import { NextRequest, NextResponse } from 'next/server'
import { callClaudeJSON } from '@/lib/ai'
import { SUMMARIZE_SYSTEM } from '@/lib/prompts/summarize'

interface SummarizeBody {
  diff: string
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
    const { diff } = (await req.json()) as SummarizeBody
    if (!diff) return NextResponse.json({ error: 'diff is required' }, { status: 400 })

    const result = await callClaudeJSON<SummarizeResult>(SUMMARIZE_SYSTEM, diff)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
