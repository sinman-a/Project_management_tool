// Cloudflare Pages Function: transparent reverse-proxy for /api/* → the Worker.
// Keeps the API same-origin with the SPA so the session cookie is first-party
// (works on mobile browsers that block third-party cookies).
const WORKER = 'https://ppm-worker.almazor-schwab.workers.dev'

export const onRequest = async (ctx) => {
  const url = new URL(ctx.request.url) // pathname already starts with /api/...
  const target = WORKER + url.pathname + url.search
  // Clone method, headers (incl. Cookie) and body; preserve redirects (Asana OAuth 302).
  return fetch(new Request(target, ctx.request), { redirect: 'manual' })
}
