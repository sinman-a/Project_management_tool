import type { MiddlewareHandler } from 'hono'
import { jwtVerify } from 'jose'
import type { HonoContext, JwtPayload } from '../types'

export const authMiddleware: MiddlewareHandler<HonoContext> = async (c, next) => {
  const cookie = c.req.header('Cookie') ?? ''
  const token = cookie
    .split(';')
    .find((s) => s.trim().startsWith('ppm_token='))
    ?.split('=')[1]
    ?.trim()

  if (!token) {
    return c.json({ message: 'Unauthorized' }, 401)
  }

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    // Pin the algorithm — reject tokens that try to use a different alg (e.g. "none").
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    c.set('user', payload as unknown as JwtPayload)
    await next()
  } catch {
    return c.json({ message: 'Invalid or expired token' }, 401)
  }
}
