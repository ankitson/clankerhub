/**
 * Sync engine – orchestrates the full and incremental sync process.
 *
 * Flow:
 * 1. Load sync state from disk.
 * 2. Fetch current sync state from Evernote (updateCount).
 * 3. Fetch sync chunks (everything changed since lastSyncUSN).
 * 4. Process each chunk:
 *    a. Update notebook map (new/renamed notebooks).
 *    b. Process changed notes (fetch content, convert to MD, write to disk).
 *    c. Process changed resources (download attachments).
 *    d. Handle deletions (expunged notes/notebooks).
 * 5. Save updated sync state.
 */

import { createConverter, buildFrontmatter } from './enml-converter.js';
import { SyncStateStore } from './sync-state.js';
import { FileManager, sanitizeFilename } from './file-manager.js';
import { createHash } from 'crypto';

export class SyncEngine {
  /**
   * @param {import('./evernote-client.js').EvernoteClient} client
   * @param {import('./config.js').loadConfig} config
   */
  constructor(client, config) {
    this.client = client;
    this.config = config;
    this.store = new SyncStateStore(config.outputDir);
    this.files = new FileManager(config.outputDir);
    this.stats = { notes: 0, attachments: 0, deleted: 0, errors: 0 };
  }

  /**
   * Run a full sync (ignore stored USN, re-download everything).
   */
  async fullSync() {
    console.log('Starting full sync…');
    this.store.load();
    this.store.reset();
    return this._sync(true);
  }

  /**
   * Run an incremental sync (from stored USN).
   */
  async incrementalSync() {
    console.log('Starting incremental sync…');
    this.store.load();
    return this._sync(false);
  }

  // ── Core sync logic ───────────────────────────────────────────────

  async _sync(isFull) {
    this.stats = { notes: 0, attachments: 0, deleted: 0, errors: 0 };
    const startTime = Date.now();

    // 1. Get current server state
    const serverState = await this.client.getSyncState();
    const serverUSN = serverState.updateCount;

    console.log(`Server USN: ${serverUSN}, Local USN: ${this.store.state.lastSyncUSN}`);

    if (!isFull && this.store.state.lastSyncUSN >= serverUSN) {
      console.log('Already up to date.');
      return this.stats;
    }

    // 2. Pre-fetch notebook list for name resolution
    await this._refreshNotebooks();

    // 3. Fetch and process sync chunks
    let afterUSN = isFull ? 0 : this.store.state.lastSyncUSN;
    let chunkCount = 0;

    while (afterUSN < serverUSN) {
      chunkCount++;
      console.log(`Fetching chunk ${chunkCount} (afterUSN=${afterUSN})…`);

      const chunk = await this.client.getSyncChunk(afterUSN, 100, isFull);

      // Process notebooks (may appear in chunks)
      if (chunk.notebooks && chunk.notebooks.length) {
        await this._processNotebooks(chunk.notebooks);
      }

      // Process notes
      if (chunk.notes && chunk.notes.length) {
        await this._processNotes(chunk.notes);
      }

      // Process resources (attachments updated independently)
      if (chunk.resources && chunk.resources.length) {
        await this._processResources(chunk.resources);
      }

      // Handle deletions
      if (chunk.expungedNotes && chunk.expungedNotes.length) {
        this._handleExpungedNotes(chunk.expungedNotes);
      }
      if (chunk.expungedNotebooks && chunk.expungedNotebooks.length) {
        this._handleExpungedNotebooks(chunk.expungedNotebooks);
      }

      // Advance watermark
      const chunkUSN = chunk.chunkHighUSN || chunk.updateCount || serverUSN;
      afterUSN = chunkUSN;
      this.store.updateUSN(afterUSN);
      this.store.save();

      // If chunk says we're done
      if (chunkUSN >= serverUSN) break;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `Sync complete in ${elapsed}s. ` +
      `Notes: ${this.stats.notes}, Attachments: ${this.stats.attachments}, ` +
      `Deleted: ${this.stats.deleted}, Errors: ${this.stats.errors}`
    );

    return this.stats;
  }

