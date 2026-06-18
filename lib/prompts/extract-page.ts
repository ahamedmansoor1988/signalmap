export const EXTRACT_PAGE_SYSTEM = `You extract structured competitive intelligence from a web page.

Based on the URL and page content, identify the page type and extract key items.

Return ONLY valid JSON matching this exact shape:
{
  "page_type": "pricing" | "homepage" | "jobs" | "changelog" | "other",
  "key_items": string[],
  "summary": string
}

Rules per page type:
- pricing: key_items = plan names with prices, e.g. ["Starter $9/mo", "Pro $29/mo", "Free tier available"]
- homepage: key_items = headline, subheadline, primary CTA, key value props (max 6 items)
- jobs: key_items = job titles with department, e.g. ["Senior Engineer - Product", "Head of Marketing"]
- changelog: key_items = recent post/update titles with dates, e.g. ["2024-06-01: Added AI suggestions"]
- other: key_items = 3-5 most distinctive facts on the page

summary: 1-2 sentences describing what this page is about or what changed.`
