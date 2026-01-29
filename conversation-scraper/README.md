# Conversation Scraper & Exporter

Automatically scrapes all conversations from **Claude.ai** (web) and **Claude Code** (local), then exports them as raw JSON and formatted Markdown into this repository.

## Features

- **Two data sources:**
  - **Claude.ai web** - Downloads all conversations via the internal API using your session cookie
  - **Claude Code local** - Reads conversation data from `~/.claude/projects/` JSONL files (including subagent conversations)
- **Dual export formats:**
  - **Raw JSON** - Complete conversation data in a unified schema
  - **Markdown** - Human-readable format with metadata tables, collapsible thinking blocks, tool usage details, and token statistics
- **Auto-generated index** - `INDEX.md` with a table of all conversations, links, and aggregate statistics
- **GitHub Actions automation** - Scheduled daily scraping with auto-commit to the repository
- **Incremental re-export** - Re-generate markdown from existing raw data without re-scraping

## Quick Start

```bash
cd conversation-scraper
npm install
```

### Scrape Claude Code local conversations

```bash
npm start scrape -- --source=claude-code
```

### Scrape Claude.ai web conversations

```bash
CLAUDE_SESSION_KEY="sk-ant-sid01-..." npm start scrape -- --source=claude-web
```

### Scrape all sources

```bash
CLAUDE_SESSION_KEY="sk-ant-sid01-..." npm start scrape
```

### Re-export markdown from existing raw data

```bash
npm start export
```

## Setup

### Prerequisites

- Node.js 18+ (uses native `fetch`)
- npm

### Installation

```bash
cd conversation-scraper
npm install
```

### Getting your Claude.ai session key

1. Log into [claude.ai](https://claude.ai) in your browser
2. Open Developer Tools (F12) -> Application -> Cookies
3. Find the `sessionKey` cookie for `claude.ai`
4. Copy the value (starts with `sk-ant-sid01-...`)

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLAUDE_SESSION_KEY` | For web scraping | Session cookie from claude.ai |
| `CLAUDE_ORG_ID` | No | Organization UUID (auto-detected) |
| `CLAUDE_CODE_DIR` | No | Path to Claude Code data (default: `~/.claude`) |
| `OUTPUT_DIR` | No | Output directory (default: `./data`) |
| `AUTO_COMMIT` | No | Set `true` to auto-commit to git |

## Output Structure

```
data/
├── INDEX.md                    # Table of all conversations with links
├── raw/
│   ├── {conversation-id}.json  # Raw unified JSON
│   └── ...
└── markdown/
    ├── {conversation-id}.md    # Formatted Markdown
    └── ...
```

### Raw JSON Schema

Each conversation is stored as a unified JSON object:

```json
{
  "id": "uuid",
  "source": "claude-web | claude-code",
  "title": "Conversation title",
  "summary": "Optional summary",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp",
  "messages": [
    {
      "id": "uuid",
      "role": "user | assistant",
      "content": "Message text",
      "timestamp": "ISO timestamp",
      "model": "claude-opus-4-5-20251101",
      "tokenUsage": { "input": 100, "output": 50 },
      "thinkingContent": "Optional thinking...",
      "toolUses": [{ "name": "tool", "input": "...", "output": "..." }]
    }
  ],
  "metadata": { ... }
}
```

### Markdown Format

Each conversation renders as a Markdown document with:
- Metadata table (source, dates, message count, project info)
- Messages with role labels, timestamps, and model info
- Collapsible `<details>` blocks for thinking content
- Collapsible tool usage with input/output
- Token usage per-message and summary totals

## GitHub Actions Automation

The included workflow (`.github/workflows/conversation-scraper.yml`) supports:

- **Scheduled runs** - Daily at 2am UTC
- **Manual trigger** - With source selection dropdown
- **Auto-commit** - Pushes scraped data back to the repo

### Setup for GitHub Actions

1. Go to your repo's **Settings > Secrets and variables > Actions**
2. Add secret: `CLAUDE_SESSION_KEY` with your session cookie value
3. (Optional) Add secret: `CLAUDE_ORG_ID` if you have multiple organizations
4. The workflow runs automatically on schedule, or trigger it manually from the Actions tab

## Commands

| Command | Description |
|---------|-------------|
| `npm start scrape` | Scrape all configured sources |
| `npm start scrape -- --source=claude-web` | Scrape only Claude.ai web |
| `npm start scrape -- --source=claude-code` | Scrape only Claude Code local |
| `npm start export` | Re-export markdown from raw JSON |
| `npm start help` | Show help |

## How It Works

### Claude.ai Web Scraper
1. Authenticates using the session cookie
2. Fetches organization list to resolve the org ID
3. Lists all conversation summaries
4. Downloads each conversation's full message history
5. Converts to unified format with rate limiting between requests

### Claude Code Local Scraper
1. Scans `~/.claude/projects/` for session JSONL files
2. Discovers subagent conversation files in `{session}/subagents/`
3. Parses JSONL entries, filtering for user/assistant messages
4. Merges main session and subagent messages, sorted by timestamp
5. Extracts content from text blocks, thinking blocks, and tool uses

### Export Pipeline
1. Raw JSON written to `data/raw/{id}.json`
2. Markdown written to `data/markdown/{id}.md`
3. Index generated at `data/INDEX.md`
4. Optional git auto-commit

## Privacy Note

This tool accesses your personal conversation data. The session cookie provides full access to your Claude.ai account. Keep it secure:
- Never commit `.env` files or session keys to version control
- Use GitHub Actions secrets for CI/CD
- The `.gitignore` excludes `.env` by default
- Consider whether you want conversation data committed to a public repository
