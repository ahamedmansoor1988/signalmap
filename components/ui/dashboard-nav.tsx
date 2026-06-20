'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Map, Users, GitCompare, BarChart3,
  Settings, Swords, TrendingUp, Bell, ChevronDown,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'

const mainNav = [
  { href: '/map',        icon: Map,        label: 'Market Map' },
  { href: '/competitor', icon: Users,       label: 'Competitors' },
  { href: '/changes',    icon: GitCompare,  label: 'Change Explorer' },
  { href: '/brief',      icon: BarChart3,   label: 'Weekly Digest' },
  { href: '/battle',     icon: Swords,      label: 'Battle Room' },
  { href: '/trends',     icon: TrendingUp,  label: 'Trend Timeline' },
  { href: '/digest',     icon: Bell,        label: 'Alerts' },
]

const bottomNav = [
  { href: '/settings', icon: Settings, label: 'Settings' },
]

const watchlists = ['Core PM Tools', 'CRM Platforms', 'AI Tools']

const POLL_INTERVAL = 5 * 60 * 1000

export default function DashboardNav({ user }: { user: User }) {
  const pathname = usePathname()
  const [unseenCount, setUnseenCount] = useState(0)
  const [watchlistOpen, setWatchlistOpen] = useState(true)

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch('/api/changes/unseen-count')
        if (res.ok) {
          const { count } = await res.json() as { count: number }
          setUnseenCount(count)
        }
      } catch { /* non-fatal */ }
    }
    fetchCount()
    const timer = setInterval(fetchCount, POLL_INTERVAL)
    const onVisible = () => { if (!document.hidden) fetchCount() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  useEffect(() => {
    if (pathname === '/changes') setUnseenCount(0)
  }, [pathname])

  const initials = (user.email ?? 'U').slice(0, 2).toUpperCase()
  const email    = user.email ?? ''

  return (
    <nav className="flex flex-col w-56 border-r border-gray-200 bg-white shrink-0 h-full">

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
          <span className="text-white text-[10px] font-bold">SM</span>
        </div>
        <span className="text-gray-900 font-bold text-sm tracking-tight">SignalMap</span>
      </div>

      {/* Main nav */}
      <div className="flex-1 overflow-y-auto py-3 px-2">
        <div className="space-y-0.5">
          {mainNav.map(({ href, icon: Icon, label }) => {
            const isChanges  = href === '/changes'
            const badge      = isChanges && unseenCount > 0 ? unseenCount : 0
            const isActive   = pathname === href || pathname.startsWith(href + '/')

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-violet-50 text-violet-700 font-semibold'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50 font-medium'
                )}
              >
                <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-violet-600' : 'text-gray-400')} />
                <span className="flex-1 truncate">{label}</span>
                {badge > 0 && (
                  <span className="min-w-[18px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Watchlists */}
        <div className="mt-4">
          <button
            onClick={() => setWatchlistOpen(v => !v)}
            className="flex items-center justify-between w-full px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
          >
            Watchlists
            <ChevronDown className={cn('w-3 h-3 transition-transform', watchlistOpen ? 'rotate-0' : '-rotate-90')} />
          </button>
          {watchlistOpen && (
            <div className="mt-1 space-y-0.5">
              {watchlists.map(w => (
                <button
                  key={w}
                  className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                  {w}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: settings + user */}
      <div className="border-t border-gray-100 px-2 py-3 space-y-0.5">
        {bottomNav.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === href
                ? 'bg-violet-50 text-violet-700 font-semibold'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50 font-medium'
            )}
          >
            <Icon className="w-4 h-4 shrink-0 text-gray-400" />
            {label}
          </Link>
        ))}

        {/* User profile */}
        <div className="flex items-center gap-2.5 px-3 py-2 mt-1 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{email.split('@')[0]}</p>
            <p className="text-[10px] text-gray-400 truncate">PMM Lead</p>
          </div>
        </div>
      </div>
    </nav>
  )
}
