CREATE TABLE company_profiles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_name   TEXT,
  description    TEXT,
  icp            TEXT,
  pricing_model  TEXT,
  differentiators TEXT,
  website_url    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id)
);

ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;

-- Org members can read and write only their own org's profile
CREATE POLICY "org members manage own company profile"
  ON company_profiles
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
