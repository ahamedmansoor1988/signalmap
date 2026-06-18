import { Clock, TrendingUp, DollarSign, MessageSquare, Users, Package } from 'lucide-react'

interface Diff {
  id: string
  change_type: string
  detected_at: string
  summary: string | null
}

interface Props {
  diffs: Diff[]
}

const CHANGE_TYPE_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  Pricing:   { color: '#f59e0b', bg: '#fffbeb', icon: DollarSign,     label: 'Pricing'   },
  Messaging: { color: '#8b5cf6', bg: '#f5f3ff', icon: MessageSquare,  label: 'Messaging' },
  Product:   { color: '#3b82f6', bg: '#eff6ff', icon: Package,        label: 'Product'   },
  Hiring:    { color: '#10b981', bg: '#f0fdf4', icon: Users,          label: 'Hiring'    },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function groupDiffs(diffs: Diff[]) {
  const now = Date.now()
  const week  = now - 7  * 86400000
  const month = now - 30 * 86400000
  const quarter = now - 90 * 86400000

  const thisWeek    = diffs.filter((d) => new Date(d.detected_at).getTime() >= week)
  const thisMonth   = diffs.filter((d) => { const t = new Date(d.detected_at).getTime(); return t >= month && t < week })
  const thisQuarter = diffs.filter((d) => { const t = new Date(d.detected_at).getTime(); return t >= quarter && t < month })

  return { thisWeek, thisMonth, thisQuarter }
}

function TimelineEntry({ diff }: { diff: Diff }) {
  const cfg = CHANGE_TYPE_CONFIG[diff.change_type] ?? CHANGE_TYPE_CONFIG['Product']
  const Icon = cfg.icon

  return (
    <div className="flex gap-3 py-2.5">
      <div className="flex flex-col items-center">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: cfg.bg }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
        </div>
        <div className="w-px flex-1 bg-gray-100 mt-1" />
      </div>
      <div className="pb-2 min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>
          <span className="text-gray-400 text-xs flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(diff.detected_at)}
          </span>
        </div>
        <p className="text-gray-700 text-sm leading-snug">
          {diff.summary ?? 'Change detected'}
        </p>
      </div>
    </div>
  )
}

function Section({ label, diffs }: { label: string; diffs: Diff[] }) {
  if (!diffs.length) return null
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
        <span className="text-xs text-gray-300">{diffs.length}</span>
      </div>
      <div>
        {diffs.map((d) => <TimelineEntry key={d.id} diff={d} />)}
      </div>
    </div>
  )
}

export default function ActivityTimeline({ diffs }: Props) {
  const { thisWeek, thisMonth, thisQuarter } = groupDiffs(diffs)
  const hasAny = thisWeek.length + thisMonth.length + thisQuarter.length > 0

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <TrendingUp className="w-7 h-7 text-gray-200 mb-2" />
        <p className="text-gray-400 text-sm">No changes detected yet</p>
        <p className="text-gray-300 text-xs mt-1">Cron runs daily at 8am UTC</p>
      </div>
    )
  }

  return (
    <div>
      <Section label="This week"    diffs={thisWeek} />
      <Section label="This month"   diffs={thisMonth} />
      <Section label="This quarter" diffs={thisQuarter} />
    </div>
  )
}
