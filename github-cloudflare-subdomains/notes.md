# Notes: GitHub + Cloudflare Pages Setup

## Goal

Set up the clankerhub monorepo so that:
1. Every folder with an `index.html` gets its own `/path` on the domain
2. Every PR automatically generates a preview URL
3. Optionally, projects can get their own subdomains

## What I explored

### Current state
- Repo already deploys to GitHub Pages via `.github/workflows/deploy-pages.yml`
- Three folders have `index.html`:
  - `pages/` → landing page (root)
  - `ai-todo-done-app/web/` → React app (needs `npm run build`)
  - `work-ai-plan-prototype/prototype/static/` → static HTML
- Terraform scaffolding exists in `ai-platform-infra/terraform/` but isn't active

### Options considered

**Option 1: GitHub Pages + Cloudflare DNS (proxy only)**
- Pros: Already working, free
- Cons: No PR preview URLs, GitHub Pages doesn't support this natively
- Verdict: Not sufficient

**Option 2: Cloudflare Pages (chosen)**
- Pros: Native GitHub integration, automatic PR previews, custom domains, free tier generous (500 builds/month, unlimited bandwidth)
- Cons: Need to set up Cloudflare account and API token
- Verdict: Best fit — handles both requirements with minimal config

**Option 3: Separate Cloudflare Pages project per subfolder**
- Each project gets its own `project.pages.dev` subdomain
- Pros: True subdomains, independent deployments
- Cons: More complex to manage, need multiple projects
- Verdict: Overkill for current repo size, but documented as an option

### Key decisions
- Used `wrangler pages deploy` via GitHub Actions rather than Cloudflare's built-in GitHub integration, because the built-in integration only supports a single build command and output directory, while this repo needs a multi-step build
- The `--branch` flag is critical: Cloudflare Pages treats `main`/`master` as production and all other branches as preview deployments — so PR branches automatically get preview URLs
- PR preview URLs follow the pattern: `<branch-name>.<project-name>.pages.dev`

### Subdomain approach (if desired later)
For true subdomains like `todo.clankerhub.com`, you would:
1. Create separate Cloudflare Pages projects per app, OR
2. Use a Cloudflare Worker as a reverse proxy that routes `todo.yourdomain.com` → `/ai-todo-done-app/` on the main Pages deployment

The Worker approach is documented in the README as an optional enhancement.
