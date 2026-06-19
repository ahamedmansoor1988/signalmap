import { NextRequest, NextResponse } from 'next/server'
import { generateWeeklyBrief } from '@/lib/weekly-brief'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await generateWeeklyBrief()
  return NextResponse.json(result)
}
