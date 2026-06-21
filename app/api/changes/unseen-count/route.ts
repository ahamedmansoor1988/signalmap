import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ count: 0, latest: null })

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ count: 0, latest: null })

  // Get competitor IDs for this org
  const { data: orgCompetitors } = await supabase
    .from('competitors')
    .select('id')
    .eq('org_id', membership.org_id)

  const competitorIds = (orgCompetitors ?? []).map((c) => c.id)
  if (!competitorIds.length) return NextResponse.json({ count: 0, latest: null })

  // Get tracked page IDs for those competitors
  const { data: pages } = await supabase
    .from('tracked_pages')
    .select('id')
    .in('competitor_id', competitorIds)

  const pageIds = (pages ?? []).map((p) => p.id)
  if (!pageIds.length) return NextResponse.json({ count: 0, latest: null })

  // Read state is personal: one teammate opening the inbox must not clear it for everyone.
  const { data: recentChanges } = await supabase
    .from('changes')
    .select('id, ai_signal, risk_score, tracked_page_id, detected_at')
    .in('tracked_page_id', pageIds)
    .order('detected_at', { ascending: false })
    .limit(500)

  const ids = (recentChanges ?? []).map(change => change.id)
  const { data: reads } = ids.length
    ? await supabase.from('signal_reads').select('change_id').eq('user_id', user.id).in('change_id', ids)
    : { data: [] }
  const readIds = new Set((reads ?? []).map(read => read.change_id))
  const minimumRisk = Math.max(0, Math.min(101, Number(req.nextUrl.searchParams.get('minimum_risk')) || 0))
  const unseen = (recentChanges ?? []).filter(change =>
    !readIds.has(change.id) && (change.risk_score ?? 0) >= minimumRisk
  )
  const latest = unseen[0] ?? null
  let competitorName = 'Competitor'

  if (latest) {
    const { data: tp } = await supabase
      .from('tracked_pages')
      .select('competitors(name)')
      .eq('id', latest.tracked_page_id)
      .maybeSingle()
    const comp = tp?.competitors as { name: string } | null
    competitorName = comp?.name ?? 'Competitor'
  }

  return NextResponse.json({
    count: unseen.length,
    latest: latest
      ? { id: latest.id, competitor_name: competitorName, ai_signal: latest.ai_signal, risk_score: latest.risk_score }
      : null,
  })
}
