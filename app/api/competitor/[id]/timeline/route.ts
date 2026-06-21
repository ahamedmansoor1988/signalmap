import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPaid } from '@/lib/plans'

export interface TimelineSignal {
  id: string
  ai_signal: string | null
  theme: string | null
  risk_score: number | null
  detected_at: string
}

export interface TimelineResponse {
  signals: TimelineSignal[]
  risk_trend: { date: string; score: number }[]
  days: number
  locked: boolean
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

  const { data: pages } = await supabase
    .from('tracked_pages')
    .select('id')
    .eq('competitor_id', params.id)

  const pageIds = (pages ?? []).map(p => p.id)
  if (!pageIds.length) return NextResponse.json({ signals: [], risk_trend: [], days, locked })

  const { data: changes } = await supabase
    .from('changes')
    .select('id, ai_signal, theme, risk_score, detected_at')
    .in('tracked_page_id', pageIds)
    .gte('detected_at', cutoff)
    .order('detected_at', { ascending: false })
    .limit(50)

  const signals: TimelineSignal[] = (changes ?? []).map(c => ({
    id: c.id,
    ai_signal: c.ai_signal,
    theme: c.theme,
    risk_score: c.risk_score,
    detected_at: c.detected_at,
  }))

  // Risk trend: group by day, take max risk_score per day
  const byDay = new Map<string, number>()
  for (const s of signals) {
    const day = s.detected_at.slice(0, 10)
    const score = s.risk_score ?? 0
    byDay.set(day, Math.max(byDay.get(day) ?? 0, score))
  }
  const risk_trend = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, score]) => ({ date, score }))

  return NextResponse.json({ signals, risk_trend, days, locked })
}
