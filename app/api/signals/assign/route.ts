import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { signal_id: string; team: string; email: string }
  const { signal_id, team, email } = body
  if (!signal_id || !team || !email) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  const { data: signal, error: fetchErr } = await supabase
    .from('news_signals')
    .select('id, title, ai_impact, ai_counter, org_id, competitors(name)')
    .eq('id', signal_id)
    .single()

  if (fetchErr || !signal) {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
  }

  const { error: updateErr } = await supabase
    .from('news_signals')
    .update({ assigned_team: team, assigned_email: email, assigned_at: new Date().toISOString() })
    .eq('id', signal_id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  const competitorName = (signal.competitors as unknown as { name: string } | null)?.name ?? 'Unknown'

  try {
    await resend.emails.send({
      from: 'SignalMap <onboarding@resend.dev>',
      to: email,
      subject: `[${team}] Competitor signal: ${competitorName}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="font-size:18px;font-weight:700;color:#111;margin:0 0 4px">Competitor Signal</h2>
          <p style="font-size:13px;color:#6b7280;margin:0 0 20px">Assigned to <strong>${team}</strong> team</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px">
            <p style="font-size:13px;font-weight:600;color:#111;margin:0 0 4px">${competitorName}</p>
            <p style="font-size:14px;color:#374151;margin:0">${signal.title}</p>
          </div>
          ${signal.ai_impact ? `
          <div style="margin-bottom:12px">
            <p style="font-size:12px;font-weight:600;color:#7c3aed;margin:0 0 4px;text-transform:uppercase;letter-spacing:.05em">Impact</p>
            <p style="font-size:13px;color:#374151;margin:0">${signal.ai_impact}</p>
          </div>
          ` : ''}
          ${signal.ai_counter ? `
          <div style="margin-bottom:20px">
            <p style="font-size:12px;font-weight:600;color:#059669;margin:0 0 4px;text-transform:uppercase;letter-spacing:.05em">Recommended Action</p>
            <p style="font-size:13px;color:#374151;margin:0">${signal.ai_counter}</p>
          </div>
          ` : ''}
          <p style="font-size:11px;color:#9ca3af;margin:0">Sent via SignalMap · Competitive Intelligence</p>
        </div>
      `,
    })
  } catch { /* email failure is non-fatal */ }

  return NextResponse.json({ ok: true })
}
