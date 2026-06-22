'use client'

import { useState, useTransition } from 'react'
import { Inbox, Rss, Globe, User, BookmarkPlus, Check, ExternalLink, Filter } from 'lucide-react'
import type { SignalRow } from '@/app/(dashboard)/inbox/page'

const TEAMS = ['Product', 'Marketing', 'Sales', 'Leadership', 'Engineering']

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const d = Math.floor(diff / 86400000)
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

function SourceIcon({ type }: { type: string }) {
  return type === 'google_news'
    ? <Globe className="w-3 h-3 text-blue-400" />
    : <Rss className="w-3 h-3 text-orange-400" />
}

function AssignModal({
  signal,
  onClose,
  onAssigned,
}: {
  signal: SignalRow
  onClose: () => void
  onAssigned: (id: string, team: string, email: string) => void
}) {
  const [team, setTeam] = useState('')
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function submit() {
    if (!team || !email) { setError('Select a team and enter an email'); return }
    setError('')
    startTransition(async () => {
      const res = await fetch('/api/signals/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal_id: signal.id, team, email }),
      })
      if (res.ok) {
        onAssigned(signal.id, team, email)
        onClose()
      } else {
        setError('Failed to assign — try again')
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Assign to Team</h3>
        <p className="text-xs text-gray-500 mb-4 line-clamp-2">{signal.title}</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {TEAMS.map(t => (
            <button key={t}
              onClick={() => setTeam(t)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                team === t
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'text-gray-600 border-gray-200 hover:border-violet-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <input
          type="email"
          placeholder="Recipient email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-violet-400"
        />

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="text-xs px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={isPending}
            className="text-xs px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {isPending ? 'Sending…' : 'Assign & Email'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SignalCard({
  signal,
  onAssign,
  onToggleMine,
}: {
  signal: SignalRow
  onAssign: (s: SignalRow) => void
  onToggleMine: (id: string, current: boolean) => void
}) {
  const isMine = signal.added_to_mine ?? false

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-violet-200 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <SourceIcon type={signal.source_type} />
          <span className="text-[10px] text-gray-400 font-medium">
            {signal.competitors?.name ?? '—'}
          </span>
          <span className="text-[10px] text-gray-300">·</span>
          <span className="text-[10px] text-gray-400">{timeAgo(signal.published_at)}</span>
        </div>
        {signal.assigned_team && (
          <span className="text-[10px] font-medium bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
            <User className="w-2.5 h-2.5" />
            {signal.assigned_team}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-gray-900 leading-snug mb-2">
        {signal.title}
      </p>

      {/* AI Impact */}
      {signal.ai_impact && (
        <div className="bg-violet-50 rounded-lg px-3 py-2 mb-2">
          <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide mb-0.5">Impact</p>
          <p className="text-xs text-gray-700 leading-snug">{signal.ai_impact}</p>
        </div>
      )}

      {/* AI Counter */}
      {signal.ai_counter && (
        <div className="bg-emerald-50 rounded-lg px-3 py-2 mb-3">
          <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-0.5">Action</p>
          <p className="text-xs text-gray-700 leading-snug">{signal.ai_counter}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        <button
          onClick={() => onAssign(signal)}
          className="flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-violet-600 transition-colors"
        >
          <User className="w-3 h-3" />
          {signal.assigned_team ? 'Reassign' : 'Assign'}
        </button>
        <span className="text-gray-200">·</span>
        <button
          onClick={() => onToggleMine(signal.id, isMine)}
          className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${
            isMine ? 'text-violet-600' : 'text-gray-500 hover:text-violet-600'
          }`}
        >
          {isMine ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
          {isMine ? 'In My Signals' : 'Add to Mine'}
        </button>
        {signal.url && (
          <>
            <span className="text-gray-200">·</span>
            <a
              href={signal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-blue-600 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Source
            </a>
          </>
        )}
      </div>
    </div>
  )
}

type FilterType = 'all' | 'mine' | 'assigned' | 'unassigned'

export default function InboxClient({
  signals: initialSignals,
  competitors,
}: {
  signals: SignalRow[]
  competitors: { id: string; name: string }[]
}) {
  const [signals, setSignals] = useState<SignalRow[]>(initialSignals)
  const [assignTarget, setAssignTarget] = useState<SignalRow | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [competitorFilter, setCompetitorFilter] = useState<string>('all')
  const [isFetching, startFetchTransition] = useTransition()

  function handleAssigned(id: string, team: string, email: string) {
    setSignals(prev => prev.map(s => s.id === id ? { ...s, assigned_team: team, assigned_email: email, assigned_at: new Date().toISOString() } : s))
  }

  function handleToggleMine(id: string, current: boolean) {
    const next = !current
    setSignals(prev => prev.map(s => s.id === id ? { ...s, added_to_mine: next } : s))
    fetch('/api/signals/mine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal_id: id, value: next }),
    }).catch(() => {
      setSignals(prev => prev.map(s => s.id === id ? { ...s, added_to_mine: current } : s))
    })
  }

  function handleFetchSignals() {
    startFetchTransition(async () => {
      await fetch('/api/signals/fetch', { method: 'POST' })
      window.location.reload()
    })
  }

  const filtered = signals.filter(s => {
    if (competitorFilter !== 'all' && s.competitor_id !== competitorFilter) return false
    if (filter === 'mine') return s.added_to_mine
    if (filter === 'assigned') return !!s.assigned_team
    if (filter === 'unassigned') return !s.assigned_team
    return true
  })

  const filterTabs: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All Signals' },
    { key: 'mine', label: 'My Signals' },
    { key: 'unassigned', label: 'Unassigned' },
    { key: 'assigned', label: 'Assigned' },
  ]

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Inbox className="w-4 h-4 text-violet-500" />
          <h1 className="text-base font-semibold text-gray-900">Signal Inbox</h1>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {signals.length}
          </span>
        </div>
        <button
          onClick={handleFetchSignals}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          <Rss className="w-3.5 h-3.5" />
          {isFetching ? 'Fetching…' : 'Fetch Signals'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {competitors.length > 0 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <Filter className="w-3 h-3 text-gray-400" />
            <select
              value={competitorFilter}
              onChange={e => setCompetitorFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              <option value="all">All Competitors</option>
              {competitors.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Signal grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Inbox className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-400">No signals yet</p>
            <p className="text-xs text-gray-300 mt-1">Click &quot;Fetch Signals&quot; to pull the latest from your competitors</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(signal => (
              <SignalCard
                key={signal.id}
                signal={signal}
                onAssign={setAssignTarget}
                onToggleMine={handleToggleMine}
              />
            ))}
          </div>
        )}
      </div>

      {assignTarget && (
        <AssignModal
          signal={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={handleAssigned}
        />
      )}
    </div>
  )
}
