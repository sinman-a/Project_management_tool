import type { MiddlewareHandler } from 'hono'
import { jwtVerify } from 'jose'
import type { Env, HonoContext, JwtPayload } from '../types'

function readTokenCookie(c: { req: { header: (k: string) => string | undefined } }): string | undefined {
  const cookie = c.req.header('Cookie') ?? ''
  return cookie
    .split(';')
    .find((s) => s.trim().startsWith('ppm_token='))
    ?.split('=')[1]
    ?.trim()
}

/**
 * Verify a JWT against the current secret, falling back to the previous secret
 * during a rotation window. Algorithm is pinned to HS256.
 */
export async function verifyToken(token: string, env: Env): Promise<JwtPayload | null> {
  const secrets = [env.JWT_SECRET, env.JWT_SECRET_PREVIOUS].filter((s): s is string => !!s)
  for (const s of secrets) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(s), { algorithms: ['HS256'] })
      return payload as unknown as JwtPayload
    } catch {
      // try next secret
    }
  }
  return null
}

export const authMiddleware: MiddlewareHandler<HonoContext> = async (c, next) => {
  const token = readTokenCookie(c)
  if (!token) return c.json({ message: 'Unauthorized' }, 401)

  const payload = await verifyToken(token, c.env)
  if (!payload) return c.json({ message: 'Invalid or expired token' }, 401)

  // Stateful session check: enforce live account status, role and revocation epoch.
  const dbUser = await c.env.DB.prepare(
    'SELECT id, role, org_id, is_active, token_version FROM users WHERE id = ?',
  ).bind(payload.sub).first<{ id: string; role: string; org_id: string; is_active: number; token_version: number }>()

  // Tokens issued before this feature lack `tv`; treat as epoch 0 to avoid a mass logout on rollout.
  const tokenEpoch = payload.tv ?? 0
  if (!dbUser || dbUser.is_active !== 1 || dbUser.token_version !== tokenEpoch) {
    return c.json({ message: 'Session expired' }, 401)
  }

  // Use the live role/org from the DB (token may carry a stale role after a change).
  c.set('user', { ...payload, role: dbUser.role as JwtPayload['role'], orgId: dbUser.org_id })
  await next()
}
