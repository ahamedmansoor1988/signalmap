import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

async function getOrgId(): Promise<{ orgId: string } | NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  return { orgId: membership.org_id }
}

export async function GET() {
  const result = await getOrgId()
  if (result instanceof NextResponse) return result
  const { orgId } = result

  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('company_profiles')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile })
}

export async function POST(req: NextRequest) {
  const result = await getOrgId()
  if (result instanceof NextResponse) return result
  const { orgId } = result

  const body = await req.json() as {
    company_name?: string
    description?: string
    icp?: string
    pricing_model?: string
    differentiators?: string
    website_url?: string
  }

  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('company_profiles')
    .upsert(
      {
        org_id: orgId,
        company_name: body.company_name ?? null,
        description: body.description ?? null,
        icp: body.icp ?? null,
        pricing_model: body.pricing_model ?? null,
        differentiators: body.differentiators ?? null,
        website_url: body.website_url ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile })
}
