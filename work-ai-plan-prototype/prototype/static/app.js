const tenantSelect = document.getElementById("tenantSelect");
const promptInput = document.getElementById("promptInput");
const generateButton = document.getElementById("generateButton");
const statusPanel = document.getElementById("statusPanel");
const previewFrame = document.getElementById("previewFrame");
const auditLog = document.getElementById("auditLog");

async function loadTenants() {
  const response = await fetch("/api/tenants");
  const data = await response.json();
  tenantSelect.innerHTML = "";
  for (const tenant of data.tenants) {
    const option = document.createElement("option");
    option.value = tenant.tenantId;
    option.textContent = `${tenant.displayName} (${tenant.model})`;
    tenantSelect.appendChild(option);
  }
}

function setStatus(message, type = "info") {
  statusPanel.textContent = message;
  statusPanel.className = `status ${type}`;
}

function renderPreview(html) {
  previewFrame.innerHTML = html;
}

function appendAudit(entry) {
  const existing = auditLog.textContent.trim();
  const next = existing ? `${existing}\n${entry}` : entry;
  auditLog.textContent = next;
}

async function generate() {
  const tenantId = tenantSelect.value;
  const prompt = promptInput.value.trim();
  if (!prompt) {
    setStatus("Enter a prompt before generating.", "warning");
    return;
  }
  setStatus("Generating preview...", "info");
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-ID": tenantId,
    },
    body: JSON.stringify({ prompt, tenantId }),
  });
  if (!response.ok) {
    setStatus("Generation failed.", "error");
    return;
  }
  const data = await response.json();
  renderPreview(data.html);
  if (data.warnings.length) {
    setStatus(`Generated with warnings: ${data.warnings.join(", ")}`, "warning");
  } else {
    setStatus("Preview generated successfully.", "success");
  }
  appendAudit(
    `${new Date().toISOString()} | tenant=${data.tenantId} | trace=${data.traceId}`
  );
}

generateButton.addEventListener("click", generate);
loadTenants();
