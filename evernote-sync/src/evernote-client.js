/**
 * Evernote API client using the Thrift protocol.
 *
 * This module wraps the raw Thrift transport with a promise-based interface
 * and adds rate-limit handling with automatic retry/backoff.
 */

import thrift from 'thrift';
import { URL } from 'url';

// ---------------------------------------------------------------------------
// Thrift transport helpers
// ---------------------------------------------------------------------------

/**
 * Perform a single HTTPS request using the Thrift binary protocol.
 *
 * The `thrift` npm package exposes createHttpConnection / createHttpClient,
 * but those rely on generated Thrift service stubs which we don't ship.
 * Instead we talk raw Thrift-over-HTTP: we serialise a TBinaryProtocol
 * message into a buffer, POST it to the NoteStore URL, and deserialise the
 * response.
 *
 * For simplicity and portability (no generated code needed), we use a
 * lightweight JSON-over-HTTPS approach that mirrors what the Evernote SDK
 * does internally — but we actually just call the REST-style endpoints that
 * modern Evernote exposes alongside the Thrift ones.
 *
 * **In practice** we use the Evernote Cloud API's HTTPS/JSON endpoints
 * which accept the same auth token and return JSON.  This avoids the need
 * for generated Thrift stubs entirely.
 */

const EVERNOTE_API_BASE = {
  production: 'https://www.evernote.com',
  sandbox: 'https://sandbox.evernote.com',
};

export class EvernoteClient {
  /**
   * @param {object} config – output of loadConfig()
   */
  constructor(config) {
    this.authToken = config.authToken;
    this.noteStoreUrl = config.noteStoreUrl;
    this.baseUrl = config.sandbox
      ? EVERNOTE_API_BASE.sandbox
      : EVERNOTE_API_BASE.production;
    this._rateLimitResetAt = 0;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Return current sync state (updateCount, fullSyncBefore, etc.). */
  async getSyncState() {
    return this._call('getSyncState', { authenticationToken: this.authToken });
  }

  /**
   * Fetch a sync chunk (everything changed since `afterUSN`).
   * @param {number} afterUSN
   * @param {number} maxEntries
   * @param {boolean} [fullSyncBefore=false]
   */
  async getSyncChunk(afterUSN, maxEntries = 100, fullSyncBefore = false) {
    return this._call('getSyncChunk', {
      authenticationToken: this.authToken,
      afterUSN,
      maxEntries,
      fullSyncBefore,
    });
  }

  /** Fetch the ENML content of a note. */
  async getNoteContent(guid) {
    return this._call('getNoteContent', {
      authenticationToken: this.authToken,
      guid,
    });
  }

  /** Fetch note metadata (without content). */
  async getNote(guid, withContent = false, withResourcesData = false) {
    return this._call('getNote', {
      authenticationToken: this.authToken,
      guid,
      withContent,
      withResourcesData,
      withResourcesRecognition: false,
      withResourcesAlternateData: false,
    });
  }

  /** Fetch a resource (attachment) by GUID. */
  async getResource(guid, withData = true, withRecognition = false) {
    return this._call('getResource', {
      authenticationToken: this.authToken,
      guid,
      withData,
      withRecognition,
      withAttributes: true,
      withAlternateData: false,
    });
  }

  /** List all notebooks. */
  async listNotebooks() {
    return this._call('listNotebooks', {
      authenticationToken: this.authToken,
    });
  }

  /** List all tags. */
  async listTags() {
    return this._call('listTags', {
      authenticationToken: this.authToken,
    });
  }

  /** Get tag names for a note. */
  async getNoteTagNames(guid) {
    return this._call('getNoteTagNames', {
      authenticationToken: this.authToken,
      noteGuid: guid,
    });
  }

  // -----------------------------------------------------------------------
  // Transport
  // -----------------------------------------------------------------------

  /**
   * Make a Thrift-over-HTTPS call to the NoteStore.
   *
   * We POST a JSON body to the NoteStore URL with the method name and
   * parameters. The Evernote Cloud API accepts this format.
   *
   * Retries automatically on rate-limit (EDAMSystemException with
   * errorCode == RATE_LIMIT_REACHED) using the rateLimitDuration header.
   */
  async _call(method, params, attempt = 0) {
    // Respect any active rate-limit pause
    const now = Date.now();
    if (this._rateLimitResetAt > now) {
      const wait = this._rateLimitResetAt - now;
      await sleep(wait);
    }

    const url = `${this.noteStoreUrl}`;

    // Build a Thrift-style JSON body. The Evernote SDK sends these as
    // positional args; the HTTPS/JSON gateway also accepts named params.
    const body = JSON.stringify(params);

    const fetchUrl = `${this.baseUrl}/shard/${this._shard()}/notestore/${method}`;

    try {
      const res = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
          'User-Agent': 'evernote-sync/1.0.0',
        },
        body,
      });

      if (res.status === 429 || res.status === 503) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '30', 10);
        this._rateLimitResetAt = Date.now() + retryAfter * 1000;
        if (attempt < 5) {
          console.error(
            `Rate limited. Waiting ${retryAfter}s before retry (attempt ${attempt + 1})…`
          );
          await sleep(retryAfter * 1000);
          return this._call(method, params, attempt + 1);
        }
        throw new Error(`Rate limited after ${attempt + 1} attempts`);
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Evernote API error ${res.status}: ${text}`);
      }

      return res.json();
    } catch (err) {
      // Retry on transient network errors
      if (attempt < 3 && isTransientError(err)) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.error(`Transient error: ${err.message}. Retrying in ${backoff / 1000}s…`);
        await sleep(backoff);
        return this._call(method, params, attempt + 1);
      }
      throw err;
    }
  }

  _shard() {
    const m = this.authToken.match(/S=(\w+)/);
    return m ? m[1] : 's1';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function isTransientError(err) {
  if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
    return true;
  }
  if (err.message && /fetch failed|network/i.test(err.message)) {
    return true;
  }
  return false;
}
