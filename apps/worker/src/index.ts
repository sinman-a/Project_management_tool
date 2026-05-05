import { Hono } from 'hono'
import type { HonoContext } from './types'
import { corsMiddleware } from './middleware/cors'
import { authMiddleware } from './middleware/auth'
import { authRoutes } from './routes/auth'
import { programRoutes } from './routes/programs'
import { projectRoutes } from './routes/projects'
import { timeLogRoutes } from './routes/timeLogs'
import { taskRoutes } from './routes/tasks'
import { sprintRoutes } from './routes/sprints'
import { resourceRoutes } from './routes/resources'
import { userRoutes } from './routes/users'
import { reportRoutes } from './routes/reports'
import { orgRoutes } from './routes/org'
import { handleScheduled } from './scheduled/budgetCron'
import { importPublicRoutes, importRoutes } from './routes/import'

const app = new Hono<HonoContext>()

app.use('*', corsMiddleware)

app.get('/api/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }))

app.route('/api/auth', authRoutes)
app.route('/api/import', importPublicRoutes)

const api = new Hono<HonoContext>()
api.use('*', authMiddleware)

api.route('/programs', programRoutes)
api.route('/projects', projectRoutes)
api.route('/tasks', taskRoutes)
api.route('/sprints', sprintRoutes)
api.route('/time-logs', timeLogRoutes)
api.route('/resources', resourceRoutes)
api.route('/users', userRoutes)
api.route('/reports', reportRoutes)
api.route('/org', orgRoutes)
api.route('/import', importRoutes)

app.route('/api', api)

app.notFound((c) => c.json({ message: 'Not found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ message: 'Internal server error' }, 500)
})

export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
}
