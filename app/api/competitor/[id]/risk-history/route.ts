import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    let user = null
    try {
      const result = await supabase.auth.getUser()
      user = result.data?.user ?? null
    } catch { /* auth unavailable */ }
    if (!user) return NextResponse.json({ history: [] }, { status: 401 })

    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ history: [] }, { status: 403 })

    const { data: ownerCheck } = await supabase
      .from('competitors')
      .select('id')
      .eq('id', params.id)
      .eq('org_id', membership.org_id)
      .maybeSingle()
    if (!ownerCheck) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('risk_score_history')
      .select('scored_at, total')
      .eq('competitor_id', params.id)
      .gte('scored_at', since)
      .order('scored_at', { ascending: true })

    if (error) {
      console.error('[risk-history]', error)
      return NextResponse.json({ history: [] })
    }

    return NextResponse.json({ history: (data ?? []).map(r => r.total) })
  } catch (err) {
    console.error('[risk-history] unexpected error', err)
    return NextResponse.json({ history: [] })
  }
}
