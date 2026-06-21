import { callClaudeJSON } from '@/lib/ai'

// Per-page-type structured extraction — compare JSON structure, not raw text

export interface PricingStructure {
  page_type: 'pricing'
  products: Array<{
    name: string
    tiers: Array<{ name: string; price: string; billing: string; features: string[] }>
    target: string
  }>
  free_plan: boolean
  enterprise_cta: boolean
  trial_offered: boolean
  pricing_model: 'per_seat' | 'usage' | 'flat' | 'hybrid' | 'unknown'
}

export interface ProductStructure {
  page_type: 'product'
  headline: string
  subheadline: string
  key_features: string[]
  integrations: string[]
  ai_capabilities: string[]
  target_persona: string
}

export interface HomeStructure {
  page_type: 'home'
  headline: string
  value_proposition: string
  target_customer: string
  key_differentiators: string[]
  cta_primary: string
  social_proof: string
}

export type PageStructure = PricingStructure | ProductStructure | HomeStructure

const PRICING_PROMPT = `Extract the COMPLETE pricing structure from this page. If there are multiple products (e.g. "Gmail plan" and "Omni plan"), extract EACH as a separate product.

Respond with JSON:
{
  "page_type": "pricing",
  "products": [
    {
      "name": "Product name (e.g. 'Hiver for Gmail', 'Fin AI', 'Starter')",
      "tiers": [{"name": "Plan name", "price": "$X/seat/mo or Free", "billing": "monthly|annual|one-time", "features": ["key feature 1"]}],
      "target": "Who this product targets"
    }
  ],
  "free_plan": true|false,
  "enterprise_cta": true|false,
  "trial_offered": true|false,
  "pricing_model": "per_seat|usage|flat|hybrid|unknown"
}`

const PRODUCT_PROMPT = `Extract the product positioning from this page.

Respond with JSON:
{
  "page_type": "product",
  "headline": "Main headline",
  "subheadline": "Sub-headline or tagline",
  "key_features": ["Feature 1", "Feature 2"],
  "integrations": ["Integration 1"],
  "ai_capabilities": ["AI feature 1"],
  "target_persona": "Who this is for"
}`

const HOME_PROMPT = `Extract the homepage positioning.

Respond with JSON:
{
  "page_type": "home",
  "headline": "Main headline",
  "value_proposition": "Core value prop in one sentence",
  "target_customer": "Who they sell to",
  "key_differentiators": ["Differentiator 1", "Differentiator 2"],
  "cta_primary": "Primary CTA text",
  "social_proof": "Key social proof (customers, ARR, reviews)"
}`

const DIFF_PROMPT = `You are a senior PMM competitive analyst.
Compare these two snapshots of a competitor's {PAGE_TYPE} page and extract strategic signals.

Focus on STRUCTURAL changes: new products, removed tiers, pricing model shifts, new target segments, repositioning.

Respond with JSON:
{
  "summary": "2-3 sentences on what strategically changed and what it means",
  "signal": "Sharp PMM alert headline — be SPECIFIC (e.g. 'Hiver splits pricing into Gmail-native ($X) vs Omni-channel ($Y) — targeting two distinct segments')",
  "confidence": 0-100,
  "risk_score": 0-100,
  "theme": "AI Features | Pricing | Enterprise | GTM | Content",
  "structural_changes": ["Specific structural change 1", "Specific structural change 2"],
  "impact_bullets": [
    "What this means for our positioning",
    "Recommended response",
    "Market opportunity this reveals"
  ]
}`

function promptForPageType(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('pricing') || l.includes('plan')) return PRICING_PROMPT
  if (l.includes('product') || l.includes('feature')) return PRODUCT_PROMPT
  return HOME_PROMPT
}

export async function extractStructured(
  pageLabel: string,
  text: string
): Promise<PageStructure | null> {
  const prompt = promptForPageType(pageLabel)
  try {
    return await callClaudeJSON<PageStructure>(prompt, text.slice(0, 4000), 800)
  } catch {
    return null
  }
}

interface StructuredDiffResult {
  summary: string
  signal: string
  confidence: number
  risk_score: number
  theme: string
  structural_changes: string[]
  impact_bullets: string[]
}

export async function diffStructured(
  pageLabel: string,
  before: PageStructure | string,
  after: PageStructure | string
): Promise<StructuredDiffResult | null> {
  const systemPrompt = DIFF_PROMPT.replace('{PAGE_TYPE}', pageLabel)
  const userPrompt = `BEFORE:\n${JSON.stringify(before, null, 2)}\n\nAFTER:\n${JSON.stringify(after, null, 2)}`
  try {
    return await callClaudeJSON<StructuredDiffResult>(systemPrompt, userPrompt, 900)
  } catch {
    return null
  }
}
