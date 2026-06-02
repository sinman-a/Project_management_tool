import type { D1Database, KVNamespace } from '@cloudflare/workers-types'

export interface Env {
  DB: D1Database
  KV_CACHE: KVNamespace
  JWT_SECRET: string
  JWT_EXPIRY: string
  ENVIRONMENT: string
  // Asana OAuth (set via: wrangler secret put ASANA_CLIENT_ID / ASANA_CLIENT_SECRET)
  ASANA_CLIENT_ID: string
  ASANA_CLIENT_SECRET: string
  ASANA_REDIRECT_URI: string
}

export type UserRole = 'admin' | 'program_manager' | 'project_manager' | 'team_member' | 'pmo_lead' | 'sponsor' | 'viewer'

export interface JwtPayload {
  sub: string
  email: string
  role: UserRole
  orgId: string
  iat: number
  exp: number
}

export interface HonoContext {
  Bindings: Env
  Variables: {
    user: JwtPayload
  }
}
