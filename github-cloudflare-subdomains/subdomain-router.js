// subdomain-router.js
//
// Optional Cloudflare Worker that routes subdomains to paths on the
// main Cloudflare Pages deployment.
//
// Example:
//   todo.clankerhub.com       → clankerhub.pages.dev/ai-todo-done-app/
//   prototype.clankerhub.com  → clankerhub.pages.dev/work-ai-plan-prototype/
//   clankerhub.com            → clankerhub.pages.dev/ (root)
//
// Deploy with:
//   wrangler deploy subdomain-router.js --name subdomain-router
//
// Then add a Worker Route in Cloudflare Dashboard:
//   *.clankerhub.com/* → subdomain-router
//
// And DNS records (proxied through Cloudflare):
//   todo.clankerhub.com      CNAME  clankerhub.pages.dev
//   prototype.clankerhub.com CNAME  clankerhub.pages.dev

const PAGES_ORIGIN = 'clankerhub.pages.dev';

// Map subdomains to path prefixes on the Pages deployment.
// Add new entries here as you add projects.
const SUBDOMAIN_ROUTES = {
  'todo': '/ai-todo-done-app',
  'prototype': '/work-ai-plan-prototype',
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const hostParts = url.hostname.split('.');
    const subdomain = hostParts[0];

    const targetUrl = new URL(request.url);
    targetUrl.hostname = PAGES_ORIGIN;
    targetUrl.port = '';
    targetUrl.protocol = 'https:';

    const pathPrefix = SUBDOMAIN_ROUTES[subdomain];
    if (pathPrefix) {
      // Prepend the path prefix, preserving the rest of the URL
      targetUrl.pathname = pathPrefix + url.pathname;
    }

    // Forward the request to the Pages deployment
    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow',
    });

    // Return the response with CORS headers preserved
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  },
};
