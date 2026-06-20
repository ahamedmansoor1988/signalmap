'use client'

import { useEffect, useRef } from 'react'

const STORAGE_KEY = 'sm_last_notified_change'
const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes

export default function SignalNotifier() {
  const lastNotifiedId = useRef<string | null>(null)

  useEffect(() => {
    // Hydrate from localStorage after mount (avoids SSR mismatch)
    lastNotifiedId.current = localStorage.getItem(STORAGE_KEY)

    async function check() {
      if (typeof Notification === 'undefined') return

      if (Notification.permission === 'default') {
        await Notification.requestPermission()
      }
      if (Notification.permission !== 'granted') return

      try {
        const res = await fetch('/api/changes/unseen-count')
        if (!res.ok) return
        const { count, latest } = await res.json() as {
          count: number
          latest: { id: string; competitor_name: string; ai_signal: string | null } | null
        }

        if (!latest || count === 0) return
        if (latest.id === lastNotifiedId.current) return

        const notif = new Notification('SignalMap — New Signal', {
          body: `${latest.competitor_name}: ${latest.ai_signal ?? 'New change detected'}`,
          icon: '/favicon.ico',
          tag: 'signalmap-signal', // replaces previous notification rather than stacking
        })
        notif.onclick = () => {
          window.focus()
          window.location.href = '/changes'
          notif.close()
        }

        lastNotifiedId.current = latest.id
        localStorage.setItem(STORAGE_KEY, latest.id)
      } catch {
        // non-fatal — network or permission error
      }
    }

    check()
    const timer = setInterval(check, POLL_INTERVAL)
    const onVisible = () => { if (!document.hidden) check() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return null
}
