import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await userSupabase
    .from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()

  const supabase = await createServiceClient()

  const [{ count: signalCount }, { count: competitorCount }, { data: sample }] = await Promise.all([
    supabase.from('news_signals').select('*', { count: 'exact', head: true }).eq('org_id', membership?.org_id ?? ''),
    supabase.from('competitors').select('*', { count: 'exact', head: true }).eq('org_id', membership?.org_id ?? ''),
    supabase.from('news_signals').select('id, title, published_at, competitor_id').eq('org_id', membership?.org_id ?? '').limit(3),
  ])

  return NextResponse.json({ org_id: membership?.org_id, signalCount, competitorCount, sample })
}
