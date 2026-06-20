import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { crawlPage } from '@/lib/crawler'
import { extractPageData } from '@/lib/extractor'
import { computeDiff } from '@/lib/diff'
import { callClaudeJSON } from '@/lib/ai'

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

const DEEP_SIGNAL_PROMPT = `You are a senior competitive intelligence analyst for a PMM (Product Marketing Manager).
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

interface WaybackSnapshot {
  url: string
  timestamp: string
  available: boolean
}

async function getWaybackSnapshot(url: string, daysAgo = 30): Promise<WaybackSnapshot> {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
  const ts = date.toISOString().replace(/[^0-9]/g, '').slice(0, 8) // YYYYMMDD
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

export async function POST(_req: NextRequest, { params }: { params: { competitorId: string } }) {
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServiceClient()

  // Verify competitor belongs to user's org
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

  // Existing tracked pages for this competitor
  const { data: existingPages } = await supabase
    .from('tracked_pages')
    .select('id, url, label')
    .eq('competitor_id', competitor.id)

  const existingUrls = new Set(existingPages?.map(p => p.url) ?? [])

  // ── Step 1: Discover pages ──────────────────────────────────
  const pagesToProcess: Array<{ id: string; url: string; label: string; isNew: boolean }> = []

  for (const pageType of PAGE_MATRIX) {
    // Check if we already track one of these paths
    const existing = existingPages?.find(p =>
      pageType.paths.some(path => p.url === `${base}${path}` || (path === '' && p.label?.toLowerCase() === 'home'))
    )

    if (existing) {
      pagesToProcess.push({ id: existing.id, url: existing.url, label: existing.label ?? pageType.label, isNew: false })
      continue
    }

    // Probe each candidate path
    for (const path of pageType.paths) {
      const candidateUrl = `${base}${path}`
      if (existingUrls.has(candidateUrl)) break

      const ok = await probeUrl(candidateUrl)
      if (ok) {
        // Add as new tracked page
        const { data: newPage } = await supabase
          .from('tracked_pages')
          .insert({ competitor_id: competitor.id, url: candidateUrl, label: pageType.label })
          .select('id')
          .single()

        if (newPage) {
          pagesToProcess.push({ id: newPage.id, url: candidateUrl, label: pageType.label, isNew: true })
          existingUrls.add(candidateUrl)
        }
        break
      }
    }
  }

  // ── Step 2: Process each page ───────────────────────────────
  const results: Array<{ url: string; label: string; status: string; signal?: string }> = []
  const now = new Date().toISOString()
  let highestRisk = 0

  for (const page of pagesToProcess.slice(0, 4)) { // cap at 4 pages to fit in 60s
    try {
      // Fetch Wayback snapshot (30 days ago) in parallel with current crawl
      const [wayback, current] = await Promise.all([
        getWaybackSnapshot(page.url, 30),
        crawlPage(page.url),
      ])

      let beforeText = ''
      if (wayback.available) {
        try {
          const archived = await crawlPage(wayback.url)
          beforeText = archived.text.slice(0, 4000)
        } catch { /* wayback fetch failed, proceed without */ }
      }

      const currentText = current.text.slice(0, 4000)
      const parsed = await extractPageData(page.url, current.text, current.html)

      // Store current snapshot
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

      // Build AI prompt — richer when we have historical comparison
      const hasHistory = beforeText.length > 100
      const diffText = hasHistory && beforeText !== currentText
        ? computeDiff(beforeText, currentText)
        : null

      const promptContent = hasHistory
        ? `Competitor: ${competitor.name}
Page: ${page.label} (${page.url})
Wayback Machine snapshot: 30 days ago

BEFORE (30 days ago):
${beforeText}

CURRENT:
${currentText}

${diffText?.hasChanges ? `KEY CHANGES:\nAdded: ${diffText.addedLines.slice(0, 15).join('\n')}\nRemoved: ${diffText.removedLines.slice(0, 15).join('\n')}` : 'Content is similar — extract key strategic positioning signals from the current state.'}`
        : `Competitor: ${competitor.name}
Page: ${page.label} (${page.url})

CURRENT CONTENT:
${currentText}`

      const ai = await callClaudeJSON<SignalResult>(DEEP_SIGNAL_PROMPT, promptContent, 900)

      // Store as change signal
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

  // Update competitor risk + summary
  if (highestRisk > 0) {
    await supabase.from('competitors')
      .update({ risk_score: highestRisk })
      .eq('id', competitor.id)
  }

  return NextResponse.json({
    competitor: competitor.name,
    pages_processed: results.length,
    pages_with_history: results.filter(r => r.status === 'diff_with_history').length,
    results,
  })
}
