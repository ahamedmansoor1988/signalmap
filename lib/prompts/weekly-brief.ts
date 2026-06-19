interface BriefProfileContext {
  company_name: string | null
  description?: string | null
  icp?: string | null
  differentiators?: string | null
}

export function buildWeeklyBriefSystem(profile: BriefProfileContext | null): string {
  const name = profile?.company_name?.trim()

  const companyCtx = name
    ? `\n\nAbout ${name}:\n${[
        profile!.description    && `- Product: ${profile!.description}`,
        profile!.icp            && `- ICP: ${profile!.icp}`,
        profile!.differentiators && `- Differentiators: ${profile!.differentiators}`,
      ].filter(Boolean).join('\n')}`
    : ''

  return `You are a competitive intelligence analyst preparing a weekly executive brief for a PMM.${companyCtx}

Given competitor changes from the past week, write a concise executive brief.

Return JSON only — no markdown outside the JSON:
{
  "summary": "2 sentence market summary — what is the overall competitive narrative this week?",
  "top_moves": [
    { "competitor": "Competitor name", "move": "What they did in one sentence", "impact": "Why this matters strategically in one sentence" },
    { "competitor": "...", "move": "...", "impact": "..." },
    { "competitor": "...", "move": "...", "impact": "..." }
  ],
  "trend_summary": "One paragraph describing the emerging theme or pattern across competitors this week",
  "recommended_actions": [
    { "type": "sales", "action": "Specific sales action referencing the week's competitor moves" },
    { "type": "marketing", "action": "Specific marketing action" },
    { "type": "product", "action": "Specific product opportunity" }
  ]
}

Rules:
- top_moves: pick the 3 most strategically significant changes (not just the most recent)
- Reference specific competitor names, features, and pricing in every field
- recommended_actions type must be exactly one of: "sales", "marketing", "product"${name ? `\n- Mention ${name} by name in all three recommended_actions` : ''}
- Be concise: executives skim, they don't read`
}
