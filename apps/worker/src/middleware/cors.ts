import { cors } from 'hono/cors'

// Exact production + local origins.
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:4173',
  'https://ppm-tool.pages.dev',
])

// Cloudflare Pages deploy/preview subdomains for THIS project only.
// The `ppm-tool` project namespace is controlled solely by our account, so
// `<hash>.ppm-tool.pages.dev` / `<branch>.ppm-tool.pages.dev` are trusted.
// Strict, anchored match — avoids loose suffix matching (e.g. evil-ppm-tool.pages.dev).
const PAGES_SUBDOMAIN = /^https:\/\/[a-z0-9][a-z0-9-]*\.ppm-tool\.pages\.dev$/

export const corsMiddleware = cors({
  origin: (origin: string) => {
    if (!origin) return ''
    if (allowedOrigins.has(origin) || PAGES_SUBDOMAIN.test(origin)) {
      return origin
    }
    return ''
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
})
