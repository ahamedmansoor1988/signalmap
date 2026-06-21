import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ACTION_TYPES = ['sales', 'marketing', 'product', 'general'] as const

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ tasks: [], open_count: 0 })

  let query = supabase.from('action_tasks').select('*')
    .eq('org_id', membership.org_id).order('created_at', { ascending: false })
  if (req.nextUrl.searchParams.get('mine') === 'true') query = query.eq('assignee_user_id', user.id)

  const [{ data: tasks, error }, { data: people }] = await Promise.all([
    query,
    supabase.from('member_preferences').select('user_id, display_name, role_view')
      .eq('org_id', membership.org_id),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const openCount = (tasks ?? []).filter(t =>
    t.assignee_user_id === user.id && (t.status === 'open' || t.status === 'in_progress')
  ).length
  return NextResponse.json({ tasks: tasks ?? [], people: people ?? [], user_id: user.id, open_count: openCount })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 404 })

  const body = await req.json() as Record<string, unknown>
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 500) : ''
  if (!title) return NextResponse.json({ error: 'Action title is required' }, { status: 400 })
  const actionType = ACTION_TYPES.includes(body.action_type as typeof ACTION_TYPES[number])
    ? body.action_type as typeof ACTION_TYPES[number] : 'general'

  const { data, error } = await supabase.from('action_tasks').insert({
    org_id: membership.org_id,
    change_id: typeof body.change_id === 'string' ? body.change_id : null,
    action_index: Number.isInteger(body.action_index) ? Number(body.action_index) : 0,
    action_type: actionType,
    title,
    assignee_user_id: typeof body.assignee_user_id === 'string' ? body.assignee_user_id : user.id,
    created_by: user.id,
    due_date: typeof body.due_date === 'string' ? body.due_date : null,
  }).select().single()

  if (error?.code === '23505') return NextResponse.json({ error: 'This action is already in the team queue' }, { status: 409 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data }, { status: 201 })
}
