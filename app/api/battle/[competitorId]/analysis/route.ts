import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaudeJSON } from '@/lib/ai'
import { BATTLE_SYSTEM } from '@/lib/prompts/battle'

export const runtime = 'nodejs'

const EMPTY: BattleAnalysis = { feature_gaps: [], battle_actions: [] }

interface BattleAnalysis {
  feature_gaps: Array<{ feature: string; us: boolean; them: boolean }>
  battle_actions: Array<{ type: string; action: string }>
}

interface RequestBody {
  profile: {
    company_name: string
    icp: string
    differentiators: string
    description: string
  }
  homepage: {
    hero_headline: string
    target_customer: string
    key_themes: string[]
    summary: string
  }
  recent_changes: string[]
}

export async function POST(
  req: NextRequest,
  { params }: { params: { competitorId: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json(EMPTY, { status: 401 })

    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json(EMPTY, { status: 403 })

    const { data: competitor } = await supabase
      .from('competitors')
      .select('id, name')
      .eq('id', params.competitorId)
      .eq('org_id', membership.org_id)
      .maybeSingle()
    if (!competitor) return NextResponse.json(EMPTY, { status: 404 })

    const body = (await req.json()) as RequestBody

    const analysis = await callClaudeJSON<BattleAnalysis>(
      BATTLE_SYSTEM,
      JSON.stringify({
        our_company: body.profile,
        competitor: { name: competitor.name, ...body.homepage },
        recent_changes: body.recent_changes,
      }),
      1400
    )

    return NextResponse.json(analysis)
  } catch (err) {
    console.error('[battle/analysis]', err)
    return NextResponse.json(EMPTY)
  }
}
