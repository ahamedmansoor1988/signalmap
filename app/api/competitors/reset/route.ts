import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) return NextResponse.json({ deleted: 0 })

    // Fetch all competitor IDs for this org
    const { data: competitors } = await supabase
      .from('competitors')
      .select('id')
      .eq('org_id', membership.org_id)

    if (!competitors || competitors.length === 0) return NextResponse.json({ deleted: 0 })

    const ids = competitors.map(c => c.id)

    // Delete in order respecting FK constraints:
    // changes → tracked_pages → competitor_diffs → competitors
    const { data: pages } = await supabase
      .from('tracked_pages')
      .select('id')
      .in('competitor_id', ids)

    const pageIds = (pages ?? []).map(p => p.id)

    if (pageIds.length > 0) {
      await supabase.from('changes').delete().in('tracked_page_id', pageIds)
      await supabase.from('competitor_diffs').delete().in('tracked_page_id', pageIds)
      await supabase.from('tracked_pages').delete().in('id', pageIds)
    }

    // Delete remaining competitor-level data
    await supabase.from('competitor_diffs').delete().in('competitor_id', ids)
    await supabase.from('competitors').delete().in('id', ids)

    // Clear org-level generated content so it regenerates for new competitors
    await supabase.from('weekly_briefs').delete().eq('org_id', membership.org_id)

    return NextResponse.json({ deleted: ids.length })
  } catch (err) {
    console.error('[DELETE /api/competitors/reset]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
