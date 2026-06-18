-- Structured daily snapshots per page (parsed JSON extracted from crawled content)
create table if not exists competitor_snapshots (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid references competitors(id) on delete cascade,
  tracked_page_id uuid references tracked_pages(id) on delete cascade,
  snapshot_date date not null default current_date,
  page_type text not null default 'other', -- 'pricing' | 'homepage' | 'jobs' | 'changelog' | 'other'
  raw_text text,
  parsed_data jsonb,
  created_at timestamptz default now(),
  unique(tracked_page_id, snapshot_date)
);

-- Individual diffs between consecutive snapshots
create table if not exists competitor_diffs (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid references competitors(id) on delete cascade,
  tracked_page_id uuid references tracked_pages(id) on delete cascade,
  change_type text not null default 'Product', -- 'Pricing' | 'Messaging' | 'Product' | 'Hiring'
  detected_at timestamptz default now(),
  summary text,
  old_value jsonb,
  new_value jsonb
);

-- Daily risk score breakdown per competitor
create table if not exists risk_score_history (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid references competitors(id) on delete cascade,
  scored_at date not null default current_date,
  product_velocity integer default 0,
  messaging_overlap integer default 0,
  market_reach integer default 0,
  total integer default 0,
  unique(competitor_id, scored_at)
);

alter table competitor_snapshots enable row level security;
alter table competitor_diffs enable row level security;
alter table risk_score_history enable row level security;

create policy "org members can access competitor snapshots" on competitor_snapshots
  for all using (
    competitor_id in (
      select id from competitors where org_id in (
        select org_id from org_members where user_id = auth.uid()
      )
    )
  );

create policy "org members can access competitor diffs" on competitor_diffs
  for all using (
    competitor_id in (
      select id from competitors where org_id in (
        select org_id from org_members where user_id = auth.uid()
      )
    )
  );

create policy "org members can access risk score history" on risk_score_history
  for all using (
    competitor_id in (
      select id from competitors where org_id in (
        select org_id from org_members where user_id = auth.uid()
      )
    )
  );
