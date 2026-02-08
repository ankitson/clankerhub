/**
 * File manager – handles writing markdown files, attachments,
 * directory management, and filename sanitisation.
 *
 * All file writes are atomic (write to temp → rename) to avoid
 * partial files if the process is interrupted.
 */

import {
  writeFileSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  existsSync,
  readdirSync,
  rmdirSync,
  statSync,
} from 'fs';
import { join, dirname, basename, extname } from 'path';
import { randomBytes, createHash } from 'crypto';

/**
 * Characters that are invalid in filenames across major OSes.
 */
const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

/**
 * Sanitise a string for use as a filename.
 * Replaces invalid characters, trims dots/spaces, and caps length.
 */
export function sanitizeFilename(name, maxLength = 200) {
  let safe = name
    .replace(INVALID_CHARS, '_')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove trailing dots and spaces (Windows restriction)
  safe = safe.replace(/[. ]+$/, '');

  if (!safe) safe = 'Untitled';

  // Truncate but preserve extension if present
  if (safe.length > maxLength) {
    safe = safe.slice(0, maxLength).trim();
  }

  return safe;
}

export class FileManager {
  /**
   * @param {string} outputDir – root mirror directory
   */
  constructor(outputDir) {
    this.outputDir = outputDir;
  }

  /**
   * Write a markdown note to disk (atomic).
   *
   * @param {string} relativePath – e.g. "Notebook A/My Note.md"
   * @param {string} content      – full markdown content (with frontmatter)
   * @returns {string} the absolute path written
   */
  writeNote(relativePath, content) {
    const absPath = join(this.outputDir, relativePath);
    this._atomicWrite(absPath, content);
    return absPath;
  }

  /**
   * Write an attachment to disk (atomic, binary).
   *
   * @param {string} notebookDir  – notebook folder name
   * @param {string} filename     – sanitised filename
   * @param {Buffer} data         – binary content
   * @returns {string} relative path from output dir
   */
  writeAttachment(notebookDir, filename, data) {
    const relPath = join(notebookDir, 'attachments', filename);
    const absPath = join(this.outputDir, relPath);
    this._atomicWriteBinary(absPath, data);
    return relPath;
  }

  /**
   * Delete a note file and clean up empty directories.
   *
   * @param {string} relativePath
   * @param {object} [options]
   * @param {string} [options.trashDir] – if set, move to trash instead of deleting
   */
  deleteNote(relativePath, options = {}) {
    const absPath = join(this.outputDir, relativePath);
    if (!existsSync(absPath)) return;

    if (options.trashDir) {
      const trashPath = join(this.outputDir, '.trash', relativePath);
      mkdirSync(dirname(trashPath), { recursive: true });
      renameSync(absPath, trashPath);
    } else {
      unlinkSync(absPath);
    }

    // Clean up empty parent directories
    this._cleanEmptyDirs(dirname(absPath));
  }

  /**
   * Delete an entire notebook directory.
   *
   * @param {string} notebookName
   * @param {object} [options]
   * @param {string} [options.trashDir]
   */
  deleteNotebookDir(notebookName, options = {}) {
    const dirPath = join(this.outputDir, notebookName);
    if (!existsSync(dirPath)) return;

    if (options.trashDir) {
      const trashPath = join(this.outputDir, '.trash', notebookName);
      mkdirSync(dirname(trashPath), { recursive: true });
      renameSync(dirPath, trashPath);
    } else {
      this._rmRecursive(dirPath);
    }
  }

  /**
   * Rename / move a note file.
   *
   * @param {string} oldRelPath
   * @param {string} newRelPath
   */
  moveNote(oldRelPath, newRelPath) {
    const oldAbs = join(this.outputDir, oldRelPath);
    const newAbs = join(this.outputDir, newRelPath);

    if (!existsSync(oldAbs)) return;

    mkdirSync(dirname(newAbs), { recursive: true });
    renameSync(oldAbs, newAbs);
    this._cleanEmptyDirs(dirname(oldAbs));
  }

  /**
   * Rename a notebook directory.
   *
   * @param {string} oldName
   * @param {string} newName
   */
  renameNotebookDir(oldName, newName) {
    const oldDir = join(this.outputDir, oldName);
    const newDir = join(this.outputDir, newName);

    if (!existsSync(oldDir)) return;
    if (oldDir === newDir) return;

    mkdirSync(dirname(newDir), { recursive: true });
    renameSync(oldDir, newDir);
  }

  /**
   * Build a unique relative path for a note, handling duplicate titles.
   *
   * @param {string} notebookName
   * @param {string} title
   * @param {string} guid
   * @param {Object<string,{path:string}>} noteMap – existing note map
   * @returns {string} relative path like "Notebook/Title.md"
   */
  buildNotePath(notebookName, title, guid, noteMap) {
    const safeName = sanitizeFilename(title);
    const baseDir = sanitizeFilename(notebookName);
    let relPath = join(baseDir, `${safeName}.md`);

    // Check for duplicate titles (different GUID, same path)
    const existingGuid = Object.entries(noteMap).find(
      ([g, entry]) => g !== guid && entry.path === relPath
    );

    if (existingGuid) {
      // Append short GUID suffix to disambiguate
      const shortGuid = guid.slice(0, 8);
      relPath = join(baseDir, `${safeName} (${shortGuid}).md`);
    }

    return relPath;
  }

  /**
   * Compute SHA-256 content hash of a string.
   */
  contentHash(content) {
    return 'sha256:' + createHash('sha256').update(content, 'utf-8').digest('hex');
  }

  // ── Private helpers ────────────────────────────────────────────────

  _atomicWrite(absPath, content) {
    mkdirSync(dirname(absPath), { recursive: true });
    const tmp = absPath + '.' + randomBytes(4).toString('hex') + '.tmp';
    writeFileSync(tmp, content, 'utf-8');
    renameSync(tmp, absPath);
  }

  _atomicWriteBinary(absPath, data) {
    mkdirSync(dirname(absPath), { recursive: true });
    const tmp = absPath + '.' + randomBytes(4).toString('hex') + '.tmp';
    writeFileSync(tmp, data);
    renameSync(tmp, absPath);
  }

  _cleanEmptyDirs(dirPath) {
    // Don't clean above the output directory
    if (!dirPath.startsWith(this.outputDir) || dirPath === this.outputDir) return;
    try {
      const entries = readdirSync(dirPath);
      if (entries.length === 0) {
        rmdirSync(dirPath);
        this._cleanEmptyDirs(dirname(dirPath));
      }
    } catch {
      // directory may not exist; ignore
    }
  }

  _rmRecursive(dirPath) {
    if (!existsSync(dirPath)) return;
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        this._rmRecursive(full);
      } else {
        unlinkSync(full);
      }
    }
    rmdirSync(dirPath);
  }
}
