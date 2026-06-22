import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { callClaudeJSON } from '@/lib/ai'
import { SIGNAL_IMPACT_SYSTEM } from '@/lib/prompts/signals'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServiceClient()

  const { data: signal } = await supabase
    .from('news_signals')
    .select('id, title, summary, competitors(name)')
    .eq('id', params.id)
    .single()

  if (!signal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const competitorName = (signal.competitors as unknown as { name: string } | null)?.name ?? 'Unknown'

  try {
    const ai = await callClaudeJSON<{ impact: string; counter: string }>(
      SIGNAL_IMPACT_SYSTEM,
      `Competitor: ${competitorName}\nHeadline: ${signal.title}\nSummary: ${signal.summary ?? ''}`,
      250
    )

    await supabase.from('news_signals')
      .update({ ai_impact: ai.impact, ai_counter: ai.counter })
      .eq('id', params.id)

    return NextResponse.json({ impact: ai.impact, counter: ai.counter })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
