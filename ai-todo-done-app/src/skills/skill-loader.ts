/**
 * Skill Loader - loads skills from directories
 *
 * This allows users to plug in custom skill directories.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Skill, SkillDirectory, ContextInfo } from '../types/index.js';
import { getBuiltinSkills } from './builtin-skills.js';

/**
 * Load a skill directory from disk
 */
export async function loadSkillDirectory(
  directoryPath: string
): Promise<SkillDirectory | null> {
  try {
    const absolutePath = path.resolve(directoryPath);

    if (!fs.existsSync(absolutePath)) {
      console.error(`Skill directory not found: ${absolutePath}`);
      return null;
    }

    const manifestPath = path.join(absolutePath, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
      console.warn(`No manifest.json found in ${absolutePath}, scanning files...`);
      return scanDirectoryForSkills(absolutePath);
    }

    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    const skills: Skill[] = [];
    const contextInfo: ContextInfo[] = [];

    // Load skills defined in manifest
    if (manifest.skills) {
      for (const skillDef of manifest.skills) {
        const skillPath = path.join(absolutePath, skillDef.file);
        if (fs.existsSync(skillPath)) {
          try {
            // Dynamic import of skill module
            const skillModule = await import(skillPath);
            if (skillModule.default) {
              skills.push(skillModule.default);
            }
          } catch (err) {
            console.error(`Failed to load skill from ${skillPath}:`, err);
          }
        }
      }
    }

    // Load context files
    if (manifest.context) {
      for (const contextDef of manifest.context) {
        const ctxPath = path.join(absolutePath, contextDef.file);
        if (fs.existsSync(ctxPath)) {
          const content = fs.readFileSync(ctxPath, 'utf-8');
          contextInfo.push({
            id: contextDef.id || path.basename(ctxPath),
            name: contextDef.name || path.basename(ctxPath),
            type: 'file',
            path: ctxPath,
            content,
            description: contextDef.description,
            tags: contextDef.tags || [],
          });
        }
      }
    }

    return {
      id: manifest.id || path.basename(absolutePath),
      name: manifest.name || path.basename(absolutePath),
      description: manifest.description,
      skills,
      contextInfo,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
  } catch (error) {
    console.error(`Error loading skill directory ${directoryPath}:`, error);
    return null;
  }
}

/**
 * Scan a directory for skill-like files and context
 */
async function scanDirectoryForSkills(
  directoryPath: string
): Promise<SkillDirectory> {
  const contextInfo: ContextInfo[] = [];

  const files = fs.readdirSync(directoryPath);

  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isFile()) {
      const ext = path.extname(file).toLowerCase();

      // Load text-based files as context
      if (['.txt', '.md', '.json', '.yaml', '.yml'].includes(ext)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        contextInfo.push({
          id: file,
          name: file,
          type: 'file',
          path: filePath,
          content,
          tags: [ext.slice(1)],
        });
      }
    }
  }

  return {
    id: path.basename(directoryPath),
    name: path.basename(directoryPath),
    description: `Auto-scanned directory: ${directoryPath}`,
    skills: [],
    contextInfo,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };
}

/**
 * Create a skill directory with builtin skills
 */
export function createBuiltinDirectory(): SkillDirectory {
  return {
    id: 'builtin',
    name: 'Built-in Skills',
    description: 'Default skills that come with TO-DONE',
    skills: getBuiltinSkills(),
    contextInfo: [],
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };
}

/**
 * Example manifest.json structure:
 *
 * {
 *   "id": "my-skills",
 *   "name": "My Custom Skills",
 *   "description": "Personal automation skills",
 *   "skills": [
 *     { "file": "email-skill.js", "id": "email" }
 *   ],
 *   "context": [
 *     {
 *       "file": "preferences.md",
 *       "id": "prefs",
 *       "name": "User Preferences",
 *       "description": "My personal preferences and constraints",
 *       "tags": ["personal", "preferences"]
 *     }
 *   ]
 * }
 */
