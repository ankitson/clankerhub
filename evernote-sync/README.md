# evernote-sync

A background service that maintains a continuously-updated local directory of Markdown files mirroring an Evernote account. The output directory is usable as-is by LLMs, Obsidian, grep, or any file-based tool.

## Output Structure

```
evernote-mirror/
├── Notebook A/
│   ├── My First Note.md
│   ├── Meeting Notes 2024-03-15.md
│   └── attachments/
│       ├── screenshot.png
│       └── document.pdf
├── Notebook B/
│   └── ...
└── .sync-state.json
```

Each Markdown file includes YAML frontmatter:

```yaml
---
title: "My First Note"
created: 2023-06-15T10:30:00Z
updated: 2024-01-20T14:22:00Z
tags: ["project-x", "meeting"]
source_url: "https://www.evernote.com/shard/..."
evernote_guid: "abc123-def456-..."
---
```

## Setup

```bash
npm install
```

Create a `.env` file (or export environment variables):

```env
EVERNOTE_AUTH_TOKEN=S=s1:U=...        # Developer token or OAuth token
EVERNOTE_SANDBOX=false                 # true for sandbox API
SYNC_OUTPUT_DIR=./evernote-mirror      # output directory
SYNC_INTERVAL=300                      # seconds between syncs in daemon mode
SYNC_INCLUDE_NOTEBOOKS=                # comma-separated (empty = all)
SYNC_EXCLUDE_NOTEBOOKS=Trash           # notebooks to skip
```

## Usage

```bash
# Incremental sync (default)
npm start
# or
node src/index.js --sync

# Full re-download (ignore stored sync position)
node src/index.js --full

# Single sync and exit (good for cron)
node src/index.js --once

# Daemon mode (sync every N seconds)
node src/index.js --daemon
node src/index.js --daemon --interval=60

# Show help
node src/index.js --help
```

## Modes

| Flag | Description |
|------|-------------|
| `--sync` | Incremental sync from last position (default) |
| `--full` | Re-download everything from scratch |
| `--once` | Single incremental sync, then exit |
| `--daemon` | Continuous sync loop |
| `--interval=N` | Override sync interval in seconds |
| `--env=PATH` | Path to `.env` file |

## Architecture

```
src/
├── index.js            # CLI entry point, daemon loop
├── config.js           # Configuration from env/.env
├── evernote-client.js  # Evernote API client (HTTPS/JSON)
├── enml-converter.js   # ENML → Markdown conversion
├── sync-state.js       # Sync state persistence (.sync-state.json)
├── file-manager.js     # Atomic file I/O, path sanitization
└── sync-engine.js      # Sync orchestration (full/incremental)
```

### Sync Protocol

Uses Evernote's USN (Update Sequence Number) based incremental sync:

1. **`getSyncState()`** — Get current server `updateCount`
2. **`getSyncChunk(afterUSN, 100)`** — Fetch changes since last sync
3. Process each chunk: update notebooks, download/convert notes, handle deletions
4. Persist `lastSyncUSN` to `.sync-state.json` after each chunk

### ENML Conversion

Evernote's note format (ENML) is a restricted XHTML subset. The converter:

1. Strips XML declaration and DOCTYPE
2. Preprocesses Evernote custom elements into standard HTML:
   - `<en-todo>` → task list checkboxes (`- [ ]` / `- [x]`)
   - `<en-media>` → image/link references to downloaded attachments
   - `<en-crypt>` → `[encrypted content]` placeholder
3. Runs [Turndown](https://github.com/mixmark-io/turndown) for HTML→Markdown
4. Post-processes to clean up whitespace and restore markers

### File Safety

- **Atomic writes**: Write to temp file, then `rename()` — no partial files
- **Filename sanitization**: Invalid characters replaced, length capped
- **Duplicate detection**: Same-title notes get GUID suffix
- **Move detection**: Notes tracked by GUID; renames and notebook moves handled
- **Optional trash**: Deleted notes can go to `.trash/` instead of hard delete

### Rate Limiting

- Automatic retry with backoff on `429`/`503` responses
- Respects `Retry-After` headers
- Transient network errors retried up to 3 times with exponential backoff

## Testing

```bash
npm test
```

46 tests covering:
- Configuration parsing and validation
- ENML→Markdown conversion (17 test cases including all custom elements)
- File manager (atomic writes, moves, trash, path deduplication)
- Sync state persistence and corruption recovery

## Dependencies

- **[turndown](https://github.com/mixmark-io/turndown)** — HTML to Markdown conversion
- **[thrift](https://www.npmjs.com/package/thrift)** — Apache Thrift (available for future raw Thrift transport)
- **[dotenv](https://www.npmjs.com/package/dotenv)** — Environment variable management

## Edge Cases Handled

- Duplicate note titles within a notebook
- Invalid filesystem characters in titles
- Notebook renames (directory renamed, paths updated)
- Note moves between notebooks
- Encrypted content blocks
- Missing/unresolvable attachments
- Corrupted sync state recovery
- Graceful daemon shutdown (SIGINT/SIGTERM)
