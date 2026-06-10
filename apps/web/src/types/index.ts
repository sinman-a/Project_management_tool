export type UserRole = 'admin' | 'program_manager' | 'project_manager' | 'team_member' | 'pmo_lead' | 'sponsor' | 'viewer'

export type RagStatus = 'green' | 'amber' | 'red'

export type CostType = 'capex' | 'opex'

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'

export type TaskType = 'waterfall_phase' | 'agile_story' | 'agile_task' | 'milestone' | 'bug'

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low'

export type Methodology = 'waterfall' | 'agile' | 'hybrid'

export type ResourceType = 'human' | 'equipment'

export type DependencyType =
  | 'finish_to_start'
  | 'start_to_start'
  | 'finish_to_finish'
  | 'start_to_finish'

export interface User {
  id: string
  orgId: string
  email: string
  fullName: string
  role: UserRole
  isActive: boolean
  createdAt: string
}

export interface Organization {
  id: string
  name: string
  createdAt: string
  settings: {
    fiscalYearStart: number
    currency: string
    workingHoursPerDay: number
  }
}

export interface Resource {
  id: string
  orgId: string
  userId: string | null
  name: string
  email: string | null
  type: ResourceType
  costType: CostType
  rate: number
  currency: string
  capacityHoursPerWeek: number
  role: string | null
  seniorityLevel: string | null
  superpower: string | null
  startDate: string | null
  location: string | null
  projectAllocation: number | null
  avatarUrl: string | null
  archetype: string | null
  motto: string | null
  createdAt: string
}

export interface Program {
  id: string
  orgId: string
  name: string
  description: string | null
  ownerId: string
  portfolioId: string | null
  status: 'planning' | 'active' | 'on_hold' | 'closed'
  startDate: string
  endDate: string | null
  budgetCapex: number
  budgetOpex: number
  createdAt: string
  projectCount?: number
  ragStatus?: RagStatus
}

export interface Project {
  id: string
  orgId: string
  programId: string | null
  name: string
  description: string | null
  managerId: string
  methodology: Methodology
  status: ProjectStatus
  startDate: string
  endDate: string | null
  budgetCapex: number
  budgetOpex: number
  createdAt: string
  ragStatus?: RagStatus
  budgetSnapshot?: BudgetSnapshot
}

export interface Sprint {
  id: string
  projectId: string
  name: string
  goal: string | null
  startDate: string
  endDate: string
  status: 'planned' | 'active' | 'completed'
  velocity: number | null
  createdAt: string
}

export interface Task {
  id: string
  projectId: string
  sprintId: string | null
  parentTaskId: string | null
  name: string
  description: string | null
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  assignedTo: string | null
  storyPoints: number | null
  estimatedHours: number
  startDate: string | null
  dueDate: string | null
  costType: CostType
  wbsCode: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  children?: Task[]
  loggedHours?: number
}

export interface TaskDependency {
  id: string
  taskId: string
  dependsOnId: string
  dependencyType: DependencyType
  lagDays: number
  crossProject: boolean
  createdAt: string
}

export interface TaskAssignment {
  id: string
  taskId: string
  resourceId: string
  allocatedHours: number
  createdAt: string
  resource?: Resource
  resourceName?: string
  resourceRole?: string | null
  rate?: number
  capacityHoursPerWeek?: number
}

// Project-level assignment row (assignment + task context)
export interface ProjectAssignment extends TaskAssignment {
  taskName: string
  startDate: string | null
  dueDate: string | null
}

export interface TimeLog {
  id: string
  taskId: string
  resourceId: string
  loggedBy: string
  logDate: string
  hours: number
  description: string | null
  costType: CostType
  unitRate: number
  computedCost: number
  isBillable: boolean
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
  task?: Pick<Task, 'id' | 'name' | 'projectId'>
  resource?: Pick<Resource, 'id' | 'name'>
}

export interface BudgetSnapshot {
  id: string
  projectId: string
  snapshotDate: string
  budgetCapex: number
  budgetOpex: number
  spentCapex: number
  spentOpex: number
  committedCapex: number
  committedOpex: number
  burnRateCapex: number
  burnRateOpex: number
  eacCapex: number
  eacOpex: number
  createdAt: string
}

export interface ResourceAllocation {
  id: string
  resourceId: string
  projectId: string
  weekStart: string
  allocatedHours: number
  createdAt: string
}

export type TaskLinkType = 'parent' | 'child' | 'related' | 'duplicate' | 'predecessor' | 'successor'

export interface TaskLink {
  id: string
  sourceTaskId: string
  targetTaskId: string
  linkType: TaskLinkType
  sourceName: string
  targetName: string
  createdBy: string
  createdAt: string
}

