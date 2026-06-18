import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Crawler not implemented yet — Sprint 2' }, { status: 501 })
}
