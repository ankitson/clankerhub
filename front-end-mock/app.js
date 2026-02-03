const STORAGE_KEY = "live-builder-state";
const SNAPSHOT_LIMIT = 8;

const defaultFiles = {
  "index.html": `<div class="hero">
  <nav>
    <strong>Nova</strong>
    <div class="nav-links">
      <span>Product</span>
      <span>Pricing</span>
      <span>Docs</span>
    </div>
    <button>Get Started</button>
  </nav>
  <section>
    <h1>Launch your next idea with AI copilots.</h1>
    <p>
      This preview updates instantly whenever you tweak files or request a new
      AI change.
    </p>
    <div class="cta">
      <button class="primary">Create a project</button>
      <button class="ghost">View live demo</button>
    </div>
  </section>
  <div class="feature-grid">
    <div>
      <h3>Live Preview</h3>
      <p>See every change immediately in a sandboxed iframe.</p>
    </div>
    <div>
      <h3>Local-first</h3>
      <p>All data persists in your browser for offline work.</p>
    </div>
    <div>
      <h3>Audit Trail</h3>
      <p>Trace AI changes and revert whenever you like.</p>
    </div>
  </div>
</div>`
  ,
  "styles.css": `body {
  margin: 0;
  font-family: "Inter", system-ui, sans-serif;
  background: #f5f6fb;
  color: #1b1f2a;
}

.hero {
  padding: 40px 48px 60px;
}

nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.nav-links {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #5c6476;
}

nav button {
  border-radius: 999px;
  padding: 8px 16px;
  border: none;
  background: #2026d2;
  color: #fff;
}

section {
  margin-top: 50px;
  max-width: 540px;
}

section h1 {
  font-size: 40px;
  margin-bottom: 12px;
}

section p {
  color: #5c6476;
}

.cta {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.cta .primary {
  background: #3b5bff;
  color: #fff;
  border: none;
  padding: 10px 18px;
  border-radius: 12px;
}

.cta .ghost {
  background: transparent;
  border: 1px solid #cfd6ff;
  padding: 10px 18px;
  border-radius: 12px;
}

.feature-grid {
  margin-top: 50px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.feature-grid div {
  background: #fff;
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 10px 20px rgba(20, 24, 45, 0.08);
}
`
  ,
  "app.js": `document.addEventListener("DOMContentLoaded", () => {
  const message = document.createElement("p");
  message.textContent = "This is a mocked app preview. Update files to see changes.";
  message.style.marginTop = "30px";
  message.style.color = "#5c6476";
  document.body.appendChild(message);
});
`
};

const state = {
  files: structuredClone(defaultFiles),
  activeFile: "index.html",
  messages: [
    {
      role: "assistant",
      content: "Hi! I can help generate and edit your app. Try a prompt or edit the code directly.",
      timestamp: new Date().toISOString()
    }
  ],
  auditLog: [],
  snapshots: [],
  pendingEdits: {},
  dirty: false
};

