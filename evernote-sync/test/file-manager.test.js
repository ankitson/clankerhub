import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { FileManager, sanitizeFilename } from '../src/file-manager.js';

const TEST_DIR = join(import.meta.dirname, '.test-output');

describe('sanitizeFilename', () => {
  it('should remove invalid characters', () => {
    assert.equal(sanitizeFilename('hello/world'), 'hello_world');
    assert.equal(sanitizeFilename('file:name'), 'file_name');
    assert.equal(sanitizeFilename('a<b>c'), 'a_b_c');
    assert.equal(sanitizeFilename('pipe|here'), 'pipe_here');
  });

  it('should collapse whitespace', () => {
    assert.equal(sanitizeFilename('hello   world'), 'hello world');
  });

  it('should handle empty string', () => {
    assert.equal(sanitizeFilename(''), 'Untitled');
  });

  it('should handle only invalid chars', () => {
    // ? is replaced with _, so '???' becomes '___'
    assert.equal(sanitizeFilename('???'), '___');
  });

  it('should truncate long names', () => {
    const long = 'a'.repeat(300);
    assert.ok(sanitizeFilename(long).length <= 200);
  });

  it('should remove trailing dots', () => {
    assert.equal(sanitizeFilename('file...'), 'file');
  });
});

describe('FileManager', () => {
  let fm;

  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    fm = new FileManager(TEST_DIR);
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('should write a note file atomically', () => {
    fm.writeNote('TestNotebook/Test Note.md', '# Hello\n');
    const content = readFileSync(join(TEST_DIR, 'TestNotebook/Test Note.md'), 'utf-8');
    assert.equal(content, '# Hello\n');
  });

  it('should write attachments', () => {
    const data = Buffer.from('fake image data');
    const relPath = fm.writeAttachment('TestNotebook', 'photo.png', data);
    assert.equal(relPath, join('TestNotebook', 'attachments', 'photo.png'));
    const written = readFileSync(join(TEST_DIR, relPath));
    assert.deepEqual(written, data);
  });

  it('should delete a note and clean empty dirs', () => {
    fm.writeNote('NB/Note.md', 'content');
    assert.ok(existsSync(join(TEST_DIR, 'NB/Note.md')));

    fm.deleteNote('NB/Note.md');
    assert.ok(!existsSync(join(TEST_DIR, 'NB/Note.md')));
    // Empty NB directory should be cleaned up
    assert.ok(!existsSync(join(TEST_DIR, 'NB')));
  });

  it('should move a note to trash when trashDir is set', () => {
    fm.writeNote('NB/Note.md', 'content');
    fm.deleteNote('NB/Note.md', { trashDir: true });
    assert.ok(!existsSync(join(TEST_DIR, 'NB/Note.md')));
    assert.ok(existsSync(join(TEST_DIR, '.trash/NB/Note.md')));
  });

  it('should move a note to a new path', () => {
    fm.writeNote('OldNB/Note.md', 'hello');
    fm.moveNote('OldNB/Note.md', 'NewNB/Note.md');
    assert.ok(!existsSync(join(TEST_DIR, 'OldNB/Note.md')));
    assert.ok(existsSync(join(TEST_DIR, 'NewNB/Note.md')));
    assert.equal(readFileSync(join(TEST_DIR, 'NewNB/Note.md'), 'utf-8'), 'hello');
  });

  it('should rename a notebook directory', () => {
    fm.writeNote('OldName/Note.md', 'data');
    fm.renameNotebookDir('OldName', 'NewName');
    assert.ok(!existsSync(join(TEST_DIR, 'OldName')));
    assert.ok(existsSync(join(TEST_DIR, 'NewName/Note.md')));
  });

  it('should build unique paths for duplicate titles', () => {
    const noteMap = {
      'guid-1': { path: join('NB', 'Title.md') },
    };

    // Same title, different GUID → should get disambiguated
    const path = fm.buildNotePath('NB', 'Title', 'guid-2222-3333', noteMap);
    assert.ok(path.includes('guid-222'));
    assert.notEqual(path, join('NB', 'Title.md'));
  });

  it('should deduplicate attachment filenames with different content', () => {
    const data1 = Buffer.from('content version 1');
    const data2 = Buffer.from('content version 2');
    const data3 = Buffer.from('content version 3');

    const path1 = fm.writeAttachment('NB', 'photo.png', data1);
    assert.equal(path1, join('NB', 'attachments', 'photo.png'));

    // Same name, different content → should get _2 suffix
    const path2 = fm.writeAttachment('NB', 'photo.png', data2);
    assert.equal(path2, join('NB', 'attachments', 'photo_2.png'));

    // Third collision → _3
    const path3 = fm.writeAttachment('NB', 'photo.png', data3);
    assert.equal(path3, join('NB', 'attachments', 'photo_3.png'));

    // Same content as data1 → should reuse original name (no suffix)
    const path4 = fm.writeAttachment('NB', 'photo.png', data1);
    assert.equal(path4, join('NB', 'attachments', 'photo.png'));
  });

  it('should compute content hash', () => {
    const hash1 = fm.contentHash('hello');
    const hash2 = fm.contentHash('hello');
    const hash3 = fm.contentHash('world');
    assert.equal(hash1, hash2);
    assert.notEqual(hash1, hash3);
    assert.ok(hash1.startsWith('sha256:'));
  });
});
