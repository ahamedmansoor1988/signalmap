'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import {
  ExternalLink, TrendingUp, AlertCircle, Zap,
  RefreshCw, Info, DollarSign, MessageSquare, ArrowRight,
} from 'lucide-react'
import type { MockCompetitor } from './mock-data'
import { THEME_CONFIG } from './mock-data'
import { getTypeStyle } from '@/lib/typed-actions'
import type { TypedAction } from '@/lib/typed-actions'

interface Insights {
  summary: string
  suggested_actions: TypedAction[]
}

interface ScanPage {
  url: string
  label: string | null
  page_type: string
  key_items: string[]
  summary: string
}

function isRealId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded ${className ?? ''}`} />
}

function RiskBadge({ score }: { score: number }) {
  const level = score >= 75 ? 'High' : score >= 50 ? 'Medium' : 'Low'
  const colors = {
    High:   'bg-red-50 text-red-600 border-red-200',
    Medium: 'bg-amber-50 text-amber-600 border-amber-200',
    Low:    'bg-emerald-50 text-emerald-600 border-emerald-200',
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${colors[level]}`}>
      <AlertCircle className="w-3 h-3" />
      {level} Risk · {score}
    </span>
  )
}

export default function CompetitorDrawer({ competitor, open, onClose }: {
  competitor: MockCompetitor | null
  open: boolean
  onClose: () => void
}) {
  const [insights, setInsights] = useState<Insights | null>(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [scanPages, setScanPages] = useState<ScanPage[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  const isReal = competitor ? isRealId(competitor.id) : false

  // Auto-generate insights when drawer opens for a real competitor
  useEffect(() => {
    if (!open || !competitor || !isReal) return

    // Use pre-fetched data from map page if available
    if (competitor.ai_summary) {
      setInsights({
        summary: competitor.ai_summary,
        suggested_actions: competitor.suggested_actions ?? [],
      })
      return
    }

    // Generate from baseline snapshots
    setInsights(null)
    setScanPages(null)
    setLoadingInsights(true)

    fetch(`/api/competitor-insights/${competitor.id}`, { method: 'POST' })
      .then((r) => r.json())
      .then((data: Insights & { error?: string }) => {
        if (data.summary) setInsights(data)
      })
      .catch(() => {})
      .finally(() => setLoadingInsights(false))
  }, [open, competitor?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset scan when switching competitors
  useEffect(() => {
    setScanPages(null)
    setScanError(null)
  }, [competitor?.id])

  const handleScan = useCallback(async () => {
    if (!competitor || !isReal) return
    setScanning(true)
    setScanError(null)
    setScanPages(null)
    try {
      const res = await fetch(`/api/scan-competitor/${competitor.id}`, { method: 'POST' })
      const data = await res.json() as { pages: ScanPage[] }
      setScanPages(data.pages)
    } catch (err) {
      setScanError('Scan failed — check network connection')
      console.error(err)
    } finally {
      setScanning(false)
    }
  }, [competitor, isReal])

  if (!competitor) return null

  const theme = THEME_CONFIG[competitor.theme]
  const productV   = Math.round(competitor.risk_score * 0.35)
  const msgOverlap = Math.round(competitor.risk_score * 0.30)
  const mktReach   = Math.round(competitor.risk_score * 0.35)
  const scoresAreEstimated = isReal && competitor.signals_count === 0

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-[420px] bg-white border-l border-gray-200 p-0 overflow-y-auto"
      >
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-gray-900 text-xl font-semibold">{competitor.name}</h2>
              <a
                href={`https://${competitor.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 text-sm hover:text-gray-600 flex items-center gap-1 mt-0.5 transition-colors"
              >
                {competitor.website}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <RiskBadge score={competitor.risk_score} />
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: theme.bg, color: theme.color, border: `1px solid ${theme.color}40` }}
            >
              {competitor.theme}
            </span>
            <span className="text-gray-300 text-xs">·</span>
            <span className="text-gray-400 text-xs">
              {competitor.signals_count > 0
                ? `${competitor.signals_count} signals this month`
                : 'Monitoring active'}
            </span>
          </div>
        </div>

        <Separator className="bg-gray-200" />

        {/* Live Scan — real competitors only */}
        {isReal && (
          <>
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="text-gray-700 text-sm font-medium">Live Scan</span>
                </div>
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 border border-violet-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3 h-3 ${scanning ? 'animate-spin' : ''}`} />
                  {scanning ? 'Scanning…' : 'Scan now'}
                </button>
              </div>

              {!scanning && !scanPages && !scanError && (
                <p className="text-gray-400 text-xs leading-snug">
                  Crawl their homepage and pricing page right now — get current tiers, headlines, and positioning without waiting for the daily cron.
                </p>
              )}

              {scanning && (
                <div className="space-y-2 mt-1">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-4/5" />
                  <Skeleton className="h-3.5 w-3/5" />
                </div>
              )}

              {scanError && (
                <p className="text-red-500 text-xs mt-1">{scanError}</p>
              )}

              {scanPages && !scanning && (
                <div className="space-y-3 mt-1">
                  {scanPages.map((page) => (
                    <div key={page.url} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        {page.page_type === 'pricing'
                          ? <DollarSign className="w-3.5 h-3.5 text-amber-500" />
                          : <MessageSquare className="w-3.5 h-3.5 text-violet-500" />
                        }
                        <span className="text-xs font-semibold text-gray-600 capitalize">
                          {page.label ?? page.page_type}
                        </span>
                        <span className="text-gray-300 text-xs ml-auto">just now</span>
                      </div>
                      {page.key_items.length > 0 ? (
                        <ul className="space-y-0.5">
                          {page.key_items.slice(0, 5).map((item, i) => (
                            <li key={i} className="text-gray-700 text-xs flex items-start gap-1.5">
                              <span className="text-gray-300 mt-0.5 shrink-0">·</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-400 text-xs">{page.summary}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator className="bg-gray-200" />
          </>
        )}

        {/* Latest Signal — only when real signals exist, or for mock data */}
        {(!isReal || competitor.signals_count > 0) && (
          <>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="text-gray-700 text-sm font-medium">Latest Signal</span>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-gray-900 text-sm leading-relaxed">{competitor.last_signal}</p>
              </div>
            </div>
            <Separator className="bg-gray-200" />
          </>
        )}

        {/* Strategic Summary */}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-violet-500" />
            <span className="text-gray-700 text-sm font-medium">Strategic Summary</span>
          </div>

          {loadingInsights ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          ) : insights?.summary ? (
            <p className="text-gray-600 text-sm leading-relaxed">{insights.summary}</p>
          ) : isReal ? (
            <p className="text-gray-400 text-sm italic">Generating from baseline data…</p>
          ) : (
            <p className="text-gray-500 text-sm leading-relaxed">{competitor.description}</p>
          )}
        </div>

        <Separator className="bg-gray-200" />

        {/* Risk Score Breakdown */}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-gray-700 text-sm font-medium">Risk Score Breakdown</span>
            {scoresAreEstimated && (
              <span
                title="Scores are estimated from initial data. Real scores update daily as we detect changes — first measurement appears after 24h of tracking."
                className="text-gray-400 hover:text-gray-600 cursor-help transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {[
              { label: 'Product velocity',  value: productV },
              { label: 'Messaging overlap', value: msgOverlap },
              { label: 'Market reach',      value: mktReach },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-gray-400 text-xs w-32 shrink-0">{label}</span>
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${value}%`, backgroundColor: theme.color }}
                  />
                </div>
                <span className="text-gray-500 text-xs w-6 text-right">{value}</span>
              </div>
            ))}
          </div>

          {scoresAreEstimated && (
            <p className="text-gray-400 text-xs mt-3 flex items-start gap-1.5">
              <Info className="w-3 h-3 shrink-0 mt-0.5" />
              Estimated from initial data · real scores update daily after changes are detected
            </p>
          )}
        </div>

        <Separator className="bg-gray-200" />

        {/* Suggested Actions */}
        <div className="p-6">
          <span className="text-gray-700 text-sm font-medium block mb-3">Suggested Actions</span>

          {loadingInsights ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : insights?.suggested_actions?.length ? (
            <div className="space-y-2">
              {insights.suggested_actions.map((action, i) => {
                const style = getTypeStyle(action.type)
                return (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 bg-gray-50 rounded-lg p-3 border border-gray-100"
                  >
                    {style ? (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${style.cls}`}>
                        {style.label}
                      </span>
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-violet-500 mt-0.5 shrink-0" />
                    )}
                    <span className="text-gray-700 text-xs leading-snug">{action.action}</span>
                  </div>
                )
              })}
            </div>
          ) : isReal ? (
            <p className="text-gray-400 text-sm italic">Suggested actions will appear alongside the strategic summary.</p>
          ) : (
            <div className="space-y-2">
              {[
                'Update battlecard with latest positioning changes',
                'Review pricing page for competitive gaps',
                'Flag to sales team for upcoming deals',
              ].map((action, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-violet-500 mt-0.5">›</span>
                  <span className="text-gray-500 text-sm">{action}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
