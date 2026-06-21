import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { crawlPage } from '@/lib/crawler'
import { computeDiff } from '@/lib/diff'
import { callClaudeJSON } from '@/lib/ai'
import { SUMMARIZE_SYSTEM } from '@/lib/prompts/summarize'
import { extractPageData, diffParsedPages, changeTypeFromPageType, calculateRiskScores } from '@/lib/extractor'
import { getCrawlTier, shouldCrawlNow } from '@/lib/crawl-schedule'
import { sendDigest } from '@/lib/digest'
import { generateWeeklyBrief } from '@/lib/weekly-brief'
import { generateTypedActions } from '@/lib/personalized-actions'
import { fetchCompetitorNews } from '@/lib/news'
import { discoverStrategicPages } from '@/lib/sitemap'
import { extractBrandProfile } from '@/lib/brand-extractor'
import type { Database } from '@/lib/supabase/types'

interface NewsSignalResult {
  summary: string; signal: string; confidence: number
  risk_score: number; theme: string; impact_bullets: string[]
}

const NEWS_SIGNAL_PROMPT = `You are a senior competitive intelligence analyst for a PMM.
Analyze this news article about a competitor and extract the strategic signal.
Focus on: acquisitions, funding, partnerships, product launches, executive moves, market expansion, pricing changes.
Respond with JSON: { "summary": "...", "signal": "...", "confidence": 0-100, "risk_score": 0-100, "theme": "AI Features|Pricing|Enterprise|GTM|Content", "impact_bullets": ["..."] }`

export const runtime = 'nodejs'
export const maxDuration = 300

type CompanyProfile = Database['public']['Tables']['company_profiles']['Row']

interface SummarizeResult {
  summary: string
  signal: string
  confidence: number
  risk_score: number
  theme: string
  impact_bullets: string[]
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const results: Array<{ page_id: string; url: string; tier: string; status: string; change_id?: string }> = []
  const today = new Date().toISOString().split('T')[0]

  // Fetch all tracked pages — filter by frequency tier in JS rather than SQL
  // (URL-pattern-based intervals can't be expressed as a single WHERE clause)
  const { data: allPages } = await supabase
    .from('tracked_pages')
    .select('id, url, competitor_id, last_crawled_at')
    .order('last_crawled_at', { ascending: true, nullsFirst: true })

  if (!allPages?.length) {
    return NextResponse.json({ message: 'No pages to crawl', results })
  }

  // Only crawl pages whose frequency interval has elapsed since last crawl
  const pages = allPages
    .filter((p) => shouldCrawlNow(p.last_crawled_at, p.url))
    .slice(0, 20)

  if (!pages.length) {
    return NextResponse.json({
      message: 'All pages crawled recently — nothing due yet',
      total: allPages.length,
      skipped: allPages.length,
      results,
    })
  }

  // Pre-fetch competitor metadata and company profiles for personalized actions
  const uniqueCompetitorIds = Array.from(new Set(pages.map((p) => p.competitor_id)))
  const { data: competitorMeta } = await supabase
    .from('competitors')
    .select('id, name, org_id')
    .in('id', uniqueCompetitorIds)

  const competitorMap: Record<string, { name: string; org_id: string }> = Object.fromEntries(
    (competitorMeta ?? []).map((c) => [c.id, { name: c.name, org_id: c.org_id }])
  )

  const uniqueOrgIds = Array.from(new Set(Object.values(competitorMap).map((c) => c.org_id)))
  const { data: profileRows } = await supabase
    .from('company_profiles')
    .select('*')
    .in('org_id', uniqueOrgIds)