  // ── Notebooks ─────────────────────────────────────────────────────

  async _refreshNotebooks() {
    try {
      const notebooks = await this.client.listNotebooks();
      if (Array.isArray(notebooks)) {
        for (const nb of notebooks) {
          const oldName = this.store.state.notebookMap[nb.guid];
          const newName = nb.name;

          if (oldName && oldName !== newName) {
            // Notebook was renamed — rename directory
            console.log(`Notebook renamed: "${oldName}" → "${newName}"`);
            this.files.renameNotebookDir(
              sanitizeFilename(oldName),
              sanitizeFilename(newName)
            );
            // Update paths in noteMap
            this._updateNotePathsForRename(oldName, newName);
          }

          this.store.setNotebook(nb.guid, newName);
        }
      }
    } catch (err) {
      console.error(`Warning: could not list notebooks: ${err.message}`);
    }
  }

  async _processNotebooks(notebooks) {
    for (const nb of notebooks) {
      const oldName = this.store.state.notebookMap[nb.guid];
      const newName = nb.name;

      if (oldName && oldName !== newName) {
        console.log(`Notebook renamed: "${oldName}" → "${newName}"`);
        this.files.renameNotebookDir(
          sanitizeFilename(oldName),
          sanitizeFilename(newName)
        );
        this._updateNotePathsForRename(oldName, newName);
      }

      this.store.setNotebook(nb.guid, newName);
    }
  }

  _updateNotePathsForRename(oldName, newName) {
    const oldDir = sanitizeFilename(oldName);
    const newDir = sanitizeFilename(newName);
    for (const [guid, entry] of Object.entries(this.store.state.noteMap)) {
      if (entry.path.startsWith(oldDir + '/')) {
        entry.path = newDir + entry.path.slice(oldDir.length);
      }
    }
  }

  // ── Notes ─────────────────────────────────────────────────────────

  async _processNotes(notes) {
    // Apply notebook include/exclude filters
    const filtered = this._filterNotes(notes);

    for (const noteMeta of filtered) {
      try {
        await this._processOneNote(noteMeta);
        this.stats.notes++;
      } catch (err) {
        console.error(`Error processing note ${noteMeta.guid}: ${err.message}`);
        this.stats.errors++;
      }
    }
  }

  async _processOneNote(noteMeta) {
    const guid = noteMeta.guid;
    const title = noteMeta.title || 'Untitled';
    const notebookGuid = noteMeta.notebookGuid;
    const notebookName = this.store.notebookName(notebookGuid);

    // Build the resource map for this note's attachments.
    // For audio resources (voice notes), also fetch recognition data
    // which may contain auto-generated transcripts.
    const resourceMap = new Map();
    if (noteMeta.resources && noteMeta.resources.length) {
      for (const res of noteMeta.resources) {
        const hash = res.data && res.data.bodyHash
          ? bufferToHex(res.data.bodyHash)
          : null;
        if (hash) {
          const filename = resolveResourceFilename(res);
          const mime = res.mime || '';
          const entry = { filename, mime };

          // For audio resources, try to fetch transcript from recognition data
          if (mime.startsWith('audio/')) {
            entry.transcript = await this._fetchTranscript(res);
          }

          resourceMap.set(hash, entry);
        }
      }
    }

    // Fetch full note content
    const enml = await this.client.getNoteContent(guid);
    const enmlBody = typeof enml === 'string' ? enml : enml.content || enml;

    // Fetch tags
    let tags = [];
    try {
      const tagResult = await this.client.getNoteTagNames(guid);
      if (Array.isArray(tagResult)) tags = tagResult;
    } catch {
      // tags are optional — ignore failures
    }

    // Convert ENML → Markdown
    const converter = createConverter({ resourceMap });
    const mdBody = converter.convert(enmlBody);

    // Build frontmatter
    const created = noteMeta.created
      ? new Date(noteMeta.created).toISOString()
      : new Date().toISOString();
    const updated = noteMeta.updated
      ? new Date(noteMeta.updated).toISOString()
      : created;

    const frontmatter = buildFrontmatter({
      title,
      created,
      updated,
      tags,
      sourceUrl: noteMeta.attributes?.sourceURL || '',
      guid,
    });

    const fullContent = frontmatter + '\n\n' + mdBody + '\n';
    const hash = this.files.contentHash(fullContent);

    // Determine file path
    const newPath = this.files.buildNotePath(
      notebookName,
      title,
      guid,
      this.store.state.noteMap
    );

    // Check if note moved or renamed
    const existing = this.store.getNote(guid);
    if (existing && existing.path !== newPath) {
      console.log(`Note moved/renamed: "${existing.path}" → "${newPath}"`);
      this.files.moveNote(existing.path, newPath);
    }

    // Skip write if content unchanged
    if (existing && existing.contentHash === hash && existing.path === newPath) {
      return;
    }

    // Write the note
    this.files.writeNote(newPath, fullContent);
    console.log(`  ✓ ${newPath}`);

    // Download attachments
    if (noteMeta.resources && noteMeta.resources.length) {
      await this._downloadResources(noteMeta.resources, notebookName);
    }

    // Update state
    this.store.setNote(guid, {
      path: newPath,
      contentHash: hash,
      updated,
    });
  }

