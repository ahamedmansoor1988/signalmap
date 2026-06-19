import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'

export async function sendDigest(): Promise<{ sent: boolean; count?: number; reason?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, reason: 'RESEND_API_KEY not configured' }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const supabase = await createServiceClient()

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: changes } = await supabase
    .from('changes')
    .select(`
      id, ai_signal, ai_summary, risk_score, theme, detected_at,
      tracked_pages(url, label, competitors!inner(name))
    `)
    .gte('detected_at', since)
    .is('seen_at', null)
    .order('risk_score', { ascending: false })
    .limit(20)

  if (!changes?.length) return { sent: false, reason: 'no_unseen_changes' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://signalmap-sigma.vercel.app'

  const cardsHtml = changes
    .map((c) => {
      const tp = c.tracked_pages as { url: string; label: string | null; competitors: { name: string } } | null
      const competitor = tp?.competitors?.name ?? 'Unknown'
      const label = tp?.label ?? ''
      const risk = c.risk_score ?? 0
      const riskColor = risk >= 75 ? '#dc2626' : risk >= 50 ? '#d97706' : '#059669'
      const riskLabel = risk >= 75 ? 'High' : risk >= 50 ? 'Medium' : 'Low'

      return `
        <a href="${appUrl}/changes/${c.id}" style="display:block;text-decoration:none;color:inherit;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px;background:#fff;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <strong style="font-size:14px;color:#111827;">${competitor}</strong>
            ${c.theme ? `<span style="font-size:11px;background:#f3f4f6;color:#374151;padding:2px 8px;border-radius:99px;">${c.theme}</span>` : ''}
            <span style="font-size:11px;color:${riskColor};font-weight:600;">${riskLabel} risk · ${risk}</span>
          </div>
          ${c.ai_signal ? `<p style="margin:0 0 6px;font-size:14px;font-weight:500;color:#1f2937;">${c.ai_signal}</p>` : ''}
          ${c.ai_summary ? `<p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">${c.ai_summary.slice(0, 220)}…</p>` : ''}
          ${label ? `<p style="margin:8px 0 0;font-size:11px;color:#9ca3af;">${label}</p>` : ''}
        </a>
      `
    })
    .join('')

  const plural = changes.length !== 1
  const subject = `${changes.length} competitor move${plural ? 's' : ''} detected overnight`

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px 20px;background:#f9fafb;">
      <div style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
          <span style="font-size:18px;font-weight:700;color:#111827;">SignalMap</span>
          <span style="font-size:11px;background:#ede9fe;color:#6d28d9;padding:2px 8px;border-radius:99px;font-weight:500;">Daily Digest</span>
        </div>
        <p style="margin:0;font-size:13px;color:#6b7280;">${changes.length} unseen competitor move${plural ? 's' : ''} from the last 24 hours</p>
      </div>
      ${cardsHtml}
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;">
        <a href="${appUrl}/changes" style="display:inline-block;font-size:13px;color:#6366f1;text-decoration:none;font-weight:500;">View all changes in SignalMap →</a>
      </div>
    </body>
    </html>
  `

  const to = process.env.DIGEST_EMAIL ?? 'ahamedmansoor1988@gmail.com'

  const { error } = await resend.emails.send({
    from: 'SignalMap <onboarding@resend.dev>',
    to,
    subject,
    html,
  })

  if (error) throw new Error(String(error))

  return { sent: true, count: changes.length }
}
