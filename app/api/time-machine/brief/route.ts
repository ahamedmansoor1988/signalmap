import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaudeJSON } from '@/lib/ai'
import { TIME_MACHINE_BRIEF_SYSTEM } from '@/lib/prompts/time-machine-brief'

export interface BriefResponse {
  headline: string
  narrative: string[]
  watch_out: string
  your_move: string
  top_movers: { name: string; risk_delta: number; signals: number; top_signal: string | null }[]
  theme_shifts: { theme: string; competitors: string[]; signal_count: number }[]
  key_signals: { competitor: string; signal: string; detected_at: string }[]
  window_label: string
  days: number
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const daysBack = Math.min(90, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)))
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
  const cutoffISO = cutoff.toISOString()
  const windowLabel = cutoff.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Fetch competitors
  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name, risk_score')
    .eq('org_id', membership.org_id)

  if (!competitors?.length) {
    return NextResponse.json({ error: 'No competitors' }, { status: 400 })
  }

  const competitorIds = competitors.map(c => c.id)
  const compById = new Map(competitors.map(c => [c.id, c]))

  // Pages for these competitors
  const { data: pages } = await supabase
    .from('tracked_pages')
    .select('id, competitor_id')
    .in('competitor_id', competitorIds)

  const pageToComp = new Map<string, string>()
  for (const p of pages ?? []) pageToComp.set(p.id, p.competitor_id)
  const allPageIds = (pages ?? []).map(p => p.id)

  if (!allPageIds.length) {
    return NextResponse.json({ error: 'No tracked pages' }, { status: 400 })
  }

  // Changes SINCE the cutoff (what's new)
  const { data: changes } = await supabase
    .from('changes')
    .select('tracked_page_id, risk_score, theme, ai_signal, detected_at')
    .in('tracked_page_id', allPageIds)
    .gte('detected_at', cutoffISO)
    .order('detected_at', { ascending: false })

  // Changes BEFORE cutoff (historical baseline for delta)
  const { data: historical } = await supabase
    .from('changes')
    .select('tracked_page_id, risk_score, detected_at')
    .in('tracked_page_id', allPageIds)
    .lt('detected_at', cutoffISO)
    .order('detected_at', { ascending: false })

  // Per-competitor aggregation
  const compSignals = new Map<string, { signals: { signal: string; detected_at: string }[]; risk_scores: number[] }>()
  for (const c of competitors) {
    compSignals.set(c.id, { signals: [], risk_scores: [] })
  }

  for (const ch of changes ?? []) {
    const compId = pageToComp.get(ch.tracked_page_id)
    if (!compId) continue
    const entry = compSignals.get(compId)
    if (!entry) continue
    if (ch.ai_signal) entry.signals.push({ signal: ch.ai_signal, detected_at: ch.detected_at })
    if (ch.risk_score) entry.risk_scores.push(ch.risk_score)
  }

  // Historical risk baseline per competitor
  const histRisk = new Map<string, number>()
  for (const ch of historical ?? []) {
    const compId = pageToComp.get(ch.tracked_page_id)
    if (!compId || histRisk.has(compId)) continue
    histRisk.set(compId, ch.risk_score ?? 0)
  }

  // Top movers
  const top_movers = competitors
    .map(c => {
      const entry = compSignals.get(c.id)!
      const currentRisk = c.risk_score ?? 0
      const baseRisk = histRisk.get(c.id) ?? 0
      return {
        name: c.name,
        risk_delta: currentRisk - baseRisk,
        signals: entry.signals.length,
        top_signal: entry.signals[0]?.signal ?? null,
      }
    })
    .filter(m => m.signals > 0 || Math.abs(m.risk_delta) > 5)
    .sort((a, b) => Math.abs(b.risk_delta) - Math.abs(a.risk_delta))
    .slice(0, 8)

  // Theme shifts — group new signals by theme
  const themeMap = new Map<string, { competitors: Set<string>; count: number }>()
  for (const ch of changes ?? []) {
    if (!ch.theme || !ch.ai_signal) continue
    const compId = pageToComp.get(ch.tracked_page_id)
    const compName = compId ? compById.get(compId)?.name : null
    if (!compName) continue
    if (!themeMap.has(ch.theme)) themeMap.set(ch.theme, { competitors: new Set(), count: 0 })
    const t = themeMap.get(ch.theme)!
    t.competitors.add(compName)
    t.count++
  }
  const theme_shifts = Array.from(themeMap.entries())
    .map(([theme, data]) => ({ theme, competitors: Array.from(data.competitors), signal_count: data.count }))
    .sort((a, b) => b.signal_count - a.signal_count)
    .slice(0, 5)

  // Key signals — top 8 by recency, with competitor name
  const key_signals = (changes ?? [])
    .filter(ch => ch.ai_signal)
    .slice(0, 8)
    .map(ch => {
      const compId = pageToComp.get(ch.tracked_page_id)
      const compName = compId ? compById.get(compId)?.name ?? 'Unknown' : 'Unknown'
      return { competitor: compName, signal: ch.ai_signal!, detected_at: ch.detected_at }
    })

  // Build AI context
  const signalContext = key_signals.length > 0
    ? key_signals.map(s => `• ${s.competitor}: ${s.signal}`).join('\n')
    : 'No new signals detected in this period.'

  const moverContext = top_movers.length > 0
    ? top_movers.map(m => `• ${m.name}: risk ${m.risk_delta > 0 ? '+' : ''}${m.risk_delta}, ${m.signals} signals`).join('\n')
    : 'No significant movers.'

  const userMsg = `Time window: last ${daysBack} days (since ${windowLabel})
Competitors monitored: ${competitors.map(c => c.name).join(', ')}

TOP RISK MOVERS:
${moverContext}

KEY SIGNALS DETECTED:
${signalContext}

ACTIVE THEMES THIS PERIOD: ${theme_shifts.map(t => `${t.theme} (${t.signal_count} signals)`).join(', ') || 'none'}

Write the competitive brief for this period.`

  interface AINarrative {
    headline: string
    narrative: string[]
    watch_out: string
    your_move: string
  }

  let ai: AINarrative = {
    headline: 'Competitive landscape activity detected in this period.',
    narrative: [
      top_movers.length > 0
        ? `${top_movers[0].name} showed the highest activity with ${top_movers[0].signals} signals and a risk delta of ${top_movers[0].risk_delta > 0 ? '+' : ''}${top_movers[0].risk_delta}.`
        : 'Multiple competitors showed activity in this period.',
      theme_shifts.length > 0
        ? `The most active themes were ${theme_shifts.slice(0, 2).map(t => t.theme).join(' and ')}, with ${theme_shifts[0]?.signal_count ?? 0} signals in the leading theme.`
        : 'No dominant themes emerged in this period.',
      'Review the key signals below and update your battle cards accordingly.',
    ],
    watch_out: top_movers[0] ? `${top_movers[0].name} is your highest-risk competitor right now.` : 'Monitor all competitors for continued activity.',
    your_move: 'Review the top signals and update your positioning document.',
  }

  try {
    ai = await callClaudeJSON<AINarrative>(TIME_MACHINE_BRIEF_SYSTEM, userMsg, 800)
  } catch {
    // fallback to structured summary above
  }

  const response: BriefResponse = {
    headline: ai.headline,
    narrative: ai.narrative,
    watch_out: ai.watch_out,
    your_move: ai.your_move,
    top_movers,
    theme_shifts,
    key_signals,
    window_label: windowLabel,
    days: daysBack,
  }

  return NextResponse.json(response)
}
