import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fetchGoogleNews } from '@/lib/rss-fetcher'

export const runtime = 'nodejs'
export const maxDuration = 55

export async function POST() {
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await userSupabase
    .from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const supabase = createServiceClient()

  const { data: competitors } = await supabase
    .from('competitors').select('id, name, website').eq('org_id', membership.org_id)
  if (!competitors?.length) return NextResponse.json({ inserted: 0 })

  const { data: existing } = await supabase
    .from('news_signals').select('url')
    .eq('org_id', membership.org_id)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
  const existingUrls = new Set((existing ?? []).map(e => e.url).filter(Boolean) as string[])

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // Fetch Google News for all competitors in parallel
  const fetchResults = await Promise.allSettled(
    competitors.map(async (competitor) => {
      const news = await fetchGoogleNews(competitor.name)
      const items = news
        .filter(i => i.link && !existingUrls.has(i.link))
        .filter(i => new Date(i.pubDate) >= sevenDaysAgo)
        .slice(0, 3) // max 3 per competitor to stay within time budget
      return { competitor, items }
    })
  )

  // Flatten all new items
  type Competitor = typeof competitors[0]
  type RSSItem = Awaited<ReturnType<typeof fetchGoogleNews>>[0]
  const toProcess: Array<{ competitor: Competitor; item: RSSItem }> = []
  for (const r of fetchResults) {
    if (r.status === 'fulfilled') {
      for (const item of r.value.items) {
        toProcess.push({ competitor: r.value.competitor, item })
      }
    }
  }

  // Insert raw signals first (no AI — avoids rate limits, signals appear immediately)
  const inserts = await Promise.allSettled(
    toProcess.slice(0, 15).map(async ({ competitor, item }) => {
      await supabase.from('news_signals').insert({
        competitor_id: competitor.id,
        org_id:        membership.org_id,
        title:         item.title,
        summary:       item.summary,
        url:           item.link,
        source_type:   item.source,
        published_at:  item.pubDate,
        ai_impact:     null,
        ai_counter:    null,
      })
      return item.link
    })
  )

  const totalInserted = inserts.filter(r => r.status === 'fulfilled').length
  return NextResponse.json({ inserted: totalInserted })
}
