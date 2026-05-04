import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { useUsers } from '@/hooks/useUsers'
import { useOrgSettings } from '@/hooks/useOrg'
import type { Resource } from '@/types'

const DEFAULT_ROLES = ['Developer', 'Tester', 'Stakeholder', 'Analyst', 'Architect']
const DEFAULT_SENIORITY = ['Junior', 'Middle', 'Senior', 'Tech Lead']

const schema = z.object({
  name: z.string().min(1, 'Required'),
  type: z.enum(['human', 'equipment']),
  costType: z.enum(['capex', 'opex']),
  rate: z.coerce.number().min(0, 'Must be ≥ 0'),
  currency: z.string().length(3).default('USD'),
  capacityHoursPerWeek: z.coerce.number().min(0).max(168).default(40),
  userId: z.string().optional(),
  role: z.string().optional(),
  seniorityLevel: z.string().optional(),
  superpower: z.string().max(300).optional(),
  startDate: z.string().optional(),
  location: z.string().max(100).optional(),
  projectAllocation: z.coerce.number().min(0).max(100).optional(),
  avatarUrl: z.string().optional(),
  archetype: z.string().max(100).optional(),
  motto: z.string().max(300).optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  resource?: Resource
  isPending: boolean
  onCancel: () => void
  onSubmit: (data: FormValues) => void
}

export function ResourceForm({ resource, isPending, onCancel, onSubmit }: Props) {
  const { data: users = [] } = useUsers()
  const { data: org } = useOrgSettings()

  const allRoles = [...DEFAULT_ROLES, ...(org?.settings?.customRoles ?? [])]
  const allSeniority = [...DEFAULT_SENIORITY, ...(org?.settings?.customSeniority ?? [])]
  const enableArchetype = org?.settings?.enableArchetype ?? false
  const enableMotto = org?.settings?.enableMotto ?? false

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: resource?.name ?? '',
      type: resource?.type ?? 'human',
      costType: resource?.costType ?? 'opex',
      rate: resource?.rate ?? 0,
      currency: resource?.currency ?? 'USD',
      capacityHoursPerWeek: resource?.capacityHoursPerWeek ?? 40,
      userId: resource?.userId ?? '',
      role: resource?.role ?? '',
      seniorityLevel: resource?.seniorityLevel ?? '',
      superpower: resource?.superpower ?? '',
      startDate: resource?.startDate ?? '',
      location: resource?.location ?? '',
      projectAllocation: resource?.projectAllocation ?? 100,
      avatarUrl: resource?.avatarUrl ?? '',
      archetype: resource?.archetype ?? '',
      motto: resource?.motto ?? '',
    },
  })

  const type = watch('type')
  const isHuman = type === 'human'

  return (
    <form
      onSubmit={handleSubmit((d) => onSubmit({
        ...d,
        userId: d.userId || undefined,
        role: d.role || undefined,
        seniorityLevel: d.seniorityLevel || undefined,
        superpower: d.superpower || undefined,
        startDate: d.startDate || undefined,
        location: d.location || undefined,
        avatarUrl: d.avatarUrl || undefined,
        archetype: d.archetype || undefined,
        motto: d.motto || undefined,
      }))}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <input className="input-field" placeholder="Resource name *" {...register('name')} />
          {errors.name && <p className="field-error">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Type</label>
          <select className="input-field" {...register('type')}>
            <option value="human">Human</option>
            <option value="equipment">Equipment</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Cost Type</label>
          <select className="input-field" {...register('costType')}>
            <option value="opex">OPEX</option>
            <option value="capex">CAPEX</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Hourly Rate</label>
          <input type="number" step="0.01" min="0" className="input-field" {...register('rate')} />
          {errors.rate && <p className="field-error">{errors.rate.message}</p>}
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Currency</label>
          <input className="input-field" placeholder="USD" maxLength={3} {...register('currency')} />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Capacity (h/week)</label>
          <input type="number" step="0.5" min="0" max="168" className="input-field" {...register('capacityHoursPerWeek')} />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Linked User (optional)</label>
          <select className="input-field" {...register('userId')}>
            <option value="">— Not linked —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
            ))}
          </select>
        </div>

        {/* Human-specific fields */}
        {isHuman && (
          <>
            <div className="sm:col-span-2 border-t pt-3 mt-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Team Member Details</p>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Avatar URL</label>
              <input
                className="input-field"
                placeholder="https://example.com/avatar.png"
                {...register('avatarUrl')}
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">Link to photo or leave blank for auto-generated avatar</p>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Role</label>
              <select className="input-field" {...register('role')}>
                <option value="">— Select role —</option>
                {allRoles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Seniority Level</label>
              <select className="input-field" {...register('seniorityLevel')}>
                <option value="">— Select seniority —</option>
                {allSeniority.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Project Allocation (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="5"
                className="input-field"
                placeholder="100"
                {...register('projectAllocation')}
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Start Date</label>
              <input type="date" className="input-field" {...register('startDate')} />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Location</label>
              <input className="input-field" placeholder="e.g. Kyiv, Ukraine" {...register('location')} />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Superpower</label>
              <input
                className="input-field"
                placeholder="e.g. Turns coffee into code at 2am"
                {...register('superpower')}
              />
            </div>

            {enableArchetype && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Archetype</label>
                <input className="input-field" placeholder="e.g. The Architect" {...register('archetype')} />
              </div>
            )}

            {enableMotto && (
              <div className={enableArchetype ? '' : 'sm:col-span-2'}>
                <label className="block text-xs text-muted-foreground mb-1">Motto</label>
                <input
                  className="input-field"
                  placeholder="e.g. Move fast, break nothing"
                  {...register('motto')}
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Saving…' : resource ? 'Save Changes' : 'Create Resource'}
        </Button>
      </div>
    </form>
  )
}
