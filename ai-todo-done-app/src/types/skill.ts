/**
 * Skill System for AI TO-DONE App
 *
 * Skills are capabilities that the AI agent can use to accomplish tasks.
 * Users can plug in directories of skills and context information.
 */

/**
 * A skill/capability that the AI can use
 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;

  // Execution
  execute: SkillExecutor;

  // Metadata
  inputSchema?: Record<string, SkillInputField>;
  outputSchema?: Record<string, string>;

  // Requirements
  requiresAuth?: boolean;
  requiredEnvVars?: string[];

  // Examples for the AI to understand usage
  examples?: Array<{
    input: Record<string, unknown>;
    description: string;
    expectedOutput?: string;
  }>;
}

export type SkillCategory =
  | 'research'        // Web searches, data lookups
  | 'file_ops'        // File reading, writing
  | 'calendar'        // Calendar management
  | 'communication'   // Email, messaging
  | 'data_processing' // Spreadsheets, calculations
  | 'automation'      // Scripts, API calls
  | 'custom';         // User-defined

export interface SkillInputField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: unknown;
}

export type SkillExecutor = (
  input: Record<string, unknown>,
  context: SkillContext
) => Promise<SkillResult>;

export interface SkillContext {
  taskId: string;
  userId?: string;
  workingDirectory?: string;
  env?: Record<string, string>;
}

export interface SkillResult {
  success: boolean;
  output?: unknown;
  error?: string;
  logs?: string[];
  artifacts?: Array<{
    name: string;
    path?: string;
    content?: string;
  }>;
}

/**
 * Context information that can be provided to the AI
 */
export interface ContextInfo {
  id: string;
  name: string;
  type: 'file' | 'directory' | 'text' | 'url';
  content?: string;
  path?: string;
  description?: string;
  tags?: string[];
}

/**
 * A directory of skills and context
 */
export interface SkillDirectory {
  id: string;
  name: string;
  description?: string;
  skills: Skill[];
  contextInfo: ContextInfo[];
  createdAt: number;
  modifiedAt: number;
}

/**
 * Skill registry for managing available skills
 */
export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private directories: Map<string, SkillDirectory> = new Map();

  registerSkill(skill: Skill): void {
    this.skills.set(skill.id, skill);
  }

  unregisterSkill(skillId: string): void {
    this.skills.delete(skillId);
  }

  getSkill(skillId: string): Skill | undefined {
    return this.skills.get(skillId);
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  getSkillsByCategory(category: SkillCategory): Skill[] {
    return this.getAllSkills().filter((s) => s.category === category);
  }

  registerDirectory(directory: SkillDirectory): void {
    this.directories.set(directory.id, directory);
    for (const skill of directory.skills) {
      this.registerSkill(skill);
    }
  }

  getDirectory(directoryId: string): SkillDirectory | undefined {
    return this.directories.get(directoryId);
  }

  /**
   * Find skills that might be useful for a given task description
   */
  findRelevantSkills(taskDescription: string): Skill[] {
    const keywords = taskDescription.toLowerCase().split(/\s+/);
    return this.getAllSkills().filter((skill) => {
      const skillText =
        `${skill.name} ${skill.description}`.toLowerCase();
      return keywords.some((kw) => skillText.includes(kw));
    });
  }

  /**
   * Get a summary of available capabilities for the AI
   */
  getCapabilitySummary(): string {
    const categories = new Map<SkillCategory, string[]>();

    for (const skill of this.getAllSkills()) {
      if (!categories.has(skill.category)) {
        categories.set(skill.category, []);
      }
      categories.get(skill.category)!.push(`- ${skill.name}: ${skill.description}`);
    }

    let summary = 'Available Capabilities:\n\n';
    for (const [category, skills] of categories) {
      summary += `## ${category.toUpperCase()}\n${skills.join('\n')}\n\n`;
    }

    return summary;
  }
}
