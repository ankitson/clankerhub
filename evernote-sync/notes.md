# Evernote Sync – Development Notes

## Approach

The goal is a background daemon that mirrors an Evernote account into a local directory of Markdown files. I studied the existing [brentmid/evernote-mcp-server](https://github.com/brentmid/evernote-mcp-server) to understand the Evernote Thrift API patterns, then built a standalone Node.js service from scratch.

## Key Design Decisions

### Architecture

Split into clean, single-responsibility modules:
- `config.js` – env/dotenv config loading, shard extraction
- `evernote-client.js` – Evernote API wrapper with rate-limit retry
- `enml-converter.js` – ENML→Markdown conversion using Turndown
- `sync-state.js` – JSON-based sync state persistence
- `file-manager.js` – atomic file writes, path sanitization, directory management
- `sync-engine.js` – orchestrates sync logic (full/incremental)
- `index.js` – CLI entry point with daemon/one-shot/full modes

### ENML Conversion Strategy

ENML has custom elements (`en-note`, `en-todo`, `en-media`, `en-crypt`) that Turndown's JSDOM parser doesn't recognize and silently drops. I initially tried Turndown's `addRule()` filter API, but it doesn't work for unknown elements.

**Solution:** Preprocess the ENML string with regex to replace custom elements with standard HTML equivalents *before* passing to Turndown:
- `<en-todo checked="true"/>` → Unicode checkbox character `☑`, then post-process `☑` → `- [x]`
- `<en-todo checked="false"/>` → `☐` → `- [ ]`
- `<en-media hash="..." type="image/png"/>` → `<img>` or `<a>` tag
- `<en-crypt>...</en-crypt>` → em-dash marker, then post-process to `[encrypted content]`

The Unicode marker approach avoids Turndown escaping square brackets.

### API Transport

The reference MCP server uses raw Thrift with generated code stubs. I opted for Evernote's HTTPS/JSON API endpoints instead, which accept the same auth tokens but don't require Thrift code generation. This eliminates the dependency on generated Thrift stubs and makes the code more portable.

### Sync Protocol

Uses Evernote's USN-based sync protocol:
1. `getSyncState()` → current `updateCount`
2. `getSyncChunk(afterUSN, 100)` in a loop until caught up
3. Each chunk contains notes, resources, expunged GUIDs
4. State persisted in `.sync-state.json` after each chunk

### File Safety

- All writes are atomic (write to temp file, then `rename()`)
- Filenames are sanitized for cross-platform compatibility
- Duplicate note titles get a GUID suffix appended
- Note moves/renames detected via GUID tracking in sync state

## Challenges Encountered

1. **Turndown and custom elements:** Turndown silently drops unrecognized HTML elements. Had to preprocess ENML custom elements into standard HTML before conversion.

2. **Bracket escaping:** Turndown escapes `[` and `]` in text content since they're Markdown link syntax. Used Unicode em-dash markers as intermediaries for encrypted content placeholders.

3. **HTML comments stripped:** Turndown removes HTML comments, so `<!-- missing attachment -->` placeholders were invisible. Switched to `<span>` elements.

4. **Self-closing tags:** ENML uses XML-style self-closing tags (`<en-todo checked="false"/>`), which need to be normalized for HTML parsing.

## Test Results

46 tests passing across 4 test files:
- Config: 5 tests (env parsing, shard extraction, notebook filters)
- ENML Converter: 17 tests (HTML elements, custom elements, edge cases)
- File Manager: 14 tests (sanitization, atomic writes, moves, trash)
- Sync State: 6 tests (persistence, corruption recovery)
