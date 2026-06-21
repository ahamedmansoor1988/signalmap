import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPaid } from '@/lib/plans'
import type { Json } from '@/lib/supabase/types'

export interface TimelineSignal {
  id: string
  ai_signal: string | null
  ai_summary: string | null
  impact_bullets: string[]
  suggested_actions: string[]
  structured_diff: Json | null
  theme: string | null
  risk_score: number | null
  confidence: number | null
  detected_at: string
  page_label: string | null   // "Pricing", "Homepage", "Changelog", "News"
  page_url: string | null
}

export interface TimelineResponse {
  signals: TimelineSignal[]
  risk_trend: { date: string; score: number }[]
  days: number
  locked: boolean
  direction: string | null    // AI-derived strategic direction
}

function extractStringArray(json: Json | null): string[] {
  if (!json) return []
  if (Array.isArray(json)) return json.filter((s): s is string => typeof s === 'string')
  return []
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, organizations(plan)')
    .eq('user_id', user.id)
    .maybeSingle()

  const plan = (membership?.organizations as { plan?: string } | null)?.plan ?? 'starter'
  const paid = isPaid(plan)

  const requested = parseInt(req.nextUrl.searchParams.get('days') ?? '7', 10)
  const days = (!paid && requested > 7) ? 7 : Math.min(90, Math.max(7, requested))
  const locked = !paid && requested > 7

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Fetch pages with their label + url so we can show source attribution
  const { data: pages } = await supabase
    .from('tracked_pages')
    .select('id, label, url')
    .eq('competitor_id', params.id)

  const pageById = new Map((pages ?? []).map(p => [p.id, p]))
  const pageIds = (pages ?? []).map(p => p.id)

  if (!pageIds.length) {
    return NextResponse.json({ signals: [], risk_trend: [], days, locked, direction: null })
  }

  // Fetch full signal data — all the rich fields
  const { data: changes } = await supabase
    .from('changes')
    .select('id, ai_signal, ai_summary, impact_bullets, suggested_actions, structured_diff, theme, risk_score, confidence, detected_at, tracked_page_id')
    .in('tracked_page_id', pageIds)
    .gte('detected_at', cutoff)
    .order('detected_at', { ascending: false })
    .limit(60)

  const signals: TimelineSignal[] = (changes ?? []).map(c => {
    const page = pageById.get(c.tracked_page_id)
    return {
      id: c.id,
      ai_signal: c.ai_signal,
      ai_summary: c.ai_summary,
      impact_bullets: extractStringArray(c.impact_bullets),
      suggested_actions: extractStringArray(c.suggested_actions),
      structured_diff: c.structured_diff,
      theme: c.theme,
      risk_score: c.risk_score,
      confidence: c.confidence,
      detected_at: c.detected_at,
      page_label: page?.label ?? null,
      page_url: page?.url ?? null,
    }
  })

  // Risk trend by day
  const byDay = new Map<string, number>()
  for (const s of signals) {
    const day = s.detected_at.slice(0, 10)
    const score = s.risk_score ?? 0
    byDay.set(day, Math.max(byDay.get(day) ?? 0, score))
  }
  const risk_trend = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, score]) => ({ date, score }))

  // Derive strategic direction from signal themes + summaries
  const themeVotes: Record<string, number> = {}
  for (const s of signals) {
    if (s.theme) themeVotes[s.theme] = (themeVotes[s.theme] ?? 0) + 1
  }
  const topTheme = Object.entries(themeVotes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const pricingSignals  = signals.filter(s => s.page_label?.toLowerCase().includes('pricing') || s.theme === 'Pricing')
  const productSignals  = signals.filter(s => s.page_label?.toLowerCase().includes('changelog') || s.page_label?.toLowerCase().includes('product'))
  const newsSignals     = signals.filter(s => s.page_label === 'News')

  let direction: string | null = null
  if (signals.length > 0) {
    const parts: string[] = []
    if (pricingSignals.length > 0) parts.push(`${pricingSignals.length} pricing change${pricingSignals.length > 1 ? 's' : ''}`)
    if (productSignals.length > 0) parts.push(`${productSignals.length} product update${productSignals.length > 1 ? 's' : ''}`)
    if (newsSignals.length > 0) parts.push(`${newsSignals.length} news signal${newsSignals.length > 1 ? 's' : ''}`)
    if (topTheme) parts.push(`primary theme: ${topTheme}`)
    direction = parts.join(' · ')
  }

  return NextResponse.json({ signals, risk_trend, days, locked, direction })
}
