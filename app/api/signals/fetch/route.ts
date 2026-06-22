import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fetchGoogleNews, fetchBlogRSS } from '@/lib/rss-fetcher'
import { fetchChangelog } from '@/lib/pipeline/changelog'
import { fetchPress } from '@/lib/pipeline/press'
import { fetchGitHub } from '@/lib/pipeline/github'
import { fetchProductHunt } from '@/lib/pipeline/producthunt'
import { fetchJobs } from '@/lib/pipeline/jobs'
import { fetchAppStore } from '@/lib/pipeline/appstore'
import type { PipelineItem } from '@/lib/pipeline/types'

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

  type Competitor = typeof competitors[0]

  const toInsert: Array<{ competitor: Competitor; item: PipelineItem }> = []

  await Promise.allSettled(
    competitors.map(async (competitor) => {
      const [news, blog, changelog, press, github, producthunt, jobs, appstore] = await Promise.allSettled([
        fetchGoogleNews(competitor.name, competitor.website),
        fetchBlogRSS(competitor.website),
        fetchChangelog(competitor, existingUrls),
        fetchPress(competitor, existingUrls),
        fetchGitHub(competitor, existingUrls),
        fetchProductHunt(competitor, existingUrls),
        fetchJobs(competitor, existingUrls),
        fetchAppStore(competitor, existingUrls),
      ])

      const newsItems = (news.status === 'fulfilled' ? news.value : []).map(i => ({
        title: i.title, summary: i.summary, url: i.link,
        source_type: i.source, published_at: i.pubDate,
      }))
      const blogItems = (blog.status === 'fulfilled' ? blog.value : []).map(i => ({
        title: i.title, summary: i.summary, url: i.link,
        source_type: i.source, published_at: i.pubDate,
      }))

      const allItems: PipelineItem[] = [
        ...blogItems,
        ...(changelog.status === 'fulfilled' ? changelog.value : []),
        ...(press.status === 'fulfilled' ? press.value : []),
        ...(github.status === 'fulfilled' ? github.value : []),
        ...(producthunt.status === 'fulfilled' ? producthunt.value : []),
        ...(jobs.status === 'fulfilled' ? jobs.value : []),
        ...(appstore.status === 'fulfilled' ? appstore.value : []),
        ...newsItems,
      ]

      const deduped = allItems
        .filter(i => i.url && !existingUrls.has(i.url))
        .filter(i => new Date(i.published_at) >= sevenDaysAgo)
        .slice(0, 5)

      for (const item of deduped) {
        existingUrls.add(item.url)
        toInsert.push({ competitor, item })
      }
    })
  )

  const inserts = await Promise.allSettled(
    toInsert.slice(0, 20).map(async ({ competitor, item }) => {
      await supabase.from('news_signals').insert({
        competitor_id: competitor.id,
        org_id:        membership.org_id,
        title:         item.title,
        summary:       item.summary,
        url:           item.url,
        source_type:   item.source_type,
        published_at:  item.published_at,
        ai_impact:     null,
        ai_counter:    null,
      })
      return item.url
    })
  )

  const totalInserted = inserts.filter(r => r.status === 'fulfilled').length
  return NextResponse.json({ inserted: totalInserted })
}
