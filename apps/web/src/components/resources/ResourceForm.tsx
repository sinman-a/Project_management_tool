import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { useUsers } from '@/hooks/useUsers'
import type { Resource } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  type: z.enum(['human', 'equipment']),
  costType: z.enum(['capex', 'opex']),
  rate: z.coerce.number().min(0, 'Must be ≥ 0'),
  currency: z.string().length(3).default('USD'),
  capacityHoursPerWeek: z.coerce.number().min(0).max(168).default(40),
  userId: z.string().optional(),
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

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: resource?.name ?? '',
      type: resource?.type ?? 'human',
      costType: resource?.costType ?? 'opex',
      rate: resource?.rate ?? 0,
      currency: resource?.currency ?? 'USD',
      capacityHoursPerWeek: resource?.capacityHoursPerWeek ?? 40,
      userId: resource?.userId ?? '',
    },
  })

  return (
    <form
      onSubmit={handleSubmit((d) => onSubmit({ ...d, userId: d.userId || undefined }))}
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
