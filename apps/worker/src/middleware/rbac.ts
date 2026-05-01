import type { MiddlewareHandler } from 'hono'
import type { HonoContext, UserRole } from '../types'

export function requireRole(...roles: UserRole[]): MiddlewareHandler<HonoContext> {
  return async (c, next) => {
    const user = c.get('user')
    if (!roles.includes(user.role)) {
      return c.json({ message: 'Forbidden' }, 403)
    }
    await next()
  }
}

export function requireAny(...roles: UserRole[]): MiddlewareHandler<HonoContext> {
  return requireRole(...roles)
}
