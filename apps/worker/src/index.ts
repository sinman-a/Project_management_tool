import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
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
import { riceRoutes } from './routes/rice'
import { taskLinkRoutes } from './routes/taskLinks'
import { riskRoutes } from './routes/risks'
import { riskCategoryRoutes } from './routes/riskCategories'
import { projectDependencyRoutes } from './routes/projectDependencies'
import { commentRoutes, activityRoutes } from './routes/comments'
import { notificationRoutes } from './routes/notifications'
import { baselineRoutes, baselineSubRoutes } from './routes/baselines'
import { reportScheduleRoutes } from './routes/reports'
import { exportRoutes } from './routes/exports'
import { capacityRoutes } from './routes/capacity'
import { ideaRoutes, themeRoutes } from './routes/ideas'
import { boardColumnRoutes, boardColumnSubRoutes } from './routes/boardColumns'
import {
  costEstimationSubRoutes,
  costEstimationRoutes,
  gradeRoutes,
  rowRoutes,
  cellRoutes,
} from './routes/costEstimations'
import { portfolioRoutes } from './routes/portfolios'
import { strategicDriverRoutes } from './routes/strategicDrivers'
import { assignmentRoutes, assignmentSubRoutes } from './routes/assignments'
import { budgetVersionRoutes, budgetVersionSubRoutes } from './routes/budgetVersions'
import { analyticsRoutes } from './routes/analytics'
import { searchRoutes } from './routes/search'
import { pushRoutes } from './routes/push'

const app = new Hono<HonoContext>()

// Security headers on every API response (nosniff, no-framing, referrer policy, HSTS).
app.use('*', secureHeaders({
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin',
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  crossOriginResourcePolicy: 'same-site',
}))
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
api.route('/rice', riceRoutes)
api.route('/task-links', taskLinkRoutes)
api.route('/risks', riskRoutes)
api.route('/risk-categories', riskCategoryRoutes)
api.route('/programs', projectDependencyRoutes)
api.route('/comments', commentRoutes)
api.route('/', activityRoutes)
api.route('/notifications', notificationRoutes)
api.route('/baselines', baselineRoutes)
api.route('/projects', baselineSubRoutes)
api.route('/status-report-schedules', reportScheduleRoutes)
api.route('/', exportRoutes)
api.route('/capacity', capacityRoutes)
api.route('/ideas', ideaRoutes)
api.route('/strategic-themes', themeRoutes)
api.route('/board-columns', boardColumnRoutes)
api.route('/projects', boardColumnSubRoutes)
api.route('/projects', costEstimationSubRoutes)
api.route('/cost-estimations', costEstimationRoutes)
api.route('/cost-estimation-grades', gradeRoutes)
api.route('/cost-estimation-rows', rowRoutes)
api.route('/cost-estimation-cells', cellRoutes)
api.route('/portfolios', portfolioRoutes)
api.route('/strategic-drivers', strategicDriverRoutes)
api.route('/task-assignments', assignmentRoutes)
api.route('/projects', assignmentSubRoutes)
api.route('/budget-versions', budgetVersionRoutes)
api.route('/projects', budgetVersionSubRoutes)
api.route('/analytics', analyticsRoutes)
api.route('/search', searchRoutes)
api.route('/push', pushRoutes)

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
