'use client'

import { useEffect, useRef } from 'react'

const STORAGE_KEY = 'sm_last_notified_change'
const ACTION_COUNT_KEY = 'sm_last_action_count'
const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes

export default function SignalNotifier() {
  const lastNotifiedId = useRef<string | null>(null)
  const lastActionCount = useRef<number | null>(null)

  useEffect(() => {
    // Hydrate from localStorage after mount (avoids SSR mismatch)
    lastNotifiedId.current = localStorage.getItem(STORAGE_KEY)
    const storedActionCount = localStorage.getItem(ACTION_COUNT_KEY)
    lastActionCount.current = storedActionCount === null ? null : Number(storedActionCount)

    async function check() {
      if (typeof Notification === 'undefined') return

      let minimumRisk = 0
      let signalNotifications = true
      let actionNotifications = true

      try {
        const prefRes = await fetch('/api/preferences')
        if (prefRes.ok) {
          const { preferences } = await prefRes.json() as {
            preferences: { browser_notifications: boolean; action_notifications: boolean; minimum_risk: number }
          }
          signalNotifications = preferences.browser_notifications
          minimumRisk = preferences.minimum_risk
          actionNotifications = preferences.action_notifications
        }
      } catch { /* keep default behavior until preferences can be loaded */ }

      if (!signalNotifications && !actionNotifications) return
      if (Notification.permission === 'default') {
        await Notification.requestPermission()
      }
      if (Notification.permission !== 'granted') return

      try {
        const [res, actionRes] = await Promise.all([
          fetch(`/api/changes/unseen-count?minimum_risk=${signalNotifications ? minimumRisk : 101}`),
          actionNotifications ? fetch('/api/actions?mine=true') : Promise.resolve(null),
        ])

        if (actionRes?.ok) {
          const { open_count } = await actionRes.json() as { open_count: number }
          if (lastActionCount.current !== null && open_count > lastActionCount.current) {
            const actionNotif = new Notification('SignalMap — Action assigned', {
              body: `You now have ${open_count} active action${open_count === 1 ? '' : 's'} in your queue.`,
              icon: '/favicon.ico', tag: 'signalmap-action',
            })
            actionNotif.onclick = () => { window.focus(); window.location.href = '/actions'; actionNotif.close() }
          }
          lastActionCount.current = open_count
          localStorage.setItem(ACTION_COUNT_KEY, String(open_count))
        }

        if (!res.ok) return
        const { count, latest } = await res.json() as {
          count: number
          latest: { id: string; competitor_name: string; ai_signal: string | null; risk_score?: number | null } | null
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
