import { useState } from 'react'
import { UserPlus, Pencil, ShieldCheck, DollarSign, Users, Star, Plus, X, ToggleLeft, ToggleRight } from 'lucide-react'
import { useUsers, useCreateUser, useUpdateUser } from '@/hooks/useUsers'
import { useOrgSettings, useUpdateOrgSettings } from '@/hooks/useOrg'
import { useAuthStore } from '@/stores/authStore'
import { UserForm } from '@/components/users/UserForm'
import { ImportSection } from '@/components/settings/ImportSection'
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

const DEFAULT_ROLES = ['Developer', 'Tester', 'Stakeholder', 'Analyst', 'Architect']
const DEFAULT_SENIORITY = ['Junior', 'Middle', 'Senior', 'Tech Lead']

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

function TagList({
  items,
  onRemove,
  isAdmin,
}: {
  items: string[]
  onRemove: (item: string) => void
  isAdmin: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full"
        >
          {item}
          {isAdmin && (
            <button
              onClick={() => onRemove(item)}
              className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
              aria-label={`Remove ${item}`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}
    </div>
  )
}

function AddItemInput({
  placeholder,
  onAdd,
}: {
  placeholder: string
  onAdd: (value: string) => void
}) {
  const [value, setValue] = useState('')
  function submit() {
    const trimmed = value.trim()
    if (trimmed) {
      onAdd(trimmed)
      setValue('')
    }
  }
  return (
    <div className="flex gap-2 mt-3">
      <input
        className="input-field flex-1"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
      />
      <Button size="sm" variant="outline" onClick={submit} disabled={!value.trim()}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Add
      </Button>
    </div>
  )
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

  const customRoles = org?.settings?.customRoles ?? []
  const customSeniority = org?.settings?.customSeniority ?? []
  const enableArchetype = org?.settings?.enableArchetype ?? false
  const enableMotto = org?.settings?.enableMotto ?? false

  function handleClose() {
    setShowForm(false)
    setEditTarget(null)
  }

  function addRole(role: string) {
    if (DEFAULT_ROLES.includes(role) || customRoles.includes(role)) return
    updateOrgSettings.mutate({ customRoles: [...customRoles, role] })
  }

  function removeRole(role: string) {
    updateOrgSettings.mutate({ customRoles: customRoles.filter((r) => r !== role) })
  }

  function addSeniority(level: string) {
    if (DEFAULT_SENIORITY.includes(level) || customSeniority.includes(level)) return
    updateOrgSettings.mutate({ customSeniority: [...customSeniority, level] })
  }

  function removeSeniority(level: string) {
    updateOrgSettings.mutate({ customSeniority: customSeniority.filter((s) => s !== level) })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Organization and user management</p>
      </div>

      {/* Currency */}
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

      {/* Custom Roles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            <Users className="inline-block w-4 h-4 mr-2 text-primary" />
            Resource Roles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Default roles (built-in)</p>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_ROLES.map((r) => (
                <span key={r} className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">{r}</span>
              ))}
            </div>
          </div>
          {customRoles.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Custom roles</p>
              <TagList items={customRoles} onRemove={removeRole} isAdmin={isAdmin} />
            </div>
          )}
          {isAdmin && (
            <AddItemInput
              placeholder="Add custom role (e.g. DevOps, Scrum Master)"
              onAdd={addRole}
            />
          )}
        </CardContent>
      </Card>

      {/* Custom Seniority */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            <Star className="inline-block w-4 h-4 mr-2 text-primary" />
            Seniority Levels
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Default levels (built-in)</p>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_SENIORITY.map((s) => (
                <span key={s} className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">{s}</span>
              ))}
            </div>
          </div>
          {customSeniority.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Custom levels</p>
              <TagList items={customSeniority} onRemove={removeSeniority} isAdmin={isAdmin} />
            </div>
          )}
          {isAdmin && (
            <AddItemInput
              placeholder="Add custom level (e.g. Principal, Staff, Intern)"
              onAdd={addSeniority}
            />
          )}
        </CardContent>
      </Card>

      {/* Resource Card Features */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            <Star className="inline-block w-4 h-4 mr-2 text-primary" />
            Resource Card Features
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAdmin && (
            <p className="text-sm text-muted-foreground">Only admins can change card features.</p>
          )}
          <div className="divide-y">
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">Archetype field</p>
                <p className="text-xs text-muted-foreground">Show "Archetype" on resource cards and forms (e.g. The Architect, The Catalyst)</p>
              </div>
              <button
                disabled={!isAdmin || updateOrgSettings.isPending}
                onClick={() => isAdmin && updateOrgSettings.mutate({ enableArchetype: !enableArchetype })}
                className="flex-shrink-0 ml-4"
                aria-label={enableArchetype ? 'Disable archetype' : 'Enable archetype'}
              >
                {enableArchetype
                  ? <ToggleRight className="w-8 h-8 text-primary" />
                  : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
              </button>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">Motto field</p>
                <p className="text-xs text-muted-foreground">Show personal motto on resource cards and forms</p>
              </div>
              <button
                disabled={!isAdmin || updateOrgSettings.isPending}
                onClick={() => isAdmin && updateOrgSettings.mutate({ enableMotto: !enableMotto })}
                className="flex-shrink-0 ml-4"
                aria-label={enableMotto ? 'Disable motto' : 'Enable motto'}
              >
                {enableMotto
                  ? <ToggleRight className="w-8 h-8 text-primary" />
                  : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Import */}
      {isAdmin && <ImportSection />}

      {/* Team Members */}
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
