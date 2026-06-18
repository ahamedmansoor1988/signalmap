'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Map, Users, GitCompare, TrendingUp, Swords, Mail, Settings } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

const navItems = [
  { href: '/map', icon: Map, label: 'Market Map' },
  { href: '/competitor', icon: Users, label: 'Competitors' },
  { href: '/changes', icon: GitCompare, label: 'Changes' },
  { href: '/digest', icon: Mail, label: 'Digest' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export default function DashboardNav({ user }: { user: User }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col w-14 border-r border-zinc-800/60 bg-zinc-950/80 items-center py-4 gap-1">
      <Link href="/map" className="mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">SM</span>
        </div>
      </Link>

      {navItems.map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          title={label}
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
            pathname === href || pathname.startsWith(href + '/')
              ? 'bg-violet-600/20 text-violet-400'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
          )}
        >
          <Icon className="w-4 h-4" />
        </Link>
      ))}

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
