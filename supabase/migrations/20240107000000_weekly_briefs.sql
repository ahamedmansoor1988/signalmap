CREATE TABLE weekly_briefs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  week_start          DATE        NOT NULL,
  summary             TEXT,
  top_moves           JSONB,
  trend_summary       TEXT,
  recommended_actions JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, week_start)
);

ALTER TABLE weekly_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members manage own weekly briefs"
  ON weekly_briefs
  FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );
