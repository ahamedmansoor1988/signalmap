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

    const { data: competitors, error } = await supabase
      .from('competitors')
      .select(`
        id, name, website, risk_score, created_at,
        tracked_pages(
          changes(detected_at, theme)
        )
      `)
      .eq('org_id', membership.org_id)
      .order('risk_score', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const enriched = (competitors ?? []).map(c => {
      type ChangeRow = { detected_at: string; theme: string | null }
      const allChanges = (c.tracked_pages as Array<{ changes: ChangeRow[] }>)
        .flatMap(tp => tp.changes)
      const recentCount = allChanges.filter(ch => ch.detected_at >= sevenDaysAgo).length
      const lastSignal  = allChanges.sort((a, b) => b.detected_at.localeCompare(a.detected_at))[0]?.detected_at ?? null
      const themes      = Array.from(new Set(allChanges.map(ch => ch.theme).filter(Boolean))).slice(0, 3)

      return {
        id:            c.id,
        name:          c.name,
        website:       c.website,
        risk_score:    c.risk_score,
        created_at:    c.created_at,
        signals_total: allChanges.length,
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
