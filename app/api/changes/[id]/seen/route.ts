import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('changes')
    .update({ seen_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
