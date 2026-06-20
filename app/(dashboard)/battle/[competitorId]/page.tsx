import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { callClaudeJSON } from '@/lib/ai'
import { BATTLE_SYSTEM } from '@/lib/prompts/battle'
import CompetitorLogo from '@/components/ui/competitor-logo'
import ShareButton from '@/components/ui/share-button'
import { getTypeStyle } from '@/lib/typed-actions'
import { THEME_CONFIG } from '@/components/map/mock-data'
import type { Theme } from '@/components/map/mock-data'
import { Swords, CheckCircle2, XCircle, ArrowLeft, Clock } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Battle Room — SignalMap' }

interface HomepageData {
  hero_headline?: string
  hero_subheadline?: string
  target_customer?: string
  key_themes?: string[]
  summary?: string
}

interface BattleAnalysis {
  feature_gaps: Array<{ feature: string; us: boolean; them: boolean }>
  battle_actions: Array<{ type: string; action: string }>
}

function ThreatGauge({ score }: { score: number }) {
  const cx = 100, cy = 100, R = 72
  const clamped = Math.min(Math.max(score, 0), 99.9)
  const angle = Math.PI * (1 - clamped / 100)
  const ex = cx + R * Math.cos(angle)
  const ey = cy - R * Math.sin(angle)
  const nx = cx + 54 * Math.cos(angle)
  const ny = cy - 54 * Math.sin(angle)
  const color = score >= 75 ? '#EF4444' : score >= 50 ? '#F97316' : '#10b981'

  return (
    <svg viewBox="0 0 200 116" className="w-44 shrink-0">
      <path
        d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 0 ${cx + R} ${cy}`}
        fill="none" stroke="#e5e7eb" strokeWidth={14} strokeLinecap="round"
      />
      {score > 0 && (
        <path
          d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 0 ${ex.toFixed(2)} ${ey.toFixed(2)}`}
          fill="none" stroke={color} strokeWidth={14} strokeLinecap="round"
        />
      )}
      <text x={cx - R + 2} y={cy + 16} textAnchor="middle" fontSize={9} fill="#9ca3af">Low</text>
      <text x={cx}         y={cy - R - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">Mid</text>
      <text x={cx + R - 2} y={cy + 16} textAnchor="middle" fontSize={9} fill="#9ca3af">High</text>
      <line x1={cx} y1={cy} x2={nx.toFixed(2)} y2={ny.toFixed(2)}
        stroke="#374151" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill="#374151" />
      <text x={cx} y={cy + 20} textAnchor="middle" fontSize={24} fontWeight={700} fill="#111827">{score}</text>
    </svg>
  )
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const d = Math.floor(diff / 86400000)
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

