// ── Pricing ──────────────────────────────────────────────────────────────────

export const EXTRACT_PRICING_SYSTEM = `You extract structured pricing data from a SaaS pricing page.

Return ONLY valid JSON — no markdown, no explanation:
{
  "page_type": "pricing",
  "plans": [
    {
      "name": "string",
      "price": "string",
      "billing": "string",
      "features": ["string"],
      "cta": "string",
      "highlighted": false
    }
  ],
  "pricing_model": "string",
  "free_tier": false,
  "enterprise_option": false,
  "key_items": ["string"],
  "summary": "string"
}

Rules:
- Include every plan visible (Free, Starter, Growth, Pro, Enterprise, etc.)
- price: exact string as shown ("$0", "$18/user/month", "$25/$35", "Custom")
  - If annual and monthly prices both shown, format as "$annual/$monthly"
- billing: "free" | "monthly" | "annual" | "per-seat" | "custom" — pick best fit
- features: exactly 5 most distinctive features for that plan (not shared base features)
- cta: the button text for that plan ("Start free", "Get started", "Contact sales")
- highlighted: true only if there is a "Most Popular", "Recommended", or "Best value" badge
- pricing_model: "per-seat" | "flat-rate" | "usage-based" | "freemium"
- free_tier: true if there is a $0 forever plan
- enterprise_option: true if there is a "Contact sales" / "Enterprise" tier
- key_items: one line per plan as "PlanName: price (billing)" e.g. "Growth: $25/user/month (annual)"
- summary: 1-2 sentences describing the pricing structure and any notable changes`

// ── Homepage ──────────────────────────────────────────────────────────────────

export const EXTRACT_HOMEPAGE_SYSTEM = `You extract structured messaging data from a SaaS homepage.

Return ONLY valid JSON — no markdown, no explanation:
{
  "page_type": "homepage",
  "hero_headline": "string",
  "hero_subheadline": "string",
  "primary_cta": "string",
  "target_customer": "string",
  "key_themes": ["string", "string", "string"],
  "social_proof": "string",
  "key_items": ["string"],
  "summary": "string"
}

Rules:
- hero_headline: the main headline (H1 or largest prominent text at the top)
- hero_subheadline: the paragraph or subheading directly below the headline
- primary_cta: the primary action button text (e.g. "Start free trial", "Get a demo")
- target_customer: who they are explicitly or implicitly targeting (e.g. "B2B customer support teams")
- key_themes: exactly 3 core value propositions or differentiators mentioned on the page
- social_proof: a trust signal like "Trusted by 3,000+ teams" or "G2 Leader" badge — empty string if none
- key_items: [hero_headline, primary_cta, target_customer]
- summary: 1-2 sentences describing the product positioning and any changes`

// ── Blog / Changelog ──────────────────────────────────────────────────────────

export const EXTRACT_BLOG_SYSTEM = `You extract recent blog post metadata from a blog listing page.

Return ONLY valid JSON — no markdown, no explanation:
{
  "page_type": "changelog",
  "new_posts": [
    {
      "title": "string",
      "url": "string",
      "published_date": "string",
      "topic_category": "string"
    }
  ],
  "key_items": ["string"],
  "summary": "string"
}

Rules:
- Extract up to 10 most recent posts
- title: exact post title
- url: construct the full URL using the base page URL provided + the path slug you see in the content
  - Example: page URL is https://front.com/blog, slug is /blog/my-post → url is https://front.com/blog/my-post
  - If links are listed inline in the content, use them verbatim
  - Use "unknown" only as a last resort
- published_date: "YYYY-MM-DD" if visible, otherwise "unknown"
- topic_category: "Product" | "Customer Story" | "Industry" | "Company" | "Other"
- key_items: post titles, one per item
- summary: 1-2 sentences on what topics were covered recently`

// ── Jobs ──────────────────────────────────────────────────────────────────────

export const EXTRACT_JOBS_SYSTEM = `You extract job postings from a careers or jobs page.

Return ONLY valid JSON — no markdown, no explanation:
{
  "page_type": "jobs",
  "key_items": ["string"],
  "summary": "string"
}

Rules:
- key_items: one entry per open role as "Job Title - Department" (max 15 roles)
- summary: 1-2 sentences about hiring trends or focus areas`

// ── Generic ───────────────────────────────────────────────────────────────────

export const EXTRACT_GENERIC_SYSTEM = `You extract competitive intelligence from a web page.

Return ONLY valid JSON — no markdown, no explanation:
{
  "page_type": "other",
  "key_items": ["string"],
  "summary": "string"
}

Rules:
- key_items: 3-6 most distinctive or competitively relevant facts on this page
- summary: 1-2 sentences describing what this page is about`
