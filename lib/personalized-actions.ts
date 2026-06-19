import { callClaudeJSON } from '@/lib/ai'
import { buildPersonalizedActionsSystem, GENERIC_ACTIONS_SYSTEM } from '@/lib/prompts/personalized-actions'
import type { TypedAction } from '@/lib/typed-actions'
import type { Database } from '@/lib/supabase/types'

type CompanyProfile = Database['public']['Tables']['company_profiles']['Row']

interface ActionsResult {
  actions: TypedAction[]
}

export async function generateTypedActions(
  profile: CompanyProfile | null,
  competitorName: string,
  context: string
): Promise<TypedAction[]> {
  const companyName = profile?.company_name?.trim()
  const system = companyName
    ? buildPersonalizedActionsSystem(profile!)
    : GENERIC_ACTIONS_SYSTEM

  const result = await callClaudeJSON<ActionsResult>(
    system,
    `Competitor: ${competitorName}\n\n${context}`,
    512
  )
  return Array.isArray(result.actions) ? result.actions : []
}
