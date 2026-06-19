import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://signalmap-sigma.vercel.app'

interface DigestResult {
  sent: boolean
  orgs?: number
  changes?: number
  reason?: string
}

interface CompetitorGroup {
  competitorName: string
  diffs: Array<{ id: string; competitor_id: string; change_type: string; summary: string | null; detected_at: string }>
}

export async function sendDigest(): Promise<DigestResult> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, reason: 'RESEND_API_KEY not configured' }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const supabase = await createServiceClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // 1. Fetch competitor_diffs from the last 24 hours
  const { data: diffs } = await supabase
    .from('competitor_diffs')
    .select('id, competitor_id, change_type, summary, detected_at')
    .gte('detected_at', since)
    .order('detected_at', { ascending: false })

  if (!diffs?.length) return { sent: false, reason: 'no_changes_in_last_24h' }

  // 2. Fetch competitor names + org_ids for those ids
  const competitorIds = Array.from(new Set(diffs.map((d) => d.competitor_id)))
  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name, org_id')
    .in('id', competitorIds)

  if (!competitors?.length) return { sent: false, reason: 'competitors_not_found' }

  // 3. Group diffs by org_id
  const byOrg: Record<string, CompetitorGroup[]> = {}
  for (const diff of diffs) {
    const comp = competitors.find((c) => c.id === diff.competitor_id)
    if (!comp?.org_id) continue
    if (!byOrg[comp.org_id]) byOrg[comp.org_id] = []
    let group = byOrg[comp.org_id].find((g) => g.competitorName === comp.name)
    if (!group) {
      group = { competitorName: comp.name, diffs: [] }
      byOrg[comp.org_id].push(group)
    }
    group.diffs.push(diff)
  }

  const orgIds = Object.keys(byOrg)
  if (!orgIds.length) return { sent: false, reason: 'no_org_matches' }

  // 4. Send one email per org
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  let sentCount = 0

  for (const orgId of orgIds) {
    const groups = byOrg[orgId]
    // Look up owner user_id for this org
    const { data: membership } = await supabase
      .from('org_members')
      .select('user_id')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    // Resolve email: try auth lookup, fall back to DIGEST_EMAIL env var
    let email: string | undefined
    if (membership?.user_id) {
      try {
        const { data: authData } = await supabase.auth.admin.getUserById(membership.user_id)
        email = authData?.user?.email ?? undefined
      } catch {
        // auth.admin unavailable in some environments
      }
    }
    email = email ?? process.env.DIGEST_EMAIL
    if (!email) continue

    const totalDiffs = groups.reduce((sum: number, g: CompetitorGroup) => sum + g.diffs.length, 0)
    const plural = totalDiffs !== 1
    const subject = `${totalDiffs} competitor move${plural ? 's' : ''} detected — ${dateLabel}`

    // Build grouped HTML
    const groupsHtml = groups
      .map(({ competitorName, diffs: groupDiffs }: CompetitorGroup) => {
        const rowsHtml = groupDiffs
          .map((d: CompetitorGroup['diffs'][number]) => {
            const typeColor: Record<string, string> = {
              pricing: '#6d28d9',
              product: '#2563eb',
              messaging: '#059669',
              jobs: '#d97706',
            }
            const color = typeColor[d.change_type?.toLowerCase()] ?? '#6b7280'
            return `
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;">
                  <span style="font-size:10px;font-weight:600;color:${color};text-transform:uppercase;letter-spacing:0.05em;background:${color}18;padding:2px 6px;border-radius:4px;">
                    ${d.change_type ?? 'change'}
                  </span>
                </td>
                <td style="padding:8px 0 8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;line-height:1.5;">
                  ${d.summary ?? 'Change detected'}
                </td>
              </tr>
            `
          })
          .join('')

        return `
          <div style="margin-bottom:20px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <div style="padding:12px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
              <strong style="font-size:14px;color:#111827;">${competitorName}</strong>
              <span style="font-size:12px;color:#9ca3af;margin-left:8px;">${groupDiffs.length} change${groupDiffs.length !== 1 ? 's' : ''}</span>
            </div>
            <div style="padding:4px 16px;">
              <table style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
            </div>
          </div>
        `
      })
      .join('')

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px 20px;background:#f9fafb;">
        <div style="margin-bottom:24px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
            <span style="font-size:18px;font-weight:700;color:#111827;">SignalMap</span>
            <span style="font-size:11px;background:#ede9fe;color:#6d28d9;padding:2px 8px;border-radius:99px;font-weight:500;">Daily Digest</span>
          </div>
          <p style="margin:0;font-size:13px;color:#6b7280;">
            ${totalDiffs} competitor move${plural ? 's' : ''} from the last 24 hours · ${dateLabel}
          </p>
        </div>
        ${groupsHtml}
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;">
          <a href="${APP_URL}/changes" style="display:inline-block;font-size:13px;color:#6366f1;text-decoration:none;font-weight:500;">
            View all changes in SignalMap →
          </a>
        </div>
      </body>
      </html>
    `

    const { error } = await resend.emails.send({
      from: 'SignalMap <onboarding@resend.dev>',
      to: email,
      subject,
      html,
    })

    if (!error) sentCount++
  }

  return { sent: sentCount > 0, orgs: sentCount, changes: diffs.length }
}
