import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { crawlPage } from '@/lib/crawler'
import { extractPageData } from '@/lib/extractor'
import { computeDiff } from '@/lib/diff'
import { callClaudeJSON } from '@/lib/ai'
import { fetchCompetitorNews } from '@/lib/news'

export const runtime = 'nodejs'
export const maxDuration = 60

// ── Page types to discover and track ───────────────────────────
const PAGE_MATRIX = [
  { label: 'Home',      paths: [''] },
  { label: 'Pricing',   paths: ['/pricing', '/plans', '/price'] },
  { label: 'Blog',      paths: ['/blog', '/insights', '/resources'] },
  { label: 'Changelog', paths: ['/changelog', '/releases', '/updates', '/whats-new'] },
  { label: 'Newsroom',  paths: ['/newsroom', '/press', '/news', '/about/press'] },
]

const PAGE_SIGNAL_PROMPT = `You are a senior competitive intelligence analyst for a PMM (Product Marketing Manager).
Analyze this competitor intelligence and extract strategic signals.

When a "BEFORE" snapshot is provided, focus on what CHANGED and what it means competitively.
When only current data is provided, extract the most strategically important signals about their positioning.

Respond with JSON only:
{
  "summary": "2-3 sentence strategic summary. Focus on competitive implications, not just what changed.",
  "signal": "Sharp one-line headline a PMM would put in a Slack alert (e.g. 'HubSpot dropped enterprise pricing 20%, targeting mid-market')",
  "confidence": 0-100,
  "risk_score": 0-100,
  "theme": "AI Features | Pricing | Enterprise | GTM | Content",
  "impact_bullets": [
    "Competitive implication for our positioning",
    "Recommended response or action",
    "Market signal this reveals"
  ]
}`

const NEWS_SIGNAL_PROMPT = `You are a senior competitive intelligence analyst for a PMM (Product Marketing Manager).
Analyze these recent news articles about a competitor and extract the most important strategic signal.

Focus on: funding rounds, partnerships, product launches, executive moves, market expansions, pricing announcements, or analyst coverage.
Ignore: routine blog posts, republished content, generic industry news that doesn't specifically name the competitor.

Respond with JSON only:
{
  "summary": "2-3 sentence strategic summary of what this news means competitively.",
  "signal": "Sharp one-line PMM alert headline (e.g. 'Notion raised $100M Series C, accelerating enterprise push')",
  "confidence": 0-100,
  "risk_score": 0-100,
  "theme": "AI Features | Pricing | Enterprise | GTM | Content",
  "top_articles": ["Title of most important article 1", "Title of most important article 2"],
  "impact_bullets": [
    "What this means for our positioning",
    "Recommended response",
    "Market signal this reveals"
  ]
}`

interface WaybackSnapshot {
  url: string
  timestamp: string
  available: boolean
}

async function getWaybackSnapshot(url: string, daysAgo = 30): Promise<WaybackSnapshot> {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
  const ts = date.toISOString().replace(/[^0-9]/g, '').slice(0, 8)
  try {
    const res = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=${ts}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const data = await res.json() as {
      archived_snapshots?: { closest?: { url: string; timestamp: string; available: string } }
    }
    const closest = data.archived_snapshots?.closest
    if (!closest || closest.available !== 'true') return { url, timestamp: '', available: false }
    return { url: closest.url, timestamp: closest.timestamp, available: true }
  } catch {
    return { url, timestamp: '', available: false }
  }
}

async function probeUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SignalMap/1.0)' },
    })
    return res.ok
  } catch { return false }
}

interface SignalResult {
  summary: string
  signal: string
  confidence: number
  risk_score: number
  theme: string
  impact_bullets: string[]
}

interface NewsSignalResult extends SignalResult {
  top_articles: string[]
}

