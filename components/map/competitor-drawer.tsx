'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink, RefreshCw, ArrowRight, CheckCircle2, AlertCircle, Zap, X } from 'lucide-react'
import type { MapCompetitor } from './market-map'

function getLogoUrl(website: string) {
  try {
    const domain = new URL(website.startsWith('http') ? website : `https://${website}`).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  } catch { return null }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (d > 30) return `${Math.floor(d / 30)}mo ago`
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  return 'just now'
}

function RiskBadge({ score }: { score: number }) {
  if (score === 0) return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-gray-50 text-gray-400 border-gray-200">
      Monitoring
    </span>
  )
  const level = score >= 75 ? 'High' : score >= 45 ? 'Medium' : 'Low'
  const cls = {
    High:   'bg-red-50 text-red-600 border-red-100',
    Medium: 'bg-amber-50 text-amber-600 border-amber-100',
    Low:    'bg-emerald-50 text-emerald-600 border-emerald-100',
  }[level]
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{level} risk · {score}</span>
}

type SyncState = 'idle' | 'syncing' | 'done' | 'error'

interface SyncResult {
  pages: number
  articles: number
  topSignal?: string
}

export default function CompetitorDrawer({
  competitor,
  onClose,
  onSynced,
}: {
  competitor: MapCompetitor | null
  onClose: () => void
  onSynced?: (lastSyncedAt: string) => void
}) {
  const [logoErr, setLogoErr]   = useState(false)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncError, setSyncError]   = useState<string | null>(null)

  // Reset sync state when competitor changes
  const [prevId, setPrevId] = useState<string | null>(null)
  if (competitor?.id !== prevId) {
    setPrevId(competitor?.id ?? null)
    setSyncState('idle')
    setSyncResult(null)
    setSyncError(null)
    setLogoErr(false)
  }

  if (!competitor) return null

  const isRealCompetitor = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(competitor.id)
  const logoUrl = getLogoUrl(competitor.website)
  const domain  = competitor.website.replace(/^https?:\/\//, '').replace(/\/$/, '')

  async function handleDeepSync() {
    if (!isRealCompetitor || syncState === 'syncing') return
    setSyncState('syncing')
    setSyncResult(null)
    setSyncError(null)
    try {
      const res  = await fetch(`/api/deep-sync/${competitor!.id}`, { method: 'POST' })
      const data = await res.json() as {
        pages_processed?: number
        news_articles_found?: number
        news_signal?: string
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      const now = new Date().toISOString()
      setSyncResult({
        pages:     data.pages_processed ?? 0,
        articles:  data.news_articles_found ?? 0,
        topSignal: data.news_signal,
      })
      setSyncState('done')
      onSynced?.(now)
    } catch (err) {
      setSyncError(String(err).replace('Error: ', ''))
      setSyncState('error')
    }
  }

  return (
    <>
      {/* Invisible backdrop to close on outside click */}
      <div className="fixed inset-0 z-30" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-16 right-4 z-40 w-80 bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-80px)]">

        {/* ── Header ── */}
        <div className="flex items-start gap-3 p-4 pb-3">
          {/* Logo */}
          <div className="w-11 h-11 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl && !logoErr ? (
              <img src={logoUrl} alt={competitor.name} className="w-8 h-8 object-contain"
                onError={() => setLogoErr(true)} />
            ) : (
              <span className="text-base font-bold text-gray-500">{competitor.name[0]}</span>
            )}
          </div>

          {/* Name + website */}
          <div className="flex-1 min-w-0">
            <h2 className="text-gray-900 font-semibold text-sm leading-tight truncate">{competitor.name}</h2>
            <a
              href={competitor.website.startsWith('http') ? competitor.website : `https://${competitor.website}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-gray-400 text-xs hover:text-violet-600 flex items-center gap-0.5 mt-0.5 transition-colors truncate"
            >
              {domain}
              <ExternalLink className="w-2.5 h-2.5 shrink-0 ml-0.5" />
            </a>
          </div>

          <button onClick={onClose}
            className="text-gray-300 hover:text-gray-600 transition-colors shrink-0 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Risk + last synced ── */}
        <div className="flex items-center justify-between px-4 pb-3">
          <RiskBadge score={competitor.risk_score} />
          <span className="text-[11px] text-gray-400">
            {competitor.last_synced_at
              ? `Synced ${timeAgo(competitor.last_synced_at)}`
              : 'Never synced'}
          </span>
        </div>

        {/* ── AI Summary ── */}
        {competitor.ai_summary && (
          <div className="mx-4 mb-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-4">{competitor.ai_summary}</p>
          </div>
        )}

        {/* ── Latest signal ── */}
        {competitor.last_signal && competitor.last_signal !== 'No signals yet' && (
          <div className="mx-4 mb-3 bg-violet-50 rounded-xl p-3 border border-violet-100">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3 h-3 text-violet-500" />
              <span className="text-[10px] font-semibold text-violet-500 uppercase tracking-wide">Latest signal</span>
              {competitor.signals_count > 0 && (
                <span className="ml-auto text-[10px] text-violet-400">{competitor.signals_count} total</span>
              )}
            </div>
            <p className="text-[11px] text-violet-800 leading-snug line-clamp-3">{competitor.last_signal}</p>
          </div>
        )}

        {/* ── Deep Sync ── */}
        {isRealCompetitor && (
          <div className="px-4 pb-3">
            {syncState === 'idle' || syncState === 'error' ? (
              <button
                onClick={handleDeepSync}
                className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Deep Sync
              </button>
            ) : syncState === 'syncing' ? (
              <div className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-xl bg-violet-50 border border-violet-100 text-violet-600">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Syncing… this takes ~30s
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-[11px] font-semibold text-emerald-700">
                    Sync complete — {syncResult?.pages} pages · {syncResult?.articles} articles
                  </span>
                </div>
                {syncResult?.topSignal && (
                  <p className="text-[11px] text-emerald-800 leading-snug ml-5">{syncResult.topSignal}</p>
                )}
              </div>
            )}

            {syncState === 'error' && syncError && (
              <div className="flex items-center gap-1.5 mt-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <p className="text-[11px] text-red-500">{syncError}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Open full profile ── */}
        {isRealCompetitor && (
          <div className="px-4 pb-4">
            <Link
              href={`/competitor/${competitor.id}`}
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors"
            >
              Open Full Profile
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
