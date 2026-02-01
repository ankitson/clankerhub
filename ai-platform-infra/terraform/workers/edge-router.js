export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const subdomain = hostname.split('.')[0];

    const tenant = await env.TENANT_CONFIG.get(subdomain, { type: "json" });
    if (!tenant) {
      return new Response("App not found", { status: 404 });
    }

    const objectKey = `${tenant.id}/app.js`;
    const appObject = await env.APP_ASSETS.get(objectKey);
    if (!appObject) {
      return new Response("App bundle missing", { status: 404 });
    }

    return new Response(appObject.body, {
      headers: {
        "Content-Type": "application/javascript",
        "X-Tenant-ID": tenant.id,
      },
    });
  },
};
