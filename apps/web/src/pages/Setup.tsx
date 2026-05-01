import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { AuthUser } from '@/types'

const setupSchema = z.object({
  orgName: z.string().min(2, 'Min 2 characters').max(200),
  fullName: z.string().min(2, 'Min 2 characters').max(100),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Minimum 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type SetupInput = z.infer<typeof setupSchema>

const fields: Array<{ name: keyof SetupInput; label: string; type?: string; placeholder?: string }> = [
  { name: 'orgName', label: 'Organization Name', placeholder: 'Acme Corp' },
  { name: 'fullName', label: 'Your Full Name', placeholder: 'John Smith' },
  { name: 'email', label: 'Admin Email', type: 'email', placeholder: 'admin@acme.com' },
  { name: 'password', label: 'Password', type: 'password' },
  { name: 'confirmPassword', label: 'Confirm Password', type: 'password' },
]

export function Setup() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<SetupInput>({
    resolver: zodResolver(setupSchema),
  })

  const { mutate, isPending, error } = useMutation({
    mutationFn: ({ confirmPassword: _, ...data }: SetupInput) =>
      api.post<AuthUser>('/auth/setup', data),
    onSuccess: (user) => {
      qc.setQueryData(['auth', 'me'], user)
      qc.setQueryData(['auth', 'setup-status'], { needsSetup: false })
      navigate('/')
    },
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to PPM Tool</CardTitle>
          <CardDescription>Set up your organization and admin account to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
            {fields.map(({ name, label, type = 'text', placeholder }) => (
              <div key={name}>
                <label className="text-sm font-medium" htmlFor={name}>{label}</label>
                <input
                  id={name}
                  type={type}
                  placeholder={placeholder}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                  {...register(name)}
                />
                {errors[name] && (
                  <p className="mt-1 text-xs text-destructive">{errors[name]?.message}</p>
                )}
              </div>
            ))}

            {error && <p className="text-xs text-destructive">{error.message}</p>}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Setting up…' : 'Create Admin Account'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
