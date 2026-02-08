/**
 * Sync state persistence.
 *
 * Stores the last-synced USN, note→file mappings, and notebook GUID→name
 * mappings in a JSON file (.sync-state.json) inside the output directory.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { randomBytes } from 'crypto';

const STATE_FILE = '.sync-state.json';

/**
 * @typedef {object} NoteEntry
 * @property {string} path       – relative path within the output dir
 * @property {string} contentHash – SHA-256 of the rendered markdown
 * @property {string} updated    – ISO 8601 timestamp
 */

/**
 * @typedef {object} SyncState
 * @property {number} lastSyncUSN
 * @property {string} lastSyncTime
 * @property {Object<string, NoteEntry>} noteMap    – keyed by note GUID
 * @property {Object<string, string>}    notebookMap – notebook GUID → name
 */

const EMPTY_STATE = {
  lastSyncUSN: 0,
  lastSyncTime: null,
  noteMap: {},
  notebookMap: {},
};

export class SyncStateStore {
  /**
   * @param {string} outputDir – the root mirror directory
   */
  constructor(outputDir) {
    this.outputDir = outputDir;
    this.filePath = join(outputDir, STATE_FILE);
    /** @type {SyncState} */
    this.state = null;
  }

  /** Load state from disk, or create a blank state. */
  load() {
    if (existsSync(this.filePath)) {
      try {
        const raw = readFileSync(this.filePath, 'utf-8');
        this.state = JSON.parse(raw);
      } catch (err) {
        console.error(`Warning: could not parse ${this.filePath}: ${err.message}. Starting fresh.`);
        this.state = { ...EMPTY_STATE };
      }
    } else {
      this.state = { ...EMPTY_STATE, noteMap: {}, notebookMap: {} };
    }
    return this.state;
  }

  /** Persist state to disk using atomic write (write tmp → rename). */
  save() {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tmp = this.filePath + '.' + randomBytes(4).toString('hex') + '.tmp';
    writeFileSync(tmp, JSON.stringify(this.state, null, 2) + '\n', 'utf-8');
    renameSync(tmp, this.filePath);
  }

  /** Update the USN watermark and timestamp. */
  updateUSN(usn) {
    this.state.lastSyncUSN = usn;
    this.state.lastSyncTime = new Date().toISOString();
  }

  /** Record / update a note entry. */
  setNote(guid, entry) {
    this.state.noteMap[guid] = entry;
  }

  /** Remove a note entry. */
  removeNote(guid) {
    delete this.state.noteMap[guid];
  }

  /** Get a note entry by GUID. */
  getNote(guid) {
    return this.state.noteMap[guid] || null;
  }

  /** Update notebook GUID → name mapping. */
  setNotebook(guid, name) {
    this.state.notebookMap[guid] = name;
  }

  /** Remove notebook mapping. */
  removeNotebook(guid) {
    delete this.state.notebookMap[guid];
  }

  /** Resolve a notebook GUID to its name (or "Unknown Notebook"). */
  notebookName(guid) {
    return this.state.notebookMap[guid] || 'Unknown Notebook';
  }

  /** Reset state for a full re-sync. */
  reset() {
    this.state = { ...EMPTY_STATE, noteMap: {}, notebookMap: {} };
  }
}
