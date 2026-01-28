/**
 * Built-in Skills for the TO-DONE App
 *
 * These are example skills that demonstrate the plugin architecture.
 * In a real implementation, these would have actual functionality.
 */

import type { Skill, SkillContext, SkillResult } from '../types/index.js';

/**
 * File Search Skill - searches for files in a directory
 */
export const fileSearchSkill: Skill = {
  id: 'file_search',
  name: 'File Search',
  description: 'Search for files by name or content in a directory',
  category: 'file_ops',

  inputSchema: {
    query: {
      type: 'string',
      description: 'Search query (filename or content pattern)',
      required: true,
    },
    directory: {
      type: 'string',
      description: 'Directory to search in',
      required: false,
      default: '.',
    },
    includeContent: {
      type: 'boolean',
      description: 'Whether to search file contents',
      required: false,
      default: false,
    },
  },

  examples: [
    {
      input: { query: 'W-2', directory: '~/Documents' },
      description: 'Search for W-2 tax forms in Documents folder',
      expectedOutput: 'List of matching file paths',
    },
  ],

  async execute(
    input: Record<string, unknown>,
    context: SkillContext
  ): Promise<SkillResult> {
    const query = input.query as string;
    const directory = (input.directory as string) || '.';

    // Mock implementation - in reality would use fs/glob
    console.log(`[FileSearch] Searching for "${query}" in ${directory}`);

    // Simulate finding some files
    return {
      success: true,
      output: {
        matchingFiles: [
          `${directory}/2024-W2-Employer.pdf`,
          `${directory}/2024-W2-Summary.pdf`,
        ],
        searchQuery: query,
      },
      logs: [`Searched ${directory} for pattern: ${query}`],
    };
  },
};

/**
 * Web Research Skill - searches the web for information
 */
export const webResearchSkill: Skill = {
  id: 'research',
  name: 'Web Research',
  description: 'Search the web for information on a topic',
  category: 'research',

  inputSchema: {
    query: {
      type: 'string',
      description: 'Search query',
      required: true,
    },
    maxResults: {
      type: 'number',
      description: 'Maximum number of results',
      required: false,
      default: 5,
    },
  },

  examples: [
    {
      input: { query: '5K training plan for beginners' },
      description: 'Research beginner 5K training plans',
      expectedOutput: 'Summary of training plan recommendations',
    },
  ],

  async execute(
    input: Record<string, unknown>,
    _context: SkillContext
  ): Promise<SkillResult> {
    const query = input.query as string;

    // Mock implementation
    console.log(`[WebResearch] Searching for: ${query}`);

    return {
      success: true,
      output: {
        results: [
          {
            title: `Top results for: ${query}`,
            summary: 'Found relevant information on the topic.',
            url: 'https://example.com/result1',
          },
        ],
      },
      logs: [`Performed web search: ${query}`],
    };
  },
};

/**
 * Calendar Skill - manages calendar events
 */
export const calendarSkill: Skill = {
  id: 'calendar',
  name: 'Calendar Management',
  description: 'Create, read, and manage calendar events',
  category: 'calendar',

  inputSchema: {
    action: {
      type: 'string',
      description: 'Action to perform: create, list, delete',
      required: true,
    },
    title: {
      type: 'string',
      description: 'Event title (for create)',
      required: false,
    },
    date: {
      type: 'string',
      description: 'Event date (ISO format)',
      required: false,
    },
    duration: {
      type: 'number',
      description: 'Duration in minutes',
      required: false,
      default: 60,
    },
  },

  examples: [
    {
      input: {
        action: 'create',
        title: 'Training Run',
        date: '2025-01-29T07:00:00',
        duration: 45,
      },
      description: 'Schedule a morning training run',
    },
  ],

  async execute(
    input: Record<string, unknown>,
    _context: SkillContext
  ): Promise<SkillResult> {
    const action = input.action as string;

    console.log(`[Calendar] Action: ${action}`);

    if (action === 'create') {
      return {
        success: true,
        output: {
          eventId: `evt_${Date.now()}`,
          title: input.title,
          date: input.date,
          duration: input.duration,
          status: 'created',
        },
        logs: [`Created calendar event: ${input.title}`],
      };
    }

    if (action === 'list') {
      return {
        success: true,
        output: {
          events: [
            { title: 'Sample Event', date: new Date().toISOString() },
          ],
        },
        logs: ['Listed calendar events'],
      };
    }

    return {
      success: false,
      error: `Unknown action: ${action}`,
    };
  },
};

/**
 * Note Taking Skill - creates and manages notes
 */
export const noteSkill: Skill = {
  id: 'notes',
  name: 'Note Taking',
  description: 'Create and organize notes',
  category: 'file_ops',

  inputSchema: {
    action: {
      type: 'string',
      description: 'Action: create, append, read',
      required: true,
    },
    title: {
      type: 'string',
      description: 'Note title',
      required: false,
    },
    content: {
      type: 'string',
      description: 'Note content',
      required: false,
    },
  },

  async execute(
    input: Record<string, unknown>,
    _context: SkillContext
  ): Promise<SkillResult> {
    const action = input.action as string;

    if (action === 'create') {
      return {
        success: true,
        output: {
          noteId: `note_${Date.now()}`,
          title: input.title,
          content: input.content,
          status: 'created',
        },
        logs: [`Created note: ${input.title}`],
      };
    }

    return {
      success: true,
      output: { action, status: 'completed' },
    };
  },
};

/**
 * Reminder Skill - sets reminders
 */
export const reminderSkill: Skill = {
  id: 'reminder',
  name: 'Set Reminder',
  description: 'Set a reminder for a specific time',
  category: 'automation',

  inputSchema: {
    message: {
      type: 'string',
      description: 'Reminder message',
      required: true,
    },
    time: {
      type: 'string',
      description: 'When to remind (ISO datetime or relative like "in 1 hour")',
      required: true,
    },
  },

  async execute(
    input: Record<string, unknown>,
    _context: SkillContext
  ): Promise<SkillResult> {
    return {
      success: true,
      output: {
        reminderId: `rem_${Date.now()}`,
        message: input.message,
        scheduledFor: input.time,
        status: 'scheduled',
      },
      logs: [`Set reminder: ${input.message} at ${input.time}`],
    };
  },
};

/**
 * Get all built-in skills
 */
export function getBuiltinSkills(): Skill[] {
  return [
    fileSearchSkill,
    webResearchSkill,
    calendarSkill,
    noteSkill,
    reminderSkill,
  ];
}
