import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { crawlPage } from '@/lib/crawler'
import { computeDiff } from '@/lib/diff'
import { callClaudeJSON } from '@/lib/ai'
import { SUMMARIZE_SYSTEM } from '@/lib/prompts/summarize'

export const runtime = 'nodejs'
export const maxDuration = 300

interface SummarizeResult {
  summary: string
  signal: string
  confidence: number
  risk_score: number
  theme: string
  impact_bullets: string[]
  suggested_actions: string[]
}

// Vercel Cron: runs every 24h
// vercel.json: { "crons": [{ "path": "/api/cron", "schedule": "0 8 * * *" }] }
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const results: Array<{ page_id: string; url: string; status: string; change_id?: string }> = []

  const { data: pages } = await supabase
    .from('tracked_pages')
    .select('id, url, competitor_id')
    .order('last_crawled_at', { ascending: true, nullsFirst: true })
    .limit(20) // Process 20 pages per cron run

  if (!pages?.length) {
    return NextResponse.json({ message: 'No pages to crawl', results })
  }

  for (const page of pages) {
    try {
      const crawled = await crawlPage(page.url)

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
        results.push({ page_id: page.id, url: page.url, status: 'snapshot_failed' })
        continue
      }

      await supabase
        .from('tracked_pages')
        .update({ last_crawled_at: crawled.crawledAt })
        .eq('id', page.id)

      // Get previous snapshot
      const { data: prevSnap } = await supabase
        .from('page_snapshots')
        .select('id, text_content')
        .eq('tracked_page_id', page.id)
        .neq('id', newSnap.id)
        .order('crawled_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!prevSnap?.text_content) {
        results.push({ page_id: page.id, url: page.url, status: 'first_snapshot' })
        continue
      }

      const diff = computeDiff(prevSnap.text_content, crawled.text)
      if (!diff.hasChanges) {
        results.push({ page_id: page.id, url: page.url, status: 'no_changes' })
        continue
      }

      const diffSummary = [
        `REMOVED:\n${diff.removedLines.slice(0, 20).map((l) => `- ${l}`).join('\n')}`,
        `ADDED:\n${diff.addedLines.slice(0, 20).map((l) => `+ ${l}`).join('\n')}`,
      ].join('\n\n')

      const ai = await callClaudeJSON<SummarizeResult>(SUMMARIZE_SYSTEM, diffSummary, 1024)

      const { data: change } = await supabase
        .from('changes')
        .insert({
          tracked_page_id: page.id,
          before_snapshot_id: prevSnap.id,
          after_snapshot_id: newSnap.id,
          diff_html: diff.diffHtml,
          ai_summary: ai.summary,
          ai_signal: ai.signal,
          confidence: ai.confidence,
          risk_score: ai.risk_score,
          theme: ai.theme,
          impact_bullets: ai.impact_bullets,
          suggested_actions: ai.suggested_actions,
        })
        .select()
        .single()

      await supabase
        .from('competitors')
        .update({ risk_score: ai.risk_score })
        .eq('id', page.competitor_id)

      results.push({ page_id: page.id, url: page.url, status: 'change_detected', change_id: change?.id })
    } catch (err) {
      results.push({ page_id: page.id, url: page.url, status: `error: ${String(err)}` })
    }
  }

  return NextResponse.json({ crawled: pages.length, results })
}
