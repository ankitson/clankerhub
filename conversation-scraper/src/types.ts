/**
 * Unified types for Claude conversation data from both
 * Claude.ai web and Claude Code local sources.
 */

// ── Source identification ──────────────────────────────────────────

export type ConversationSource = "claude-web" | "claude-code";

// ── Claude.ai Web API types ────────────────────────────────────────

export interface ClaudeWebOrganization {
  uuid: string;
  name: string;
  slug?: string;
}

export interface ClaudeWebConversationSummary {
  uuid: string;
  name: string;
  summary: string;
  created_at: string;
  updated_at: string;
  project_uuid?: string;
}

export interface ClaudeWebMessage {
  uuid: string;
  text: string;
  sender: "human" | "assistant";
  created_at: string;
  updated_at: string;
  attachments?: ClaudeWebAttachment[];
  content?: ClaudeWebContentBlock[];
}

export interface ClaudeWebAttachment {
  file_name: string;
  file_type: string;
  file_size: number;
  extracted_content?: string;
}

export interface ClaudeWebContentBlock {
  type: string;
  text?: string;
  input?: unknown;
  name?: string;
}

export interface ClaudeWebConversation {
  uuid: string;
  name: string;
  summary: string;
  created_at: string;
  updated_at: string;
  chat_messages: ClaudeWebMessage[];
}

// ── Claude Code local JSONL types ──────────────────────────────────

export interface ClaudeCodeMessageEntry {
  parentUuid: string | null;
  isSidechain: boolean;
  userType: string;
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch?: string;
  agentId?: string;
  slug?: string;
  type: "user" | "assistant";
  message: ClaudeCodeMessage;
  uuid: string;
  timestamp: string;
  requestId?: string;
}

export interface ClaudeCodeMessage {
  role: "user" | "assistant";
  content: string | ClaudeCodeContentBlock[];
  model?: string;
  id?: string;
  type?: string;
  stop_reason?: string | null;
  usage?: ClaudeCodeUsage;
}

export interface ClaudeCodeContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  input?: unknown;
  name?: string;
  content?: unknown;
  signature?: string;
}

export interface ClaudeCodeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface ClaudeCodeQueueOperation {
  type: "queue-operation";
  operation: string;
  timestamp: string;
  sessionId: string;
}

// ── Unified conversation model ─────────────────────────────────────

export interface UnifiedMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  model?: string;
  attachments?: string[];
  tokenUsage?: {
    input: number;
    output: number;
  };
  thinkingContent?: string;
  toolUses?: ToolUseRecord[];
}

export interface ToolUseRecord {
  name: string;
  input: string;
  output?: string;
}

export interface UnifiedConversation {
  id: string;
  source: ConversationSource;
  title: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  messages: UnifiedMessage[];
  metadata: Record<string, unknown>;
}

// ── Configuration ──────────────────────────────────────────────────

export interface ScraperConfig {
  /** Claude.ai session cookie value (sk-ant-sid01-...) */
  claudeSessionKey?: string;

  /** Path to Claude Code data directory (default: ~/.claude) */
  claudeCodeDataDir?: string;

  /** Output directory for scraped data */
  outputDir: string;

  /** Whether to export raw JSON */
  exportRaw: boolean;

  /** Whether to export markdown */
  exportMarkdown: boolean;

  /** Whether to auto-commit to git */
  autoCommit: boolean;

  /** Sources to scrape */
  sources: ConversationSource[];
}
