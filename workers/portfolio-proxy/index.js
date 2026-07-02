const HOST_MAP = {
  'edit.portzenx.com': 'portzen-edit.pages.dev',
  'www.portzenx.com':  'portzen-storefront.pages.dev',
  'portzenx.com':      'portzen-storefront.pages.dev',
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetHost = HOST_MAP[url.hostname] || 'portzen-portfolio.pages.dev';
    const target = new URL(url.pathname + url.search, `https://${targetHost}`);
    const resp = await fetch(target.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    return new Response(resp.body, {
      status: resp.status,
      headers: resp.headers,
    });
  },
};
