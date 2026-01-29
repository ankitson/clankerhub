/**
 * Claude.ai Web Conversation Scraper
 *
 * Uses the Claude.ai internal web API with a session cookie to
 * list and download all conversations for a user.
 *
 * Required: A valid session key (sk-ant-sid01-...) obtained from
 * the browser's cookie storage when logged into claude.ai.
 */

import type {
  ClaudeWebOrganization,
  ClaudeWebConversationSummary,
  ClaudeWebConversation,
  UnifiedConversation,
  UnifiedMessage,
  ToolUseRecord,
} from "./types.js";

const BASE_URL = "https://claude.ai/api";

interface WebScraperOptions {
  sessionKey: string;
  organizationId?: string;
  rateLimitMs?: number;
}

export class ClaudeWebScraper {
  private sessionKey: string;
  private organizationId?: string;
  private rateLimitMs: number;

  constructor(options: WebScraperOptions) {
    this.sessionKey = options.sessionKey;
    this.organizationId = options.organizationId;
    this.rateLimitMs = options.rateLimitMs ?? 1000;
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      headers: {
        Cookie: `sessionKey=${this.sessionKey}`,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Claude.ai API error ${res.status} ${res.statusText} for ${path}: ${body}`
      );
    }

    return res.json() as Promise<T>;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Fetch all organizations the user belongs to */
  async getOrganizations(): Promise<ClaudeWebOrganization[]> {
    return this.request<ClaudeWebOrganization[]>("/organizations");
  }

  /** Resolve the organization ID (fetch if not provided) */
  private async resolveOrgId(): Promise<string> {
    if (this.organizationId) return this.organizationId;
    const orgs = await this.getOrganizations();
    if (orgs.length === 0) {
      throw new Error("No organizations found for this session key");
    }
    this.organizationId = orgs[0].uuid;
    console.log(
      `  Using organization: ${orgs[0].name} (${this.organizationId})`
    );
    return this.organizationId;
  }

  /** List all conversation summaries */
  async listConversations(): Promise<ClaudeWebConversationSummary[]> {
    const orgId = await this.resolveOrgId();
    return this.request<ClaudeWebConversationSummary[]>(
      `/organizations/${orgId}/chat_conversations`
    );
  }

  /** Fetch a full conversation with all messages */
  async getConversation(
    conversationId: string
  ): Promise<ClaudeWebConversation> {
    const orgId = await this.resolveOrgId();
    return this.request<ClaudeWebConversation>(
      `/organizations/${orgId}/chat_conversations/${conversationId}`
    );
  }

  /** Scrape all conversations and return unified format */
  async scrapeAll(
    onProgress?: (current: number, total: number, title: string) => void
  ): Promise<UnifiedConversation[]> {
    console.log("Fetching conversation list from Claude.ai...");
    const summaries = await this.listConversations();
    console.log(`  Found ${summaries.length} conversations`);

    const results: UnifiedConversation[] = [];

    for (let i = 0; i < summaries.length; i++) {
      const summary = summaries[i];
      const title = summary.name || `Conversation ${summary.uuid.slice(0, 8)}`;
      onProgress?.(i + 1, summaries.length, title);
      console.log(
        `  [${i + 1}/${summaries.length}] Downloading: ${title.slice(0, 60)}`
      );

      try {
        const conv = await this.getConversation(summary.uuid);
        results.push(this.toUnified(conv));
      } catch (err) {
        console.error(
          `    Failed to download ${summary.uuid}: ${err instanceof Error ? err.message : err}`
        );
      }

      // Rate limiting between requests
      if (i < summaries.length - 1) {
        await this.sleep(this.rateLimitMs);
      }
    }

    return results;
  }

  /** Convert a Claude.ai web conversation to unified format */
  private toUnified(conv: ClaudeWebConversation): UnifiedConversation {
    const messages: UnifiedMessage[] = (conv.chat_messages || []).map(
      (msg) => {
        let content = msg.text || "";
        const toolUses: ToolUseRecord[] = [];

        // Extract content from content blocks if present
        if (msg.content && Array.isArray(msg.content)) {
          const textParts: string[] = [];
          for (const block of msg.content) {
            if (block.type === "text" && block.text) {
              textParts.push(block.text);
            } else if (block.type === "tool_use" && block.name) {
              toolUses.push({
                name: block.name,
                input: JSON.stringify(block.input, null, 2),
              });
            }
          }
          if (textParts.length > 0) {
            content = textParts.join("\n");
          }
        }

        // Append attachment info
        const attachments = (msg.attachments || []).map((a) => a.file_name);

        return {
          id: msg.uuid,
          role: msg.sender === "human" ? ("user" as const) : ("assistant" as const),
          content,
          timestamp: msg.created_at,
          attachments: attachments.length > 0 ? attachments : undefined,
          toolUses: toolUses.length > 0 ? toolUses : undefined,
        };
      }
    );

    return {
      id: conv.uuid,
      source: "claude-web",
      title: conv.name || `Conversation ${conv.uuid.slice(0, 8)}`,
      summary: conv.summary || undefined,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
      messages,
      metadata: {
        originalName: conv.name,
      },
    };
  }
}
