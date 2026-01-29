/**
 * Claude Code Local Conversation Scraper
 *
 * Reads Claude Code conversation data from the local filesystem.
 * Claude Code stores conversations as JSONL files in:
 *   ~/.claude/projects/{project-path}/{session-id}.jsonl
 * with subagent conversations in:
 *   ~/.claude/projects/{project-path}/{session-id}/subagents/agent-{id}.jsonl
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type {
  ClaudeCodeMessageEntry,
  ClaudeCodeQueueOperation,
  ClaudeCodeContentBlock,
  UnifiedConversation,
  UnifiedMessage,
  ToolUseRecord,
} from "./types.js";

interface CodeScraperOptions {
  dataDir?: string;
}

interface SessionInfo {
  sessionId: string;
  projectPath: string;
  mainFile: string;
  subagentFiles: string[];
}

export class ClaudeCodeScraper {
  private dataDir: string;

  constructor(options?: CodeScraperOptions) {
    this.dataDir =
      options?.dataDir || path.join(os.homedir(), ".claude");
  }

  /** Discover all session files in the projects directory */
  private discoverSessions(): SessionInfo[] {
    const projectsDir = path.join(this.dataDir, "projects");
    if (!fs.existsSync(projectsDir)) {
      console.log(`  No projects directory found at ${projectsDir}`);
      return [];
    }

    const sessions: SessionInfo[] = [];
    const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true });

    for (const projectEntry of projectDirs) {
      if (!projectEntry.isDirectory()) continue;
      const projectPath = projectEntry.name;
      const projectFullPath = path.join(projectsDir, projectPath);
      const entries = fs.readdirSync(projectFullPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;

        const sessionId = entry.name.replace(".jsonl", "");
        const mainFile = path.join(projectFullPath, entry.name);

        // Check for subagent files
        const subagentDir = path.join(
          projectFullPath,
          sessionId,
          "subagents"
        );
        const subagentFiles: string[] = [];
        if (fs.existsSync(subagentDir)) {
          const subEntries = fs.readdirSync(subagentDir);
          for (const sub of subEntries) {
            if (sub.endsWith(".jsonl")) {
              subagentFiles.push(path.join(subagentDir, sub));
            }
          }
        }

        sessions.push({
          sessionId,
          projectPath,
          mainFile,
          subagentFiles,
        });
      }
    }

    return sessions;
  }

  /** Parse a JSONL file into typed entries */
  private parseJsonl(filePath: string): (ClaudeCodeMessageEntry | ClaudeCodeQueueOperation)[] {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());
    const entries: (ClaudeCodeMessageEntry | ClaudeCodeQueueOperation)[] = [];

    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch {
        // Skip malformed lines
      }
    }

    return entries;
  }

  /** Extract text content from a Claude Code message content field */
  private extractContent(
    content: string | ClaudeCodeContentBlock[]
  ): { text: string; thinking?: string; toolUses: ToolUseRecord[] } {
    if (typeof content === "string") {
      return { text: content, toolUses: [] };
    }

    const textParts: string[] = [];
    let thinking: string | undefined;
    const toolUses: ToolUseRecord[] = [];

    for (const block of content) {
      if (block.type === "text" && block.text) {
        textParts.push(block.text);
      } else if (block.type === "thinking" && block.thinking) {
        thinking = block.thinking;
      } else if (block.type === "tool_use" && block.name) {
        toolUses.push({
          name: block.name,
          input:
            typeof block.input === "string"
              ? block.input
              : JSON.stringify(block.input, null, 2),
        });
      } else if (block.type === "tool_result" && block.content) {
        // Tool results can contain nested content
        const resultText =
          typeof block.content === "string"
            ? block.content
            : JSON.stringify(block.content, null, 2);
        // Attach to the last tool use if possible
        if (toolUses.length > 0) {
          toolUses[toolUses.length - 1].output = resultText;
        }
      }
    }

    return {
      text: textParts.join("\n"),
      thinking,
      toolUses,
    };
  }

  /** Convert message entries to unified messages */
  private toUnifiedMessages(
    entries: (ClaudeCodeMessageEntry | ClaudeCodeQueueOperation)[]
  ): UnifiedMessage[] {
    return entries
      .filter(
        (e): e is ClaudeCodeMessageEntry =>
          "message" in e && (e.type === "user" || e.type === "assistant")
      )
      .map((entry) => {
        const { text, thinking, toolUses } = this.extractContent(
          entry.message.content
        );

        return {
          id: entry.uuid,
          role: entry.type as "user" | "assistant",
          content: text,
          timestamp: entry.timestamp,
          model: entry.message.model,
          tokenUsage: entry.message.usage
            ? {
                input: entry.message.usage.input_tokens,
                output: entry.message.usage.output_tokens,
              }
            : undefined,
          thinkingContent: thinking,
          toolUses: toolUses.length > 0 ? toolUses : undefined,
        };
      });
  }

  /** Decode the project path from the directory name */
  private decodeProjectPath(encodedPath: string): string {
    // Claude Code encodes paths by replacing / with -
    // e.g., -home-user-clankerhub -> /home/user/clankerhub
    return encodedPath.replace(/^-/, "/").replace(/-/g, "/");
  }

  /** Scrape all local Claude Code conversations */
  async scrapeAll(
    onProgress?: (current: number, total: number, title: string) => void
  ): Promise<UnifiedConversation[]> {
    console.log(`Scanning Claude Code data at ${this.dataDir}...`);
    const sessions = this.discoverSessions();
    console.log(`  Found ${sessions.length} sessions`);

    const results: UnifiedConversation[] = [];

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const projectName = this.decodeProjectPath(session.projectPath);
      const title = `${projectName} (${session.sessionId.slice(0, 8)})`;
      onProgress?.(i + 1, sessions.length, title);
      console.log(`  [${i + 1}/${sessions.length}] Reading: ${title}`);

      try {
        // Parse main session file
        const mainEntries = this.parseJsonl(session.mainFile);
        const mainMessages = this.toUnifiedMessages(mainEntries);

        // Parse subagent files and merge
        const allMessages = [...mainMessages];
        for (const subFile of session.subagentFiles) {
          const subEntries = this.parseJsonl(subFile);
          const subMessages = this.toUnifiedMessages(subEntries);
          allMessages.push(...subMessages);
        }

        // Sort all messages by timestamp
        allMessages.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // Extract metadata from first message entry
        const firstEntry = mainEntries.find(
          (e): e is ClaudeCodeMessageEntry => "message" in e
        );

        // Calculate time range
        const timestamps = allMessages
          .map((m) => m.timestamp)
          .filter(Boolean);
        const createdAt =
          timestamps.length > 0
            ? timestamps[0]
            : new Date().toISOString();
        const updatedAt =
          timestamps.length > 0
            ? timestamps[timestamps.length - 1]
            : new Date().toISOString();

        results.push({
          id: session.sessionId,
          source: "claude-code",
          title: `Claude Code: ${projectName}`,
          createdAt,
          updatedAt,
          messages: allMessages,
          metadata: {
            projectPath: projectName,
            encodedProjectPath: session.projectPath,
            sessionSlug: firstEntry?.slug,
            gitBranch: firstEntry?.gitBranch,
            claudeCodeVersion: firstEntry?.version,
            subagentCount: session.subagentFiles.length,
            totalMessages: allMessages.length,
          },
        });
      } catch (err) {
        console.error(
          `    Failed to read session ${session.sessionId}: ${err instanceof Error ? err.message : err}`
        );
      }
    }

    return results;
  }
}
