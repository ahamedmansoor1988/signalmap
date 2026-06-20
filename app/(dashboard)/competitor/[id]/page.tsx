import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, TrendingUp, Zap, AlertTriangle } from 'lucide-react'
import { THEME_CONFIG } from '@/components/map/mock-data'
import type { Theme } from '@/components/map/mock-data'
import RiskSparkline from '@/components/competitor/risk-sparkline'

function getLogoUrl(website: string) {
  try {
    const domain = new URL(website.startsWith('http') ? website : `https://${website}`).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  } catch { return null }
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const d = Math.floor(diff / 86400000)
  const h = Math.floor(diff / 3600000)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  return 'just now'
}

export default async function CompetitorProfilePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  type CompetitorFull = {
    id: string; name: string; website: string; risk_score: number
    ai_summary: string | null; tracked_pages: unknown
  }
  type DiffRow = { id: string; change_type: string; detected_at: string; summary: string | null }
  type RiskRow = { scored_at: string; product_velocity: number; messaging_overlap: number; market_reach: number; total: number }
  type ChangeRow = { id: string; ai_signal: string | null; theme: string | null; detected_at: string; confidence: number | null }

  let competitor: CompetitorFull | null = null
  let diffs: DiffRow[] | null = null
  let riskHistory: RiskRow[] | null = null

  try {
    const [r1, r2, r3] = await Promise.all([
      supabase.from('competitors').select('*, tracked_pages(id, url, label, last_crawled_at, changes(id, ai_signal, ai_summary, theme, risk_score, confidence, detected_at))').eq('id', params.id).single(),
      supabase.from('competitor_diffs').select('id, change_type, detected_at, summary').eq('competitor_id', params.id).order('detected_at', { ascending: false }).limit(20),
      supabase.from('risk_score_history').select('scored_at, product_velocity, messaging_overlap, market_reach, total').eq('competitor_id', params.id).order('scored_at', { ascending: false }).limit(30),
    ])
    competitor  = r1.data as CompetitorFull | null
    diffs       = r2.data as DiffRow[] | null
    riskHistory = r3.data as RiskRow[] | null
  } catch { /* handled below */ }

  if (!competitor) notFound()

  type TrackedPage = { id: string; url: string; label: string | null; last_crawled_at: string | null; changes: ChangeRow[] }
  const pages = (competitor.tracked_pages as TrackedPage[] | null) ?? []
  const allChanges = pages.flatMap(p => p.changes).sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime())
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentActivity = allChanges.filter(c => new Date(c.detected_at) >= sevenDaysAgo).slice(0, 7)

  const riskScore = competitor.risk_score > 0 ? competitor.risk_score : (diffs?.length ?? 0) >= 4 ? 75 : (diffs?.length ?? 0) >= 1 ? 45 : 20
  const riskLevel = riskScore >= 75 ? 'High' : riskScore >= 45 ? 'Medium' : 'Low'
  const riskColor = { High: 'text-red-600 bg-red-50', Medium: 'text-amber-600 bg-amber-50', Low: 'text-emerald-600 bg-emerald-50' }[riskLevel]

  const logoUrl = getLogoUrl(competitor.website)
  const domain  = competitor.website.replace(/^https?:\/\//, '')

  // Derive themes from change signals
  const themeSet = new Set(allChanges.map(c => c.theme).filter(Boolean) as string[])
  const themes = Array.from(themeSet).slice(0, 5) as Theme[]

  // Potential impact bullets from AI summary
  const impactPoints = competitor.ai_summary
    ? competitor.ai_summary.split('. ').filter(s => s.length > 20).slice(0, 3)
    : ['Monitor pricing changes closely', 'Review feature positioning', 'Track hiring signals']

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* Back nav */}
        <Link href="/competitor" className="inline-flex items-center gap-1.5 text-gray-400 text-sm hover:text-gray-700 transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Competitors
        </Link>

        {/* ── Header ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div className="w-14 h-14 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt={competitor.name} className="w-10 h-10 object-contain" />
                ) : (
                  <span className="text-xl font-bold text-gray-500">{competitor.name[0]}</span>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{competitor.name}</h1>
                <a href={competitor.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-violet-500 text-sm hover:text-violet-700 mt-0.5">
                  {domain} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Risk score */}
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-2xl font-bold text-gray-900">{riskScore}</span>
                  <span className="text-sm text-gray-400">/100</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${riskColor}`}>
                    ▲ {riskLevel}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Risk Score</p>
                {riskHistory && riskHistory.length >= 2 && (
                  <div className="mt-1 flex justify-end">
                    <RiskSparkline
                      data={[...riskHistory].reverse().map(r => ({ scored_at: r.scored_at, total: r.total }))}
                      height={28} width={80}
                    />
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Theme tags */}
          {themes.length > 0 && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
              <span className="text-xs text-gray-400">Themes:</span>
              {themes.map(t => {
                const cfg = THEME_CONFIG[t]
                if (!cfg) return null
                return (
                  <span key={t} className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                    {cfg.label}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* ── 3-column body ── */}
        <div className="grid grid-cols-3 gap-4">

          {/* Recent Activity */}
          <div className="col-span-1 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
              <span className="text-xs text-gray-400">Last 7 days</span>
            </div>
            {recentActivity.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No signals yet — cron runs daily</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map(change => {
                  const theme = change.theme as Theme | null
                  const cfg   = theme && THEME_CONFIG[theme] ? THEME_CONFIG[theme] : null
                  return (
                    <div key={change.id} className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 leading-snug line-clamp-2">{change.ai_signal ?? 'Change detected'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {cfg && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                              style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                              {cfg.label}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400">{timeAgo(change.detected_at)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <Link href="/changes" className="block text-center text-xs text-violet-600 hover:text-violet-800 mt-4 pt-3 border-t border-gray-100">
              View all activity →
            </Link>
          </div>

          {/* AI Summary + Potential Impact */}
          <div className="col-span-1 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">AI Summary</h2>
              <p className="text-xs text-gray-600 leading-relaxed">
                {competitor.ai_summary ?? 'Run a sync to generate an AI summary of this competitor\'s positioning and recent moves.'}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Potential Impact</h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${riskColor}`}>
                  {riskLevel}
                </span>
              </div>
              <ul className="space-y-2">
                {impactPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="text-violet-400 mt-0.5 shrink-0">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Quick actions */}
          <div className="col-span-1 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3.5 h-3.5 text-violet-500" />
              <h2 className="text-sm font-semibold text-gray-900">Quick Actions</h2>
            </div>
            <Link href={`/battle/${params.id}`}
              className="flex items-center justify-center gap-1.5 w-full text-xs font-semibold px-3 py-2.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors">
              <TrendingUp className="w-3.5 h-3.5" />
              Open Battle Room
            </Link>
            <Link href={`/changes?competitor=${encodeURIComponent(competitor.name)}`}
              className="flex items-center justify-center gap-1.5 w-full text-xs font-semibold px-3 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-colors">
              View All Signals →
            </Link>
            <div className="mt-auto pt-3 border-t border-gray-100 text-center">
              <p className="text-2xl font-bold text-gray-900">{allChanges.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">total signals detected</p>
            </div>
          </div>
        </div>

        {/* ── Changes feed ── */}
        {diffs && diffs.length > 0 && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Change History</h2>
              <div className="flex gap-2">
                {['Pricing', 'Messaging', 'Product', 'Hiring'].map(type => {
                  const count = diffs!.filter(d => d.change_type === type).length
                  return count > 0 ? (
                    <span key={type} className="text-[10px] text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                      {type} · {count}
                    </span>
                  ) : null
                })}
              </div>
            </div>
            <div className="space-y-2">
              {diffs.slice(0, 8).map(d => (
                <div key={d.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 leading-snug">{d.summary ?? d.change_type + ' change detected'}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(d.detected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  </div>
                  <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded shrink-0">{d.change_type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
