import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { crawlPage } from '@/lib/crawler'
import { computeDiff } from '@/lib/diff'
import { callClaudeJSON } from '@/lib/ai'
import { fetchCompetitorNews } from '@/lib/news'
import { extractBrandProfile } from '@/lib/brand-extractor'
import { discoverStrategicPages } from '@/lib/sitemap'
import { extractStructured, diffStructured } from '@/lib/structured-extractor'
import { parseRSSFeed, isFeedUrl } from '@/lib/rss-parser'
import type { PageStructure } from '@/lib/structured-extractor'

export const runtime = 'nodejs'
export const maxDuration = 60

const NEWS_SIGNAL_PROMPT = `You are a senior competitive intelligence analyst for a PMM.
Analyze this news article about a competitor and extract the strategic signal.

Focus on: acquisitions, funding, partnerships, product launches, executive moves, market expansion, pricing changes.
Ignore: generic industry think-pieces that barely mention the competitor.

Respond with JSON only:
{
  "summary": "2-3 sentence strategic summary of what this means competitively.",
  "signal": "Sharp one-line PMM alert (e.g. 'Salesforce acquires Fin AI from Intercom — major consolidation in AI customer service')",
  "confidence": 0-100,
  "risk_score": 0-100,
  "theme": "AI Features | Pricing | Enterprise | GTM | Content",
  "impact_bullets": [
    "What this means for our positioning",
    "Recommended response",
    "Market signal this reveals"
  ]
}`

const RSS_SIGNAL_PROMPT = `You are a senior competitive intelligence analyst for a PMM.
Analyze this blog post or changelog entry from a competitor and extract the strategic signal.
Focus on: new features, product changes, pricing updates, positioning shifts, partnerships, hiring signals.
Respond with JSON: { "summary": "...", "signal": "...", "confidence": 0-100, "risk_score": 0-100, "theme": "AI Features|Pricing|Enterprise|GTM|Content", "impact_bullets": ["..."] }`

interface NewsSignalResult {
  summary: string; signal: string; confidence: number; risk_score: number
  theme: string; impact_bullets: string[]
}

async function getWaybackSnapshot(url: string, daysAgo = 30): Promise<{ url: string; available: boolean }> {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
  const ts = date.toISOString().replace(/[^0-9]/g, '').slice(0, 8)
  try {
    const res = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=${ts}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const data = await res.json() as {
      archived_snapshots?: { closest?: { url: string; available: string } }
    }
    const closest = data.archived_snapshots?.closest
    if (!closest || closest.available !== 'true') return { url, available: false }
    return { url: closest.url, available: true }
  } catch {
    return { url, available: false }
  }
}


