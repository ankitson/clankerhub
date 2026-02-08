import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { SyncStateStore } from '../src/sync-state.js';

const TEST_DIR = join(import.meta.dirname, '.test-state');

describe('SyncStateStore', () => {
  let store;

  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    store = new SyncStateStore(TEST_DIR);
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('should initialize with empty state when no file exists', () => {
    const state = store.load();
    assert.equal(state.lastSyncUSN, 0);
    assert.equal(state.lastSyncTime, null);
    assert.deepEqual(state.noteMap, {});
    assert.deepEqual(state.notebookMap, {});
  });

  it('should persist and reload state', () => {
    store.load();
    store.updateUSN(42);
    store.setNotebook('nb-1', 'My Notebook');
    store.setNote('note-1', {
      path: 'My Notebook/Note.md',
      contentHash: 'sha256:abc',
      updated: '2024-01-01T00:00:00Z',
    });
    store.save();

    // Reload from disk
    const store2 = new SyncStateStore(TEST_DIR);
    const state = store2.load();
    assert.equal(state.lastSyncUSN, 42);
    assert.ok(state.lastSyncTime);
    assert.equal(state.notebookMap['nb-1'], 'My Notebook');
    assert.equal(state.noteMap['note-1'].path, 'My Notebook/Note.md');
  });

  it('should remove note entries', () => {
    store.load();
    store.setNote('note-1', { path: 'NB/Note.md', contentHash: 'h', updated: 'u' });
    assert.ok(store.getNote('note-1'));
    store.removeNote('note-1');
    assert.equal(store.getNote('note-1'), null);
  });

  it('should remove notebook entries', () => {
    store.load();
    store.setNotebook('nb-1', 'Test');
    assert.equal(store.notebookName('nb-1'), 'Test');
    store.removeNotebook('nb-1');
    assert.equal(store.notebookName('nb-1'), 'Unknown Notebook');
  });

  it('should reset state', () => {
    store.load();
    store.updateUSN(100);
    store.setNote('n', { path: 'x', contentHash: 'h', updated: 'u' });
    store.reset();
    assert.equal(store.state.lastSyncUSN, 0);
    assert.deepEqual(store.state.noteMap, {});
  });

  it('should handle corrupted state file gracefully', async () => {
    const { writeFileSync } = await import('fs');
    writeFileSync(join(TEST_DIR, '.sync-state.json'), 'not json!!!');
    const state = store.load();
    assert.equal(state.lastSyncUSN, 0);
  });
});
