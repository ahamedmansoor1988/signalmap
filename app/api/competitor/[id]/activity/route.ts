import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ activity: [] }, { status: 401 })

    const { data: pages } = await supabase
      .from('tracked_pages')
      .select('id')
      .eq('competitor_id', params.id)

    const pageIds = (pages ?? []).map(p => p.id)
    if (!pageIds.length) return NextResponse.json({ activity: [] })

    const { data, error } = await supabase
      .from('changes')
      .select('id, ai_signal, theme, detected_at')
      .in('tracked_page_id', pageIds)
      .order('detected_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('[activity]', error)
      return NextResponse.json({ activity: [] })
    }

    return NextResponse.json({ activity: data ?? [] })
  } catch (err) {
    console.error('[activity] unexpected error', err)
    return NextResponse.json({ activity: [] })
  }
}
