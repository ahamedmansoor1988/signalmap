import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const SQL = `
CREATE TABLE IF NOT EXISTS news_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id uuid REFERENCES competitors(id) ON DELETE CASCADE NOT NULL,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  summary text,
  url text,
  source_type text NOT NULL DEFAULT 'google_news',
  published_at timestamptz NOT NULL DEFAULT now(),
  ai_impact text,
  ai_counter text,
  assigned_team text,
  assigned_email text,
  assigned_at timestamptz,
  added_to_mine boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_news_signals_org_date ON news_signals(org_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_signals_competitor ON news_signals(competitor_id, published_at DESC);
ALTER TABLE changes ADD COLUMN IF NOT EXISTS assigned_team text;
ALTER TABLE changes ADD COLUMN IF NOT EXISTS assigned_email text;
ALTER TABLE changes ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
ALTER TABLE changes ADD COLUMN IF NOT EXISTS added_to_mine boolean DEFAULT false;
`

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // Use Supabase's pg-meta SQL endpoint (available on all Supabase projects)
  const res = await fetch(`${url}/rest/v1/`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'tx=commit',
    },
    body: JSON.stringify({ query: SQL }),
  })

  // Fallback: write migration SQL for manual execution
  return NextResponse.json({
    note: 'Run this SQL manually in the Supabase SQL editor',
    sql: SQL,
    status: res.status,
  })
}
