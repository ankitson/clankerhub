# Deploying clankerhub with Cloudflare Pages

Every folder with an `index.html` gets its own `/path` on your domain, and every pull request gets an automatic preview URL.

## Architecture

```
clankerhub repo
├── pages/index.html                    → yourdomain.com/
├── ai-todo-done-app/web/ (React)       → yourdomain.com/ai-todo-done-app/
├── work-ai-plan-prototype/.../static/  → yourdomain.com/work-ai-plan-prototype/
└── any-new-folder/index.html           → yourdomain.com/any-new-folder/  (auto-discovered)
```

**PR previews** are automatic: `<branch>.clankerhub.pages.dev`

---

## Setup (one-time)

### 1. Create a Cloudflare account

Go to [dash.cloudflare.com](https://dash.cloudflare.com) and sign up if you haven't.

### 2. Create a Cloudflare Pages project

```bash
# Install wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Do an initial deploy to create the project
# (run from the repo root)
bash github-cloudflare-subdomains/build.sh
wrangler pages deploy _site --project-name=clankerhub
```

This creates a project at `clankerhub.pages.dev`.

### 3. Create an API token

1. Go to [Cloudflare Dashboard → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use the **Custom token** template:
   - **Permissions**: `Account` → `Cloudflare Pages` → `Edit`
   - **Account Resources**: Select your account
4. Copy the token

### 4. Add GitHub Secrets

In your GitHub repo → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|--------|-------|
| `CLOUDFLARE_ACCOUNT_ID` | Your account ID (found on the Cloudflare dashboard overview page) |
| `CLOUDFLARE_API_TOKEN` | The API token from step 3 |

### 5. Copy the workflow file

```bash
cp github-cloudflare-subdomains/deploy-cloudflare-pages.yml .github/workflows/deploy-cloudflare-pages.yml
```

Commit and push to `main`. The workflow will run and deploy your site.

---

## How it works

### Path-based routing

The `build.sh` script assembles all projects into a single `_site/` directory:

1. Copies `pages/*` to `_site/` (root landing page)
2. Runs `npm ci && npm run build` for `ai-todo-done-app/web`, copies output to `_site/ai-todo-done-app/`
3. Copies static folders like `work-ai-plan-prototype` to `_site/work-ai-plan-prototype/`
4. Auto-discovers any other top-level folder with an `index.html` and copies it too

Cloudflare Pages serves the `_site/` directory, so each subfolder becomes a path.

### PR preview URLs

Cloudflare Pages has built-in branch previews. The workflow uses `--branch=${{ github.head_ref }}` for PRs, which tells Cloudflare this is a non-production branch. Cloudflare automatically generates a preview URL:

```
https://<branch-name>.clankerhub.pages.dev
```

The workflow also posts a comment on the PR with links to each project's preview.

### Adding a new project

1. Create a folder with an `index.html` at the repo root
2. If it's purely static, you're done — `build.sh` auto-discovers it
3. If it needs a build step, add the build commands to `build.sh` before the auto-discovery loop

---

## Custom domain setup

### Option A: Your domain → Cloudflare Pages (paths)

1. In Cloudflare Dashboard → Pages → clankerhub → Custom domains
2. Click **Set up a custom domain**
3. Enter your domain (e.g., `clankerhub.com`)
4. Cloudflare will guide you through DNS setup
5. All projects are now at `clankerhub.com/project-name/`

### Option B: Subdomains → individual projects

If you want `todo.clankerhub.com` instead of `clankerhub.com/ai-todo-done-app/`, you have two options:

#### B1. Cloudflare Worker as reverse proxy (recommended)

Deploy a Worker that routes subdomains to paths on your Pages deployment:

```javascript
// subdomain-router.js — deploy as a Cloudflare Worker
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const subdomain = url.hostname.split('.')[0];

    // Map subdomains to paths on the Pages deployment
    const routes = {
      'todo': '/ai-todo-done-app',
      'prototype': '/work-ai-plan-prototype',
      // add more mappings here
    };

    const pathPrefix = routes[subdomain];
    if (pathPrefix) {
      // Rewrite to the Pages deployment
      const pagesUrl = new URL(request.url);
      pagesUrl.hostname = 'clankerhub.pages.dev';
      pagesUrl.pathname = pathPrefix + url.pathname;
      return fetch(pagesUrl, request);
    }

    // Default: serve root
    const pagesUrl = new URL(request.url);
    pagesUrl.hostname = 'clankerhub.pages.dev';
    return fetch(pagesUrl, request);
  }
};
```

Then add DNS records:
```
todo.clankerhub.com      → CNAME → clankerhub.pages.dev (proxied)
prototype.clankerhub.com → CNAME → clankerhub.pages.dev (proxied)
```

And set up a Worker Route: `*.clankerhub.com/*` → `subdomain-router`

#### B2. Separate Cloudflare Pages projects

Create a separate Pages project per app, each with its own build:
```bash
wrangler pages deploy ai-todo-done-app/web/dist --project-name=clankerhub-todo
wrangler pages deploy work-ai-plan-prototype/prototype/static --project-name=clankerhub-prototype
```

Then add custom domains to each project in the dashboard.

---

## Files in this folder

| File | Purpose |
|------|---------|
| `build.sh` | Assembles all projects into `_site/` for deployment |
| `deploy-cloudflare-pages.yml` | GitHub Actions workflow (copy to `.github/workflows/`) |
| `subdomain-router.js` | Optional Cloudflare Worker for subdomain routing |
| `notes.md` | Investigation notes and decision log |
| `README.md` | This file |
