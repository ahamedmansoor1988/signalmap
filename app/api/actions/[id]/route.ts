import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const STATUSES = ['open', 'in_progress', 'done', 'dismissed'] as const

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  const update: {
    status?: typeof STATUSES[number]
    assignee_user_id?: string | null
    due_date?: string | null
    updated_at: string
  } = { updated_at: new Date().toISOString() }

  if (STATUSES.includes(body.status as typeof STATUSES[number])) {
    update.status = body.status as typeof STATUSES[number]
  }
  if (typeof body.assignee_user_id === 'string' || body.assignee_user_id === null) {
    update.assignee_user_id = body.assignee_user_id as string | null
  }
  if (typeof body.due_date === 'string' || body.due_date === null) {
    update.due_date = body.due_date as string | null
  }

  const { data, error } = await supabase.from('action_tasks')
    .update(update).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ task: data })
}
