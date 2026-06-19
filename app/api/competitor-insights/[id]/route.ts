import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { callClaudeJSON } from '@/lib/ai'
import { COMPETITOR_PROFILE_SYSTEM } from '@/lib/prompts/competitor-profile'
import type { Json } from '@/lib/supabase/types'

interface InsightsResult {
  summary: string
  suggested_actions: string[]
}

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServiceClient()

  const { data: competitor } = await supabase
    .from('competitors')
    .select('id, name, website, ai_summary, suggested_actions')
    .eq('id', params.id)
    .single()

  if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Return cached if already generated
  if (competitor.ai_summary) {
    return NextResponse.json({
      summary: competitor.ai_summary,
      suggested_actions: (competitor.suggested_actions as string[]) ?? [],
      cached: true,
    })
  }

  // Build context from baseline snapshots (homepage + pricing)
  const { data: snapshots } = await supabase
    .from('competitor_snapshots')
    .select('page_type, parsed_data')
    .eq('competitor_id', params.id)
    .order('created_at', { ascending: false })
    .limit(4)

  if (!snapshots?.length) {
    return NextResponse.json(
      { error: 'No snapshot data yet — trigger a cron run first' },
      { status: 422 }
    )
  }

  const context = snapshots
    .map((s) => {
      const parsed = s.parsed_data as { key_items?: string[]; summary?: string } | null
      const lines = parsed?.key_items?.join('\n') ?? parsed?.summary ?? 'No data'
      return `[${s.page_type.toUpperCase()} PAGE]\n${lines}`
    })
    .join('\n\n')

  const result = await callClaudeJSON<InsightsResult>(
    COMPETITOR_PROFILE_SYSTEM,
    `Competitor: ${competitor.name}\nWebsite: ${competitor.website}\n\n${context}`,
    512
  )

  await supabase
    .from('competitors')
    .update({
      ai_summary: result.summary,
      suggested_actions: result.suggested_actions as unknown as Json,
    })
    .eq('id', params.id)

  return NextResponse.json({ ...result, cached: false })
}
