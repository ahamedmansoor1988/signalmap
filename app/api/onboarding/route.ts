import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface OnboardingBody {
  companyName: string
  companyWebsite: string
  industry: string
  productDescription: string
  icp: string
  productStrength: string
  fullName: string
  role: string
  teamSize: string
  knownCompetitors: string[]
}

export async function POST(req: NextRequest) {
  const userSupabase = await createClient()

  let user = null
  try {
    const result = await userSupabase.auth.getUser()
    user = result.data?.user ?? null
  } catch { /* auth unavailable */ }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await userSupabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const body = await req.json() as OnboardingBody
  const supabase = createServiceClient()

  // Update org name
  await supabase
    .from('organizations')
    .update({ name: body.companyName || 'My Organization' })
    .eq('id', membership.org_id)

  // Upsert company profile (org_id has a unique constraint via isOneToOne FK)
  const { data: existingProfile } = await supabase
    .from('company_profiles')
    .select('id')
    .eq('org_id', membership.org_id)
    .maybeSingle()

  const profileData = {
    org_id: membership.org_id,
    company_name: body.companyName || null,
    description: body.productDescription || null,
    icp: body.icp || null,
    differentiators: body.productStrength || null,
    website_url: body.companyWebsite || null,
  }

  if (existingProfile?.id) {
    await supabase.from('company_profiles').update(profileData).eq('id', existingProfile.id)
  } else {
    await supabase.from('company_profiles').insert(profileData)
  }

  // Upsert member preferences (display_name)
  const { data: existingPrefs } = await supabase
    .from('member_preferences')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('org_id', membership.org_id)
    .maybeSingle()

  if (existingPrefs) {
    await supabase
      .from('member_preferences')
      .update({ display_name: body.fullName })
      .eq('user_id', user.id)
      .eq('org_id', membership.org_id)
  } else {
    await supabase.from('member_preferences').insert({
      user_id: user.id,
      org_id: membership.org_id,
      display_name: body.fullName,
    })
  }

  // Insert known competitors from step 2 (best-effort, skip duplicates)
  if (body.knownCompetitors.length > 0) {
    for (const name of body.knownCompetitors) {
      if (!name) continue
      const slug = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9.-]/g, '')
      const website = `https://www.${slug}.com`
      // Ignore errors (duplicate names, invalid websites)
      await supabase
        .from('competitors')
        .insert({ org_id: membership.org_id, name, website })
        .select()
        .maybeSingle()
    }
  }

  const res = NextResponse.json({ success: true })
  res.cookies.set('sm_onboarded', '1', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  return res
}
