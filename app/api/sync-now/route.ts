import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { crawlPage } from '@/lib/crawler'
import { extractPageData } from '@/lib/extractor'
import { callClaudeJSON } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 60

const INITIAL_SIGNAL_PROMPT = `You are a competitive intelligence analyst. Analyze this competitor's current website content and extract key strategic signals.

Respond with JSON only:
{
  "summary": "2-3 sentence summary of this competitor's current positioning and what makes them notable",
  "signal": "one-line strategic signal headline (e.g. 'Launched enterprise tier targeting Fortune 500')",
  "confidence": 85,
  "risk_score": 0-100,
  "theme": "AI Features | Pricing | Enterprise | GTM | Content",
  "impact_bullets": ["competitive implication 1", "competitive implication 2", "competitive implication 3"]
}`

interface SignalResult {
  summary: string
  signal: string
  confidence: number
  risk_score: number
  theme: string
  impact_bullets: string[]
}

export async function POST() {
  try {
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: membership } = await userSupabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) return NextResponse.json({ error: 'No org found' }, { status: 404 })

    // Use service client for writes
    const supabase = await createServiceClient()

    // Get all tracked pages for this org (home pages only for speed)
    const { data: competitors } = await supabase
      .from('competitors')
      .select('id, name')
      .eq('org_id', membership.org_id)

    if (!competitors?.length) return NextResponse.json({ synced: 0 })

    const competitorIds = competitors.map(c => c.id)
    const { data: allPages } = await supabase
      .from('tracked_pages')
      .select('id, url, label, competitor_id')
      .in('competitor_id', competitorIds)
      .or('label.ilike.home,label.is.null')
      .limit(15)

    if (!allPages?.length) return NextResponse.json({ synced: 0 })

    const competitorMap = Object.fromEntries(competitors.map(c => [c.id, c.name]))
    const results: Array<{ name: string; url: string; status: string }> = []
    const now = new Date().toISOString()

    for (const page of allPages) {
      const name = competitorMap[page.competitor_id] ?? 'Unknown'
      try {
        // Crawl the page
        const crawled = await crawlPage(page.url)
        const content = crawled.text.slice(0, 6000) // limit to avoid token overrun

        // Extract structured data
        const parsed = await extractPageData(page.url, crawled.text, crawled.html)

        // Store snapshot
        const { data: snap } = await supabase
          .from('page_snapshots')
          .insert({
            tracked_page_id: page.id,
            text_content: crawled.text,
            html_content: crawled.html.slice(0, 50000),
            crawled_at: now,
          })
          .select('id')
          .single()

        await supabase
          .from('tracked_pages')
          .update({ last_crawled_at: now })
          .eq('id', page.id)

        await supabase
          .from('competitor_snapshots')
          .upsert({
            competitor_id: page.competitor_id,
            tracked_page_id: page.id,
            snapshot_date: now.split('T')[0],
            page_type: parsed.page_type,
            raw_text: content,
            parsed_data: parsed as never,
          }, { onConflict: 'tracked_page_id,snapshot_date' })

        // Generate initial AI signal from current content (no diff required)
        const ai = await callClaudeJSON<SignalResult>(
          INITIAL_SIGNAL_PROMPT,
          `Competitor: ${name}\nURL: ${page.url}\n\nCurrent website content:\n${content}`,
          800
        )

        // Store as a change record
        await supabase.from('changes').insert({
          tracked_page_id: page.id,
          before_snapshot_id: snap?.id ?? null,
          after_snapshot_id: snap?.id ?? null,
          diff_html: null,
          ai_summary: ai.summary,
          ai_signal: ai.signal,
          confidence: ai.confidence,
          risk_score: ai.risk_score,
          theme: ai.theme,
          impact_bullets: ai.impact_bullets,
          detected_at: now,
        })

        await supabase
          .from('competitors')
          .update({ risk_score: ai.risk_score, ai_summary: ai.summary })
          .eq('id', page.competitor_id)

        results.push({ name, url: page.url, status: 'ok' })
      } catch (err) {
        results.push({ name, url: page.url, status: `error: ${String(err).slice(0, 80)}` })
      }
    }

    return NextResponse.json({ synced: results.filter(r => r.status === 'ok').length, results })
  } catch (err) {
    console.error('[sync-now]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
