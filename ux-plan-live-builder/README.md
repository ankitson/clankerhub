# UX + Requirements Plan — Live AI Web App Builder (Local Storage)

## Source Review Summary
This plan references:
- Prototype UX patterns: tenant selection, prompt input, status feedback, live preview, and audit trail logging. (work-ai-plan-prototype/prototype/static/*)
- Code-structure sketch: chat pipeline, preview bridge, local persistence with Dexie/IndexedDB, and sync concepts. (code-structure-sketch/code-sketch.md)
- Infra scaffold context: edge routing + LLM gateway as future deployment analogs, even though this plan targets local-only storage. (ai-platform-infra/README.md)

## Product Objective
Enable non-technical and technical users to **create and modify a running web application in real time** via:
1. **Chatting with an AI** in a sidebar that can generate or edit JS/HTML/CSS.
2. **Direct editing** of code with instant preview.

All project data is stored **locally** in the browser (IndexedDB/local storage), with zero server dependency.

---

## Primary Users & Jobs-to-be-Done
1. **Product-minded creator (non-dev):** “I want to describe a web app and have it built for me, then tweak it visually.”
2. **Frontend developer:** “I want a fast AI co-pilot that can edit or refactor my code while I keep control.”
3. **Educator/learner:** “I want to experiment with JS apps and see results immediately.”

---

## Core UX Principles
- **Immediate feedback:** Every change should have a visible outcome (preview updates and status messaging).
- **Dual control:** Users can either chat or edit code directly; both remain in sync.
- **Safe experimentation:** Undo/redo, version snapshots, and warnings for risky output.
- **Local-first:** Works offline and persists without accounts.

---

## Information Architecture (IA)
### Main Layout (single-page workspace)
**Left Sidebar (AI Chat)**
- Conversation thread
- Prompt input (multi-line, supports slash commands)
- Quick action buttons ("Generate UI", "Refactor", "Explain", "Add Feature")
- Status banner (success/warning/error)
- Audit log (timestamped AI actions)

**Center (Live Preview Canvas)**
- Sandbox/iframe for running JS/HTML/CSS
- Live reload on each patch
- Responsive mode toggles (mobile/tablet/desktop)
- “Reset Preview” button

**Right Sidebar (Code + Files)**
- File tree (HTML/CSS/JS)
- Code editor tabs
- Inline diff highlights from AI changes
- Linting hints and error list

---

## Key User Flows
### 1. Create a New App
1. User selects “New App” or “Start from Template”.
2. Chooses app type (landing page, dashboard, form, etc.).
3. Chat sidebar prompts: “Describe what you want to build.”
4. AI generates initial files and preview updates instantly.

### 2. Modify via Chat
1. User asks: “Add a pricing section with three tiers.”
2. AI returns a patch: file changes + brief summary.
3. Preview updates; status panel shows success/warnings.
4. User can accept/rollback the patch.

### 3. Modify via Code
1. User edits JS or CSS directly in editor.
2. Preview updates on save or debounce.
3. AI can be asked to explain or refactor selected code.

### 4. Snapshot + Undo
1. Automatic snapshot after each AI patch.
2. Manual “Save snapshot” and “Revert” options.
3. Undo stack visible for the last N changes.

### 5. Export + Share (Local)
1. Export as ZIP (HTML/CSS/JS).
2. “Copy Preview Link” creates a local blob URL or static export.

---

## Functional Requirements
### AI Chat + Generation
- **Prompt handling** with streaming responses.
- **Patch-based output:** AI must return structured diffs per file.
- **Validation:** detect forbidden patterns or missing dependencies.
- **Warnings:** surfaced in status panel (prototype pattern).
- **Audit log:** timestamped record of AI changes (prototype pattern).

### Code Editor
- Multi-file editing (HTML, CSS, JS).
- Syntax highlighting.
- Read-only diff view for AI changes (accept/reject).
- Inline errors surfaced via lightweight linting.

### Live Preview Sandbox
- Iframe sandbox with CSP constraints.
- Preview updates from patched files only (no full reload unless needed).
- Error overlay with JS runtime errors.

### Project Storage (Local)
- IndexedDB for:
  - Project metadata (name, created/updated)
  - File contents
  - Chat history
  - Snapshots / versions
  - Settings (theme, AI profile)

### Templates
- Starter templates stored locally.
- Optional “AI regenerate from template” flow.

### Accessibility + UX Details
- Keyboard shortcuts (Ctrl/Cmd+Enter to send prompt).
- Focus management between chat/editor.
- ARIA labels for sidebar controls.

---

## Non-Functional Requirements
- **Performance:** preview update under 500ms for small patches.
- **Reliability:** no data loss on refresh (local persistence).
- **Security:** sandboxed preview iframe, allowlist for script execution.
- **Offline mode:** fully functional without network.

---

## UX Components (Detailed)
### 1. Status & Feedback
- **Info:** “Generating preview…”
- **Success:** “Preview updated”
- **Warning:** “Generated with warnings: …”
- **Error:** “Generation failed”

### 2. AI Output Review
- AI changes shown in diff viewer.
- One-click “Apply changes” / “Reject changes”.

### 3. History & Audit
- Sidebar log (timestamp, AI action summary, files touched).
- Ability to jump to prior snapshot.

---

## Requirements Traceback (Source-Informed)
- **Prototype elements reused:** status panel, preview, audit log patterns, and prompt-to-preview flow.
- **Code-structure sketch alignment:** chat pipeline, preview bridge, Dexie/IndexedDB persistence, and snapshotting models.
- **Infra context:** gateway + routing patterns acknowledged for eventual hosted deployment, but not required for local-first MVP.

---

## MVP Definition
**Must-have:**
- Chat sidebar + prompt sending
- Code editor + file tree
- Live preview sandbox
- Local persistence
- Undo/snapshot support

**Nice-to-have:**
- Template gallery
- Export ZIP
- Diff viewer
- Error overlay

---

## Open Questions
- Which LLM runtime will be used locally (WASM, API proxy, or user-provided key)?
- Should local storage be encrypted?
- How much streaming UI is needed for long responses?

