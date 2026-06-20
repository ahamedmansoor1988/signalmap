import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { callClaudeJSON } from '@/lib/ai'
import { COMPETITOR_PROFILE_SYSTEM } from '@/lib/prompts/competitor-profile'
import { generateTypedActions } from '@/lib/personalized-actions'
import { normalizeActions } from '@/lib/typed-actions'
import type { Json } from '@/lib/supabase/types'

interface InsightsResult {
  summary: string
}

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServiceClient()

  const { data: competitor } = await supabase
    .from('competitors')
    .select('id, name, website, org_id, ai_summary, suggested_actions')
    .eq('id', params.id)
    .single()

  if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Return cached if already generated
  if (competitor.ai_summary) {
    return NextResponse.json({
      summary: competitor.ai_summary,
      suggested_actions: normalizeActions(competitor.suggested_actions as Json),
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

  let result: InsightsResult
  try {
    result = await callClaudeJSON<InsightsResult>(
      COMPETITOR_PROFILE_SYSTEM,
      `Competitor: ${competitor.name}\nWebsite: ${competitor.website}\n\n${context}`,
      512
    )
  } catch (err) {
    console.error('[competitor-insights] summary generation failed:', err)
    return NextResponse.json({ error: 'AI generation failed — try again shortly' }, { status: 503 })
  }

  // Fetch company profile for personalized actions
  const { data: profile } = await supabase
    .from('company_profiles')
    .select('*')
    .eq('org_id', competitor.org_id)
    .maybeSingle()

  let typedActions: Awaited<ReturnType<typeof generateTypedActions>> = []
  try {
    typedActions = await generateTypedActions(profile ?? null, competitor.name, context)
  } catch (err) {
    console.error('[competitor-insights] actions generation failed:', err)
    // Proceed without actions rather than failing the whole request
  }

  await supabase
    .from('competitors')
    .update({
      ai_summary: result.summary,
      suggested_actions: typedActions as unknown as Json,
    })
    .eq('id', params.id)

  return NextResponse.json({ summary: result.summary, suggested_actions: typedActions, cached: false })
}
