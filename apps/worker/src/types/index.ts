import type { D1Database, KVNamespace } from '@cloudflare/workers-types'

export interface Env {
  DB: D1Database
  KV_CACHE: KVNamespace
  JWT_SECRET: string
  JWT_EXPIRY: string
  ENVIRONMENT: string
}

export type UserRole = 'admin' | 'program_manager' | 'project_manager' | 'team_member'

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
