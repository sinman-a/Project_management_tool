import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { usePortfolios } from '@/hooks/usePortfolios'
import type { Program } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Required').max(200),
  description: z.string().max(500).optional(),
  portfolioId: z.string().optional().or(z.literal('')),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  budgetCapex: z.coerce.number().min(0).default(0),
  budgetOpex: z.coerce.number().min(0).default(0),
})

type FormInput = z.infer<typeof schema>

interface ProgramFormProps {
  program?: Program
  onSubmit: (data: FormInput) => void
  isPending: boolean
  onCancel: () => void
}

export function ProgramForm({ program, onSubmit, isPending, onCancel }: ProgramFormProps) {
  const { data: portfolios = [] } = usePortfolios()
  const { register, handleSubmit, formState: { errors } } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: program
      ? {
          name: program.name,
          description: program.description ?? '',
          portfolioId: program.portfolioId ?? '',
          startDate: program.startDate,
          endDate: program.endDate ?? '',
          budgetCapex: program.budgetCapex,
          budgetOpex: program.budgetOpex,
        }
      : { portfolioId: '', startDate: new Date().toISOString().slice(0, 10), budgetCapex: 0, budgetOpex: 0 },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Program Name *</label>
        <input className="input-field" {...register('name')} />
        {errors.name && <p className="field-error">{errors.name.message}</p>}
      </div>

      <div>
        <label className="text-sm font-medium">Description</label>
        <textarea className="input-field resize-none" rows={3} {...register('description')} />
      </div>

      <div>
        <label className="text-sm font-medium">Portfolio</label>
        <select className="input-field" {...register('portfolioId')}>
          <option value="">— No portfolio —</option>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
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
          {errors.budgetCapex && <p className="field-error">{errors.budgetCapex.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium">OPEX Budget ($)</label>
          <input type="number" min="0" step="1000" className="input-field" {...register('budgetOpex')} />
          {errors.budgetOpex && <p className="field-error">{errors.budgetOpex.message}</p>}
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : program ? 'Save Changes' : 'Create Program'}
        </Button>
      </div>
    </form>
  )
}
