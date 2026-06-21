import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) return NextResponse.json({ competitors: [] })

    // Step 1: flat competitor list (no nested joins)
    const { data: competitors, error } = await supabase
      .from('competitors')
      .select('id, name, website, risk_score, created_at')
      .eq('org_id', membership.org_id)
      .order('risk_score', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const competitorIds = (competitors ?? []).map(c => c.id)
    if (!competitorIds.length) return NextResponse.json({ competitors: [] })

    // Step 2: tracked_page IDs for all competitors
    const { data: trackedPages } = await supabase
      .from('tracked_pages')
      .select('id, competitor_id')
      .in('competitor_id', competitorIds)

    const pageIdToCompId = new Map((trackedPages ?? []).map(p => [p.id, p.competitor_id]))
    const pageIds = (trackedPages ?? []).map(p => p.id)

    // Step 3: 30d changes for those pages only
    type ChangeRow = { tracked_page_id: string; ai_signal: string | null; theme: string | null; detected_at: string }
    let changes: ChangeRow[] = []
    if (pageIds.length > 0) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('changes')
        .select('tracked_page_id, ai_signal, theme, detected_at')
        .in('tracked_page_id', pageIds)
        .gte('detected_at', thirtyDaysAgo)
        .order('detected_at', { ascending: false })
      changes = (data ?? []) as ChangeRow[]
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Group changes by competitor
    const changesByComp = new Map<string, ChangeRow[]>()
    for (const ch of changes) {
      const compId = pageIdToCompId.get(ch.tracked_page_id)
      if (!compId) continue
      if (!changesByComp.has(compId)) changesByComp.set(compId, [])
      changesByComp.get(compId)!.push(ch)
    }

    const enriched = (competitors ?? []).map(c => {
      const compChanges = changesByComp.get(c.id) ?? []
      const recentCount = compChanges.filter(ch => ch.detected_at >= sevenDaysAgo).length
      const lastSignal  = compChanges[0]?.detected_at ?? null
      const themes      = Array.from(new Set(compChanges.map(ch => ch.theme).filter(Boolean))).slice(0, 3)

      return {
        id:            c.id,
        name:          c.name,
        website:       c.website,
        risk_score:    c.risk_score,
        created_at:    c.created_at,
        signals_total: compChanges.length,
        signals_week:  recentCount,
        last_signal:   lastSignal,
        themes,
      }
    })

    return NextResponse.json({ competitors: enriched })
  } catch (err) {
    console.error('[GET /api/competitors]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