  const profileByOrg: Record<string, CompanyProfile> = Object.fromEntries(
    (profileRows ?? []).map((p) => [p.org_id, p])
  )

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  for (const page of pages) {
    await sleep(2000) // 2s between pages to stay under Groq 12k TPM limit
    const tier = getCrawlTier(page.url)
    try {
      const crawled = await crawlPage(page.url)

      // 1. Store raw snapshot (existing)
      const { data: newSnap } = await supabase
        .from('page_snapshots')
        .insert({
          tracked_page_id: page.id,
          text_content: crawled.text,
          html_content: crawled.html.slice(0, 50000),
          crawled_at: crawled.crawledAt,
        })
        .select()
        .single()

      if (!newSnap) {
        results.push({ page_id: page.id, url: page.url, tier, status: 'snapshot_failed' })
        continue
      }

      await supabase
        .from('tracked_pages')
        .update({ last_crawled_at: crawled.crawledAt })
        .eq('id', page.id)

      // 2. Classic text diff — check for changes before spending AI tokens
      const { data: prevSnap } = await supabase
        .from('page_snapshots')
        .select('id, text_content')
        .eq('tracked_page_id', page.id)
        .neq('id', newSnap.id)
        .order('crawled_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!prevSnap?.text_content) {
        // First snapshot — store structured extraction as baseline, no diff yet
        const parsed = await extractPageData(page.url, crawled.text, crawled.html)
        await supabase
          .from('competitor_snapshots')
          .upsert({
            competitor_id: page.competitor_id,
            tracked_page_id: page.id,
            snapshot_date: today,
            page_type: parsed.page_type,
            raw_text: crawled.text.slice(0, 10000),
            parsed_data: parsed as unknown as import('@/lib/supabase/types').Json,
          }, { onConflict: 'tracked_page_id,snapshot_date' })
        results.push({ page_id: page.id, url: page.url, tier, status: 'first_snapshot' })
        continue
      }

      const textDiff = computeDiff(prevSnap.text_content, crawled.text)
      if (!textDiff.hasChanges) {
        // If this page has never had a structured snapshot, extract baseline now (one-time cost)
        const { data: existingSnapshot } = await supabase
          .from('competitor_snapshots')
          .select('id')
          .eq('tracked_page_id', page.id)
          .limit(1)
          .maybeSingle()

        if (!existingSnapshot) {
          const parsed = await extractPageData(page.url, crawled.text, crawled.html)
          await supabase
            .from('competitor_snapshots')
            .upsert({
              competitor_id: page.competitor_id,
              tracked_page_id: page.id,
              snapshot_date: today,
              page_type: parsed.page_type,
              raw_text: crawled.text.slice(0, 10000),
              parsed_data: parsed as unknown as import('@/lib/supabase/types').Json,
            }, { onConflict: 'tracked_page_id,snapshot_date' })
        }

        results.push({ page_id: page.id, url: page.url, tier, status: 'no_changes' })
        continue
      }

      // 3. Changes detected — extract structured data + compare with yesterday
      const parsed = await extractPageData(page.url, crawled.text, crawled.html)
      await supabase
        .from('competitor_snapshots')
        .upsert({
          competitor_id: page.competitor_id,
          tracked_page_id: page.id,
          snapshot_date: today,
          page_type: parsed.page_type,
          raw_text: crawled.text.slice(0, 10000),
          parsed_data: parsed as unknown as import('@/lib/supabase/types').Json,
        }, { onConflict: 'tracked_page_id,snapshot_date' })

      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const { data: prevSnapshot } = await supabase
        .from('competitor_snapshots')
        .select('parsed_data')
        .eq('tracked_page_id', page.id)
        .eq('snapshot_date', yesterday)
        .maybeSingle()

      if (prevSnapshot?.parsed_data) {
        const diff = diffParsedPages(
          prevSnapshot.parsed_data as unknown as typeof parsed,
          parsed
        )
        if (diff && (diff.added.length > 0 || diff.removed.length > 0)) {
          const summaryLines = [
            diff.added.length > 0 ? `Added: ${diff.added.slice(0, 3).join(' · ')}` : '',
            diff.removed.length > 0 ? `Removed: ${diff.removed.slice(0, 3).join(' · ')}` : '',
          ].filter(Boolean).join(' | ')

          await supabase.from('competitor_diffs').insert({
            competitor_id: page.competitor_id,
            tracked_page_id: page.id,
            change_type: changeTypeFromPageType(parsed.page_type),
            summary: summaryLines || parsed.summary,
            old_value: prevSnapshot.parsed_data,            // full ParsedPage
            new_value: parsed as unknown as import('@/lib/supabase/types').Json, // full ParsedPage
          })
        }
      }

      // 4. AI summary of the text diff
      const diffSummary = [
        `REMOVED:\n${textDiff.removedLines.slice(0, 20).map((l) => `- ${l}`).join('\n')}`,
        `ADDED:\n${textDiff.addedLines.slice(0, 20).map((l) => `+ ${l}`).join('\n')}`,
      ].join('\n\n')

      const ai = await callClaudeJSON<SummarizeResult>(SUMMARIZE_SYSTEM, diffSummary, 1024)

      // 5. Personalized actions using company profile context
      const comp = competitorMap[page.competitor_id]
      const profile = comp?.org_id ? (profileByOrg[comp.org_id] ?? null) : null
      const typedActions = await generateTypedActions(
        profile,
        comp?.name ?? 'Competitor',
        diffSummary
      )

      const { data: change } = await supabase
        .from('changes')
        .insert({
          tracked_page_id: page.id,
          before_snapshot_id: prevSnap.id,
          after_snapshot_id: newSnap.id,
          diff_html: textDiff.diffHtml,
          ai_summary: ai.summary,
          ai_signal: ai.signal,
          confidence: ai.confidence,
          risk_score: ai.risk_score,
          theme: ai.theme,
          impact_bullets: ai.impact_bullets,
          suggested_actions: typedActions as unknown as import('@/lib/supabase/types').Json,
        })
        .select()
        .single()

      await supabase
        .from('competitors')
        .update({ risk_score: ai.risk_score })
        .eq('id', page.competitor_id)

      results.push({ page_id: page.id, url: page.url, tier, status: 'change_detected', change_id: change?.id })
    } catch (err) {
      results.push({ page_id: page.id, url: page.url, tier, status: `error: ${String(err)}` })
    }
  }

