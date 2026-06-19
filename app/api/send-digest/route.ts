import { NextRequest, NextResponse } from 'next/server'
import { sendDigest } from '@/lib/digest'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sendDigest()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ sent: false, error: String(err) }, { status: 500 })
  }
}
