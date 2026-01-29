/**
 * Markdown Converter
 *
 * Converts unified conversations into well-formatted Markdown files.
 */

import type { UnifiedConversation, UnifiedMessage, ToolUseRecord } from "./types.js";

/** Convert a single conversation to Markdown */
export function conversationToMarkdown(conv: UnifiedConversation): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${escapeMarkdown(conv.title)}`);
  lines.push("");

  // Metadata table
  lines.push("| Field | Value |");
  lines.push("|-------|-------|");
  lines.push(`| **Source** | ${conv.source} |`);
  lines.push(`| **ID** | \`${conv.id}\` |`);
  lines.push(`| **Created** | ${formatDate(conv.createdAt)} |`);
  lines.push(`| **Updated** | ${formatDate(conv.updatedAt)} |`);
  lines.push(`| **Messages** | ${conv.messages.length} |`);

  if (conv.summary) {
    lines.push(`| **Summary** | ${escapeMarkdown(conv.summary)} |`);
  }

  // Source-specific metadata
  const meta = conv.metadata;
  if (meta.projectPath) {
    lines.push(`| **Project** | \`${meta.projectPath}\` |`);
  }
  if (meta.gitBranch) {
    lines.push(`| **Git Branch** | \`${meta.gitBranch}\` |`);
  }
  if (meta.claudeCodeVersion) {
    lines.push(`| **Claude Code Version** | ${meta.claudeCodeVersion} |`);
  }
  if (meta.sessionSlug) {
    lines.push(`| **Session** | ${meta.sessionSlug} |`);
  }

  lines.push("");
  lines.push("---");
  lines.push("");

  // Messages
  lines.push("## Conversation");
  lines.push("");

  for (const msg of conv.messages) {
    lines.push(formatMessage(msg));
    lines.push("");
  }

  // Token usage summary
  const totalTokens = calculateTokenSummary(conv.messages);
  if (totalTokens.input > 0 || totalTokens.output > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Token Usage Summary");
    lines.push("");
    lines.push(`- **Input tokens:** ${totalTokens.input.toLocaleString()}`);
    lines.push(`- **Output tokens:** ${totalTokens.output.toLocaleString()}`);
    lines.push(
      `- **Total tokens:** ${(totalTokens.input + totalTokens.output).toLocaleString()}`
    );
    lines.push("");
  }

  return lines.join("\n");
}

/** Format a single message */
function formatMessage(msg: UnifiedMessage): string {
  const lines: string[] = [];
  const roleLabel = msg.role === "user" ? "User" : "Assistant";
  const roleIcon = msg.role === "user" ? "**[User]**" : "**[Assistant]**";
  const timestamp = msg.timestamp ? ` _${formatDate(msg.timestamp)}_` : "";
  const model = msg.model ? ` (${msg.model})` : "";

  lines.push(`### ${roleIcon}${model}${timestamp}`);
  lines.push("");

  // Thinking content (collapsed)
  if (msg.thinkingContent) {
    lines.push("<details>");
    lines.push("<summary>Thinking...</summary>");
    lines.push("");
    lines.push(msg.thinkingContent);
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  // Main content
  if (msg.content) {
    lines.push(msg.content);
    lines.push("");
  }

  // Tool uses
  if (msg.toolUses && msg.toolUses.length > 0) {
    for (const tool of msg.toolUses) {
      lines.push(formatToolUse(tool));
      lines.push("");
    }
  }

  // Attachments
  if (msg.attachments && msg.attachments.length > 0) {
    lines.push("**Attachments:**");
    for (const att of msg.attachments) {
      lines.push(`- ${att}`);
    }
    lines.push("");
  }

  // Token usage
  if (msg.tokenUsage) {
    lines.push(
      `_Tokens: ${msg.tokenUsage.input.toLocaleString()} in / ${msg.tokenUsage.output.toLocaleString()} out_`
    );
    lines.push("");
  }

  return lines.join("\n");
}

/** Format a tool use record */
function formatToolUse(tool: ToolUseRecord): string {
  const lines: string[] = [];
  lines.push(`<details>`);
  lines.push(`<summary>Tool: <code>${escapeHtml(tool.name)}</code></summary>`);
  lines.push("");

  if (tool.input) {
    lines.push("**Input:**");
    lines.push("```json");
    // Truncate very long inputs
    const input = tool.input.length > 2000
      ? tool.input.slice(0, 2000) + "\n... (truncated)"
      : tool.input;
    lines.push(input);
    lines.push("```");
    lines.push("");
  }

  if (tool.output) {
    lines.push("**Output:**");
    lines.push("```");
    // Truncate very long outputs
    const output = tool.output.length > 2000
      ? tool.output.slice(0, 2000) + "\n... (truncated)"
      : tool.output;
    lines.push(output);
    lines.push("```");
    lines.push("");
  }

  lines.push("</details>");
  return lines.join("\n");
}

/** Generate a Markdown index of all conversations */
export function generateIndex(conversations: UnifiedConversation[]): string {
  const lines: string[] = [];

  lines.push("# Conversation Archive Index");
  lines.push("");
  lines.push(
    `_Generated on ${formatDate(new Date().toISOString())} | ${conversations.length} conversations_`
  );
  lines.push("");

  // Group by source
  const bySource = new Map<string, UnifiedConversation[]>();
  for (const conv of conversations) {
    const group = bySource.get(conv.source) || [];
    group.push(conv);
    bySource.set(conv.source, group);
  }

  for (const [source, convs] of bySource) {
    const sourceLabel =
      source === "claude-web" ? "Claude.ai Web" : "Claude Code";
    lines.push(`## ${sourceLabel} (${convs.length} conversations)`);
    lines.push("");

    // Sort by date descending
    const sorted = [...convs].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    lines.push("| # | Title | Messages | Created | Updated |");
    lines.push("|---|-------|----------|---------|---------|");

    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i];
      const fileName = sanitizeFilename(c.id);
      const mdLink = `[${escapeMarkdown(c.title.slice(0, 50))}](markdown/${fileName}.md)`;
      const rawLink = `[raw](raw/${fileName}.json)`;
      lines.push(
        `| ${i + 1} | ${mdLink} (${rawLink}) | ${c.messages.length} | ${formatDateShort(c.createdAt)} | ${formatDateShort(c.updatedAt)} |`
      );
    }

    lines.push("");
  }

  // Summary stats
  lines.push("## Statistics");
  lines.push("");
  const totalMessages = conversations.reduce(
    (sum, c) => sum + c.messages.length,
    0
  );
  lines.push(`- **Total conversations:** ${conversations.length}`);
  lines.push(`- **Total messages:** ${totalMessages.toLocaleString()}`);

  const allTokens = conversations.flatMap((c) => c.messages);
  const tokenSummary = calculateTokenSummary(allTokens);
  if (tokenSummary.input > 0 || tokenSummary.output > 0) {
    lines.push(
      `- **Total input tokens:** ${tokenSummary.input.toLocaleString()}`
    );
    lines.push(
      `- **Total output tokens:** ${tokenSummary.output.toLocaleString()}`
    );
  }

  lines.push("");
  return lines.join("\n");
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 200);
}

function calculateTokenSummary(
  messages: UnifiedMessage[]
): { input: number; output: number } {
  let input = 0;
  let output = 0;
  for (const msg of messages) {
    if (msg.tokenUsage) {
      input += msg.tokenUsage.input;
      output += msg.tokenUsage.output;
    }
  }
  return { input, output };
}
