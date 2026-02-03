# AI Platform Plans Review & Prototype

## Source Plans Reviewed

- **Infra scaffolding plan**: Cloudflare Workers, KV/R2, wildcard DNS, and local Docker mocks for Postgres/Redis/MinIO/edge router/LLM gateway. (From `ai-platform-infra/README.md`.)
- **Code-level sketch**: SvelteKit app, Cloudflare worker edge router, AI core validators, sync engine, and service worker flow. (From `code-structure-sketch/code-sketch.md`.)

## Critique

### Infra plan strengths
- Clear mapping of Cloudflare primitives (Workers, KV, R2) to multi-tenant delivery.
- Helpful local mocks to reduce startup friction.

### Infra plan gaps
- **Identity/tenant isolation**: no mention of authn/authz or tenant boundary enforcement beyond subdomains.
- **Secrets + key rotation**: relies on unscoped variables; no rotation story.
- **Observability**: missing logging/metrics/trace propagation requirements (critical for LLM debugging).
- **Deployment staging**: no rollback strategy or canary path for worker/edge updates.

### Code-level plan strengths
- Modular breakdown of client, edge, AI core, and sync engine.
- Identifies validation and sandbox components.

### Code-level plan gaps
- **Contract definitions** between client and gateway (schema evolution, versioning, error taxonomy).
- **Policy enforcement**: validation is only content-scanning; no clear policy layering (tenant policy vs. global policy).
- **Queue reliability**: sync queue lacks idempotency and retry/backoff semantics.
- **Preview security**: iframe bridge assumes permissive message passing and lacks CSP/nonce enforcement detail.

## Revised Plan (condensed)

1. **Explicit platform contracts**
   - Define JSON schema for `/api/generate`, `/api/sync`, `/api/preview` with versioned envelopes.
   - Require trace IDs for every request and response.

2. **Tenant-aware policy engine**
   - Layer policies: global safety + tenant-specific overrides.
   - Maintain policy in a KV/R2-backed config service, with signed policy payloads.

3. **Gateway with guardrails**
   - LLM gateway enforces policy checks, response validation, and response shaping.
   - Attach observability metadata (trace ID, model, latency) to every response.

4. **Edge routing with isolation**
   - Resolve tenant by subdomain, attach tenant policy + model config in request context.
   - Rate limiting per tenant + per user.

5. **Client pipeline**
   - Client requests include versioned schema + trace ID.
   - UI surfaces warnings/errors from validation and includes a local audit trail.

6. **Sync engine resilience**
   - Idempotent operations with deterministic change IDs.
   - Retry with exponential backoff; report failures in UI.

## Prototype Summary

A minimal prototype was created to exercise the revised plan:

- **Tenant-aware generation UI** in `static/`.
- **`/api/generate` gateway stub** applying validation and returning warnings.
- **`/api/tenants`** endpoint to hydrate UI with tenant metadata.
- **Audit trail** showing trace IDs to simulate observability requirements.

See `prototype/README.md` for run instructions.
