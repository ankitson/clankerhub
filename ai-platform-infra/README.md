# AI-Powered Web App Platform — Infra Scaffolding Report

## Goal
Provide Terraform and Docker scaffolding to manage the high-level infrastructure described in the architecture brief: Cloudflare Workers for edge routing, KV/R2 for tenant config and assets, wildcard DNS for subdomains, and local mocks for foundational services (Postgres, Redis, object storage, edge router, and LLM gateway).

## What’s Included

### Terraform (Cloudflare edge tier)
Location: `terraform/`

- **Workers edge router** with KV + R2 bindings to serve tenant-specific app bundles.
- **KV namespace** for tenant config lookup.
- **R2 bucket** for generated app assets and snapshots.
- **Wildcard DNS** for preview subdomains.
- **Outputs and variables** for Supabase and LLM gateway connectivity.

Files:
- `terraform/main.tf` — Cloudflare Workers, KV, R2, and DNS records.
- `terraform/variables.tf` — inputs for account/zone IDs, domain info, and Supabase/LLM endpoints.
- `terraform/outputs.tf` — IDs/names for wiring into CI/CD.
- `terraform/versions.tf` — provider/version constraints.
- `terraform/workers/edge-router.js` — minimal router that fetches tenant bundles from R2 using KV metadata.

### Docker (local mocks)
Location: `docker/`

- `docker-compose.yml` spins up:
  - **Postgres** — local backing store for Supabase-like data.
  - **Redis** — placeholder for a KV/ratelimit store.
  - **MinIO** — S3-compatible storage for app bundles.
  - **Mock edge router** — HTTP service that represents edge routing.
  - **Mock LLM gateway** — HTTP service that represents the LLM request broker.

These containers are intentionally lightweight and serve as placeholders for high-level platform integration.

## How to Use

### Terraform (Cloudflare)
```bash
cd terraform
terraform init
terraform apply \
  -var="cloudflare_api_token=..." \
  -var="cloudflare_account_id=..." \
  -var="cloudflare_zone_id=..." \
  -var="platform_domain=platform.com" \
  -var="preview_subdomain=preview.platform.com" \
  -var='worker_routes=["*.preview.platform.com/*"]' \
  -var="supabase_project_url=https://your.supabase.co" \
  -var="supabase_anon_key=..." \
  -var="supabase_service_role_key=..." \
  -var="llm_gateway_url=https://llm-gateway.platform.com"
```

### Docker (local mocks)
```bash
cd docker
docker compose up --build
```

## Notes / Next Steps
- Replace mock Docker services with production services (Cloudflare Workers, Supabase, and your LLM gateway service).
- Add CI workflows for Terraform plan/apply and to publish Worker scripts.
- Integrate secrets management (Vault, SSM, or Cloudflare Secrets) for API keys.

