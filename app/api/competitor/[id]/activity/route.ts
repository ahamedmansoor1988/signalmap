import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: pages } = await supabase
    .from('tracked_pages')
    .select('id')
    .eq('competitor_id', params.id)

  const pageIds = pages?.map(p => p.id) ?? []
  if (!pageIds.length) return NextResponse.json({ activity: [] })

  const { data, error } = await supabase
    .from('changes')
    .select('id, ai_signal, theme, detected_at')
    .in('tracked_page_id', pageIds)
    .order('detected_at', { ascending: false })
    .limit(5)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ activity: data ?? [] })
}
