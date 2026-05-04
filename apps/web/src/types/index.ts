export type UserRole = 'admin' | 'program_manager' | 'project_manager' | 'team_member'

export type RagStatus = 'green' | 'amber' | 'red'

export type CostType = 'capex' | 'opex'

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'

export type TaskType = 'waterfall_phase' | 'agile_story' | 'agile_task' | 'milestone'

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
