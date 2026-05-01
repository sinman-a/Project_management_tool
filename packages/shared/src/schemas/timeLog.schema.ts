import { z } from 'zod'

export const createTimeLogSchema = z.object({
  taskId: z.string().uuid(),
  resourceId: z.string().uuid(),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  hours: z.number().positive('Must be positive').max(24, 'Max 24 hours per day'),
  description: z.string().max(500).optional(),
  isBillable: z.boolean().default(true),
})

export const weeklyTimesheetSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(
    z.object({
      taskId: z.string().uuid(),
      resourceId: z.string().uuid(),
      dayHours: z.array(z.number().min(0).max(24)).length(7),
    }),
  ),
})

export type CreateTimeLogInput = z.infer<typeof createTimeLogSchema>
export type WeeklyTimesheetInput = z.infer<typeof weeklyTimesheetSchema>
