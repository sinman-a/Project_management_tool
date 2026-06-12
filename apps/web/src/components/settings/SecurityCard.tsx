import { useState } from 'react'
import QRCode from 'qrcode'
import { ShieldCheck, KeyRound, LogOut } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'
import {
  useChangePassword, useLogoutAll, useStart2fa, useEnable2fa, useDisable2fa,
} from '@/hooks/useSecurity'

function ChangePassword() {
  const changePw = useChangePassword()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [done, setDone] = useState(false)

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-1.5"><KeyRound className="w-4 h-4" /> Password</h3>
      <div className="grid grid-cols-2 gap-2">
        <input type="password" className="input-field" placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} />
        <input type="password" className="input-field" placeholder="New password (min 8)" value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={!cur || next.length < 8 || changePw.isPending}
          onClick={() => changePw.mutate({ currentPassword: cur, newPassword: next }, {
            onSuccess: () => { setCur(''); setNext(''); setDone(true) },
          })}>
          {changePw.isPending ? 'Updating…' : 'Change password'}
        </Button>
        {done && <span className="text-xs text-green-600">Updated — other sessions signed out.</span>}
        {changePw.isError && <span className="text-xs text-destructive">{(changePw.error as Error)?.message}</span>}
      </div>
    </div>
  )
}

function TwoFactor() {
  const user = useAuthStore((s) => s.user)
  const enabled = user?.twoFactorEnabled ?? false
  const start = useStart2fa()
  const enable = useEnable2fa()
  const disable = useDisable2fa()

  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [disableCode, setDisableCode] = useState('')

  async function beginSetup() {
    const res = await start.mutateAsync()
    setSecret(res.secret)
    setQr(await QRCode.toDataURL(res.otpauthUri))
    setBackupCodes(null)
  }

  return (
    <div className="space-y-2 border-t pt-4">
      <h3 className="text-sm font-semibold flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Two-Factor Authentication (TOTP)</h3>

      {enabled ? (
        <div className="space-y-2">
          <p className="text-xs text-green-600">2FA is enabled on your account.</p>
          <div className="flex items-center gap-2">
            <input className="input-field max-w-[160px]" placeholder="Current code" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} />
            <Button size="sm" variant="outline" disabled={!disableCode || disable.isPending}
              onClick={() => disable.mutate(disableCode.trim(), { onSuccess: () => setDisableCode('') })}>
              Disable 2FA
            </Button>
          </div>
          {disable.isError && <p className="text-xs text-destructive">{(disable.error as Error)?.message}</p>}
        </div>
      ) : qr ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Scan with Google Authenticator / Authy, then enter the 6-digit code.</p>
          <img src={qr} alt="2FA QR code" className="w-40 h-40 border rounded" />
          <p className="text-xs">Secret: <code className="bg-muted px-1 rounded">{secret}</code></p>
          <div className="flex items-center gap-2">
            <input className="input-field max-w-[160px]" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button size="sm" disabled={!code || enable.isPending}
              onClick={() => enable.mutate(code.trim(), {
                onSuccess: (res) => { setBackupCodes(res.backupCodes); setQr(null); setCode('') },
              })}>
              Enable
            </Button>
          </div>
          {enable.isError && <p className="text-xs text-destructive">{(enable.error as Error)?.message}</p>}
        </div>
      ) : backupCodes ? (
        <div className="space-y-2">
          <p className="text-xs text-green-600">2FA enabled. Save these one-time backup codes somewhere safe:</p>
          <div className="grid grid-cols-2 gap-1 font-mono text-sm bg-muted/50 rounded p-3 w-fit">
            {backupCodes.map((c) => <span key={c}>{c}</span>)}
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" disabled={start.isPending} onClick={beginSetup}>
          {start.isPending ? 'Preparing…' : 'Set up 2FA'}
        </Button>
      )}
    </div>
  )
}

function Sessions() {
  const logoutAll = useLogoutAll()
  return (
    <div className="space-y-2 border-t pt-4">
      <h3 className="text-sm font-semibold flex items-center gap-1.5"><LogOut className="w-4 h-4" /> Sessions</h3>
      <p className="text-xs text-muted-foreground">Sign out of all devices (including this one).</p>
      <Button size="sm" variant="outline" disabled={logoutAll.isPending}
        onClick={() => logoutAll.mutate(undefined, { onSuccess: () => { window.location.href = '/login' } })}>
        Log out all devices
      </Button>
    </div>
  )
}

export function SecurityCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base"><ShieldCheck className="inline-block w-4 h-4 mr-2 text-primary" /> Security</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChangePassword />
        <TwoFactor />
        <Sessions />
      </CardContent>
    </Card>
  )
}
