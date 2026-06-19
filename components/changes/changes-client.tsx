'use client'

import { useState, useMemo } from 'react'
import { GitCompare } from 'lucide-react'
import ChangeCard from '@/components/changes/change-card'
import type { Database } from '@/lib/supabase/types'

type Change = Database['public']['Tables']['changes']['Row'] & {
  tracked_pages: {
    url: string
    label: string | null
    competitors: {
      id: string
      name: string
    }
  }
}

export default function ChangesClient({ changes }: { changes: Change[] }) {
  const [competitor, setCompetitor] = useState('')
  const [theme, setTheme] = useState('')
  const [showSeen, setShowSeen] = useState(false)

  const competitors = useMemo(() => {
    const names = changes.map((c) => c.tracked_pages.competitors.name)
    return Array.from(new Set(names)).sort()
  }, [changes])

  const THEME_PILLS = ['All', 'Pricing', 'Messaging', 'Product', 'Home', 'Hiring'] as const

  const filtered = useMemo(() => {
    return changes.filter((c) => {
      if (competitor && c.tracked_pages.competitors.name !== competitor) return false
      if (theme && c.theme !== theme) return false
      if (!showSeen && c.seen_at) return false
      return true
    })
  }, [changes, competitor, theme, showSeen])

  const unseenCount = useMemo(() => changes.filter((c) => !c.seen_at).length, [changes])

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
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

        <div className="flex items-center gap-1">
          {THEME_PILLS.map((pill) => {
            const value = pill === 'All' ? '' : pill
            const active = theme === value
            return (
              <button
                key={pill}
                onClick={() => setTheme(value)}
                className={`text-sm px-3 py-1.5 rounded-lg transition-all ${
                  active
                    ? 'bg-violet-600 text-white font-medium'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {pill}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => setShowSeen((s) => !s)}
          className={`text-sm px-3 py-1.5 rounded-lg border transition-all ${
            showSeen
              ? 'border-violet-300 bg-violet-50 text-violet-700'
              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
          }`}
        >
          {showSeen ? 'Hide seen' : 'Show seen'}
        </button>

        {(competitor || theme) && (
          <button
            onClick={() => { setCompetitor(''); setTheme('') }}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Clear filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {unseenCount > 0 && (
            <span className="text-xs bg-violet-100 text-violet-700 font-medium px-2 py-0.5 rounded-full">
              {unseenCount} new
            </span>
          )}
          <span className="text-xs text-gray-400">
            {filtered.length} of {changes.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl">
          <GitCompare className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            {changes.length === 0 ? 'No changes detected yet' : 'No changes match these filters'}
          </p>
          {changes.length === 0 && (
            <p className="text-gray-400 text-xs mt-1">
              Add competitors in Settings, then the cron job will detect changes automatically
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => <ChangeCard key={c.id} change={c} />)}
        </div>
      )}
    </div>
  )
}