  _filterNotes(notes) {
    const { includeNotebooks, excludeNotebooks } = this.config;
    if (!includeNotebooks.length && !excludeNotebooks.length) return notes;

    return notes.filter(note => {
      const nbName = this.store.notebookName(note.notebookGuid);
      if (includeNotebooks.length && !includeNotebooks.includes(nbName)) return false;
      if (excludeNotebooks.includes(nbName)) return false;
      return true;
    });
  }

  // ── Resources / Attachments ───────────────────────────────────────

  async _processResources(resources) {
    for (const res of resources) {
      try {
        // Find which note this resource belongs to
        const noteGuid = res.noteGuid;
        if (!noteGuid) continue;

        const noteEntry = this.store.getNote(noteGuid);
        if (!noteEntry) continue; // note not synced yet; it will be handled when the note syncs

        // Determine notebook from path
        const notebookDir = noteEntry.path.split('/')[0];
        await this._downloadOneResource(res, notebookDir);
        this.stats.attachments++;
      } catch (err) {
        console.error(`Error processing resource ${res.guid}: ${err.message}`);
        this.stats.errors++;
      }
    }
  }

  async _downloadResources(resources, notebookName) {
    for (const res of resources) {
      try {
        await this._downloadOneResource(res, sanitizeFilename(notebookName));
        this.stats.attachments++;
      } catch (err) {
        console.error(`Error downloading resource ${res.guid}: ${err.message}`);
        this.stats.errors++;
      }
    }
  }

  async _downloadOneResource(resMeta, notebookDir) {
    const isAudio = (resMeta.mime || '').startsWith('audio/');
    const fullResource = await this.client.getResource(resMeta.guid, true, isAudio);
    const data = fullResource.data?.body;
    if (!data) return;

    const filename = resolveResourceFilename(resMeta);
    const buf = typeof data === 'string' ? Buffer.from(data, 'base64') : Buffer.from(data);
    this.files.writeAttachment(notebookDir, filename, buf);

    // For audio resources, also save transcript as a sidecar .txt file
    if (isAudio && fullResource.recognition?.body) {
      const transcript = parseRecognitionXml(fullResource.recognition.body);
      if (transcript) {
        const txtFilename = filename.replace(/\.[^.]+$/, '') + '_transcript.txt';
        this.files.writeAttachment(
          notebookDir,
          txtFilename,
          Buffer.from(transcript, 'utf-8')
        );
      }
    }
  }

