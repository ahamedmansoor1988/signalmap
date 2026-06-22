'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Map, Users, GitCompare, BarChart3,
  Settings, Swords, TrendingUp, ListTodo,
  Sun, Moon, LogOut, User, Zap, Inbox,
} from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

const mainNav = [
  { href: '/map',        icon: Map,        label: 'Market Map'      },
  { href: '/inbox',      icon: Inbox,      label: 'Signal Inbox'    },
  { href: '/competitor', icon: Users,       label: 'Competitors'     },
  { href: '/changes',    icon: GitCompare,  label: 'Change Feed'     },
  { href: '/actions',    icon: ListTodo,    label: 'My Actions'      },
  { href: '/brief',      icon: BarChart3,   label: 'Weekly Digest'   },
  { href: '/battle',     icon: Swords,      label: 'Battle Room'     },
  { href: '/trends',     icon: TrendingUp,  label: 'Trend Timeline'  },
]

const POLL_INTERVAL = 5 * 60 * 1000

export default function DashboardNav({ user }: { user: SupabaseUser }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const supabase  = createClient()

  const [unseenCount, setUnseenCount] = useState(0)
  const [actionCount, setActionCount] = useState(0)
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [dark,        setDark]        = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Dark mode — toggle `dark` class on <html>
  useEffect(() => {
    const stored = localStorage.getItem('sm_theme')
    const isDark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  function toggleDark() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('sm_theme', next ? 'dark' : 'light')
  }

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Badge counts
  useEffect(() => {
    async function fetchCounts() {
      try {
        const [sigRes, actRes] = await Promise.all([
          fetch('/api/changes/unseen-count'),
          fetch('/api/actions?mine=true'),
        ])
        if (sigRes.ok) {
          const { count } = await sigRes.json() as { count: number }
          setUnseenCount(count)
        }
        if (actRes.ok) {
          const { open_count } = await actRes.json() as { open_count: number }
          setActionCount(open_count)
        }
      } catch { /* non-fatal */ }
    }
    fetchCounts()
    const timer = setInterval(fetchCounts, POLL_INTERVAL)
    const onVisible = () => { if (!document.hidden) fetchCounts() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  useEffect(() => {
    if (pathname === '/changes') setUnseenCount(0)
  }, [pathname])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = (user.user_metadata?.full_name as string | undefined)
    ? (user.user_metadata.full_name as string).split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : (user.email ?? 'U').slice(0, 2).toUpperCase()

  const email = user.email ?? ''
  const displayName = (user.user_metadata?.full_name as string | undefined) ?? email.split('@')[0]

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
          const isActions = href === '/actions'
          const badge     = isChanges && unseenCount > 0 ? unseenCount : isActions && actionCount > 0 ? actionCount : 0
          const isActive  = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                'relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors',
                isActive ? 'bg-violet-50 text-violet-600' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              <Icon className="w-[18px] h-[18px]" />
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
        <Link
          href="/settings"
          title="Settings"
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-lg transition-colors',
            pathname === '/settings' ? 'bg-violet-50 text-violet-600' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
          )}
        >
          <Settings className="w-[18px] h-[18px]" />
        </Link>

        {/* User avatar + dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            title={email}
            onClick={() => setMenuOpen(o => !o)}
            className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-violet-300 transition-all"
          >
            <span className="text-white text-[10px] font-bold">{initials}</span>
          </button>

          {menuOpen && (
            <div className="absolute bottom-0 left-full ml-3 w-52 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
              {/* User info */}
              <div className="px-3 py-2.5 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-900 truncate">{displayName}</p>
                <p className="text-[10px] text-gray-400 truncate">{email}</p>
              </div>

              <div className="py-1">
                <button
                  onClick={() => { setMenuOpen(false); router.push('/profile') }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  Profile
                </button>

                <button
                  onClick={() => { setMenuOpen(false); router.push('/settings') }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Zap className="w-3.5 h-3.5 text-violet-400" />
                  Settings &amp; Plan
                </button>

                <button
                  onClick={toggleDark}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {dark
                    ? <Sun  className="w-3.5 h-3.5 text-amber-400" />
                    : <Moon className="w-3.5 h-3.5 text-gray-400" />
                  }
                  {dark ? 'Light mode' : 'Dark mode'}
                </button>
              </div>

              <div className="border-t border-gray-100 py-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