  // 5. Update risk_score_history for all affected competitors
  const competitorIds = Array.from(new Set(pages.map((p) => p.competitor_id)))
  for (const competitorId of competitorIds) {
    try {
      const { data: allDiffs } = await supabase
        .from('competitor_diffs')
        .select('change_type, detected_at')
        .eq('competitor_id', competitorId)

      if (allDiffs) {
        const scores = calculateRiskScores(allDiffs)
        await supabase
          .from('risk_score_history')
          .upsert({
            competitor_id: competitorId,
            scored_at: today,
            ...scores,
          }, { onConflict: 'competitor_id,scored_at' })

        if (scores.total > 0) {
          await supabase
            .from('competitors')
            .update({ risk_score: scores.total })
            .eq('id', competitorId)
        }
      }
    } catch {
      // non-fatal
    }
  }

  // ── Daily news + sitemap refresh for every competitor ──────────
  // Runs every day regardless of page crawl results
  const { data: allCompetitors } = await supabase
    .from('competitors')
    .select('id, name, website, org_id, product_names')

  const newsResults: Array<{ competitor: string; articles: number; new_pages: number }> = []

  for (const comp of allCompetitors ?? []) {
    try {
      const base = comp.website?.startsWith('http') ? comp.website.replace(/\/$/, '') : `https://${comp.website?.replace(/\/$/, '')}`

      // Parallel: news fetch + sitemap discovery
      const [newsItems, sitemapPages, homeCrawl] = await Promise.all([
        fetchCompetitorNews(comp.name, 1, (comp.product_names as string[] | null) ?? []), // last 24h only in cron
        discoverStrategicPages(base),
        crawlPage(base).catch(() => ({ text: '' })),
      ])

      // Refresh brand profile from homepage (fast — only updates if homepage changed)
      if (homeCrawl.text.length > 200) {
        const brand = await extractBrandProfile(comp.name, homeCrawl.text)
        await supabase.from('competitors').update({
          product_names: brand.search_terms,
          brand_metadata: brand as never,
        }).eq('id', comp.id)
      }

      // Auto-register any new strategic pages from sitemap
      const { data: existingPages } = await supabase
        .from('tracked_pages').select('url').eq('competitor_id', comp.id)
      const existingUrls = new Set(existingPages?.map(p => p.url) ?? [])
      let newPages = 0

      for (const page of sitemapPages) {
        if (!existingUrls.has(page.url)) {
          const { data: newPage } = await supabase
            .from('tracked_pages')
            .insert({ competitor_id: comp.id, url: page.url, label: page.label, auto_discovered: true })
            .select('id').single()
          if (newPage && page.priority >= 8) {
            await supabase.from('changes').insert({
              tracked_page_id: newPage.id,
              ai_summary: `${comp.name} has a new ${page.label} page at ${page.url} — auto-discovered via sitemap.`,
              ai_signal: `${comp.name} added new ${page.label} page — possible product or segment expansion`,
              confidence: 70, risk_score: 55, theme: 'GTM',
              impact_bullets: ['New page may signal product/segment expansion', `Review ${page.url}`, 'Added to tracking automatically'],
              detected_at: new Date().toISOString(),
            })
            newPages++
          }
        }
      }

      // Get home page for attaching news signals
      const { data: homePage } = await supabase
        .from('tracked_pages').select('id').eq('competitor_id', comp.id)
        .order('created_at', { ascending: true }).limit(1).maybeSingle()

      // Emit per-article news signals with correct pubDate
      let articlesSignalled = 0
      if (newsItems.length > 0 && homePage) {
        for (const article of newsItems.slice(0, 5)) {
          try {
            const prompt = `Competitor: ${comp.name}\nSource: ${article.source}\nPublished: ${article.pubDate}\nTitle: ${article.title}\n${article.snippet ? `Summary: ${article.snippet}` : ''}`
            const ai = await callClaudeJSON<NewsSignalResult>(NEWS_SIGNAL_PROMPT, prompt, 600)
            if (ai.confidence < 30 && ai.risk_score < 20) continue
            await supabase.from('changes').insert({
              tracked_page_id: homePage.id,
              ai_summary: ai.summary, ai_signal: ai.signal,
              confidence: ai.confidence, risk_score: ai.risk_score,
              theme: ai.theme, impact_bullets: ai.impact_bullets,
              detected_at: article.pubDateMs > 0 ? new Date(article.pubDateMs).toISOString() : new Date().toISOString(),
            })
            articlesSignalled++
          } catch { /* skip */ }
        }
      }

      newsResults.push({ competitor: comp.name, articles: articlesSignalled, new_pages: newPages })
      await sleep(1000) // rate limit between competitors
    } catch { /* non-fatal per competitor */ }
  }

  // Send daily digest if there were any detected changes
  let digest: { sent: boolean; count?: number; reason?: string } = { sent: false, reason: 'skipped' }
  const hasChanges = results.some((r) => r.status === 'change_detected')
  if (hasChanges) {
    try {
      digest = await sendDigest()
    } catch {
      digest = { sent: false, reason: 'digest_error' }
    }
  }

  // Generate weekly brief on Mondays (day 1)
  let brief: { sent: boolean; orgs?: number; reason?: string } = { sent: false, reason: 'not_monday' }
  if (new Date().getDay() === 1) {
    try {
      brief = await generateWeeklyBrief()
    } catch {
      brief = { sent: false, reason: 'brief_error' }
    }
  }

  return NextResponse.json({
    crawled: pages.length,
    skipped: allPages.length - pages.length,
    results,
    news: newsResults,
    digest,
    brief,
  })
}
