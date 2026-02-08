#!/usr/bin/env bash
# build.sh — Assembles all projects into _site/ for Cloudflare Pages deployment.
#
# Every folder containing an index.html gets its own /path on the domain.
# Projects that need a build step (e.g. npm) are handled explicitly.
# Static-only folders are copied as-is.
set -euo pipefail

SITE_DIR="_site"
rm -rf "$SITE_DIR"
mkdir -p "$SITE_DIR"

# ── 1. Landing page (root) ──────────────────────────────────────────
echo "» Copying landing page → /"
cp -r pages/* "$SITE_DIR/"

# ── 2. ai-todo-done-app (needs npm build) ───────────────────────────
if [ -f ai-todo-done-app/web/package.json ]; then
  echo "» Building ai-todo-done-app → /ai-todo-done-app/"
  (cd ai-todo-done-app/web && npm ci && npm run build)
  mkdir -p "$SITE_DIR/ai-todo-done-app"
  cp -r ai-todo-done-app/web/dist/* "$SITE_DIR/ai-todo-done-app/"
fi

# ── 3. work-ai-plan-prototype (static) ──────────────────────────────
if [ -f work-ai-plan-prototype/prototype/static/index.html ]; then
  echo "» Copying work-ai-plan-prototype → /work-ai-plan-prototype/"
  mkdir -p "$SITE_DIR/work-ai-plan-prototype"
  cp -r work-ai-plan-prototype/prototype/static/* "$SITE_DIR/work-ai-plan-prototype/"
fi

# ── 4. Auto-discover additional static projects ─────────────────────
# Any top-level folder with a direct index.html that wasn't handled above
# gets copied automatically. Add build steps above for projects that need them.
for dir in */; do
  dir="${dir%/}"
  # Skip already-handled folders and non-project dirs
  case "$dir" in
    _site|pages|ai-todo-done-app|work-ai-plan-prototype|.github|node_modules|github-cloudflare-subdomains) continue ;;
  esac
  if [ -f "$dir/index.html" ]; then
    echo "» Auto-discovered static project: $dir → /$dir/"
    mkdir -p "$SITE_DIR/$dir"
    cp -r "$dir"/* "$SITE_DIR/$dir/"
  fi
done

echo ""
echo "Build complete. Contents of $SITE_DIR/:"
ls -la "$SITE_DIR/"
