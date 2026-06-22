import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fetchGoogleNews } from '@/lib/rss-fetcher'

export async function GET() {
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await userSupabase
    .from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()

  const supabase = await createServiceClient()

  const [{ count: signalCount }, { data: competitors }] = await Promise.all([
    supabase.from('news_signals').select('*', { count: 'exact', head: true }).eq('org_id', membership?.org_id ?? ''),
    supabase.from('competitors').select('id, name').eq('org_id', membership?.org_id ?? '').limit(3),
  ])

  // Test Google News for first competitor
  const firstCompetitor = competitors?.[0]
  let newsTest: { name: string; itemCount: number; firstTitle?: string } | null = null
  if (firstCompetitor) {
    const items = await fetchGoogleNews(firstCompetitor.name)
    newsTest = { name: firstCompetitor.name, itemCount: items.length, firstTitle: items[0]?.title }
  }

  // Check env vars
  const envCheck = {
    GROQ_API_KEY: !!process.env.GROQ_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
  }

  return NextResponse.json({ org_id: membership?.org_id, signalCount, competitorCount: competitors?.length, newsTest, envCheck })
}
