import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fetchGoogleNews, fetchBlogRSS } from '@/lib/rss-fetcher'

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

  // Get stored RSS/blog URLs from tracked_pages (discovered via "Discover Content Sources")
  const { data: trackedPages } = await supabase
    .from('tracked_pages')
    .select('competitor_id, url, label')
    .in('competitor_id', competitors.map(c => c.id))
    .or('label.ilike.%blog%,label.ilike.%rss%,label.ilike.%news%,label.ilike.%changelog%')

  const rssUrlsByCompetitor: Record<string, string[]> = {}
  for (const page of trackedPages ?? []) {
    if (!rssUrlsByCompetitor[page.competitor_id]) rssUrlsByCompetitor[page.competitor_id] = []
    rssUrlsByCompetitor[page.competitor_id].push(page.url)
  }

  const { data: existing } = await supabase
    .from('news_signals').select('url')
    .eq('org_id', membership.org_id)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
  const existingUrls = new Set((existing ?? []).map(e => e.url).filter(Boolean) as string[])

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  type Competitor = typeof competitors[0]
  type RSSItem = Awaited<ReturnType<typeof fetchGoogleNews>>[0]

  // Fetch Google News + stored blog RSS for all competitors in parallel
  const fetchResults = await Promise.allSettled(
    competitors.map(async (competitor) => {
      const storedRssUrls = rssUrlsByCompetitor[competitor.id] ?? []

      // If no stored URLs, fall back to guessing common feed paths
      const rssTargets = storedRssUrls.length > 0
        ? storedRssUrls
        : (competitor.website ? [competitor.website] : [])

      const [news, ...blogResults] = await Promise.all([
        fetchGoogleNews(competitor.name, competitor.website),
        ...rssTargets.map(url => fetchBlogRSS(url)),
      ])

      const blogItems = blogResults.flat()

      const items = [...blogItems, ...news] // blog first (more authoritative)
        .filter(i => i.link && !existingUrls.has(i.link))
        .filter(i => new Date(i.pubDate) >= sevenDaysAgo)
        .slice(0, 5)

      return { competitor, items }
    })
  )

  const toProcess: Array<{ competitor: Competitor; item: RSSItem }> = []
  for (const r of fetchResults) {
    if (r.status === 'fulfilled') {
      for (const item of r.value.items) {
        toProcess.push({ competitor: r.value.competitor, item })
      }
    }
  }

  const inserts = await Promise.allSettled(
    toProcess.slice(0, 20).map(async ({ competitor, item }) => {
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
