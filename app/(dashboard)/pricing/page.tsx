import Link from 'next/link'
import { Check } from 'lucide-react'

export const metadata = { title: 'Pricing — SignalMap' }

interface PlanDef {
  name: string
  price: number
  desc: string
  competitors: number
  features: string[]
  cta: string
  highlight?: boolean
  disabled?: boolean
}

const PLANS: PlanDef[] = [
  {
    name: 'Starter',
    price: 0,
    desc: 'Perfect for solo PMMs and founders.',
    competitors: 5,
    features: [
      '5 competitors tracked',
      '7-day signal history',
      'Market Map view',
      'Weekly digest',
      'Community support',
    ],
    cta: 'Current plan',
    disabled: true,
  },
  {
    name: 'Pro',
    price: 50,
    desc: 'For growing PMM teams.',
    competitors: 10,
    features: [
      '10 competitors tracked',
      '30-day signal history',
      'Battle Room',
      'Backfill history (Wayback)',
      'Signal timeline',
      'Priority support',
    ],
    cta: 'Upgrade to Pro',
    highlight: true,
  },
  {
    name: 'Business',
    price: 100,
    desc: 'For teams that need unlimited scale.',
    competitors: 20,
    features: [
      '20 competitors tracked',
      '90-day signal history',
      'Team access + roles',
      'Everything in Pro',
      'Dedicated onboarding',
    ],
    cta: 'Upgrade to Business',
  },
]

const EMAIL = 'ahamedmansoor1988@gmail.com'

export default function PricingPage() {
  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Simple, transparent pricing</h1>
          <p className="text-gray-500 text-sm">Start free. Upgrade as you grow. No credit card required to start.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={`relative bg-white rounded-2xl border p-6 shadow-sm flex flex-col ${
                plan.highlight
                  ? 'border-violet-300 ring-1 ring-violet-200'
                  : 'border-gray-200'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-violet-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    Most popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
                <p className="text-gray-500 text-xs mt-1">{plan.desc}</p>
                <div className="mt-4 flex items-end gap-1">
                  <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-gray-400 text-sm mb-1">/month</span>
                </div>
              </div>

              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              {'disabled' in plan && plan.disabled ? (
                <button
                  disabled
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-400 bg-gray-100 cursor-not-allowed"
                >
                  {plan.cta}
                </button>
              ) : (
                <a
                  href={`mailto:${EMAIL}?subject=SignalMap upgrade — ${plan.name} plan&body=Hi, I'd like to upgrade my SignalMap account to the ${plan.name} plan ($${plan.price}/mo).`}
                  className={`block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    plan.highlight
                      ? 'bg-violet-600 text-white hover:bg-violet-700'
                      : 'border border-violet-300 text-violet-600 hover:bg-violet-50'
                  }`}
                >
                  {plan.cta}
                </a>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          Questions?{' '}
          <a href={`mailto:${EMAIL}`} className="text-violet-600 hover:underline">Email us</a>{' '}
          — we reply within 24 hours.
        </p>

        <div className="text-center mt-4">
          <Link href="/settings" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← Back to Settings
          </Link>
        </div>
      </div>
    </div>
  )
}
