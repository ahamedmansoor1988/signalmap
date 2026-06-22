import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { callClaudeJSON } from '@/lib/ai'
import { buildWeeklyBriefSystem } from '@/lib/prompts/weekly-brief'
import type { TypedAction } from '@/lib/typed-actions'
import type { Json } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://signalmap-sigma.vercel.app'

export interface TopMove {
  competitor: string
  move: string
  impact: string
}

interface BriefResult {
  summary: string
  top_moves: TopMove[]
  trend_summary: string
  recommended_actions: TypedAction[]
}

export interface WeeklyBriefResult {
  sent: boolean
  saved?: number
  orgs?: number
  reason?: string
}

function getMondayOfWeek(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function formatWeekLabel(weekStart: string): string {
  return new Date(weekStart + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

export async function generateWeeklyBrief(): Promise<WeeklyBriefResult> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, reason: 'RESEND_API_KEY not configured' }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const supabase = createServiceClient()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const weekStart = getMondayOfWeek(new Date())

  // 1. Fetch all orgs (we send to every org, even quiet ones)
  const { data: allMembers } = await supabase
    .from('org_members')
    .select('org_id')
    .order('created_at', { ascending: true })

  const uniqueOrgIds = Array.from(new Set((allMembers ?? []).map((m) => m.org_id)))
  if (!uniqueOrgIds.length) return { sent: false, reason: 'no_orgs' }

  // 2. Fetch competitor_diffs from last 7 days
  const { data: diffs } = await supabase
    .from('competitor_diffs')
    .select('id, competitor_id, change_type, summary, detected_at')
    .gte('detected_at', since)
    .order('detected_at', { ascending: false })

  // 3. Map competitor_id → { name, org_id }
  const competitorIds = Array.from(new Set((diffs ?? []).map((d) => d.competitor_id)))
  const { data: competitors } = competitorIds.length
    ? await supabase.from('competitors').select('id, name, org_id').in('id', competitorIds)
    : { data: [] }

  const competitorMap: Record<string, { name: string; org_id: string }> = Object.fromEntries(
    (competitors ?? []).map((c) => [c.id, { name: c.name, org_id: c.org_id }])
  )

  // Group diffs by org_id
  const diffsByOrg: Record<string, Array<{ competitor_id: string; change_type: string; summary: string | null; detected_at: string }>> = {}
  for (const diff of (diffs ?? [])) {
    const comp = competitorMap[diff.competitor_id]
    if (!comp) continue
    if (!diffsByOrg[comp.org_id]) diffsByOrg[comp.org_id] = []
    diffsByOrg[comp.org_id].push(diff)
  }

  let savedCount = 0
  let sentCount = 0

  for (const orgId of uniqueOrgIds) {
    const orgDiffs = diffsByOrg[orgId] ?? []

    // Fetch company profile
    const { data: profile } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle()

    // Generate brief first — upsert regardless of email availability
    let brief: BriefResult

    if (!orgDiffs.length) {
      brief = {
        summary: 'Quiet week — no major competitor moves detected this week.',
        top_moves: [],
        trend_summary: 'No significant competitive activity in the past 7 days. This may be a good moment to proactively reach out to prospects before competitors make their next move.',
        recommended_actions: [],
      }
    } else {
      // Build context: group diffs by competitor name, cap at 30 rows
      const grouped: Record<string, string[]> = {}
      for (const diff of orgDiffs.slice(0, 30)) {
        const comp = competitorMap[diff.competitor_id]
        if (!comp) continue
        if (!grouped[comp.name]) grouped[comp.name] = []
        grouped[comp.name].push(`[${diff.change_type ?? 'change'}] ${diff.summary ?? 'Change detected'}`)
      }

      const context = Object.entries(grouped)
        .map(([name, lines]) => `${name}:\n${lines.join('\n')}`)
        .join('\n\n')

      const system = buildWeeklyBriefSystem(profile ?? null)

      try {
        brief = await callClaudeJSON<BriefResult>(system, `Week of ${weekStart}\n\n${context}`, 1200)
        brief.top_moves = Array.isArray(brief.top_moves) ? brief.top_moves.slice(0, 3) : []
        brief.recommended_actions = Array.isArray(brief.recommended_actions) ? brief.recommended_actions : []
      } catch (err) {
        console.error('[weekly-brief] AI call failed:', err)
        brief = {
          summary: 'Brief generation encountered an error this week.',
          top_moves: [],
          trend_summary: '',
          recommended_actions: [],
        }
      }
    }

    // Always store — upsert is idempotent on (org_id, week_start)
    const { error: upsertError } = await supabase
      .from('weekly_briefs')
      .upsert(
        {
          org_id: orgId,
          week_start: weekStart,
          summary: brief.summary,
          top_moves: brief.top_moves as unknown as Json,
          trend_summary: brief.trend_summary,
          recommended_actions: brief.recommended_actions as unknown as Json,
        },
        { onConflict: 'org_id,week_start' }
      )

    if (upsertError) {
      console.error('[weekly-brief] upsert failed:', upsertError.message)
      continue
    }
    savedCount++

    // Resolve email — after the row is safe
    const { data: membership } = await supabase
      .from('org_members')
      .select('user_id')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

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
    if (!email) continue   // brief is saved; just can't email

    const weekLabel = formatWeekLabel(weekStart)
    const html = buildBriefEmail(brief, weekLabel)

    const { error: emailError } = await resend.emails.send({
      from: 'SignalMap <onboarding@resend.dev>',
      to: email,
      subject: `Your Weekly Competitive Brief — Week of ${weekLabel}`,
      html,
    })

    if (!emailError) sentCount++
  }

  return { sent: sentCount > 0, saved: savedCount, orgs: sentCount }
}

function buildBriefEmail(brief: BriefResult, weekLabel: string): string {
  const typeColor: Record<string, { bg: string; text: string }> = {
    sales:     { bg: '#eff6ff', text: '#1d4ed8' },
    marketing: { bg: '#f0fdf4', text: '#15803d' },
    product:   { bg: '#f5f3ff', text: '#6d28d9' },
  }

  const topMovesHtml = brief.top_moves.length
    ? brief.top_moves
        .map((move, i) => `
          <div style="margin-bottom:12px;padding:14px 16px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
            <div style="display:flex;align-items:flex-start;gap:10px;">
              <span style="font-size:13px;font-weight:700;color:#d1d5db;min-width:16px;margin-top:1px;">${i + 1}</span>
              <div>
                <span style="font-size:13px;font-weight:600;color:#111827;">${move.competitor}</span>
                <p style="margin:4px 0 0;font-size:13px;color:#374151;line-height:1.5;">${move.move}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;font-style:italic;line-height:1.4;">${move.impact}</p>
              </div>
            </div>
          </div>
        `)
        .join('')
    : '<p style="font-size:13px;color:#9ca3af;font-style:italic;">No major moves this week.</p>'

  const actionsHtml = brief.recommended_actions.length
    ? brief.recommended_actions
        .map((a) => {
          const colors = typeColor[a.type] ?? { bg: '#f9fafb', text: '#6b7280' }
          const label = a.type ? a.type.charAt(0).toUpperCase() + a.type.slice(1) : ''
          return `
            <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #f3f4f6;">
              ${label ? `<span style="font-size:10px;font-weight:700;background:${colors.bg};color:${colors.text};padding:2px 8px;border-radius:4px;white-space:nowrap;margin-top:2px;">${label}</span>` : ''}
              <span style="font-size:13px;color:#374151;line-height:1.5;">${a.action}</span>
            </div>
          `
        })
        .join('')
    : '<p style="font-size:13px;color:#9ca3af;font-style:italic;">No actions generated for this week.</p>'

  const trendHtml = brief.trend_summary
    ? `<p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">${brief.trend_summary}</p>`
    : ''

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px 20px;background:#f9fafb;">

  <!-- Header -->
  <div style="margin-bottom:28px;">
    <div style="margin-bottom:6px;">
      <span style="font-size:18px;font-weight:700;color:#111827;">SignalMap</span>
      <span style="margin-left:8px;font-size:11px;background:#ede9fe;color:#6d28d9;padding:2px 8px;border-radius:99px;font-weight:500;">Weekly Brief</span>
    </div>
    <p style="margin:0;font-size:13px;color:#6b7280;">Week of ${weekLabel}</p>
  </div>

  <!-- Market Summary -->
  <div style="margin-bottom:20px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;">
    <div style="font-size:14px;font-weight:600;color:#111827;margin-bottom:10px;">📊 Market Summary</div>
    <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">${brief.summary}</p>
  </div>

  <!-- Top Competitor Moves -->
  <div style="margin-bottom:20px;">
    <div style="font-size:14px;font-weight:600;color:#111827;margin-bottom:12px;">🏆 Top Competitor Moves This Week</div>
    ${topMovesHtml}
  </div>

  ${brief.trend_summary ? `
  <!-- Emerging Trend -->
  <div style="margin-bottom:20px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;">
    <div style="font-size:14px;font-weight:600;color:#111827;margin-bottom:10px;">📈 Emerging Trend</div>
    ${trendHtml}
  </div>
  ` : ''}

  ${brief.recommended_actions.length ? `
  <!-- Recommended Actions -->
  <div style="margin-bottom:24px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;">
    <div style="font-size:14px;font-weight:600;color:#111827;margin-bottom:12px;">⚡ Recommended Actions</div>
    ${actionsHtml}
  </div>
  ` : ''}

  <!-- CTA -->
  <div style="text-align:center;padding-top:8px;">
    <a href="${APP_URL}/brief"
       style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 24px;border-radius:8px;">
      View full brief →
    </a>
  </div>

  <!-- Footer -->
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">SignalMap · Competitive intelligence for B2B PMMs</p>
  </div>

</body>
</html>`
}
