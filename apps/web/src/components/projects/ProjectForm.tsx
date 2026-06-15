import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { usePrograms } from '@/hooks/useProjects'
import { useUsers } from '@/hooks/useUsers'
import { Button } from '@/components/ui/button'
import type { Project } from '@/types'

const schema = z.object({
  name: z.string().trim().min(3, 'At least 3 characters').max(200)
    .refine((v) => !/^[[\]<>{}]/.test(v), 'Cannot start with a bracket/symbol'),
  description: z.string().max(500).optional(),
  programId: z.string().uuid().optional().or(z.literal('')),
  managerId: z.string().uuid({ message: 'Select a Project Manager' }),
  methodology: z.enum(['waterfall', 'agile', 'hybrid']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  budgetCapex: z.coerce.number().min(0).default(0),
  budgetOpex: z.coerce.number().min(0).default(0),
  expectedBenefit: z.coerce.number().min(0).default(0),
})

type FormInput = z.infer<typeof schema>

interface ProjectFormProps {
  project?: Project
  defaultProgramId?: string
  onSubmit: (data: FormInput) => void
  isPending: boolean
  onCancel: () => void
}

const methodologyLabels = { waterfall: 'Waterfall', agile: 'Agile', hybrid: 'Hybrid (Waterfall + Agile)' }

export function ProjectForm({ project, defaultProgramId, onSubmit, isPending, onCancel }: ProjectFormProps) {
  const { data: programs = [] } = usePrograms()
  const { data: users = [] } = useUsers()
  const managers = users.filter((u) => ['admin', 'program_manager', 'project_manager'].includes(u.role))

  const { register, handleSubmit, formState: { errors } } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: project
      ? {
          name: project.name,
          description: project.description ?? '',
          programId: project.programId ?? '',
          managerId: project.managerId,
          methodology: project.methodology,
          startDate: project.startDate,
          endDate: project.endDate ?? '',
          budgetCapex: project.budgetCapex,
          budgetOpex: project.budgetOpex,
          expectedBenefit: project.expectedBenefit ?? 0,
        }
      : {
          programId: defaultProgramId ?? '',
          methodology: 'hybrid',
          startDate: new Date().toISOString().slice(0, 10),
          budgetCapex: 0,
          budgetOpex: 0,
          expectedBenefit: 0,
        },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Project Name *</label>
        <input className="input-field" {...register('name')} />
        {errors.name && <p className="field-error">{errors.name.message}</p>}
      </div>

      <div>
        <label className="text-sm font-medium">Description</label>
        <textarea className="input-field resize-none" rows={2} {...register('description')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Program (optional)</label>
          <select className="input-field" {...register('programId')}>
            <option value="">— Standalone project —</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Project Manager *</label>
          <select className="input-field" {...register('managerId')}>
            <option value="">Select…</option>
            {managers.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
          {errors.managerId && <p className="field-error">{errors.managerId.message}</p>}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Methodology</label>
        <select className="input-field" {...register('methodology')}>
          {(Object.entries(methodologyLabels) as [keyof typeof methodologyLabels, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Start Date *</label>
          <input type="date" className="input-field" {...register('startDate')} />
          {errors.startDate && <p className="field-error">{errors.startDate.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium">End Date</label>
          <input type="date" className="input-field" {...register('endDate')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">CAPEX Budget ($)</label>
          <input type="number" min="0" step="1000" className="input-field" {...register('budgetCapex')} />
        </div>
        <div>
          <label className="text-sm font-medium">OPEX Budget ($)</label>
          <input type="number" min="0" step="1000" className="input-field" {...register('budgetOpex')} />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Expected Benefit ($)</label>
        <input type="number" min="0" step="1000" className="input-field" {...register('expectedBenefit')} />
        <p className="text-xs text-muted-foreground mt-1">Total expected financial return — used to compute ROI.</p>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : project ? 'Save Changes' : 'Create Project'}
        </Button>
      </div>
    </form>
  )
}
