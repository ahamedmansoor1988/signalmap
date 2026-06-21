const PLAN_LABELS: Record<string, string> = { starter: 'Starter', growth: 'Growth', scale: 'Scale' }

export default function OrganizationPlanCard({ plan, used, limit }: { plan: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100))
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">{PLAN_LABELS[plan] ?? plan} organization plan</p>
          <p className="text-xs text-gray-400 mt-1">Unlimited team members · priced by monitored competitors</p>
        </div>
        <span className="text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-100 rounded-full px-2.5 py-1">
          {used} / {limit} competitors
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-4">
        <div className={`h-full rounded-full ${pct >= 90 ? 'bg-amber-500' : 'bg-violet-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Invite each teammate to get a private queue, role-specific lens and personal notifications—without increasing the bill.
      </p>
    </div>
  )
}
