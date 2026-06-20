import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TrendingUp, Zap } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Trend Timeline — SignalMap' }

const THEME_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  'AI Features':  { bg: '#f5f3ff', color: '#7c3aed', label: 'AI Features' },
  'Pricing':      { bg: '#fffbeb', color: '#d97706', label: 'Pricing' },
  'Enterprise':   { bg: '#eff6ff', color: '#2563eb', label: 'Enterprise' },
  'GTM':          { bg: '#f0fdf4', color: '#16a34a', label: 'GTM' },
  'Content':      { bg: '#fff1f2', color: '#e11d48', label: 'Content' },
  'Messaging':    { bg: '#fdf4ff', color: '#a21caf', label: 'Messaging' },
  'Product':      { bg: '#f0f9ff', color: '#0284c7', label: 'Product' },
  'Hiring':       { bg: '#f7fee7', color: '#65a30d', label: 'Hiring' },
}

export default async function TrendTimelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  // Fetch all changes across all tracked competitors with theme
  const { data: changes } = await supabase
    .from('changes')
    .select(`
      id, theme, detected_at, ai_signal, risk_score,
      tracked_pages(
        competitors!inner(id, name, website, org_id)
      )
    `)
    .eq('tracked_pages.competitors.org_id', membership.org_id)
    .not('theme', 'is', null)
    .order('detected_at', { ascending: false })
    .limit(200)

  const safeChanges = changes ?? []

  // Group signals by theme + week
  const now = new Date()
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = new Date(now)
    end.setDate(end.getDate() - i * 7)
    const start = new Date(end)
    start.setDate(start.getDate() - 7)
    return { start, end, label: i === 0 ? 'This week' : i === 1 ? 'Last week' : `${i}w ago` }
  }).reverse()

  // Theme signal counts over time
  const themes = Array.from(new Set(safeChanges.map(c => c.theme).filter(Boolean))) as string[]
  const themeData = themes.slice(0, 6).map(theme => {
    const themeChanges = safeChanges.filter(c => c.theme === theme)
    const weekCounts = weeks.map(w =>
      themeChanges.filter(c => {
        const d = new Date(c.detected_at)
        return d >= w.start && d < w.end
      }).length
    )
    const total = themeChanges.length
    const maxCount = Math.max(...weekCounts, 1)
    const cfg = THEME_COLORS[theme] ?? { bg: '#f3f4f6', color: '#6b7280', label: theme }

    return { theme, weekCounts, total, maxCount, cfg }
  })

  // Top movers this week
  const thisWeekStart = weeks[weeks.length - 1].start
  const thisWeekChanges = safeChanges.filter(c => new Date(c.detected_at) >= thisWeekStart)
  const moverMap = new Map<string, { name: string; website: string; count: number; themes: string[] }>()
  for (const c of thisWeekChanges) {
    const comp = (c.tracked_pages as { competitors: { id: string; name: string; website: string } }).competitors
    if (!moverMap.has(comp.id)) moverMap.set(comp.id, { name: comp.name, website: comp.website, count: 0, themes: [] })
    const entry = moverMap.get(comp.id)!
    entry.count++
    if (c.theme && !entry.themes.includes(c.theme)) entry.themes.push(c.theme)
  }
  const topMovers = Array.from(moverMap.values()).sort((a, b) => b.count - a.count).slice(0, 5)

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-gray-900 text-xl font-bold">Trend Timeline</h1>
          <p className="text-gray-400 text-sm mt-0.5">Signal volume per theme over the last 8 weeks</p>
        </div>

        {safeChanges.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-gray-200 rounded-2xl bg-white">
            <TrendingUp className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No signal data yet</p>
            <p className="text-gray-400 text-xs mt-1">Trends appear after the cron job runs and signals are categorized</p>
          </div>
        ) : (
          <div className="space-y-5">

            {/* Theme trend bars */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 mb-5">Signal Volume by Theme</h2>

              {/* Week headers */}
              <div className="grid mb-3" style={{ gridTemplateColumns: '140px repeat(8, 1fr)' }}>
                <div />
                {weeks.map((w, i) => (
                  <div key={i} className="text-[10px] text-gray-400 text-center">{w.label}</div>
                ))}
              </div>

              <div className="space-y-3">
                {themeData.map(({ theme, weekCounts, total, maxCount, cfg }) => (
                  <div key={theme} className="grid items-center gap-1" style={{ gridTemplateColumns: '140px repeat(8, 1fr) 40px' }}>
                    <div className="flex items-center gap-2 pr-3">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full truncate"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </div>
                    {weekCounts.map((count, i) => (
                      <div key={i} className="flex items-end justify-center h-8">
                        {count > 0 ? (
                          <div
                            className="w-full max-w-[28px] rounded-sm transition-all"
                            style={{
                              height: `${Math.max(4, (count / maxCount) * 28)}px`,
                              backgroundColor: cfg.color,
                              opacity: 0.7 + (count / maxCount) * 0.3,
                            }}
                            title={`${count} signal${count !== 1 ? 's' : ''}`}
                          />
                        ) : (
                          <div className="w-full max-w-[28px] h-0.5 bg-gray-100 rounded-sm" />
                        )}
                      </div>
                    ))}
                    <div className="text-[11px] font-bold text-gray-500 text-right">{total}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Two-column: top movers + recent spikes */}
            <div className="grid grid-cols-2 gap-4">

              {/* Top movers this week */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-4 h-4 text-violet-500" />
                  <h2 className="text-sm font-semibold text-gray-900">Top Movers This Week</h2>
                </div>
                {topMovers.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No activity this week</p>
                ) : (
                  <div className="space-y-3">
                    {topMovers.map((m, i) => {
                      const logoUrl = (() => {
                        try {
                          const domain = new URL(m.website.startsWith('http') ? m.website : `https://${m.website}`).hostname
                          return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
                        } catch { return null }
                      })()
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-gray-300 w-3 shrink-0">{i + 1}</span>
                          <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                            {logoUrl
                              ? <img src={logoUrl} alt={m.name} className="w-4 h-4 object-contain" />
                              : <span className="text-[9px] font-bold text-gray-500">{m.name[0]}</span>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{m.name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              {m.themes.slice(0, 2).map(t => {
                                const cfg = THEME_COLORS[t]
                                return cfg ? (
                                  <span key={t} className="text-[9px] px-1 py-0.5 rounded font-medium"
                                    style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                                    {cfg.label}
                                  </span>
                                ) : null
                              })}
                            </div>
                          </div>
                          <span className="text-xs font-bold text-violet-600 shrink-0">{m.count}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Theme breakdown */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Theme Breakdown</h2>
                <div className="space-y-2.5">
                  {themeData
                    .sort((a, b) => b.total - a.total)
                    .map(({ theme, total, cfg }) => {
                      const maxTotal = Math.max(...themeData.map(t => t.total), 1)
                      return (
                        <div key={theme}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700">{cfg.label}</span>
                            <span className="text-xs text-gray-400">{total}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${(total / maxTotal) * 100}%`, backgroundColor: cfg.color }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
