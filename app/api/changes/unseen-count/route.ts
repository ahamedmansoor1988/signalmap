import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
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

  // Count unseen + fetch latest in one shot
  const [{ count }, { data: latestRows }] = await Promise.all([
    supabase
      .from('changes')
      .select('id', { count: 'exact', head: true })
      .in('tracked_page_id', pageIds)
      .is('seen_at', null),
    supabase
      .from('changes')
      .select('id, ai_signal, tracked_page_id')
      .in('tracked_page_id', pageIds)
      .is('seen_at', null)
      .order('detected_at', { ascending: false })
      .limit(1),
  ])

  const latest = latestRows?.[0] ?? null
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
    count: count ?? 0,
    latest: latest
      ? { id: latest.id, competitor_name: competitorName, ai_signal: latest.ai_signal }
      : null,
  })
}
