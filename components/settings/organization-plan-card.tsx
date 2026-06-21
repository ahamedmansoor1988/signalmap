'use client'

import { useState } from 'react'
import { Check, Zap } from 'lucide-react'
import { PLANS, getPlan, competitorLabel } from '@/lib/plans'

function UpgradeModal({ currentPlan, onClose }: { currentPlan: string; onClose: () => void }) {
  const current = getPlan(currentPlan)
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Upgrade your plan</h2>
          <p className="text-sm text-gray-400 mt-1">Monitor more competitors — pricing is per org, not per seat</p>
        </div>
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {PLANS.map(plan => {
            const isCurrent = plan.id === currentPlan
            return (
              <div key={plan.id} className={`relative rounded-xl border p-4 flex flex-col gap-3 ${isCurrent ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-violet-200'}`}>
                {plan.badge && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-violet-600 text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                    {plan.badge}
                  </span>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-900">{plan.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {plan.competitors === -1 ? 'Unlimited' : `${plan.competitors} competitors`}
                  </p>
                </div>
                <div>
                  {plan.price === 0
                    ? <p className="text-xl font-bold text-gray-900">Free</p>
                    : <p className="text-xl font-bold text-gray-900">${plan.price}<span className="text-xs font-normal text-gray-400">/mo</span></p>
                  }
                  {plan.trialDays > 0 && plan.price === 0 && (
                    <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Then free forever</p>
                  )}
                </div>
                <ul className="space-y-1 flex-1">
                  {[
                    `${plan.competitors === -1 ? 'Unlimited' : plan.competitors} competitors`,
                    'Unlimited teammates',
                    'AI signal analysis',
                    plan.id !== 'starter' ? 'Priority crawling' : null,
                  ].filter(Boolean).map(f => (
                    <li key={f} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                {isCurrent
                  ? <span className="text-center text-xs font-semibold text-violet-600">Current plan</span>
                  : plan.id === 'starter' && current.price > 0
                    ? <span className="text-center text-xs text-gray-400">Downgrade</span>
                    : (
                      <a
                        href={`mailto:ahamedmansoor1988@gmail.com?subject=SignalMap upgrade to ${plan.name}&body=Hi, I'd like to upgrade to the ${plan.name} plan ($${plan.price}/month).`}
                        className="block text-center text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white py-2 rounded-lg transition-colors"
                      >
                        Upgrade
                      </a>
                    )
                }
              </div>
            )
          })}
        </div>
        <div className="px-6 pb-5 flex items-center justify-between">
          <p className="text-xs text-gray-400">Need more? Email us for a custom Enterprise plan.</p>
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">Close</button>
        </div>
      </div>
    </div>
  )
}

export default function OrganizationPlanCard({ plan, used, limit }: { plan: string; used: number; limit: number }) {
  const [showUpgrade, setShowUpgrade] = useState(false)
  const planInfo = getPlan(plan)
  const isUnlimited = limit >= 9999 || limit === -1
  const pct = isUnlimited ? Math.min(100, Math.round((used / 20) * 100)) : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100))
  const nearLimit = !isUnlimited && pct >= 80

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">{planInfo.name} plan</p>
              {planInfo.badge && (
                <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{planInfo.badge}</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">Unlimited teammates · priced by monitored competitors</p>
          </div>
          <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${nearLimit ? 'text-amber-700 bg-amber-50 border border-amber-100' : 'text-violet-700 bg-violet-50 border border-violet-100'}`}>
            {competitorLabel(limit, used)}
          </span>
        </div>

        {!isUnlimited && (
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-4">
            <div className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-violet-500'}`} style={{ width: `${pct}%` }} />
          </div>
        )}

        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-400">
            {isUnlimited
              ? 'You have unlimited competitor monitoring.'
              : nearLimit
                ? `You've used ${pct}% of your limit. Upgrade to add more.`
                : 'Invite teammates without increasing the bill.'}
          </p>
          {plan !== 'elite' && (
            <button
              onClick={() => setShowUpgrade(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 border border-violet-200 hover:border-violet-300 px-3 py-1.5 rounded-lg hover:bg-violet-50 transition-all"
            >
              <Zap className="w-3 h-3" /> Upgrade
            </button>
          )}
        </div>
      </div>

      {showUpgrade && <UpgradeModal currentPlan={plan} onClose={() => setShowUpgrade(false)} />}
    </>
  )
}
