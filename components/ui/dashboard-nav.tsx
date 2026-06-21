'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Map, Users, GitCompare, BarChart3,
  Settings, Swords, TrendingUp,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'

const mainNav = [
  { href: '/map',        icon: Map,        label: 'Market Map' },
  { href: '/competitor', icon: Users,       label: 'Competitors' },
  { href: '/changes',    icon: GitCompare,  label: 'Signal Inbox' },
  { href: '/brief',      icon: BarChart3,   label: 'Weekly Digest' },
  { href: '/battle',     icon: Swords,      label: 'Battle Room' },
  { href: '/trends',     icon: TrendingUp,  label: 'Trend Timeline' },
]

const bottomNav = [
  { href: '/settings', icon: Settings, label: 'Settings' },
]

const POLL_INTERVAL = 5 * 60 * 1000

export default function DashboardNav({ user }: { user: User }) {
  const pathname = usePathname()
  const [unseenCount, setUnseenCount] = useState(0)

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

  return (
    <nav className="flex flex-col w-14 border-r border-gray-200 bg-white shrink-0 h-full items-center">

      {/* Logo */}
      <div className="py-4 border-b border-gray-100 w-full flex justify-center">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
          <span className="text-white text-[10px] font-bold">SM</span>
        </div>
      </div>

      {/* Main nav */}
      <div className="flex-1 py-3 flex flex-col items-center gap-1 w-full px-2">
        {mainNav.map(({ href, icon: Icon, label }) => {
          const isChanges = href === '/changes'
          const badge     = isChanges && unseenCount > 0 ? unseenCount : 0
          const isActive  = pathname === href || pathname.startsWith(href + '/')

          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                'relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors',
                isActive
                  ? 'bg-violet-50 text-violet-600'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
              {badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Bottom: settings + avatar */}
      <div className="border-t border-gray-100 py-3 flex flex-col items-center gap-2 w-full px-2">
        {bottomNav.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            title={label}
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-lg transition-colors',
              pathname === href
                ? 'bg-violet-50 text-violet-600'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
            )}
          >
            <Icon className="w-[18px] h-[18px]" />
          </Link>
        ))}

        {/* User avatar */}
        <div
          title={user.email ?? ''}
          className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center cursor-pointer"
        >
          <span className="text-white text-[10px] font-bold">{initials}</span>
        </div>
      </div>
    </nav>
  )
}
