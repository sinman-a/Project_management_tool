import { useState } from 'react'
import { UserPlus, Pencil, ShieldCheck, DollarSign } from 'lucide-react'
import { useUsers, useCreateUser, useUpdateUser } from '@/hooks/useUsers'
import { useOrgSettings, useUpdateOrgSettings } from '@/hooks/useOrg'
import { useAuthStore } from '@/stores/authStore'
import { UserForm } from '@/components/users/UserForm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { User } from '@/types'

const CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar', symbol: '$' },
  { code: 'EUR', label: 'EUR — Euro', symbol: '€' },
  { code: 'GBP', label: 'GBP — British Pound', symbol: '£' },
  { code: 'UAH', label: 'UAH — Ukrainian Hryvnia', symbol: '₴' },
] as const

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'green' | 'amber'> = {
  admin: 'default',
  program_manager: 'green',
  project_manager: 'amber',
  team_member: 'secondary',
}

const roleLabel: Record<string, string> = {
  admin: 'Admin',
  program_manager: 'Program Manager',
  project_manager: 'Project Manager',
  team_member: 'Team Member',
}

export function Settings() {
  const { user: me } = useAuthStore()
  const isAdmin = me?.role === 'admin'
  const { data: users = [], isLoading } = useUsers()
  const { data: org } = useOrgSettings()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const updateOrgSettings = useUpdateOrgSettings()
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<User | null>(null)

  function handleClose() {
    setShowForm(false)
    setEditTarget(null)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Organization and user management</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            <DollarSign className="inline-block w-4 h-4 mr-2 text-primary" />
            Display Currency
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isAdmin ? (
            <p className="text-sm text-muted-foreground">Only admins can change the currency setting.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map((c) => (
                <Button
                  key={c.code}
                  variant={org?.settings?.currency === c.code ? 'default' : 'outline'}
                  size="sm"
                  disabled={updateOrgSettings.isPending}
                  onClick={() => updateOrgSettings.mutate({ currency: c.code })}
                >
                  {c.symbol} {c.label}
                </Button>
              ))}
            </div>
          )}
          {isAdmin && org?.settings?.currency && (
            <p className="text-xs text-muted-foreground mt-2">
              Current: {CURRENCIES.find(c => c.code === org.settings.currency)?.label ?? org.settings.currency}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">
            <ShieldCheck className="inline-block w-4 h-4 mr-2 text-primary" />
            Team Members
          </CardTitle>
          {isAdmin && !showForm && (
            <Button size="sm" onClick={() => { setEditTarget(null); setShowForm(true) }}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {(showForm || editTarget) && isAdmin && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/30">
              <h3 className="text-sm font-semibold mb-4">
                {editTarget ? `Edit — ${editTarget.fullName}` : 'New User'}
              </h3>
              <UserForm
                user={editTarget ?? undefined}
                isPending={createUser.isPending || updateUser.isPending}
                onCancel={handleClose}
                onSubmit={(data) => {
                  if (editTarget) {
                    const payload = { ...data, id: editTarget.id } as typeof data & { id: string }
                    if ('password' in payload && !payload.password) delete (payload as Partial<typeof data & { password?: string }>).password
                    updateUser.mutate(payload as User & { id: string }, { onSuccess: handleClose })
                  } else {
                    createUser.mutate(data as Parameters<typeof createUser.mutate>[0], { onSuccess: handleClose })
                  }
                }}
              />
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="divide-y">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{u.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={roleBadgeVariant[u.role] ?? 'outline'}>
                      {roleLabel[u.role]}
                    </Badge>
                    {!u.isActive && (
                      <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                    )}
                    {isAdmin && u.id !== me?.id && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => { setEditTarget(u); setShowForm(false) }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">No users yet.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