export interface RiceItem {
  id: string
  projectId: string
  milestone: string | null
  goal: string | null
  businessValue: string | null
  userStory: string | null
  reach: number
  impact: number
  confidence: number
  effort: number
  riceScore: number
  createdBy: string
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

export interface StatusReport {
  id: string
  projectId: string | null
  programId: string | null
  authorId: string
  reportDate: string
  periodStart: string
  periodEnd: string
  overallStatus: RagStatus
  scheduleStatus: RagStatus
  budgetStatus: RagStatus
  scopeStatus: RagStatus
  narrativeThisPeriod: string | null
  narrativeNextPeriod: string | null
  risksIssues: Array<{ title: string; severity: RagStatus; mitigation: string }> | null
  createdAt: string
}

export interface AuthUser {
  id: string
  email: string
  fullName: string
  role: UserRole
  orgId: string
}

// ============================================================
// CPM / Schedule
// ============================================================

export interface CpmFields {
  earlyStart: number
  earlyFinish: number
  lateStart: number
  lateFinish: number
  totalFloat: number
  isCritical: boolean
  duration: number
}

export type TaskScheduleEntry = { id: string } & CpmFields

export interface ProjectDependency {
  id: string
  projectId: string
  dependsOnId: string
  dependencyType: DependencyType
  lagDays: number
  projectName?: string
  dependsOnName?: string
  createdAt: string
}

// ============================================================
// Risk Register
// ============================================================

export type RiskStatus =
  | 'identified'
  | 'analyzing'
  | 'mitigating'
  | 'closed'
  | 'accepted'
  | 'occurred'

export type RiskResponseStrategy = 'avoid' | 'transfer' | 'mitigate' | 'accept'

export type RiskScoreBand = 'low' | 'medium' | 'high' | 'critical'

export interface Risk {
  id: string
  projectId: string
  riskNumber: number
  title: string
  description: string | null
  category: string
  probability: number
  impact: number
  score: number
  scoreBand: RiskScoreBand
  ownerId: string | null
  ownerName: string | null
  status: RiskStatus
  responseStrategy: RiskResponseStrategy | null
  mitigationActions: string | null
  contingencyPlan: string | null
  triggerIndicators: string | null
  dateIdentified: string
  dateLastReviewed: string | null
  nextReviewDate: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  projectName?: string
}

export interface RiskCategory {
  id: string
  orgId: string
  name: string
  isBuiltin: boolean
  createdAt: string
}

export interface RiskHeatmapCell {
  probability: number
  impact: number
  count: number
}

// ============================================================
// Cost Estimation
// ============================================================

export interface CostEstimationGrade {
  id: string
  estimationId: string
  name: string
  ratePerDay: number
  costType: 'capex' | 'opex'
  position: number
}

export interface CostEstimationRow {
  id: string
  estimationId: string
  stage: string
  workDescription: string
  position: number
  cells: Record<string, number>  // gradeId → days
}

export interface CostEstimationSummaryGrade {
  gradeId: string
  gradeName: string
  ratePerDay: number
  costType: 'capex' | 'opex'
  totalDays: number
  totalCost: number
}

export interface CostEstimation {
  id: string
  projectId: string
  name: string
  notes: string | null
  currency: string
  isActive: boolean
  createdAt: string
  grades: CostEstimationGrade[]
  rows: CostEstimationRow[]
  summary: {
    byGrade: CostEstimationSummaryGrade[]
    totalDays: number
    totalCapex: number
    totalOpex: number
    grandTotal: number
  }
}

export interface CostEstimationListItem {
  id: string
  projectId: string
  name: string
  notes: string | null
  currency: string
  isActive: boolean
  createdAt: string
}

// ============================================================
// Comments + Activity
// ============================================================

export interface Comment {
  id: string
  orgId: string
  entityType: 'project' | 'task' | 'status_report' | 'risk' | 'idea'
  entityId: string
  parentCommentId: string | null
  body: string
  authorId: string
  authorName: string
  authorEmail: string
  isPinned: boolean
  editedAt: string | null
  deletedAt: string | null
  createdAt: string
}

export interface ActivityEvent {
  id: string
  orgId: string
  entityType: string
  entityId: string
  eventType: string
  actorId: string
  actorName: string
  payload: Record<string, unknown>
  occurredAt: string
}

// ============================================================
// Notifications
// ============================================================

export interface Notification {
  id: string
  orgId: string
  recipientId: string
  type: string
  entityType: string | null
  entityId: string | null
  actorId: string | null
  actorName: string | null
  payload: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

// ============================================================
// Baselines + EVM
// ============================================================

export interface Baseline {
  id: string
  projectId: string
  name: string
  notes: string | null
  lockedAt: string
  lockedBy: string
  lockedByName: string | null
  isActive: boolean
  totalBudget: number
  totalCapex: number
  totalOpex: number
  plannedStart: string | null
  plannedFinish: string | null
}

export interface BaselineTask {
  id: string
  baselineId: string
  taskId: string
  taskNameSnapshot: string
  plannedStart: string | null
  plannedFinish: string | null
  plannedDurationDays: number
  plannedEstimateHours: number
  plannedBudget: number
}

export interface EVMResult {
  ev: number
  pv: number
  ac: number
  sv: number
  cv: number
  spi: number
  cpi: number
  band: 'green' | 'amber' | 'red'
  hasBaseline: boolean
}

// ============================================================
// Status Report extensions
// ============================================================

export interface RAGSuggestion {
  rags: { overall: RagStatus; schedule: RagStatus; budget: RagStatus; scope: RagStatus }
  reasoning: { overall: string; schedule: string; budget: string; scope: string }
  ruleVersion: string
}

// ============================================================
// Capacity
// ============================================================

export interface CapacityWeek {
  week: string
  allocated: number
  capacity: number
  utilisation: number
  band: 'empty' | 'low' | 'light' | 'good' | 'amber' | 'red'
  projects: { name: string; hours: number }[]
}

export interface CapacityResource {
  resourceId: string
  resourceName: string
  capacity: number
  role: string | null
  weeks: CapacityWeek[]
}

export interface CapacityHeatmap {
  weeks: string[]
  resources: CapacityResource[]
  aggregation: string
}

// ============================================================
// Ideas
// ============================================================

export type IdeaStatus =
  | 'draft' | 'submitted' | 'under_review'
  | 'approved' | 'rejected' | 'on_hold' | 'converted_to_project'

export interface Idea {
  id: string
  orgId: string
  title: string
  problemStatement: string
  proposedSolution: string | null
  expectedValueEur: number | null
  estimatedCostEur: number | null
  estimatedEffortWeeks: number | null
  reach: number | null
  impact: number | null
  confidence: number | null
  effort: number | null
  riskScore: number | null
  riceScore: number
  status: IdeaStatus
  submitterId: string
  submitterName: string | null
  decisionNotes: string | null
  decidedBy: string | null
  decidedByName: string | null
  decidedAt: string | null
  convertedProjectId: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  themes?: StrategicTheme[]
  approvals?: IdeaApproval[]
  driverScores?: Record<string, number>   // driverId → score (1-10), from GET /:id
}

export interface IdeaApproval {
  id: string
  ideaId: string
  approverId: string
  approverName: string
  decision: 'approve' | 'reject' | 'request_changes'
  comments: string | null
  decidedAt: string
}

export interface StrategicTheme {
  id: string
  orgId: string
  name: string
  colour: string | null
  isActive: boolean
}

// ============================================================
// Strategic Portfolio Management
// ============================================================

export interface Portfolio {
  id: string
  orgId: string
  name: string
  description: string | null
  ownerId: string | null
  ownerName?: string | null
  programCount?: number
  projectCount?: number
  createdAt: string
  updatedAt: string
}

export interface PortfolioSummary {
  programs: Program[]
  projects: Array<{
    id: string; name: string; status: string; ragStatus: string | null; programId: string
    budgetCapex: number; budgetOpex: number
    spentCapex: number | null; spentOpex: number | null
    eacCapex: number | null; eacOpex: number | null
  }>
  rollup: {
    programCount: number
    projectCount: number
    totalBudget: number
    totalSpent: number
    totalEac: number
    ragMix: Record<string, number>
  }
}

export interface StrategicDriver {
  id: string
  orgId: string
  name: string
  weight: number
  isActive: boolean
  position: number
  createdAt: string
}

// One ranked idea row from GET /ideas/ranking
export interface IdeaRankingEntry {
  id: string
  title: string
  status: IdeaStatus
  submitterName: string | null
  estimatedCostEur: number | null
  riceScore: number
  strategicValue: number   // Σ wᵢ·Sᵢ
  costScore: number        // C (1-5)
  riskScore: number        // R (1-5)
  pScore: number
  isComplete: boolean
  driverScores: Record<string, number>  // driverId → 0..10 (for client-side what-if)
}

export interface IdeaRanking {
  drivers: Array<{ id: string; name: string; weight: number; normWeight: number }>
  costRange: { min: number; max: number }
  ideas: IdeaRankingEntry[]
}
