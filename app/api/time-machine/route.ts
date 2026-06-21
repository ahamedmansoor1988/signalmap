import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface TimeMachineCompetitor {
  id: string
  name: string
  website: string
  risk_score: number        // risk at the snapshot date
  risk_delta: number        // current - historical (positive = got riskier)
  theme: string | null
  signals_since: number     // signals detected AFTER snapshot date (new intel)
  top_signal: string | null // most recent signal headline since that date
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ competitors: [] })

  const daysBack = Math.min(90, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)))
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()

  // Fetch all competitors for the org
  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name, website, risk_score')
    .eq('org_id', membership.org_id)

  if (!competitors?.length) return NextResponse.json({ competitors: [], cutoff })

  const competitorIds = competitors.map(c => c.id)

  // Get tracked pages for these competitors
  const { data: pages } = await supabase
    .from('tracked_pages')
    .select('id, competitor_id')
    .in('competitor_id', competitorIds)

  const pageToComp = new Map<string, string>()
  const compPages = new Map<string, string[]>()
  for (const p of pages ?? []) {
    pageToComp.set(p.id, p.competitor_id)
    if (!compPages.has(p.competitor_id)) compPages.set(p.competitor_id, [])
    compPages.get(p.competitor_id)!.push(p.id)
  }

  const allPageIds = (pages ?? []).map(p => p.id)

  // Signals BEFORE the cutoff date → gives us historical state
  const { data: historicalChanges } = await supabase
    .from('changes')
    .select('tracked_page_id, risk_score, theme, ai_signal, detected_at')
    .in('tracked_page_id', allPageIds)
    .lte('detected_at', cutoff)
    .order('detected_at', { ascending: false })

  // Signals AFTER the cutoff date → "what changed since then"
  const { data: newChanges } = await supabase
    .from('changes')
    .select('tracked_page_id, risk_score, theme, ai_signal, detected_at')
    .in('tracked_page_id', allPageIds)
    .gt('detected_at', cutoff)
    .order('detected_at', { ascending: false })

  // Build per-competitor historical snapshot
  const result: TimeMachineCompetitor[] = competitors.map(comp => {
    const myPageIds = new Set(compPages.get(comp.id) ?? [])

    // Historical: most recent signal BEFORE cutoff → that was the state then
    const histSignals = (historicalChanges ?? []).filter(c => myPageIds.has(c.tracked_page_id))
    const historicalRisk = histSignals.length > 0
      ? Math.max(...histSignals.slice(0, 5).map(c => c.risk_score ?? 0))
      : 0
    const historicalTheme = histSignals[0]?.theme ?? null

    // New signals since cutoff
    const newer = (newChanges ?? []).filter(c => myPageIds.has(c.tracked_page_id))
    const topSignal = newer[0]?.ai_signal ?? null

    return {
      id: comp.id,
      name: comp.name,
      website: comp.website,
      risk_score: historicalRisk,
      risk_delta: (comp.risk_score ?? 0) - historicalRisk,
      theme: historicalTheme,
      signals_since: newer.length,
      top_signal: topSignal,
    }
  })

  return NextResponse.json({ competitors: result, cutoff, days: daysBack })
}
