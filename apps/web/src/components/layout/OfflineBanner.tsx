import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

/** Thin banner shown while the browser is offline; cached data may be stale and edits are disabled. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null
  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500/90 text-white text-xs py-1 px-3">
      <WifiOff className="w-3.5 h-3.5" />
      <span>You’re offline — showing the last loaded data. Changes can’t be saved until you reconnect.</span>
    </div>
  )
}
