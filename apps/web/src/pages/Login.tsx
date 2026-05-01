import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { AuthUser } from '@/types'

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Minimum 8 characters'),
})

type LoginInput = z.infer<typeof loginSchema>

export function Login() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { setUser } = useAuthStore()
  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: LoginInput) => api.post<AuthUser>('/auth/login', data),
    onSuccess: (user) => {
      qc.setQueryData(['auth', 'me'], user)
      setUser(user) // sync Zustand immediately so ProtectedRoute doesn't redirect back
      navigate('/dashboard')
    },
    onError: (err) => {
      if (err.message === 'SETUP_REQUIRED') navigate('/setup')
    },
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">PPM Tool</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
            <div>
              <label className="text-sm font-medium" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                {...register('email')}
              />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                {...register('password')}
              />
              {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
            </div>
            {error && (
              <p className="text-xs text-destructive">{error.message}</p>
            )}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
