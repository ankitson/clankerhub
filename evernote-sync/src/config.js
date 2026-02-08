/**
 * Configuration management for Evernote Sync.
 * Loads from environment variables (with optional .env file support).
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

export function loadConfig(envPath) {
  if (envPath) {
    dotenvConfig({ path: resolve(envPath) });
  } else {
    dotenvConfig();
  }

  const authToken = process.env.EVERNOTE_AUTH_TOKEN;
  if (!authToken) {
    throw new Error(
      'EVERNOTE_AUTH_TOKEN is required. Set it in your environment or .env file.'
    );
  }

  const sandbox = (process.env.EVERNOTE_SANDBOX || 'false').toLowerCase() === 'true';
  const serviceHost = sandbox
    ? 'sandbox.evernote.com'
    : 'www.evernote.com';

  return {
    authToken,
    sandbox,
    serviceHost,
    noteStoreUrl: `https://${serviceHost}/shard/${extractShard(authToken)}/notestore`,
    outputDir: resolve(process.env.SYNC_OUTPUT_DIR || './evernote-mirror'),
    syncInterval: parseInt(process.env.SYNC_INTERVAL || '300', 10),
    includeNotebooks: parseList(process.env.SYNC_INCLUDE_NOTEBOOKS),
    excludeNotebooks: parseList(process.env.SYNC_EXCLUDE_NOTEBOOKS || 'Trash'),
    trashDir: (process.env.SYNC_TRASH_DIR || '').toLowerCase() === 'true',
    trashRetentionDays: parseInt(process.env.SYNC_TRASH_RETENTION_DAYS || '30', 10),
  };
}

/**
 * Extract shard ID from an Evernote auth token.
 * Token format: S=s1:U=...:E=...:C=...:P=...:A=...:V=...:H=...
 * The shard is the value after S= (e.g., "s1").
 */
function extractShard(token) {
  const match = token.match(/S=(\w+)/);
  if (!match) {
    throw new Error('Could not extract shard from auth token. Token format may be invalid.');
  }
  return match[1];
}

function parseList(value) {
  if (!value || !value.trim()) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}
