import { cors } from 'hono/cors'

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://ppm-tool.pages.dev',
]

export const corsMiddleware = cors({
  origin: (origin: string) => {
    if (allowedOrigins.includes(origin) || origin?.endsWith('.ppm-tool.pages.dev')) {
      return origin
    }
    return ''
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
})
