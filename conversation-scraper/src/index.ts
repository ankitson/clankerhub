#!/usr/bin/env node
/**
 * Conversation Scraper & Exporter
 *
 * CLI tool that scrapes all conversations from Claude.ai web and
 * Claude Code local storage, then exports them as raw JSON and
 * formatted Markdown files into this repository.
 *
 * Usage:
 *   npx tsx src/index.ts scrape                    # Scrape all sources
 *   npx tsx src/index.ts scrape --source=claude-web    # Web only
 *   npx tsx src/index.ts scrape --source=claude-code   # Local only
 *   npx tsx src/index.ts export                    # Re-export from existing raw data
 *
 * Environment variables:
 *   CLAUDE_SESSION_KEY   - Session cookie for claude.ai (sk-ant-sid01-...)
 *   CLAUDE_ORG_ID        - (Optional) Organization UUID
 *   CLAUDE_CODE_DIR      - (Optional) Path to ~/.claude directory
 *   OUTPUT_DIR           - (Optional) Output directory (default: ./data)
 *   AUTO_COMMIT          - (Optional) Set to "true" to auto-commit changes
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { ClaudeWebScraper } from "./claude-web.js";
import { ClaudeCodeScraper } from "./claude-code.js";
import {
  conversationToMarkdown,
  generateIndex,
  sanitizeFilename,
} from "./markdown.js";
import type { ConversationSource, UnifiedConversation } from "./types.js";

// ── Config ─────────────────────────────────────────────────────────

function getConfig() {
  const args = process.argv.slice(2);
  const command = args[0] || "scrape";

  const sourceFlag = args.find((a) => a.startsWith("--source="));
  const sources: ConversationSource[] = sourceFlag
    ? [sourceFlag.split("=")[1] as ConversationSource]
    : ["claude-web", "claude-code"];

  // Resolve output directory relative to the script location (project root)
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const projectRoot = path.resolve(scriptDir, "..");

  return {
    command,
    sources,
    sessionKey: process.env.CLAUDE_SESSION_KEY,
    orgId: process.env.CLAUDE_ORG_ID,
    claudeCodeDir: process.env.CLAUDE_CODE_DIR,
    outputDir: process.env.OUTPUT_DIR || path.join(projectRoot, "data"),
    autoCommit: process.env.AUTO_COMMIT === "true",
  };
}

// ── File I/O ───────────────────────────────────────────────────────

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeRawJson(outputDir: string, conv: UnifiedConversation) {
  const rawDir = path.join(outputDir, "raw");
  ensureDir(rawDir);
  const filename = sanitizeFilename(conv.id) + ".json";
  const filePath = path.join(rawDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(conv, null, 2), "utf-8");
  return filePath;
}

function writeMarkdown(outputDir: string, conv: UnifiedConversation) {
  const mdDir = path.join(outputDir, "markdown");
  ensureDir(mdDir);
  const filename = sanitizeFilename(conv.id) + ".md";
  const filePath = path.join(mdDir, filename);
  const md = conversationToMarkdown(conv);
  fs.writeFileSync(filePath, md, "utf-8");
  return filePath;
}

function writeIndex(outputDir: string, conversations: UnifiedConversation[]) {
  const indexPath = path.join(outputDir, "INDEX.md");
  const md = generateIndex(conversations);
  fs.writeFileSync(indexPath, md, "utf-8");
  return indexPath;
}

function loadExistingRaw(outputDir: string): UnifiedConversation[] {
  const rawDir = path.join(outputDir, "raw");
  if (!fs.existsSync(rawDir)) return [];

  const files = fs.readdirSync(rawDir).filter((f) => f.endsWith(".json"));
  const conversations: UnifiedConversation[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(rawDir, file), "utf-8");
      conversations.push(JSON.parse(content));
    } catch {
      console.error(`  Warning: Could not parse ${file}`);
    }
  }

  return conversations;
}

// ── Git operations ─────────────────────────────────────────────────

function gitCommit(outputDir: string) {
  try {
    const repoRoot = execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
    }).trim();
    const relPath = path.relative(repoRoot, outputDir);

    execSync(`git add "${relPath}"`, { cwd: repoRoot, stdio: "pipe" });

    const status = execSync("git status --porcelain", {
      cwd: repoRoot,
      encoding: "utf-8",
    });

    if (status.trim()) {
      const now = new Date().toISOString().replace(/[:.]/g, "-");
      execSync(
        `git commit -m "conversation-scraper: auto-export ${now}"`,
        { cwd: repoRoot, stdio: "pipe" }
      );
      console.log(`  Committed changes to git`);
    } else {
      console.log(`  No changes to commit`);
    }
  } catch (err) {
    console.error(
      `  Git commit failed: ${err instanceof Error ? err.message : err}`
    );
  }
}

// ── Scrape command ─────────────────────────────────────────────────

async function scrape() {
  const config = getConfig();
  console.log("=== Conversation Scraper ===");
  console.log(`Sources: ${config.sources.join(", ")}`);
  console.log(`Output:  ${config.outputDir}`);
  console.log("");

  const allConversations: UnifiedConversation[] = [];

  // Scrape Claude.ai web conversations
  if (config.sources.includes("claude-web")) {
    if (!config.sessionKey) {
      console.log(
        "Skipping Claude.ai web: CLAUDE_SESSION_KEY not set"
      );
      console.log(
        "  To scrape web conversations, set CLAUDE_SESSION_KEY to your session cookie value"
      );
      console.log(
        '  (Found in browser cookies for claude.ai, starts with "sk-ant-sid01-...")'
      );
      console.log("");
    } else {
      console.log("--- Claude.ai Web ---");
      const webScraper = new ClaudeWebScraper({
        sessionKey: config.sessionKey,
        organizationId: config.orgId,
      });

      try {
        const webConversations = await webScraper.scrapeAll();
        allConversations.push(...webConversations);
        console.log(
          `  Downloaded ${webConversations.length} web conversations`
        );
      } catch (err) {
        console.error(
          `  Web scraping failed: ${err instanceof Error ? err.message : err}`
        );
      }
      console.log("");
    }
  }

  // Scrape Claude Code local conversations
  if (config.sources.includes("claude-code")) {
    console.log("--- Claude Code Local ---");
    const codeScraper = new ClaudeCodeScraper({
      dataDir: config.claudeCodeDir,
    });

    try {
      const codeConversations = await codeScraper.scrapeAll();
      allConversations.push(...codeConversations);
      console.log(
        `  Found ${codeConversations.length} local conversations`
      );
    } catch (err) {
      console.error(
        `  Local scraping failed: ${err instanceof Error ? err.message : err}`
      );
    }
    console.log("");
  }

  if (allConversations.length === 0) {
    console.log("No conversations found. Nothing to export.");
    return;
  }

  // Export
  console.log(`--- Exporting ${allConversations.length} conversations ---`);
  exportConversations(config.outputDir, allConversations);

  // Auto-commit
  if (config.autoCommit) {
    console.log("");
    console.log("--- Auto-commit ---");
    gitCommit(config.outputDir);
  }

  console.log("");
  console.log("Done!");
}

// ── Export command (re-export from existing raw data) ───────────────

async function reExport() {
  const config = getConfig();
  console.log("=== Re-exporting from raw data ===");
  console.log(`Output: ${config.outputDir}`);
  console.log("");

  const conversations = loadExistingRaw(config.outputDir);
  if (conversations.length === 0) {
    console.log("No raw data found. Run 'scrape' first.");
    return;
  }

  console.log(`Found ${conversations.length} conversations in raw data`);
  exportConversations(config.outputDir, conversations);

  if (config.autoCommit) {
    console.log("");
    gitCommit(config.outputDir);
  }

  console.log("");
  console.log("Done!");
}

// ── Shared export logic ────────────────────────────────────────────

function exportConversations(
  outputDir: string,
  conversations: UnifiedConversation[]
) {
  for (const conv of conversations) {
    const rawPath = writeRawJson(outputDir, conv);
    const mdPath = writeMarkdown(outputDir, conv);
    console.log(
      `  Exported: ${conv.title.slice(0, 50)} -> ${path.basename(rawPath)}`
    );
  }

  const indexPath = writeIndex(outputDir, conversations);
  console.log(`  Index:    ${indexPath}`);
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const config = getConfig();

  switch (config.command) {
    case "scrape":
      await scrape();
      break;
    case "export":
      await reExport();
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${config.command}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp() {
  console.log(`
Conversation Scraper & Exporter
===============================

Scrapes Claude.ai web and Claude Code local conversations,
exports them as raw JSON and formatted Markdown.

COMMANDS:
  scrape             Scrape conversations and export
  export             Re-export markdown from existing raw data
  help               Show this help message

OPTIONS:
  --source=SOURCE    Scrape only one source:
                       claude-web   - Claude.ai web conversations
                       claude-code  - Claude Code local conversations

ENVIRONMENT VARIABLES:
  CLAUDE_SESSION_KEY   Session cookie for claude.ai
                       (starts with sk-ant-sid01-...)
  CLAUDE_ORG_ID        Organization UUID (auto-detected if not set)
  CLAUDE_CODE_DIR      Path to Claude Code data dir (default: ~/.claude)
  OUTPUT_DIR           Output directory (default: ./data)
  AUTO_COMMIT          Set to "true" to auto-commit to git

EXAMPLES:
  # Scrape everything
  npm start scrape

  # Scrape only Claude Code local conversations
  npm start scrape -- --source=claude-code

  # Scrape with web session and auto-commit
  CLAUDE_SESSION_KEY="sk-ant-..." AUTO_COMMIT=true npm start scrape

  # Re-export markdown from existing raw data
  npm start export
`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
