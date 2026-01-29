# Conversation Scraper - Development Notes

## Investigation

### Claude Code Local Storage
- Claude Code stores conversations in `~/.claude/projects/` as JSONL files
- Directory structure: `projects/{encoded-path}/{session-uuid}.jsonl`
- Subagent data stored in `{session-uuid}/subagents/agent-{id}.jsonl`
- Path encoding: slashes become hyphens, e.g., `-home-user-clankerhub` = `/home/user/clankerhub`
- Main session files contain `queue-operation` entries (enqueue/dequeue events)
- Subagent files contain full message entries with `user` and `assistant` types
- Each message entry includes: uuid, timestamp, sessionId, message content, version, git branch, agent ID
- Assistant messages include: model name, token usage stats, content blocks (text, thinking, tool_use)
- Thinking blocks include cryptographic signatures for verification

### Claude.ai Web API
- Internal API at `https://claude.ai/api/`
- Authentication via `sessionKey` cookie (starts with `sk-ant-sid01-...`)
- Key endpoints:
  - `GET /api/organizations` - list orgs
  - `GET /api/organizations/{org}/chat_conversations` - list all conversations
  - `GET /api/organizations/{org}/chat_conversations/{id}` - full conversation with messages
- Rate limiting needed between requests to avoid 429s
- Several unofficial Python libraries exist (unofficial-claude-api, Claude-API, claude-api-py)
- Anthropic also has a built-in export feature on claude.ai for manual downloads

### Architecture Decisions
- Chose TypeScript/Node.js to match the existing monorepo (ai-todo-done-app uses TS)
- Used native Node.js `fetch` (available in Node 18+) - no HTTP library dependency needed
- JSONL parsing done manually (line-by-line JSON.parse) - no external parser needed
- Unified data model abstracts differences between web and local formats
- Markdown output uses collapsible `<details>` blocks for thinking/tool content
- Rate limiting (1s default) on web API requests to be respectful

## What I Learned
1. Claude Code JSONL files separate queue operations (session-level) from actual messages (subagent-level)
2. The Claude.ai web API returns conversations with a `chat_messages` array containing full message history
3. Content blocks can be text, thinking, tool_use, or tool_result types
4. Token usage metadata is embedded in assistant message entries
5. Git branch and working directory are tracked per-message in Claude Code
