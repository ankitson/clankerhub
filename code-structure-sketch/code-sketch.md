# Code-Level Structure Sketch

> Goal: outline the main code components for the AI-powered web app platform with client-first execution, edge routing, and AI generation.

## Repository layout (proposed)

```
apps/
  web/                      # SvelteKit main UI + chat + preview host
    src/
      routes/
        (app)/              # Authenticated app builder UI
        (preview)/          # Static preview shell for sandboxed iframes
      lib/
        api/                # API clients (LLM gateway, Supabase, storage)
        chat/               # Conversation state + streaming pipeline
        preview/            # Sandpack/iframe bridge + runtime
        project/            # Project state, snapshot, undo/redo
        security/           # Output validation + CSP helpers
        storage/            # Dexie-backed persistence
        sync/               # Offline queue + server sync
        ui/                 # Shared UI components
      workers/              # Service worker (Workbox)
  edge-worker/              # Cloudflare Worker for subdomain routing + LLM gateway
    src/
      handlers/
        app-router.ts
        llm-gateway.ts
        auth.ts
      middleware/
        rate-limit.ts
        tenant-context.ts
      storage/
        kv.ts
        r2.ts
packages/
  ai-core/                  # LLM orchestration + RAG + validation
    src/
      prompt/
      policies/
      validators/
      tools/
  sandbox-runtime/          # Sandpack/WebContainer setup + message bridge
    src/
      sandbox.ts
      events.ts
  sync-engine/              # Conflict resolution + LWW invariants
    src/
      queue.ts
      merge.ts
      versioning.ts
  shared/                   # Shared types, schemas, utilities
    src/
      types/
      schemas/
      constants/
services/
  supabase/                 # SQL migrations + RLS policies
    migrations/
    seed/
```

## Core domain types (shared)

```ts
// packages/shared/src/types/domain.ts
export type TenantId = string;
export type ProjectId = string;
export type AppVersionId = string;

export interface Project {
  id: ProjectId;
  tenantId: TenantId;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSnapshot {
  id: AppVersionId;
  projectId: ProjectId;
  versionNumber: number;
  createdAt: string;
  description?: string;
  files: Record<string, string>; // e.g. { "/App.svelte": "..." }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: string;
}
```

## Client (SvelteKit) modules

### Chat + generation pipeline

```ts
// apps/web/src/lib/chat/useChatSession.ts
export function useChatSession(projectId: ProjectId) {
  const messages = writable<ChatMessage[]>([]);
  const generation = createGenerationStream(projectId);

  async function sendUserMessage(input: string) {
    const message: ChatMessage = {
      role: "user",
      content: input,
      createdAt: new Date().toISOString(),
    };
    messages.update((m) => [...m, message]);

    // stream LLM output and apply file changes to local state
    for await (const chunk of generation.stream(input)) {
      applyPatchToFiles(chunk.files);
      messages.update((m) => [...m, chunk.message]);
    }
  }

  return { messages, sendUserMessage };
}
```

### Preview runtime bridge

```ts
// apps/web/src/lib/preview/previewBridge.ts
export function createPreviewBridge(iframe: HTMLIFrameElement) {
  function updateFiles(files: Record<string, string>) {
    iframe.contentWindow?.postMessage({ type: "update-files", files }, "*");
  }

  function setCspNonce(nonce: string) {
    iframe.contentWindow?.postMessage({ type: "set-csp", nonce }, "*");
  }

  return { updateFiles, setCspNonce };
}
```

### Local storage + sync

```ts
// apps/web/src/lib/storage/db.ts
export const db = new Dexie("AppDatabase");

db.version(1).stores({
  currentState: "++id, projectId",
  snapshots: "++id, projectId, timestamp",
  syncQueue: "++id, operation, timestamp",
});
```

```ts
// apps/web/src/lib/sync/syncQueue.ts
export async function enqueueChange(change: SyncChange) {
  await db.table("syncQueue").add({
    ...change,
    timestamp: Date.now(),
  });
}

export async function flushQueue(client: ApiClient) {
  const pending = await db.table("syncQueue").toArray();
  for (const entry of pending) {
    await client.sync(entry);
    await db.table("syncQueue").delete(entry.id);
  }
}
```

## Edge worker (Cloudflare)

```ts
// apps/edge-worker/src/handlers/app-router.ts
export async function handleAppRequest(request: Request, env: Env) {
  const url = new URL(request.url);
  const subdomain = url.hostname.split(".")[0];
  const tenant = await env.TENANT_CONFIG.get(subdomain, "json");
  if (!tenant) return new Response("Not found", { status: 404 });

  const appBundle = await env.APP_BUNDLES.get(`${tenant.id}/app.js`);
  return new Response(appBundle?.body ?? "", {
    headers: {
      "Content-Type": "application/javascript",
      "X-Tenant-ID": tenant.id,
    },
  });
}
```

```ts
// apps/edge-worker/src/handlers/llm-gateway.ts
export async function handleLlmRequest(request: Request, env: Env) {
  const { prompt, projectId } = await request.json();
  const context = await env.RAG_INDEX.query(prompt);

  const response = await env.ANTHROPIC.fetch("/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      stream: true,
      messages: [{ role: "user", content: prompt }],
      system: buildSystemPrompt(context),
    }),
  });

  return response; // stream to client
}
```

## AI core package

```ts
// packages/ai-core/src/validators/outputValidator.ts
const forbiddenPatterns = [
  /eval\s*\(/,
  /new\s+Function/,
  /document\.write/,
  /innerHTML\s*=/,
];

export function validateGeneratedCode(code: string) {
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(code)) {
      return { safe: false, reason: `Blocked pattern: ${pattern}` };
    }
  }
  return { safe: true, code };
}
```

```ts
// packages/ai-core/src/tools/patchComposer.ts
export function composeFilePatches(diff: FileDiff[]): PatchOutput {
  return diff.reduce((acc, change) => {
    acc.files[change.path] = change.content;
    return acc;
  }, { files: {} } as PatchOutput);
}
```

## Sync engine

```ts
// packages/sync-engine/src/merge.ts
export function mergeSnapshots(base: AppSnapshot, incoming: AppSnapshot) {
  return {
    ...incoming,
    files: { ...base.files, ...incoming.files }, // property-level LWW
  };
}
```

## Service worker

```ts
// apps/web/src/workers/sw.ts
self.addEventListener("sync", (event: SyncEvent) => {
  if (event.tag === "sync-changes") {
    event.waitUntil(flushQueue(new ApiClient()));
  }
});
```

## Data flow outline

1. User message -> `useChatSession` -> LLM gateway stream.
2. LLM stream -> `ai-core` validation -> patch -> local state + preview bridge.
3. Snapshot saved to Dexie -> queued to sync engine.
4. Edge worker persists snapshots in R2 + Supabase row.
5. Preview iframe receives code updates and hot reloads.

