import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InboxClient from '@/components/inbox/inbox-client'

export const revalidate = 0

export type SignalRow = {
  id: string
  title: string
  summary: string | null
  url: string | null
  source_type: string
  published_at: string
  ai_impact: string | null
  ai_counter: string | null
  assigned_team: string | null
  assigned_email: string | null
  assigned_at: string | null
  added_to_mine: boolean | null
  competitor_id: string
  competitors: { name: string; website: string } | null
}

export default async function InboxPage() {
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await userSupabase
    .from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()
  if (!membership) redirect('/onboarding')

  // Use service client to bypass RLS on news_signals (no policy set yet)
  const supabase = await createServiceClient()

  const { data: signals } = await supabase
    .from('news_signals')
    .select('id, title, summary, url, source_type, published_at, ai_impact, ai_counter, assigned_team, assigned_email, assigned_at, added_to_mine, competitor_id, competitors(name, website)')
    .eq('org_id', membership.org_id)
    .order('published_at', { ascending: false })
    .limit(100)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedSignals = (signals ?? []) as unknown as SignalRow[]

  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name')
    .eq('org_id', membership.org_id)
    .order('name')

  return (
    <InboxClient
      signals={typedSignals}
      competitors={competitors ?? []}
    />
  )
}
