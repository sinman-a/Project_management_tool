import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

const pushSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window

export function usePush() {
  const [supported] = useState(pushSupported)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supported) return
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {})
  }, [supported])

  const subscribe = useCallback(async () => {
    setError(null); setBusy(true)
    try {
      const { publicKey } = await api.get<{ publicKey: string }>('/push/public-key')
      if (!publicKey) { setError('Push is not configured on the server.'); return }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setError('Notification permission denied.'); return }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      })
      await api.post('/push/subscribe', sub.toJSON())
      setSubscribed(true)
    } catch (e) {
      setError((e as Error).message || 'Could not enable push.')
    } finally {
      setBusy(false)
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {})
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } finally {
      setBusy(false)
    }
  }, [])

  return { supported, subscribed, busy, error, subscribe, unsubscribe }
}
