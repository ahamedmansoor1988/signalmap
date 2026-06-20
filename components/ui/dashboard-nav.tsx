'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Map, Users, GitCompare, BarChart3, Mail, Settings, Swords } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

const navItems = [
  { href: '/map',        icon: Map,       label: 'Market Map' },
  { href: '/competitor', icon: Users,     label: 'Competitors' },
  { href: '/changes',    icon: GitCompare, label: 'Changes' },
  { href: '/brief',      icon: BarChart3,  label: 'Weekly Brief' },
  { href: '/digest',     icon: Mail,       label: 'Digest' },
  { href: '/battle',     icon: Swords,     label: 'Battle Room' },
  { href: '/settings',   icon: Settings,   label: 'Settings' },
]

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes

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
      } catch {
        // non-fatal
      }
    }

    fetchCount()
    const timer = setInterval(fetchCount, POLL_INTERVAL)
    const onVisible = () => { if (!document.hidden) fetchCount() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // Clear badge when user navigates to /changes
  useEffect(() => {
    if (pathname === '/changes') setUnseenCount(0)
  }, [pathname])

  return (
    <nav className="flex flex-col w-14 border-r border-gray-200 bg-white items-center py-4 gap-1">
      <Link href="/map" className="mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">SM</span>
        </div>
      </Link>

      {navItems.map(({ href, icon: Icon, label }) => {
        const isChanges = href === '/changes'
        const badge = isChanges && unseenCount > 0 ? unseenCount : 0

        return (
          <Link
            key={href}
            href={href}
            title={badge > 0 ? `${label} (${badge} new)` : label}
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-violet-50 text-violet-600'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            )}
          >
            <span className="relative">
              <Icon className="w-4 h-4" />
              {badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none px-0.5">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span>
          </Link>
        )
      })}

      <div className="mt-auto">
        <div
          className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center cursor-pointer"
          title={user.email ?? ''}
        >
          <span className="text-white text-xs font-semibold">
            {(user.email ?? 'U')[0].toUpperCase()}
          </span>
        </div>
      </div>
    </nav>
  )
}
