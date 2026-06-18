import { NextRequest, NextResponse } from 'next/server'
import { callClaudeJSON } from '@/lib/ai'
import { SUGGEST_COMPETITORS_SYSTEM } from '@/lib/prompts/suggest-competitors'

export interface CompetitorSuggestion {
  name: string
  website: string
  theme: 'AI Features' | 'Pricing' | 'Enterprise' | 'GTM' | 'Content'
  reason: string
}

export async function POST(req: NextRequest) {
  const { description } = await req.json() as { description: string }

  if (!description?.trim()) {
    return NextResponse.json({ error: 'Description required' }, { status: 400 })
  }

  const suggestions = await callClaudeJSON<CompetitorSuggestion[]>(
    SUGGEST_COMPETITORS_SYSTEM,
    `We make: ${description.trim()}\n\nSuggest 12 competitors to monitor.`
  )

  return NextResponse.json({ suggestions })
}
