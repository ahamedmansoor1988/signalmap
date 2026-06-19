export type Theme = 'AI Features' | 'Pricing' | 'Enterprise' | 'GTM' | 'Content'

export interface MockCompetitor {
  id: string
  name: string
  website: string
  risk_score: number
  theme: Theme
  last_signal: string
  signals_count: number
  description: string
  ai_summary?: string
  suggested_actions?: string[]
}

export const THEME_CONFIG: Record<Theme, { color: string; glow: string; bg: string; label: string }> = {
  'AI Features': {
    color: '#8b5cf6',
    glow: 'rgba(139, 92, 246, 0.4)',
    bg: 'rgba(139, 92, 246, 0.08)',
    label: 'AI Features',
  },
  'Pricing': {
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.4)',
    bg: 'rgba(245, 158, 11, 0.08)',
    label: 'Pricing',
  },
  'Enterprise': {
    color: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.4)',
    bg: 'rgba(59, 130, 246, 0.08)',
    label: 'Enterprise',
  },
  'GTM': {
    color: '#10b981',
    glow: 'rgba(16, 185, 129, 0.4)',
    bg: 'rgba(16, 185, 129, 0.08)',
    label: 'GTM Motion',
  },
  'Content': {
    color: '#f43f5e',
    glow: 'rgba(244, 63, 94, 0.4)',
    bg: 'rgba(244, 63, 94, 0.08)',
    label: 'Content',
  },
}

export const MOCK_COMPETITORS: MockCompetitor[] = [
  {
    id: '1',
    name: 'Crayon',
    website: 'crayon.co',
    risk_score: 87,
    theme: 'AI Features',
    last_signal: 'Launched AI-generated battlecard summaries',
    signals_count: 14,
    description: 'Doubled down on AI summarization for sales enablement',
  },
  {
    id: '2',
    name: 'Klue',
    website: 'klue.com',
    risk_score: 72,
    theme: 'Enterprise',
    last_signal: 'New SOC2 Type II badge on homepage',
    signals_count: 9,
    description: 'Enterprise compliance push targeting Fortune 500',
  },
  {
    id: '3',
    name: 'Kompyte',
    website: 'kompyte.com',
    risk_score: 58,
    theme: 'AI Features',
    last_signal: 'Auto-updating competitive profiles with AI',
    signals_count: 7,
    description: 'AI-first approach to competitive monitoring',
  },
  {
    id: '4',
    name: 'G2',
    website: 'g2.com',
    risk_score: 45,
    theme: 'Content',
    last_signal: 'Comparison page redesign targeting us',
    signals_count: 11,
    description: 'Heavy content moat around review comparisons',
  },
  {
    id: '5',
    name: 'Semrush',
    website: 'semrush.com',
    risk_score: 63,
    theme: 'GTM',
    last_signal: 'Launched competitive intelligence add-on',
    signals_count: 8,
    description: 'Expanding into CI from SEO tooling adjacency',
  },
  {
    id: '6',
    name: 'Ahrefs',
    website: 'ahrefs.com',
    risk_score: 41,
    theme: 'Content',
    last_signal: 'New CI features in Site Explorer',
    signals_count: 5,
    description: 'Content gap analysis encroaching on CI space',
  },
  {
    id: '7',
    name: 'Bombora',
    website: 'bombora.com',
    risk_score: 55,
    theme: 'Enterprise',
    last_signal: 'Intent data integration partnerships',
    signals_count: 6,
    description: 'B2B intent data for enterprise sales teams',
  },
  {
    id: '8',
    name: 'Gong',
    website: 'gong.io',
    risk_score: 78,
    theme: 'AI Features',
    last_signal: 'Competitive insights from call recordings',
    signals_count: 12,
    description: 'Revenue intelligence with embedded CI features',
  },
  {
    id: '9',
    name: 'Highspot',
    website: 'highspot.com',
    risk_score: 67,
    theme: 'GTM',
    last_signal: 'Battlecard authoring AI feature launch',
    signals_count: 9,
    description: 'Sales enablement platform adding CI workflows',
  },
  {
    id: '10',
    name: 'Seismic',
    website: 'seismic.com',
    risk_score: 52,
    theme: 'GTM',
    last_signal: 'Competitive analysis templates in LiveDocs',
    signals_count: 7,
    description: 'Enterprise sales content platform expanding CI',
  },
  {
    id: '11',
    name: 'Apollo',
    website: 'apollo.io',
    risk_score: 44,
    theme: 'Pricing',
    last_signal: 'Dropped pricing by 30% for startup tier',
    signals_count: 4,
    description: 'Aggressive pricing to capture SMB market',
  },
  {
    id: '12',
    name: 'ZoomInfo',
    website: 'zoominfo.com',
    risk_score: 71,
    theme: 'Pricing',
    last_signal: 'New usage-based pricing model announced',
    signals_count: 8,
    description: 'Shifting to consumption pricing across suite',
  },
]
