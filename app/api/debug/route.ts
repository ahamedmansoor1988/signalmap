import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fetchGoogleNews } from '@/lib/rss-fetcher'
import { callClaudeJSON } from '@/lib/ai'
import { SIGNAL_IMPACT_SYSTEM } from '@/lib/prompts/signals'

export async function GET() {
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await userSupabase
    .from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()

  const supabase = await createServiceClient()
  const { data: competitors } = await supabase
    .from('competitors').select('id, name').eq('org_id', membership?.org_id ?? '').limit(1)

  const firstCompetitor = competitors?.[0]
  if (!firstCompetitor) return NextResponse.json({ error: 'No competitors' })

  // Step 1: fetch news
  const news = await fetchGoogleNews(firstCompetitor.name)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const filtered = news.filter(i => new Date(i.pubDate) >= sevenDaysAgo)

  if (!filtered.length) {
    return NextResponse.json({
      step: 'date_filter_blocked',
      competitor: firstCompetitor.name,
      totalFetched: news.length,
      sevenDaysAgo: sevenDaysAgo.toISOString(),
      firstItemDate: news[0]?.pubDate,
      firstItemTitle: news[0]?.title,
    })
  }

  // Step 2: try AI on first item
  const item = filtered[0]
  let aiResult: unknown = null
  let aiError: string | null = null
  try {
    aiResult = await callClaudeJSON(
      SIGNAL_IMPACT_SYSTEM,
      `Competitor: ${firstCompetitor.name}\nHeadline: ${item.title}\nSummary: ${item.summary}`,
      250
    )
  } catch (e) {
    aiError = String(e)
  }

  // Step 3: try insert
  let insertError: string | null = null
  if (aiResult && !aiError) {
    const { error } = await supabase.from('news_signals').insert({
      competitor_id: firstCompetitor.id,
      org_id: membership?.org_id ?? '',
      title: item.title,
      summary: item.summary,
      url: item.link,
      source_type: item.source,
      published_at: item.pubDate,
      ai_impact: (aiResult as { impact: string }).impact,
      ai_counter: (aiResult as { counter: string }).counter,
    })
    insertError = error?.message ?? null
  }

  return NextResponse.json({
    competitor: firstCompetitor.name,
    newsCount: news.length,
    filteredCount: filtered.length,
    firstItem: { title: item.title, pubDate: item.pubDate },
    aiResult,
    aiError,
    insertError,
  })
}
