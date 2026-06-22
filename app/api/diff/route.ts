import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { computeDiff } from '@/lib/diff'
import { callClaudeJSON } from '@/lib/ai'
import { SUMMARIZE_SYSTEM } from '@/lib/prompts/summarize'

export const runtime = 'nodejs'
export const maxDuration = 60

interface DiffBody {
  before_snapshot_id: string
  after_snapshot_id: string
  tracked_page_id: string
}

interface SummarizeResult {
  summary: string
  signal: string
  confidence: number
  risk_score: number
  theme: string
  impact_bullets: string[]
  suggested_actions: string[]
}

export async function POST(req: NextRequest) {
  try {
    const { before_snapshot_id, after_snapshot_id, tracked_page_id } =
      (await req.json()) as DiffBody

    if (!before_snapshot_id || !after_snapshot_id || !tracked_page_id) {
      return NextResponse.json({ error: 'before_snapshot_id, after_snapshot_id, tracked_page_id required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const [{ data: before }, { data: after }] = await Promise.all([
      supabase.from('page_snapshots').select('text_content').eq('id', before_snapshot_id).single(),
      supabase.from('page_snapshots').select('text_content').eq('id', after_snapshot_id).single(),
    ])

    if (!before?.text_content || !after?.text_content) {
      return NextResponse.json({ error: 'Snapshots not found or empty' }, { status: 404 })
    }

    const diff = computeDiff(before.text_content, after.text_content)

    if (!diff.hasChanges) {
      return NextResponse.json({ message: 'No changes detected', change_id: null })
    }

    // Build diff summary for Claude
    const diffSummary = [
      `REMOVED (${diff.removedLines.length} lines):`,
      ...diff.removedLines.slice(0, 20).map((l) => `- ${l}`),
      '',
      `ADDED (${diff.addedLines.length} lines):`,
      ...diff.addedLines.slice(0, 20).map((l) => `+ ${l}`),
    ].join('\n')

    const aiResult = await callClaudeJSON<SummarizeResult>(SUMMARIZE_SYSTEM, diffSummary, 1024)

    // Fetch competitor name for context
    const { data: page } = await supabase
      .from('tracked_pages')
      .select('competitor_id, competitors(name)')
      .eq('id', tracked_page_id)
      .single()

    const { data: change, error: changeErr } = await supabase
      .from('changes')
      .insert({
        tracked_page_id,
        before_snapshot_id,
        after_snapshot_id,
        diff_html: diff.diffHtml,
        ai_summary: aiResult.summary,
        ai_signal: aiResult.signal,
        confidence: aiResult.confidence,
        risk_score: aiResult.risk_score,
        theme: aiResult.theme,
        impact_bullets: aiResult.impact_bullets,
        suggested_actions: aiResult.suggested_actions,
      })
      .select()
      .single()

    if (changeErr) throw changeErr

    // Update competitor risk score (rolling average)
    if (page?.competitor_id) {
      await supabase
        .from('competitors')
        .update({ risk_score: aiResult.risk_score })
        .eq('id', page.competitor_id)
    }

    return NextResponse.json({ change_id: change.id, ...aiResult })
  } catch (err) {
    console.error('[diff]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
