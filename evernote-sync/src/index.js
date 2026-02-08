#!/usr/bin/env node

/**
 * evernote-sync – CLI entry point.
 *
 * Usage:
 *   evernote-sync                      # incremental sync (default)
 *   evernote-sync --sync               # incremental sync (explicit)
 *   evernote-sync --full               # full re-download
 *   evernote-sync --once               # single incremental sync, then exit
 *   evernote-sync --daemon             # run sync loop every N seconds
 *   evernote-sync --daemon --interval=60
 *
 * Environment / .env:
 *   EVERNOTE_AUTH_TOKEN   (required)
 *   EVERNOTE_SANDBOX      true/false
 *   SYNC_OUTPUT_DIR       output directory (default: ./evernote-mirror)
 *   SYNC_INTERVAL         seconds between daemon cycles (default: 300)
 *   SYNC_INCLUDE_NOTEBOOKS  comma-separated list
 *   SYNC_EXCLUDE_NOTEBOOKS  comma-separated list (default: Trash)
 */

import { loadConfig } from './config.js';
import { EvernoteClient } from './evernote-client.js';
import { SyncEngine } from './sync-engine.js';

// ── CLI argument parsing ───────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    mode: 'sync',       // sync | full | daemon | once
    interval: null,     // override for SYNC_INTERVAL
    envFile: null,      // path to .env file
    help: false,
  };

  for (const arg of argv.slice(2)) {
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--full') args.mode = 'full';
    else if (arg === '--sync') args.mode = 'sync';
    else if (arg === '--once') args.mode = 'once';
    else if (arg === '--daemon') args.mode = 'daemon';
    else if (arg.startsWith('--interval=')) {
      args.interval = parseInt(arg.split('=')[1], 10);
    }
    else if (arg.startsWith('--env=')) {
      args.envFile = arg.split('=').slice(1).join('=');
    }
  }

  return args;
}

function printHelp() {
  console.log(`
evernote-sync – Mirror Evernote notes to local markdown files

USAGE
  evernote-sync [options]

OPTIONS
  --sync          Incremental sync (default)
  --full          Full re-download (ignore stored USN)
  --once          Single incremental sync, then exit
  --daemon        Run in a loop every SYNC_INTERVAL seconds
  --interval=N    Override sync interval (seconds)
  --env=PATH      Path to .env file
  --help, -h      Show this help

ENVIRONMENT VARIABLES
  EVERNOTE_AUTH_TOKEN        Evernote developer/OAuth token (required)
  EVERNOTE_SANDBOX           Use sandbox API (default: false)
  SYNC_OUTPUT_DIR            Output directory (default: ./evernote-mirror)
  SYNC_INTERVAL              Seconds between daemon syncs (default: 300)
  SYNC_INCLUDE_NOTEBOOKS     Only sync these notebooks (comma-separated)
  SYNC_EXCLUDE_NOTEBOOKS     Skip these notebooks (default: Trash)
`.trim());
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  let config;
  try {
    config = loadConfig(args.envFile);
  } catch (err) {
    console.error(`Configuration error: ${err.message}`);
    process.exit(1);
  }

  // Override interval from CLI
  if (args.interval) {
    config.syncInterval = args.interval;
  }

  const client = new EvernoteClient(config);
  const engine = new SyncEngine(client, config);

  console.log(`Output directory: ${config.outputDir}`);
  console.log(`Mode: ${args.mode}`);
  console.log(`Sandbox: ${config.sandbox}`);

  if (config.includeNotebooks.length) {
    console.log(`Include notebooks: ${config.includeNotebooks.join(', ')}`);
  }
  if (config.excludeNotebooks.length) {
    console.log(`Exclude notebooks: ${config.excludeNotebooks.join(', ')}`);
  }

  try {
    switch (args.mode) {
      case 'full':
        await engine.fullSync();
        break;

      case 'once':
      case 'sync':
        await engine.incrementalSync();
        break;

      case 'daemon':
        await runDaemon(engine, config.syncInterval);
        break;
    }
  } catch (err) {
    console.error(`Fatal error: ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

/**
 * Daemon loop: run incremental sync, sleep, repeat.
 */
async function runDaemon(engine, intervalSeconds) {
  console.log(`Daemon mode: syncing every ${intervalSeconds}s. Press Ctrl+C to stop.`);

  // Handle graceful shutdown
  let running = true;
  const shutdown = () => {
    console.log('\nShutting down…');
    running = false;
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (running) {
    try {
      await engine.incrementalSync();
    } catch (err) {
      console.error(`Sync error: ${err.message}. Will retry next cycle.`);
    }

    // Sleep in 1-second increments so we can respond to SIGINT quickly
    for (let i = 0; i < intervalSeconds && running; i++) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('Daemon stopped.');
}

main();
