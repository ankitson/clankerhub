/**
 * Task Store - simple in-memory and file-based persistence
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Task } from '../types/index.js';

export interface TaskStoreConfig {
  persistPath?: string;
  autoSave?: boolean;
}

export class TaskStore {
  private tasks: Map<string, Task> = new Map();
  private config: TaskStoreConfig;

  constructor(config: TaskStoreConfig = {}) {
    this.config = {
      autoSave: true,
      ...config,
    };

    if (this.config.persistPath) {
      this.load();
    }
  }

  /**
   * Add or update a task
   */
  save(task: Task): void {
    this.tasks.set(task.id, task);
    if (this.config.autoSave && this.config.persistPath) {
      this.persist();
    }
  }

  /**
   * Get a task by ID
   */
  get(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAll(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by status
   */
  getByStatus(status: Task['status']): Task[] {
    return this.getAll().filter((t) => t.status === status);
  }

  /**
   * Get active tasks (not completed)
   */
  getActive(): Task[] {
    return this.getAll().filter((t) => t.status !== 'completed');
  }

  /**
   * Delete a task
   */
  delete(taskId: string): boolean {
    const deleted = this.tasks.delete(taskId);
    if (deleted && this.config.autoSave && this.config.persistPath) {
      this.persist();
    }
    return deleted;
  }

  /**
   * Search tasks by title/description
   */
  search(query: string): Task[] {
    const queryLower = query.toLowerCase();
    return this.getAll().filter(
      (t) =>
        t.title.toLowerCase().includes(queryLower) ||
        t.description?.toLowerCase().includes(queryLower)
    );
  }

  /**
   * Get tasks by tag
   */
  getByTag(tag: string): Task[] {
    return this.getAll().filter((t) => t.tags.includes(tag));
  }

  /**
   * Persist to disk
   */
  private persist(): void {
    if (!this.config.persistPath) return;

    try {
      const data = JSON.stringify(
        {
          version: 1,
          tasks: Array.from(this.tasks.values()),
          savedAt: Date.now(),
        },
        null,
        2
      );

      const dir = path.dirname(this.config.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.config.persistPath, data, 'utf-8');
    } catch (error) {
      console.error('Failed to persist tasks:', error);
    }
  }

  /**
   * Load from disk
   */
  private load(): void {
    if (!this.config.persistPath) return;

    try {
      if (!fs.existsSync(this.config.persistPath)) {
        return;
      }

      const data = fs.readFileSync(this.config.persistPath, 'utf-8');
      const parsed = JSON.parse(data);

      if (parsed.tasks && Array.isArray(parsed.tasks)) {
        for (const task of parsed.tasks) {
          this.tasks.set(task.id, task);
        }
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  }

  /**
   * Export all data
   */
  export(): string {
    return JSON.stringify(
      {
        version: 1,
        tasks: Array.from(this.tasks.values()),
        exportedAt: Date.now(),
      },
      null,
      2
    );
  }

  /**
   * Import data
   */
  import(data: string): number {
    const parsed = JSON.parse(data);
    let imported = 0;

    if (parsed.tasks && Array.isArray(parsed.tasks)) {
      for (const task of parsed.tasks) {
        this.tasks.set(task.id, task);
        imported++;
      }
    }

    if (this.config.autoSave && this.config.persistPath) {
      this.persist();
    }

    return imported;
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    this.tasks.clear();
    if (this.config.autoSave && this.config.persistPath) {
      this.persist();
    }
  }
}
