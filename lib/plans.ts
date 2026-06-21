export type PlanId = 'starter' | 'pro' | 'business' | 'elite'

export interface Plan {
  id: PlanId
  name: string
  price: number        // USD/month (0 = free)
  competitors: number  // -1 = unlimited
  trialDays: number
  badge?: string
}

export const PLANS: Plan[] = [
  { id: 'starter',  name: 'Starter',  price: 0,   competitors: 5,  trialDays: 30, badge: '1 month free' },
  { id: 'pro',      name: 'Pro',      price: 50,  competitors: 10, trialDays: 0 },
  { id: 'business', name: 'Business', price: 100, competitors: 20, trialDays: 0 },
  { id: 'elite',    name: 'Elite',    price: 300, competitors: -1, trialDays: 0 },
]

export function getPlan(id: string): Plan {
  return PLANS.find(p => p.id === id) ?? PLANS[0]
}

export function competitorLabel(limit: number, used: number): string {
  if (limit === -1 || limit >= 9999) return `${used} competitors (unlimited)`
  return `${used} / ${limit} competitors`
}

export function isPaid(plan: string): boolean {
  return plan === 'pro' || plan === 'business' || plan === 'elite'
}

export const TIME_PERIODS = [
  { days: 7,  label: '7d',  paid: false },
  { days: 30, label: '30d', paid: true  },
  { days: 60, label: '60d', paid: true  },
  { days: 90, label: '90d', paid: true  },
] as const
