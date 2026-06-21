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
  { id: 'starter',  name: 'Starter',  price: 0,   competitors: 5,  trialDays: 0 },
  { id: 'pro',      name: 'Pro',      price: 50,  competitors: 10, trialDays: 30, badge: '1 month free' },
  { id: 'business', name: 'Business', price: 100, competitors: 20, trialDays: 0 },
  { id: 'elite',    name: 'Elite',    price: 0,   competitors: -1, trialDays: 0, badge: 'Owner access' },
]

export function getPlan(id: string): Plan {
  return PLANS.find(p => p.id === id) ?? PLANS[0]
}

export function competitorLabel(limit: number, used: number): string {
  if (limit === -1 || limit >= 9999) return `${used} competitors (unlimited)`
  return `${used} / ${limit} competitors`
}