const elements = {
  chatThread: document.getElementById("chat-thread"),
  chatForm: document.getElementById("chat-form"),
  promptInput: document.getElementById("prompt-input"),
  statusBanner: document.getElementById("status-banner"),
  auditList: document.getElementById("audit-list"),
  clearLog: document.getElementById("clear-log"),
  previewFrame: document.getElementById("preview-frame"),
  fileTree: document.getElementById("file-tree"),
  editorTabs: document.getElementById("editor-tabs"),
  codeEditor: document.getElementById("code-editor"),
  applyChange: document.getElementById("apply-change"),
  discardChange: document.getElementById("discard-change"),
  lintPanel: document.getElementById("lint-panel"),
  snapshotItems: document.getElementById("snapshot-items"),
  resetPreview: document.getElementById("reset-preview"),
  saveSnapshot: document.getElementById("save-snapshot"),
  undoBtn: document.getElementById("undo-btn"),
  exportBtn: document.getElementById("export-btn"),
  newProjectBtn: document.getElementById("new-project-btn")
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    Object.assign(state, parsed);
  } catch (error) {
    console.warn("Unable to restore saved state", error);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setStatus(message, type = "info") {
  elements.statusBanner.textContent = message;
  elements.statusBanner.className = `status-banner ${type}`;
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderChat() {
  elements.chatThread.innerHTML = "";
  state.messages.forEach((message) => {
    const wrapper = document.createElement("div");
    wrapper.className = `chat-message ${message.role}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = message.role === "user" ? "U" : "AI";

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    bubble.innerHTML = `<strong>${message.role === "user" ? "You" : "Assistant"}</strong><br>${message.content}`;

    wrapper.append(avatar, bubble);
    elements.chatThread.appendChild(wrapper);
  });
  elements.chatThread.scrollTop = elements.chatThread.scrollHeight;
}

function renderAuditLog() {
  elements.auditList.innerHTML = "";
  if (state.auditLog.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No AI actions yet.";
    elements.auditList.appendChild(empty);
    return;
  }
  state.auditLog.slice().reverse().forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = `${formatTimestamp(entry.timestamp)} · ${entry.summary}`;
    elements.auditList.appendChild(item);
  });
}

function renderFiles() {
  elements.fileTree.innerHTML = "";
  Object.keys(state.files).forEach((file) => {
    const item = document.createElement("div");
    item.className = `file-item ${file === state.activeFile ? "active" : ""}`;
    item.textContent = file;
    item.addEventListener("click", () => {
      state.activeFile = file;
      renderFiles();
      renderEditor();
    });
    elements.fileTree.appendChild(item);
  });

  elements.editorTabs.innerHTML = "";
  Object.keys(state.files).forEach((file) => {
    const tab = document.createElement("div");
    tab.className = `editor-tab ${file === state.activeFile ? "active" : ""}`;
    tab.textContent = file;
    tab.addEventListener("click", () => {
      state.activeFile = file;
      renderFiles();
      renderEditor();
    });
    elements.editorTabs.appendChild(tab);
  });
}

function renderEditor() {
  elements.codeEditor.value = state.pendingEdits[state.activeFile] ?? state.files[state.activeFile];
  elements.lintPanel.textContent = "No lint warnings. AI output validation passed.";
}

function buildPreview() {
  const html = state.files["index.html"];
  const css = state.files["styles.css"];
  const js = state.files["app.js"];
  const doc = `<!doctype html>
<html>
  <head>
    <style>${css}</style>
  </head>
  <body>
    ${html}
    <script>${js}</script>
  </body>
</html>`;
  elements.previewFrame.srcdoc = doc;
}

function addAudit(summary) {
  state.auditLog.push({
    summary,
    timestamp: new Date().toISOString()
  });
  renderAuditLog();
}

function pushSnapshot(label) {
  state.snapshots.unshift({
    id: crypto.randomUUID(),
    label,
    timestamp: new Date().toISOString(),
    files: structuredClone(state.files)
  });
  if (state.snapshots.length > SNAPSHOT_LIMIT) {
    state.snapshots = state.snapshots.slice(0, SNAPSHOT_LIMIT);
  }
  renderSnapshots();
}

function renderSnapshots() {
  elements.snapshotItems.innerHTML = "";
  if (state.snapshots.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No snapshots saved yet.";
    elements.snapshotItems.appendChild(empty);
    return;
  }

  state.snapshots.forEach((snapshot) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${snapshot.label} · ${formatTimestamp(snapshot.timestamp)}`;
    const restore = document.createElement("button");
    restore.textContent = "Restore";
    restore.className = "ghost";
    restore.addEventListener("click", () => {
      state.files = structuredClone(snapshot.files);
      state.pendingEdits = {};
      renderFiles();
      renderEditor();
      buildPreview();
      setStatus("Snapshot restored.", "success");
      saveState();
    });
    item.append(label, restore);
    elements.snapshotItems.appendChild(item);
  });
}

function applyMockPatch(prompt) {
  const timestamp = new Date().toISOString();
  const summary = `AI update: ${prompt.slice(0, 60)}${prompt.length > 60 ? "…" : ""}`;
  const newFiles = structuredClone(state.files);

  if (prompt.toLowerCase().includes("pricing")) {
    newFiles["index.html"] += `\n<section class="pricing">\n  <h2>Flexible pricing</h2>\n  <div class="tiers">\n    <div><h4>Starter</h4><p>$19/mo</p></div>\n    <div><h4>Growth</h4><p>$49/mo</p></div>\n    <div><h4>Scale</h4><p>$99/mo</p></div>\n  </div>\n</section>`;
    newFiles["styles.css"] += `\n.pricing { margin-top: 48px; }\n.tiers { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; }\n.tiers div { background:#fff; padding:16px; border-radius:12px; box-shadow:0 6px 14px rgba(20,24,45,0.08); }`;
  } else if (prompt.toLowerCase().includes("spacing")) {
    newFiles["styles.css"] += `\nsection { line-height: 1.6; }\n.hero { padding: 56px 64px; }`;
  } else if (prompt.toLowerCase().includes("explain")) {
    // no changes, explanation only
  } else {
    newFiles["index.html"] = newFiles["index.html"].replace(
      "Launch your next idea with AI copilots.",
      "Launch your next idea with AI copilots and real-time previews."
    );
  }

  state.files = newFiles;
  state.pendingEdits = {};
  state.messages.push({ role: "assistant", content: `Mocked response: ${summary}`, timestamp });
  addAudit(summary);
  pushSnapshot("AI Patch");
  buildPreview();
  renderFiles();
  renderEditor();
  renderChat();
  setStatus("Preview updated with AI changes.", "success");
  saveState();
}

function handlePrompt(prompt) {
  if (!prompt.trim()) return;
  state.messages.push({ role: "user", content: prompt, timestamp: new Date().toISOString() });
  renderChat();
  setStatus("Generating preview…", "info");
  setTimeout(() => {
    applyMockPatch(prompt);
  }, 700);
}

function handleEditorInput(value) {
  state.pendingEdits[state.activeFile] = value;
  state.dirty = true;
  elements.lintPanel.textContent = "Pending edits detected. Click Apply changes to sync.";
}

function applyEditorChanges() {
  if (!state.dirty) {
    setStatus("No local changes to apply.", "warning");
    return;
  }
  state.files[state.activeFile] = state.pendingEdits[state.activeFile];
  state.pendingEdits = {};
  state.dirty = false;
  buildPreview();
  setStatus("Changes applied to preview.", "success");
  saveState();
}

function discardEditorChanges() {
  state.pendingEdits = {};
  state.dirty = false;
  renderEditor();
  setStatus("Discarded pending edits.", "warning");
}

function handleReset() {
  state.files = structuredClone(defaultFiles);
  state.pendingEdits = {};
  state.auditLog = [];
  state.snapshots = [];
  state.messages = state.messages.slice(0, 1);
  buildPreview();
  renderChat();
  renderAuditLog();
  renderSnapshots();
  renderFiles();
  renderEditor();
  setStatus("Preview reset to default template.", "success");
  saveState();
}

function handleUndo() {
  const snapshot = state.snapshots.shift();
  if (!snapshot) {
    setStatus("No snapshots available to undo.", "warning");
    return;
  }
  state.files = structuredClone(snapshot.files);
  state.pendingEdits = {};
  buildPreview();
  renderFiles();
  renderEditor();
  renderSnapshots();
  setStatus("Reverted to previous snapshot.", "success");
  saveState();
}

function handleExport() {
  const payload = {
    exportedAt: new Date().toISOString(),
    files: state.files,
    auditLog: state.auditLog,
    snapshots: state.snapshots
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "live-builder-export.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function handleNewProject() {
  if (!confirm("Start a new project? This will clear local changes.")) {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

function setPreviewSize(size) {
  elements.previewFrame.className = size === "desktop" ? "" : size;
  document.querySelectorAll(".preview-actions button[data-size]").forEach((button) => {
    button.classList.toggle("active", button.dataset.size === size);
  });
}

function wireEvents() {
  elements.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const prompt = elements.promptInput.value;
    elements.promptInput.value = "";
    handlePrompt(prompt);
  });

  elements.promptInput.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      const prompt = elements.promptInput.value;
      elements.promptInput.value = "";
      handlePrompt(prompt);
    }
  });

  elements.codeEditor.addEventListener("input", (event) => {
    handleEditorInput(event.target.value);
  });

  elements.applyChange.addEventListener("click", applyEditorChanges);
  elements.discardChange.addEventListener("click", discardEditorChanges);
  elements.resetPreview.addEventListener("click", handleReset);
  elements.saveSnapshot.addEventListener("click", () => {
    pushSnapshot("Manual snapshot");
    setStatus("Snapshot saved.", "success");
    saveState();
  });
  elements.undoBtn.addEventListener("click", handleUndo);
  elements.exportBtn.addEventListener("click", handleExport);
  elements.newProjectBtn.addEventListener("click", handleNewProject);

  elements.clearLog.addEventListener("click", () => {
    state.auditLog = [];
    renderAuditLog();
    saveState();
  });

  document.querySelectorAll(".quick-actions button").forEach((button) => {
    button.addEventListener("click", () => handlePrompt(button.dataset.prompt));
  });

  document.querySelectorAll(".preview-actions button[data-size]").forEach((button) => {
    button.addEventListener("click", () => setPreviewSize(button.dataset.size));
  });
}

loadState();
renderChat();
renderFiles();
renderEditor();
renderAuditLog();
renderSnapshots();
buildPreview();
wireEvents();
