'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ExternalLink, Users, Zap, RefreshCw, CheckCircle2, AlertCircle, LayoutGrid, List, Tag } from 'lucide-react'
import { THEME_CONFIG } from '@/components/map/mock-data'
import type { Theme } from '@/components/map/mock-data'

type ViewMode = 'list' | 'cards' | 'theme'

type CompetitorRow = {
  id: string
  name: string
  website: string
  risk_score: number
  created_at: string
  signals_total: number
  signals_week: number
  last_signal: string | null
  themes: string[]
}

type SyncState = {
  status: 'idle' | 'syncing' | 'done' | 'error'
  pagesProcessed?: number
  pagesWithHistory?: number
  newsArticlesFound?: number
  newsSignal?: string
  signals?: Array<{ label: string; signal?: string }>
  error?: string
}

function getLogoUrl(website: string) {
  try {
    const domain = new URL(website.startsWith('http') ? website : `https://${website}`).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  } catch { return null }
}

function timeAgo(date: string | null) {
  if (!date) return null
  const diff = Date.now() - new Date(date).getTime()
  const d = Math.floor(diff / 86400000)
  const h = Math.floor(diff / 3600000)
  if (d > 30) return `${Math.floor(d / 30)}mo ago`
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  return 'just now'
}

function CompetitorLogo({ website, name }: { website: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const url = getLogoUrl(website)
  if (!url || failed) {
    return (
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-gray-500">{name[0]}</span>
      </div>
    )
  }
  return (
    <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
      <img src={url} alt={name} className="w-6 h-6 object-contain" onError={() => setFailed(true)} />
    </div>
  )
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<CompetitorRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({})
  const [deepSyncingAll, setDeepSyncingAll] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const loadCompetitors = useCallback(() => {
    fetch('/api/competitors')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setCompetitors(data.competitors ?? [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadCompetitors() }, [loadCompetitors])

  async function deepSync(competitorId: string) {
    setSyncStates(prev => ({ ...prev, [competitorId]: { status: 'syncing' } }))
    try {
      const res = await fetch(`/api/deep-sync/${competitorId}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      setSyncStates(prev => ({
        ...prev,
        [competitorId]: {
          status: 'done',
          pagesProcessed: data.pages_processed,
          pagesWithHistory: data.pages_with_history,
          newsArticlesFound: data.news_articles_found,
          newsSignal: data.news_signal,
          signals: data.results,
        },
      }))
      // Refresh competitor list to reflect new signal counts
      setTimeout(loadCompetitors, 500)
    } catch (err) {
      setSyncStates(prev => ({
        ...prev,
        [competitorId]: { status: 'error', error: String(err).replace('Error: ', '') },
      }))
    }
  }

  async function deepSyncAll() {
    if (!competitors?.length) return
    setDeepSyncingAll(true)
    for (const c of competitors) {
      if (syncStates[c.id]?.status === 'syncing') continue
      await deepSync(c.id)
    }
    setDeepSyncingAll(false)
  }

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-[72px] bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900 font-semibold mb-1">Could not load competitors</p>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  const highRisk    = competitors?.filter(c => c.risk_score >= 75).length ?? 0
  const totalSignals = competitors?.reduce((sum, c) => sum + c.signals_week, 0) ?? 0

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-gray-900 text-xl font-bold">Competitors</h1>
            <p className="text-gray-400 text-sm mt-0.5">{competitors?.length ?? 0} being tracked</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View switcher */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              {([
                { mode: 'list'  as ViewMode, icon: List,        title: 'List'     },
                { mode: 'cards' as ViewMode, icon: LayoutGrid,  title: 'Cards'    },
                { mode: 'theme' as ViewMode, icon: Tag,         title: 'By Theme' },
              ]).map(({ mode, icon: Icon, title }) => (
                <button
                  key={mode}
                  title={title}
                  onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors ${
                    viewMode === mode ? 'bg-white shadow-sm text-violet-600' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{title}</span>
                </button>
              ))}
            </div>
            {(competitors?.length ?? 0) > 0 && (
              <button
                onClick={deepSyncAll}
                disabled={deepSyncingAll}
                className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 border border-violet-200 px-3 py-2 rounded-xl hover:bg-violet-50 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${deepSyncingAll ? 'animate-spin' : ''}`} />
                {deepSyncingAll ? 'Deep Syncing…' : 'Deep Sync All'}
              </button>
            )}
          </div>
        </div>

        {/* Deep Sync explanation banner */}
        {(competitors?.length ?? 0) > 0 && (
          <div className="bg-violet-50 border border-violet-100 rounded-2xl px-4 py-3 mb-5 flex items-start gap-3">
            <RefreshCw className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-violet-800 text-xs font-semibold">Deep Sync — 30-day historical intelligence</p>
              <p className="text-violet-600 text-xs mt-0.5 leading-relaxed">
                Crawls Home, Pricing, Blog, Changelog, and Newsroom. Compares against Wayback Machine snapshots from 30 days ago. Also pulls Google News RSS for funding rounds, product launches, partnerships, and press coverage.
              </p>
            </div>
          </div>
        )}

        {/* Stats row */}
        {(competitors?.length ?? 0) > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3">
              <p className="text-2xl font-bold text-gray-900">{competitors?.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Tracked</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3">
              <p className="text-2xl font-bold text-amber-500">{totalSignals}</p>
              <p className="text-xs text-gray-400 mt-0.5">Signals this week</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3">
              <p className="text-2xl font-bold text-red-500">{highRisk}</p>
              <p className="text-xs text-gray-400 mt-0.5">High risk</p>
            </div>
          </div>
        )}

        {!competitors?.length ? (
          <div className="text-center py-16 border border-dashed border-gray-300 rounded-2xl bg-white">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No competitors tracked yet</p>
            <a href="/settings" className="text-violet-600 text-sm hover:underline mt-1 block">
              Add your first competitor →
            </a>
          </div>
        ) : viewMode === 'cards' ? (
          /* ── CARDS VIEW ── */
          <div className="grid grid-cols-2 gap-3">
            {competitors.map(c => {
              const riskLevel = c.risk_score >= 75 ? 'High' : c.risk_score >= 45 ? 'Medium' : 'Low'
              const riskColor = { High: 'text-red-600 bg-red-50', Medium: 'text-amber-600 bg-amber-50', Low: 'text-emerald-600 bg-emerald-50' }[riskLevel]
              return (
                <Link key={c.id} href={`/competitor/${c.id}`}
                  className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:border-violet-300 hover:shadow-md transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <CompetitorLogo website={c.website} name={c.name} />
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg ${riskColor}`}>{riskLevel}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-violet-700 transition-colors">{c.name}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{c.website.replace(/^https?:\/\//, '')}</p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    <span className="text-xl font-bold text-gray-900">{c.risk_score}</span>
                    {c.signals_week > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">
                        <Zap className="w-2.5 h-2.5" />{c.signals_week} this week
                      </span>
                    )}
                  </div>
                  {c.themes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.themes.slice(0, 2).map(t => {
                        const cfg = THEME_CONFIG[t as Theme]
                        return cfg ? (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                        ) : null
                      })}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        ) : viewMode === 'theme' ? (
          /* ── BY THEME VIEW ── */
          <div className="space-y-6">
            {(() => {
              const themeMap = new Map<string, CompetitorRow[]>()
              const noTheme: CompetitorRow[] = []
              for (const c of competitors) {
                if (!c.themes.length) { noTheme.push(c); continue }
                const t = c.themes[0]
                if (!themeMap.has(t)) themeMap.set(t, [])
                themeMap.get(t)!.push(c)
              }
              const groups = Array.from(themeMap.entries()).sort((a, b) => b[1].length - a[1].length)
              if (noTheme.length) groups.push(['Uncategorized', noTheme])
              return groups.map(([theme, group]) => {
                const cfg = THEME_CONFIG[theme as Theme]
                return (
                  <div key={theme}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={cfg ? { backgroundColor: cfg.bg, color: cfg.color } : { backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                        {cfg?.label ?? theme}
                      </span>
                      <span className="text-xs text-gray-400">{group.length} competitor{group.length > 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-2">
                      {group.map(c => {
                        const riskLevel = c.risk_score >= 75 ? 'High' : c.risk_score >= 45 ? 'Medium' : 'Low'
                        const riskConfig = { High: { cls: 'text-red-600 bg-red-50 border-red-100' }, Medium: { cls: 'text-amber-600 bg-amber-50 border-amber-100' }, Low: { cls: 'text-emerald-600 bg-emerald-50 border-emerald-100' } }[riskLevel]
                        return (
                          <div key={c.id} className="bg-white border border-gray-200 rounded-xl flex items-center gap-4 px-4 py-3 hover:border-violet-200 transition-colors">
                            <CompetitorLogo website={c.website} name={c.name} />
                            <div className="flex-1 min-w-0">
                              <Link href={`/competitor/${c.id}`} className="text-sm font-semibold text-gray-900 hover:text-violet-700">{c.name}</Link>
                              <p className="text-xs text-gray-400 truncate">{c.website.replace(/^https?:\/\//, '')}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-bold text-gray-900">{c.risk_score}</span>
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${riskConfig.cls}`}>{riskLevel}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        ) : (
          /* ── LIST VIEW (default) ── */
          <div className="space-y-2">
            {competitors.map((c) => {
              const riskLevel = c.risk_score >= 75 ? 'High' : c.risk_score >= 45 ? 'Medium' : 'Low'
              const riskConfig = {
                High:   { cls: 'text-red-600 bg-red-50 border-red-100' },
                Medium: { cls: 'text-amber-600 bg-amber-50 border-amber-100' },
                Low:    { cls: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
              }[riskLevel]
              const ago = timeAgo(c.last_signal)
              const sync = syncStates[c.id] ?? { status: 'idle' }

              return (
                <div key={c.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  {/* Main row */}
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    <CompetitorLogo website={c.website} name={c.name} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/competitor/${c.id}`}
                          className="text-gray-900 font-semibold text-sm hover:text-violet-700 transition-colors"
                        >
                          {c.name}
                        </a>
                        {c.signals_week > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full border border-violet-100">
                            <Zap className="w-2.5 h-2.5" />
                            {c.signals_week} this week
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <a
                          href={c.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-0.5 text-gray-400 text-xs hover:text-gray-600 transition-colors"
                        >
                          {c.website.replace(/^https?:\/\//, '')}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                        {ago && (
                          <>
                            <span className="text-gray-200">·</span>
                            <span className="text-xs text-gray-400">last signal {ago}</span>
                          </>
                        )}
                      </div>
                      {c.themes.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5">
                          {c.themes.slice(0, 3).map(t => {
                            const cfg = THEME_CONFIG[t as Theme]
                            return cfg ? (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                                {cfg.label}
                              </span>
                            ) : null
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{c.risk_score}</p>
                        <p className="text-[10px] text-gray-400">risk</p>
                      </div>
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-xl border ${riskConfig.cls}`}>
                        {riskLevel}
                      </span>
                      <button
                        onClick={() => deepSync(c.id)}
                        disabled={sync.status === 'syncing'}
                        title="Deep Sync — crawl full site + compare to 30-day Wayback snapshot"
                        className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-violet-600 border border-gray-200 hover:border-violet-200 hover:bg-violet-50 px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className={`w-3 h-3 ${sync.status === 'syncing' ? 'animate-spin text-violet-500' : ''}`} />
                        {sync.status === 'syncing' ? 'Syncing…' : 'Deep Sync'}
                      </button>
                    </div>
                  </div>

                  {/* Sync result panel */}
                  {sync.status === 'done' && (
                    <div className="border-t border-gray-100 bg-emerald-50 px-4 py-3">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-emerald-700 text-xs font-semibold">
                            Deep Sync complete — {sync.pagesProcessed} pages
                            {(sync.pagesWithHistory ?? 0) > 0 ? `, ${sync.pagesWithHistory} with Wayback history` : ''}
                            {(sync.newsArticlesFound ?? 0) > 0 ? `, ${sync.newsArticlesFound} news articles` : ''}
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {sync.signals?.filter(s => s.label !== 'News' && s.signal).map((s, i) => (
                              <li key={i} className="text-[11px] text-emerald-800 leading-snug">
                                <span className="font-semibold text-emerald-600">{s.label}:</span>{' '}{s.signal}
                              </li>
                            ))}
                            {sync.newsSignal && (
                              <li className="text-[11px] text-violet-800 leading-snug bg-violet-50 rounded px-2 py-1 mt-1">
                                <span className="font-semibold text-violet-600">📰 News:</span>{' '}{sync.newsSignal}
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {sync.status === 'error' && (
                    <div className="border-t border-gray-100 bg-red-50 px-4 py-2.5 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <p className="text-red-600 text-xs">{sync.error}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

