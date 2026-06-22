import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fetchGoogleNews, fetchBlogRSS } from '@/lib/rss-fetcher'
import { callClaudeJSON } from '@/lib/ai'
import { SIGNAL_IMPACT_SYSTEM } from '@/lib/prompts/signals'

export const runtime = 'nodejs'
export const maxDuration = 55

export async function POST() {
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await userSupabase
    .from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const supabase = await createServiceClient()

  const { data: competitors } = await supabase
    .from('competitors').select('id, name, website').eq('org_id', membership.org_id)
  if (!competitors?.length) return NextResponse.json({ inserted: 0 })

  const { data: existing } = await supabase
    .from('news_signals').select('url')
    .eq('org_id', membership.org_id)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
  const existingUrls = new Set((existing ?? []).map(e => e.url).filter(Boolean) as string[])

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  let totalInserted = 0

  for (const competitor of competitors) {
    const [news, blog] = await Promise.all([
      fetchGoogleNews(competitor.name),
      fetchBlogRSS(competitor.website),
    ])

    const items = [...news, ...blog]
      .filter(i => i.link && !existingUrls.has(i.link))
      .filter(i => new Date(i.pubDate) >= sevenDaysAgo)
      .slice(0, 6)

    for (const item of items) {
      try {
        const ai = await callClaudeJSON<{ impact: string; counter: string }>(
          SIGNAL_IMPACT_SYSTEM,
          `Competitor: ${competitor.name}\nHeadline: ${item.title}\nSummary: ${item.summary}`,
          250
        )
        await supabase.from('news_signals').insert({
          competitor_id: competitor.id,
          org_id:        membership.org_id,
          title:         item.title,
          summary:       item.summary,
          url:           item.link,
          source_type:   item.source,
          published_at:  item.pubDate,
          ai_impact:     ai.impact,
          ai_counter:    ai.counter,
        })
        existingUrls.add(item.link)
        totalInserted++
      } catch { continue }
    }
  }

  return NextResponse.json({ inserted: totalInserted })
}
