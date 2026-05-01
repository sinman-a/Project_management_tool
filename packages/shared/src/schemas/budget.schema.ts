import { z } from 'zod'

export const budgetSchema = z.object({
  budgetCapex: z.number().min(0, 'Must be non-negative'),
  budgetOpex: z.number().min(0, 'Must be non-negative'),
})

export const budgetAlertSchema = z.object({
  type: z.literal('budget_threshold'),
  projectId: z.string().uuid(),
  pct: z.number().min(0).max(200),
  snapshotDate: z.string(),
})

export type BudgetInput = z.infer<typeof budgetSchema>
export type BudgetAlertMessage = z.infer<typeof budgetAlertSchema>
