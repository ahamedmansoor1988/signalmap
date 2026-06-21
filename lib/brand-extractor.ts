import { callClaudeJSON } from '@/lib/ai'

export interface BrandProfile {
  company_name: string          // canonical name, e.g. "Intercom"
  product_names: string[]       // sub-brands/products, e.g. ["Fin", "Fin AI"]
  search_terms: string[]        // all terms to monitor in news
  positioning: string           // 1-line market position
  target_segment: string        // who they sell to
  primary_category: string      // e.g. "Customer Support", "CRM", "Sales Engagement"
}

const BRAND_PROMPT = `You are a competitive intelligence analyst. Extract brand intelligence from this company's homepage.

Respond with JSON only:
{
  "company_name": "Official company name",
  "product_names": ["Product 1", "Sub-brand 1"],
  "search_terms": ["term1", "term2"],
  "positioning": "One-line market positioning",
  "target_segment": "Who they sell to",
  "primary_category": "Software category"
}

Rules:
- product_names: include AI assistants, sub-products, platform names that have their own brand identity
- search_terms: include company name, all products, and common abbreviations/nicknames used by press
- Do NOT include generic terms like "AI", "customer service" — only proper nouns`

export async function extractBrandProfile(
  competitorName: string,
  homepageText: string
): Promise<BrandProfile> {
  const prompt = `Company: ${competitorName}
Homepage content:
${homepageText.slice(0, 3000)}`

  try {
    const result = await callClaudeJSON<BrandProfile>(BRAND_PROMPT, prompt, 500)
    // Always include the original name
    if (!result.search_terms.includes(competitorName)) {
      result.search_terms.unshift(competitorName)
    }
    return result
  } catch {
    return {
      company_name: competitorName,
      product_names: [],
      search_terms: [competitorName],
      positioning: '',
      target_segment: '',
      primary_category: '',
    }
  }
}
