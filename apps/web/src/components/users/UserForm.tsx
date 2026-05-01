import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import type { User } from '@/types'

const roles = ['admin', 'program_manager', 'project_manager', 'team_member'] as const

const createSchema = z.object({
  email: z.string().email('Valid email required'),
  fullName: z.string().min(2, 'Min 2 characters'),
  role: z.enum(roles),
  password: z.string().min(8, 'Min 8 characters'),
})

const editSchema = z.object({
  fullName: z.string().min(2, 'Min 2 characters').optional(),
  role: z.enum(roles).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional().or(z.literal('')),
})

type CreateInput = z.infer<typeof createSchema>
type EditInput = z.infer<typeof editSchema>

interface UserFormProps {
  user?: User
  onSubmit: (data: CreateInput | EditInput) => void
  isPending: boolean
  onCancel: () => void
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  program_manager: 'Program Manager',
  project_manager: 'Project Manager',
  team_member: 'Team Member',
}

export function UserForm({ user, onSubmit, isPending, onCancel }: UserFormProps) {
  const isEdit = !!user

  const { register, handleSubmit, formState: { errors } } = useForm<CreateInput>({
    resolver: zodResolver(isEdit ? editSchema : createSchema) as never,
    defaultValues: isEdit
      ? { fullName: user.fullName, role: user.role }
      : { role: 'team_member' },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-4">
      {!isEdit && (
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
            {...register('email')}
          />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
        </div>
      )}

      <div>
        <label className="text-sm font-medium">Full Name</label>
        <input
          type="text"
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
          {...register('fullName')}
        />
        {errors.fullName && <p className="mt-1 text-xs text-destructive">{errors.fullName.message}</p>}
      </div>

      <div>
        <label className="text-sm font-medium">Role</label>
        <select
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
          {...register('role')}
        >
          {roles.map((r) => (
            <option key={r} value={r}>{roleLabels[r]}</option>
          ))}
        </select>
        {errors.role && <p className="mt-1 text-xs text-destructive">{errors.role.message}</p>}
      </div>

      <div>
        <label className="text-sm font-medium">
          {isEdit ? 'New Password (leave blank to keep)' : 'Password'}
        </label>
        <input
          type="password"
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
          {...register('password')}
        />
        {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
        </Button>
      </div>
    </form>
  )
}
