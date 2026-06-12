import { useState } from 'react'
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
  const [needs2fa, setNeeds2fa] = useState(false)
  const [totpCode, setTotpCode] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: LoginInput & { totpCode?: string }) => api.post<AuthUser>('/auth/login', data),
    onSuccess: (user) => {
      qc.setQueryData(['auth', 'me'], user)
      setUser(user)
      navigate('/dashboard')
    },
    onError: (err) => {
      if (err.message === 'SETUP_REQUIRED') navigate('/setup')
      else if (err.message === 'TWO_FACTOR_REQUIRED') setNeeds2fa(true)
    },
  })

  const errorMessage =
    error && error.message !== 'TWO_FACTOR_REQUIRED' && error.message !== 'SETUP_REQUIRED'
      ? error.message
      : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">PPM Tool</CardTitle>
          <CardDescription>{needs2fa ? 'Enter your authentication code' : 'Sign in to your account'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((d) => mutate({ ...d, totpCode: needs2fa ? totpCode.trim() : undefined }))}
            className="space-y-4"
          >
            {!needs2fa && (
              <>
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
              </>
            )}

            {needs2fa && (
              <div>
                <label className="text-sm font-medium" htmlFor="totp">Authentication code</label>
                <input
                  id="totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="6-digit code or backup code"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Open your authenticator app, or use a backup code.
                </p>
              </div>
            )}

            {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}

            <Button type="submit" className="w-full" disabled={isPending || (needs2fa && !totpCode.trim())}>
              {isPending ? 'Signing in…' : needs2fa ? 'Verify' : 'Sign in'}
            </Button>

            {needs2fa && (
              <button
                type="button"
                className="w-full text-xs text-muted-foreground hover:underline"
                onClick={() => { setNeeds2fa(false); setTotpCode('') }}
              >
                ← Back
              </button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