  /**
   * Fetch transcript text for an audio resource.
   * Evernote stores auto-generated transcripts in the resource's
   * recognition XML (<t> tags within <item> elements).
   *
   * @param {object} resMeta – resource metadata from sync chunk
   * @returns {Promise<string|null>} transcript text or null
   */
  async _fetchTranscript(resMeta) {
    try {
      // Fetch resource with recognition data
      const fullRes = await this.client.getResource(resMeta.guid, false, true);
      if (fullRes.recognition?.body) {
        return parseRecognitionXml(fullRes.recognition.body);
      }
      // Also check alternateData which sometimes holds transcripts
      if (fullRes.alternateData?.body) {
        const text = typeof fullRes.alternateData.body === 'string'
          ? fullRes.alternateData.body
          : Buffer.from(fullRes.alternateData.body).toString('utf-8');
        if (text.trim()) return text.trim();
      }
    } catch {
      // Transcript is optional; don't fail the note
    }
    return null;
  }

  // ── Deletions ─────────────────────────────────────────────────────

  _handleExpungedNotes(guids) {
    const trashOpts = this.config.trashDir ? { trashDir: true } : {};

    for (const guid of guids) {
      const entry = this.store.getNote(guid);
      if (entry) {
        console.log(`  ✗ Deleted: ${entry.path}`);
        this.files.deleteNote(entry.path, trashOpts);
        this.store.removeNote(guid);
        this.stats.deleted++;
      }
    }
  }

  _handleExpungedNotebooks(guids) {
    const trashOpts = this.config.trashDir ? { trashDir: true } : {};

    for (const guid of guids) {
      const name = this.store.notebookName(guid);
      if (name) {
        console.log(`  ✗ Deleted notebook: ${name}`);
        this.files.deleteNotebookDir(sanitizeFilename(name), trashOpts);

        // Remove all notes in this notebook from the state
        for (const [noteGuid, entry] of Object.entries(this.store.state.noteMap)) {
          if (entry.path.startsWith(sanitizeFilename(name) + '/')) {
            this.store.removeNote(noteGuid);
          }
        }

        this.store.removeNotebook(guid);
        this.stats.deleted++;
      }
    }
  }
}

// ── Utility functions ─────────────────────────────────────────────────

/**
 * Convert a Buffer or byte array to hex string.
 */
function bufferToHex(buf) {
  if (Buffer.isBuffer(buf)) return buf.toString('hex');
  if (buf instanceof Uint8Array) return Buffer.from(buf).toString('hex');
  if (typeof buf === 'string') return buf; // already hex
  return '';
}

/**
 * Parse Evernote recognition XML to extract transcript text.
 *
 * Evernote auto-generated transcripts for voice notes are stored in
 * recognition XML with this structure:
 *   <recoIndex ...>
 *     <item ...><t>transcript text</t></item>
 *     ...
 *   </recoIndex>
 *
 * We extract all <t> tag contents and join them.
 */
function parseRecognitionXml(xmlOrBuf) {
  const xml = typeof xmlOrBuf === 'string'
    ? xmlOrBuf
    : Buffer.from(xmlOrBuf).toString('utf-8');

  // Extract all <t>...</t> tag contents
  const matches = [...xml.matchAll(/<t[^>]*>([^<]*)<\/t>/gi)];
  if (matches.length === 0) return null;

  const text = matches.map(m => m[1].trim()).filter(Boolean).join(' ');
  return text || null;
}

/**
 * Determine a filename for a resource.
 */
function resolveResourceFilename(res) {
  // Prefer the original filename from attributes
  if (res.attributes?.fileName) {
    return sanitizeFilename(res.attributes.fileName);
  }

  // Fall back to GUID + extension from MIME
  const ext = mimeToExt(res.mime || 'application/octet-stream');
  return `${res.guid}${ext}`;
}

/**
 * Map common MIME types to file extensions.
 */
function mimeToExt(mime) {
  const map = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/x-m4a': '.m4a',
    'audio/mp4': '.m4a',
    'audio/aac': '.aac',
    'audio/amr': '.amr',
    'audio/ogg': '.ogg',
    'audio/webm': '.weba',
    'video/mp4': '.mp4',
    'text/plain': '.txt',
    'text/html': '.html',
    'text/csv': '.csv',
    'application/json': '.json',
    'application/xml': '.xml',
    'application/zip': '.zip',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  };
  return map[mime] || '.bin';
}