function DiffBadge({ changeType }: { changeType: string }) {
  const type = changeType.toLowerCase()
  const styles: Record<string, string> = {
    pricing:    'bg-amber-50 text-amber-700 border-amber-200',
    messaging:  'bg-violet-50 text-violet-700 border-violet-200',
    features:   'bg-blue-50 text-blue-700 border-blue-200',
    enterprise: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    content:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  const cls = styles[type] ?? 'bg-gray-50 text-gray-600 border-gray-200'
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 capitalize ${cls}`}>
      {changeType}
    </span>
  )
}

export default async function BattleRoomPage({
  params,
}: {
  params: { competitorId: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/onboarding')

  const { data: competitor } = await supabase
    .from('competitors')
    .select('id, name, website, risk_score, ai_summary')
    .eq('id', params.competitorId)
    .eq('org_id', membership.org_id)
    .maybeSingle()

  if (!competitor) notFound()

  const [
    { data: profile },
    { data: snapshots },
    { data: diffs },
  ] = await Promise.all([
    supabase
      .from('company_profiles')
      .select('company_name, description, icp, differentiators, website_url')
      .eq('org_id', membership.org_id)
      .maybeSingle(),
    supabase
      .from('competitor_snapshots')
      .select('parsed_data, snapshot_date')
      .eq('competitor_id', competitor.id)
      .eq('page_type', 'homepage')
      .order('snapshot_date', { ascending: false })
      .limit(1),
    supabase
      .from('competitor_diffs')
      .select('id, change_type, detected_at, summary')
      .eq('competitor_id', competitor.id)
      .order('detected_at', { ascending: false })
      .limit(5),
  ])

  const homepageData = (snapshots?.[0]?.parsed_data ?? null) as HomepageData | null
  const recentDiffs = diffs ?? []

  let analysis: BattleAnalysis = { feature_gaps: [], battle_actions: [] }
  try {
    const userMessage = JSON.stringify({
      our_company: {
        name: profile?.company_name ?? 'Our Company',
        icp: profile?.icp ?? '',
        differentiators: profile?.differentiators ?? '',
        description: profile?.description ?? '',
      },
      competitor: {
        name: competitor.name,
        hero_headline: homepageData?.hero_headline ?? '',
        target_customer: homepageData?.target_customer ?? '',
        key_themes: homepageData?.key_themes ?? [],
        summary: homepageData?.summary ?? competitor.ai_summary ?? '',
      },
      recent_changes: recentDiffs.map(d => `${d.change_type}: ${d.summary ?? 'Change detected'}`),
    })
    analysis = await callClaudeJSON<BattleAnalysis>(BATTLE_SYSTEM, userMessage, 1400)
  } catch {
    // Render page with empty AI sections if generation fails
  }

  const ourName = profile?.company_name ?? 'Your Company'
  const ourDifferentiators = (profile?.differentiators ?? '')
    .split(/[,\n•·]/)
    .map(s => s.trim())
    .filter(Boolean)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Top bar: back link + share */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/map"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Market Map
          </Link>
          <ShareButton />
        </div>

        {/* VS Header */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 shadow-sm mb-5">
          <p className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-5">
            Battle Room
          </p>
          <div className="flex items-center justify-center gap-6 sm:gap-10">
            <div className="flex flex-col items-center gap-2 min-w-0">
              <CompetitorLogo website={profile?.website_url ?? null} name={ourName} size="lg" />
              <div className="text-center">
                <p className="text-gray-900 font-semibold text-sm truncate max-w-[100px] sm:max-w-none">{ourName}</p>
                <p className="text-gray-400 text-xs">You</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1 shrink-0">
              <Swords className="w-5 h-5 text-gray-300" />
              <span className="text-gray-300 text-[10px] font-bold tracking-widest">VS</span>
            </div>

            <div className="flex flex-col items-center gap-2 min-w-0">
              <CompetitorLogo website={competitor.website} name={competitor.name} size="lg" />
              <div className="text-center">
                <p className="text-gray-900 font-semibold text-sm truncate max-w-[100px] sm:max-w-none">{competitor.name}</p>
                <p className="text-gray-400 text-xs">Competitor</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-5">

          {/* 1. Messaging */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100">
              <h2 className="text-gray-700 text-sm font-semibold">Messaging</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-gray-100 divide-y sm:divide-y-0">
              {/* Our side */}
              <div className="p-4 sm:p-5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3 sm:mb-4">
                  {ourName}
                </p>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <p className="text-[11px] text-gray-400 mb-1">Hero Headline</p>
                    <p className="text-gray-800 text-sm font-medium leading-snug">
                      {profile?.description
                        ? (profile.description.split(/[.!?]/)[0] ?? profile.description) + '.'
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 mb-1">ICP</p>
                    <p className="text-gray-700 text-sm leading-snug">{profile?.icp || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 mb-1.5">Key Differentiators</p>
                    {ourDifferentiators.length > 0 ? (
                      <ul className="space-y-1">
                        {ourDifferentiators.slice(0, 4).map((d, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-violet-400 shrink-0 mt-0.5 text-xs">•</span>
                            <span className="text-gray-700 text-sm leading-snug">{d}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-400 text-sm">—</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Their side */}
              <div className="p-4 sm:p-5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3 sm:mb-4">
                  {competitor.name}
                </p>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <p className="text-[11px] text-gray-400 mb-1">Hero Headline</p>
                    <p className="text-gray-800 text-sm font-medium leading-snug">
                      {homepageData?.hero_headline || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 mb-1">ICP</p>
                    <p className="text-gray-700 text-sm leading-snug">
                      {homepageData?.target_customer || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 mb-1.5">Key Themes</p>
                    {(homepageData?.key_themes?.length ?? 0) > 0 ? (
                      <ul className="space-y-1">
                        {(homepageData!.key_themes!).slice(0, 4).map((t, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-400 shrink-0 mt-0.5 text-xs">•</span>
                            <span className="text-gray-700 text-sm leading-snug">{t}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-700 text-sm leading-snug">
                        {homepageData?.summary || competitor.ai_summary || '—'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Feature Gaps */}
          {analysis.feature_gaps.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100">
                <h2 className="text-gray-700 text-sm font-semibold">Feature Gaps</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-[11px] text-gray-400 font-medium px-4 sm:px-5 py-3 w-1/2">
                        Feature
                      </th>
                      <th className="text-center text-[11px] text-gray-400 font-medium px-3 sm:px-4 py-3 w-1/4">
                        <span className="hidden sm:inline">{ourName}</span>
                        <span className="sm:hidden">You</span>
                      </th>
                      <th className="text-center text-[11px] text-gray-400 font-medium px-3 sm:px-4 py-3 w-1/4">
                        <span className="hidden sm:inline">{competitor.name}</span>
                        <span className="sm:hidden">Them</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {analysis.feature_gaps.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 sm:px-5 py-3 text-gray-700 text-sm">{row.feature}</td>
                        <td className="px-3 sm:px-4 py-3 text-center">
                          {row.us
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                            : <XCircle className="w-4 h-4 text-gray-200 mx-auto" />}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-center">
                          {row.them
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                            : <XCircle className="w-4 h-4 text-gray-200 mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. Threat Level */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
            <h2 className="text-gray-700 text-sm font-semibold mb-4 sm:mb-5">Threat Level</h2>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-8">
              <ThreatGauge score={competitor.risk_score} />
              <div className="text-center sm:text-left">
                <p className={`text-2xl font-bold mb-1 ${
                  competitor.risk_score >= 75 ? 'text-red-500' :
                  competitor.risk_score >= 50 ? 'text-amber-500' :
                  'text-emerald-500'
                }`}>
                  {competitor.risk_score >= 75 ? 'High' :
                   competitor.risk_score >= 50 ? 'Medium' : 'Low'}
                </p>
                <p className="text-gray-500 text-sm leading-snug max-w-xs">
                  {competitor.risk_score >= 75
                    ? 'Active competitive threat — take immediate action on differentiation and win-loss analysis.'
                    : competitor.risk_score >= 50
                    ? 'Growing threat — monitor closely and strengthen positioning in overlap areas.'
                    : 'Low current threat — maintain awareness and watch for acceleration signals.'}
                </p>
              </div>
            </div>
          </div>

          {/* 4. Recent Moves */}
          {recentDiffs.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-gray-700 text-sm font-semibold">Recent Moves</h2>
                <Link href="/changes" className="text-xs text-violet-600 hover:text-violet-700 transition-colors">
                  View all →
                </Link>
              </div>
              <div className="p-3 sm:p-4 space-y-2.5">
                {recentDiffs.map((diff) => {
                  const themeKey = Object.keys(THEME_CONFIG).find(
                    k => k.toLowerCase() === diff.change_type?.toLowerCase()
                  ) as Theme | undefined
                  const cfg = themeKey ? THEME_CONFIG[themeKey] : null

                  return (
                    <div
                      key={diff.id}
                      className="bg-gray-50 border border-gray-100 rounded-xl p-3 sm:p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {cfg ? (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                            style={{ backgroundColor: cfg.bg, color: cfg.color }}
                          >
                            {diff.change_type}
                          </span>
                        ) : (
                          <DiffBadge changeType={diff.change_type} />
                        )}
                        <span className="flex items-center gap-1 text-gray-400 text-xs ml-auto shrink-0">
                          <Clock className="w-3 h-3" />
                          {timeAgo(diff.detected_at)}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm leading-snug">
                        {diff.summary ?? 'Change detected'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {recentDiffs.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100">
                <h2 className="text-gray-700 text-sm font-semibold">Recent Moves</h2>
              </div>
              <div className="px-4 sm:px-5 py-6 text-center">
                <p className="text-gray-400 text-sm">No changes detected yet — the cron job runs daily at 8am UTC.</p>
              </div>
            </div>
          )}

          {/* 5. Suggested Battle Actions */}
          {analysis.battle_actions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100">
                <h2 className="text-gray-700 text-sm font-semibold">Suggested Battle Actions</h2>
              </div>
              <div className="p-4 sm:p-5 space-y-2">
                {analysis.battle_actions.map((action, i) => {
                  const style = getTypeStyle(action.type)
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 bg-gray-50 rounded-lg p-3 border border-gray-100"
                    >
                      {style && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${style.cls}`}>
                          {style.label}
                        </span>
                      )}
                      <span className="text-gray-700 text-sm leading-snug">{action.action}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {analysis.battle_actions.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100">
                <h2 className="text-gray-700 text-sm font-semibold">Suggested Battle Actions</h2>
              </div>
              <div className="px-4 sm:px-5 py-6 text-center">
                <p className="text-gray-400 text-sm">Add your company profile in Settings to generate personalized battle actions.</p>
                <Link href="/settings" className="text-xs text-violet-600 hover:text-violet-700 mt-2 inline-block transition-colors">
                  Go to Settings →
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