export async function POST(_req: NextRequest, { params }: { params: { competitorId: string } }) {
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServiceClient()

  const { data: membership } = await userSupabase
    .from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const { data: competitor } = await supabase
    .from('competitors')
    .select('id, name, website, org_id')
    .eq('id', params.competitorId)
    .eq('org_id', membership.org_id)
    .maybeSingle()

  if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const base = competitor.website.replace(/\/$/, '').startsWith('http')
    ? competitor.website.replace(/\/$/, '')
    : `https://${competitor.website.replace(/\/$/, '')}`

  const { data: existingPages } = await supabase
    .from('tracked_pages')
    .select('id, url, label')
    .eq('competitor_id', competitor.id)

  const existingUrls = new Set(existingPages?.map(p => p.url) ?? [])

  // ── Step 1: Discover pages + fetch Google News in parallel ──
  const pagesToProcess: Array<{ id: string; url: string; label: string }> = []

  const [, newsItems] = await Promise.all([
    // Page discovery (sequential probes)
    (async () => {
      for (const pageType of PAGE_MATRIX) {
        const existing = existingPages?.find(p =>
          pageType.paths.some(path => p.url === `${base}${path}` || (path === '' && p.label?.toLowerCase() === 'home'))
        )
        if (existing) {
          pagesToProcess.push({ id: existing.id, url: existing.url, label: existing.label ?? pageType.label })
          continue
        }
        for (const path of pageType.paths) {
          const candidateUrl = `${base}${path}`
          if (existingUrls.has(candidateUrl)) break
          const ok = await probeUrl(candidateUrl)
          if (ok) {
            const { data: newPage } = await supabase
              .from('tracked_pages')
              .insert({ competitor_id: competitor.id, url: candidateUrl, label: pageType.label })
              .select('id').single()
            if (newPage) {
              pagesToProcess.push({ id: newPage.id, url: candidateUrl, label: pageType.label })
              existingUrls.add(candidateUrl)
            }
            break
          }
        }
      }
    })(),
    // Google News RSS fetch (runs concurrently with page discovery)
    fetchCompetitorNews(competitor.name, 30),
  ])

  // ── Step 2: Process pages (cap at 3 to leave time for news) ──
  const results: Array<{ label: string; url?: string; status: string; signal?: string }> = []
  const now = new Date().toISOString()
  let highestRisk = 0

  // Get home page tracked_page_id for news signals (or first available)
  const homePage = existingPages?.find(p => p.label?.toLowerCase() === 'home') ?? existingPages?.[0] ?? null

  for (const page of pagesToProcess.slice(0, 3)) {
    try {
      const [wayback, current] = await Promise.all([
        getWaybackSnapshot(page.url, 30),
        crawlPage(page.url),
      ])

      let beforeText = ''
      if (wayback.available) {
        try {
          const archived = await crawlPage(wayback.url)
          beforeText = archived.text.slice(0, 4000)
        } catch { /* proceed without */ }
      }

      const currentText = current.text.slice(0, 4000)
      const parsed = await extractPageData(page.url, current.text, current.html)

      const { data: snap } = await supabase
        .from('page_snapshots')
        .insert({ tracked_page_id: page.id, text_content: current.text, html_content: current.html.slice(0, 50000), crawled_at: now })
        .select('id').single()

      await supabase.from('tracked_pages').update({ last_crawled_at: now }).eq('id', page.id)
      await supabase.from('competitor_snapshots').upsert({
        competitor_id: competitor.id,
        tracked_page_id: page.id,
        snapshot_date: now.split('T')[0],
        page_type: parsed.page_type,
        raw_text: currentText,
        parsed_data: parsed as never,
      }, { onConflict: 'tracked_page_id,snapshot_date' })

      const hasHistory = beforeText.length > 100
      const diffText = hasHistory && beforeText !== currentText ? computeDiff(beforeText, currentText) : null

      const promptContent = hasHistory
        ? `Competitor: ${competitor.name}\nPage: ${page.label} (${page.url})\nWayback snapshot: 30 days ago\n\nBEFORE:\n${beforeText}\n\nCURRENT:\n${currentText}\n\n${diffText?.hasChanges ? `KEY CHANGES:\nAdded: ${diffText.addedLines.slice(0, 15).join('\n')}\nRemoved: ${diffText.removedLines.slice(0, 15).join('\n')}` : 'Content similar — extract key positioning signals.'}`
        : `Competitor: ${competitor.name}\nPage: ${page.label} (${page.url})\n\nCURRENT CONTENT:\n${currentText}`

      const ai = await callClaudeJSON<SignalResult>(PAGE_SIGNAL_PROMPT, promptContent, 900)

      await supabase.from('changes').insert({
        tracked_page_id: page.id,
        before_snapshot_id: snap?.id ?? null,
        after_snapshot_id: snap?.id ?? null,
        diff_html: diffText?.diffHtml ?? null,
        ai_summary: ai.summary,
        ai_signal: ai.signal,
        confidence: ai.confidence,
        risk_score: ai.risk_score,
        theme: ai.theme,
        impact_bullets: ai.impact_bullets,
        detected_at: now,
      })

      if (ai.risk_score > highestRisk) highestRisk = ai.risk_score
      results.push({ url: page.url, label: page.label, status: wayback.available ? 'diff_with_history' : 'initial_scan', signal: ai.signal })
    } catch (err) {
      results.push({ url: page.url, label: page.label, status: `error: ${String(err).slice(0, 60)}` })
    }
  }

  // ── Step 3: Process Google News articles ───────────────────
  let newsSignal: string | undefined
  if (newsItems.length > 0 && homePage) {
    try {
      const articleList = newsItems
        .slice(0, 15)
        .map((a, i) => `${i + 1}. [${a.source}] ${a.title}${a.snippet ? ` — ${a.snippet}` : ''} (${a.pubDate})`)
        .join('\n')

      const newsPrompt = `Competitor: ${competitor.name}
Source: Google News RSS — last 30 days
Articles found: ${newsItems.length}

${articleList}`

      const ai = await callClaudeJSON<NewsSignalResult>(NEWS_SIGNAL_PROMPT, newsPrompt, 900)

      await supabase.from('changes').insert({
        tracked_page_id: homePage.id,
        before_snapshot_id: null,
        after_snapshot_id: null,
        diff_html: null,
        ai_summary: ai.summary,
        ai_signal: ai.signal,
        confidence: ai.confidence,
        risk_score: ai.risk_score,
        theme: ai.theme,
        impact_bullets: ai.impact_bullets,
        detected_at: now,
      })

      if (ai.risk_score > highestRisk) highestRisk = ai.risk_score
      newsSignal = ai.signal
      results.push({ label: 'News', status: `${newsItems.length} articles`, signal: ai.signal })
    } catch (err) {
      results.push({ label: 'News', status: `error: ${String(err).slice(0, 60)}` })
    }
  } else {
    results.push({ label: 'News', status: newsItems.length === 0 ? 'no_articles_found' : 'no_page_to_attach' })
  }

  if (highestRisk > 0) {
    await supabase.from('competitors').update({ risk_score: highestRisk }).eq('id', competitor.id)
  }

  return NextResponse.json({
    competitor: competitor.name,
    pages_processed: results.filter(r => r.label !== 'News').length,
    pages_with_history: results.filter(r => r.status === 'diff_with_history').length,
    news_articles_found: newsItems.length,
    news_signal: newsSignal,
    results,
  })
}
