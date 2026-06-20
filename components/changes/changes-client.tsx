'use client'

import { useState, useMemo } from 'react'
import { Inbox } from 'lucide-react'
import ChangeCard from '@/components/changes/change-card'
import type { Database } from '@/lib/supabase/types'
import type { StructuredDiff } from '@/lib/extractor'

type Change = Database['public']['Tables']['changes']['Row'] & {
  tracked_pages: {
    url: string
    label: string | null
    competitors: {
      id: string
      name: string
      website: string
    }
  }
  structured_diff?: unknown
}

const THEME_PILLS = ['All', 'Pricing', 'Messaging', 'Product', 'Home', 'Hiring'] as const

function getDateGroup(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays < 1 && date.getDate() === now.getDate()) return 'Today'
  if (diffDays < 2 && date.getDate() === new Date(now.getTime() - 86400000).getDate()) return 'Yesterday'
  if (diffDays < 7) return 'This week'
  if (diffDays < 14) return 'Last week'
  return 'Earlier'
}

const GROUP_ORDER = ['Today', 'Yesterday', 'This week', 'Last week', 'Earlier']

export default function ChangesClient({ changes }: { changes: Change[] }) {
  const [competitor, setCompetitor] = useState('')
  const [theme, setTheme] = useState('')
  const [showSeen, setShowSeen] = useState(false)

  const competitors = useMemo(() => {
    const names = changes.map((c) => c.tracked_pages.competitors.name)
    return Array.from(new Set(names)).sort()
  }, [changes])

  const filtered = useMemo(() => {
    return changes.filter((c) => {
      if (competitor && c.tracked_pages.competitors.name !== competitor) return false
      if (theme && c.theme !== theme) return false
      if (!showSeen && c.seen_at) return false
      return true
    })
  }, [changes, competitor, theme, showSeen])

  const grouped = useMemo(() => {
    const map = new Map<string, Change[]>()
    for (const c of filtered) {
      const group = getDateGroup(c.detected_at)
      if (!map.has(group)) map.set(group, [])
      map.get(group)!.push(c)
    }
    // Sort by defined order
    return GROUP_ORDER
      .filter(g => map.has(g))
      .map(g => ({ label: g, items: map.get(g)! }))
  }, [filtered])

  const unseenCount = useMemo(() => changes.filter((c) => !c.seen_at).length, [changes])

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <select
          value={competitor}
          onChange={(e) => setCompetitor(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        >
          <option value="">All competitors</option>
          {competitors.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {THEME_PILLS.map((pill) => {
            const value = pill === 'All' ? '' : pill
            const active = theme === value
            return (
              <button
                key={pill}
                onClick={() => setTheme(value)}
                className={`text-xs px-2.5 py-1 rounded-md transition-all ${
                  active
                    ? 'bg-white text-gray-900 font-semibold shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {pill}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => setShowSeen((s) => !s)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
            showSeen
              ? 'border-violet-300 bg-violet-50 text-violet-700 font-medium'
              : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
          }`}
        >
          {showSeen ? 'Hiding seen' : 'Show seen'}
        </button>

        {(competitor || theme) && (
          <button
            onClick={() => { setCompetitor(''); setTheme('') }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Clear
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {unseenCount > 0 && (
            <span className="text-xs bg-violet-100 text-violet-700 font-semibold px-2.5 py-1 rounded-full">
              {unseenCount} unread
            </span>
          )}
          <span className="text-xs text-gray-400">
            {filtered.length} signals
          </span>
        </div>
      </div>

      {/* Grouped inbox */}
      {grouped.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 rounded-xl">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            {changes.length === 0 ? 'Inbox is empty — no signals yet' : 'No signals match these filters'}
          </p>
          {changes.length === 0 && (
            <p className="text-gray-400 text-xs mt-1">
              Add competitors and the cron will detect changes automatically
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ label, items }) => (
            <div key={label}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-300">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((c) => (
                  <ChangeCard
                    key={c.id}
                    change={c}
                    structuredDiff={c.structured_diff as StructuredDiff | null}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