export async function POST(_req: NextRequest, { params }: { params: { competitorId: string } }) {
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: membership } = await userSupabase
    .from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const { data: competitor } = await supabase
    .from('competitors')
    .select('id, name, website, org_id, product_names, brand_metadata')
    .eq('id', params.competitorId)
    .eq('org_id', membership.org_id)
    .maybeSingle()

  if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const base = competitor.website.replace(/\/$/, '').startsWith('http')
    ? competitor.website.replace(/\/$/, '')
    : `https://${competitor.website.replace(/\/$/, '')}`

  const now = new Date().toISOString()
  const results: Array<{ label: string; url?: string; status: string; signal?: string }> = []
  let highestRisk = 0

  // ── Step 1: Brand intelligence + sitemap discovery + news (parallel) ──
  const { data: existingPages } = await supabase
    .from('tracked_pages').select('id, url, label').eq('competitor_id', competitor.id)

  const existingUrls = new Set(existingPages?.map(p => p.url) ?? [])

  const [homeCrawl, sitemapPages, newsItems] = await Promise.all([
    // Crawl homepage for brand extraction
    crawlPage(base).catch(() => ({ text: '', html: '' })),
    // Discover strategic pages from sitemap
    discoverStrategicPages(base),
    // Fetch news using any known product names
    fetchCompetitorNews(
      competitor.name,
      30,
      (competitor.product_names as string[] | null) ?? []
    ),
  ])

  // ── Step 2: Extract + save brand profile ──
  if (homeCrawl.text.length > 200) {
    const brand = await extractBrandProfile(competitor.name, homeCrawl.text)
    await supabase.from('competitors').update({
      product_names: brand.search_terms,
      brand_metadata: brand as never,
    }).eq('id', competitor.id)
    results.push({ label: 'Brand', status: `${brand.search_terms.length} search terms extracted`, signal: brand.positioning })
  }

  // ── Step 3: Auto-register new strategic pages from sitemap ──
  let newPagesAdded = 0
  for (const page of sitemapPages) {
    if (!existingUrls.has(page.url)) {
      const { data: newPage } = await supabase
        .from('tracked_pages')
        .insert({ competitor_id: competitor.id, url: page.url, label: page.label, auto_discovered: true })
        .select('id').single()
      if (newPage) {
        existingUrls.add(page.url)
        newPagesAdded++
        // Emit a signal for brand-new strategically important pages
        if (page.priority >= 8) {
          await supabase.from('changes').insert({
            tracked_page_id: newPage.id,
            ai_summary: `${competitor.name} has a new ${page.label} page at ${page.url}. This was auto-discovered via sitemap and may represent a new product, segment, or offering.`,
            ai_signal: `${competitor.name} added new ${page.label} page — possible product expansion or repositioning`,
            confidence: 70,
            risk_score: 55,
            theme: 'GTM',
            impact_bullets: [
              `New page may signal a product/segment expansion`,
              `Review ${page.url} for positioning changes`,
              `Add to tracked pages for ongoing monitoring`,
            ],
            detected_at: now,
          })
        }
      }
    }
  }
  if (newPagesAdded > 0) results.push({ label: 'Sitemap', status: `${newPagesAdded} new pages discovered` })

  // ── Step 4: Deep crawl + structured diff on tracked pages ──
  const { data: currentPages } = await supabase
    .from('tracked_pages').select('id, url, label').eq('competitor_id', competitor.id)

  const homePage = currentPages?.find(p => p.label?.toLowerCase() === 'home') ?? currentPages?.[0] ?? null
  const pagesToProcess = (currentPages ?? []).slice(0, 5)

  for (const page of pagesToProcess) {
    try {
      const [wayback, current] = await Promise.all([
        getWaybackSnapshot(page.url, 30),
        crawlPage(page.url),
      ])

      const currentText = current.text.slice(0, 5000)

      // Save snapshot
      const { data: snap } = await supabase
        .from('page_snapshots')
        .insert({ tracked_page_id: page.id, text_content: current.text, html_content: current.html.slice(0, 50000), crawled_at: now })
        .select('id').single()

      await supabase.from('tracked_pages').update({ last_crawled_at: now }).eq('id', page.id)

      // Structured extraction of current page
      const currentStructured = await extractStructured(page.label ?? 'home', currentText)

      let signal: string | undefined
      let riskScore = 0

      if (wayback.available) {
        // Get archived version and extract its structure too
        let beforeStructured: PageStructure | string | null = null
        try {
          const archived = await crawlPage(wayback.url)
          beforeStructured = await extractStructured(page.label ?? 'home', archived.text.slice(0, 5000))
          if (!beforeStructured) beforeStructured = archived.text.slice(0, 3000)
        } catch { /* proceed without */ }

        if (beforeStructured && currentStructured) {
          // Structured diff — catches "1 plan → 2 plans" type changes
          const diff = await diffStructured(page.label ?? 'page', beforeStructured, currentStructured)
          if (diff && diff.confidence >= 30) {
            await supabase.from('changes').insert({
              tracked_page_id: page.id,
              before_snapshot_id: snap?.id ?? null,
              after_snapshot_id: snap?.id ?? null,
              diff_html: JSON.stringify(diff.structural_changes),
              ai_summary: diff.summary,
              ai_signal: diff.signal,
              confidence: diff.confidence,
              risk_score: diff.risk_score,
              theme: diff.theme,
              impact_bullets: diff.impact_bullets,
              detected_at: now,
            })
            riskScore = diff.risk_score
            signal = diff.signal
            results.push({ url: page.url, label: page.label ?? '', status: 'structured_diff', signal })
          } else {
            results.push({ url: page.url, label: page.label ?? '', status: 'no_significant_change' })
          }
        }
      } else {
        // First scan — just extract structure and report positioning
        if (currentStructured) {
          const textDiff = computeDiff('', currentText)
          await supabase.from('changes').insert({
            tracked_page_id: page.id,
            before_snapshot_id: null,
            after_snapshot_id: snap?.id ?? null,
            diff_html: null,
            ai_summary: `Initial scan of ${competitor.name}'s ${page.label} page. ${JSON.stringify(currentStructured).slice(0, 200)}`,
            ai_signal: `${competitor.name} ${page.label} page scanned — baseline established`,
            confidence: 80,
            risk_score: 30,
            theme: 'GTM',
            impact_bullets: [`Baseline captured for ${page.label}`, 'Changes will be detected on next sync'],
            detected_at: now,
          })
          void textDiff
          results.push({ url: page.url, label: page.label ?? '', status: 'initial_scan' })
        }
      }

      if (riskScore > highestRisk) highestRisk = riskScore

      // Store structured data for future diffs
      await supabase.from('competitor_snapshots').upsert({
        competitor_id: competitor.id,
        tracked_page_id: page.id,
        snapshot_date: now.split('T')[0],
        page_type: page.label ?? 'unknown',
        raw_text: currentText,
        parsed_data: (currentStructured ?? {}) as never,
      }, { onConflict: 'tracked_page_id,snapshot_date' })

    } catch (err) {
      results.push({ url: page.url, label: page.label ?? '', status: `error: ${String(err).slice(0, 60)}` })
    }
  }

  // ── Step 4b: RSS/Atom feed parsing for feed-type tracked pages ──
  const feedPages = (currentPages ?? []).filter(p => isFeedUrl(p.url))
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  let rssInserted = 0

  for (const feedPage of feedPages) {
    try {
      const items = await parseRSSFeed(feedPage.url)
      const recentItems = items.filter(item => new Date(item.pubDate) >= sevenDaysAgo)

      for (const item of recentItems) {
        const { data: existing } = await supabase
          .from('changes')
          .select('id')
          .eq('tracked_page_id', feedPage.id)
          .eq('diff_html', item.link)
          .maybeSingle()
        if (existing) continue

        const prompt = `Competitor: ${competitor.name}\nSource: ${feedPage.label ?? 'Blog'}\nPublished: ${item.pubDate}\nTitle: ${item.title}\n${item.summary ? `Summary: ${item.summary}` : ''}`
        const ai = await callClaudeJSON<NewsSignalResult>(RSS_SIGNAL_PROMPT, prompt, 600)
        if (ai.confidence < 20) continue

        await supabase.from('changes').insert({
          tracked_page_id: feedPage.id,
          diff_html: item.link,
          ai_summary: ai.summary,
          ai_signal: ai.signal,
          confidence: ai.confidence,
          risk_score: ai.risk_score,
          theme: ai.theme,
          impact_bullets: ai.impact_bullets,
          detected_at: item.pubDate,
        })
        if (ai.risk_score > highestRisk) highestRisk = ai.risk_score
        rssInserted++
      }
    } catch { /* non-fatal per feed */ }
  }
  if (feedPages.length > 0) {
    results.push({ label: 'RSS', status: `${rssInserted} signals from ${feedPages.length} feed${feedPages.length !== 1 ? 's' : ''}` })
  }

  // ── Step 5: Per-article news signals with correct dates ──
  const topArticles = newsItems.slice(0, 8)
  let newsProcessed = 0
  let newsSignal: string | undefined

  if (topArticles.length > 0 && homePage) {
    for (const article of topArticles) {
      try {
        const prompt = `Competitor: ${competitor.name}
Source: ${article.source}
Published: ${article.pubDate}
Title: ${article.title}
${article.snippet ? `Summary: ${article.snippet}` : ''}`

        const ai = await callClaudeJSON<NewsSignalResult>(NEWS_SIGNAL_PROMPT, prompt, 600)
        if (ai.confidence < 30 && ai.risk_score < 20) continue

        const articleDate = article.pubDateMs > 0 ? new Date(article.pubDateMs).toISOString() : now

        await supabase.from('changes').insert({
          tracked_page_id: homePage.id,
          ai_summary: ai.summary,
          ai_signal: ai.signal,
          confidence: ai.confidence,
          risk_score: ai.risk_score,
          theme: ai.theme,
          impact_bullets: ai.impact_bullets,
          detected_at: articleDate,
        })

        if (ai.risk_score > highestRisk) highestRisk = ai.risk_score
        if (!newsSignal) newsSignal = ai.signal
        newsProcessed++
      } catch { /* skip bad article */ }
    }
    results.push({ label: 'News', status: `${newsProcessed}/${topArticles.length} articles signalled`, signal: newsSignal })
  } else {
    results.push({ label: 'News', status: newsItems.length === 0 ? 'no_articles_found' : 'no_page_to_attach' })
  }

  if (highestRisk > 0) {
    await supabase.from('competitors').update({ risk_score: highestRisk }).eq('id', competitor.id)
  }

  return NextResponse.json({
    competitor: competitor.name,
    pages_processed: pagesToProcess.length,
    new_pages_discovered: newPagesAdded,
    news_articles_found: newsItems.length,
    news_signal: newsSignal,
    results,
  })
}
