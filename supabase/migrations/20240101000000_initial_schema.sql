-- Organizations
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

-- Users belong to orgs
create table if not exists org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member',
  created_at timestamptz default now(),
  unique(org_id, user_id)
);

-- Competitors being tracked
create table if not exists competitors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  website text not null,
  logo_url text,
  risk_score integer default 0,
  created_at timestamptz default now()
);

-- Pages being monitored per competitor
create table if not exists tracked_pages (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid references competitors(id) on delete cascade,
  url text not null,
  label text,
  last_crawled_at timestamptz,
  created_at timestamptz default now()
);

-- Snapshots of page content over time
create table if not exists page_snapshots (
  id uuid primary key default gen_random_uuid(),
  tracked_page_id uuid references tracked_pages(id) on delete cascade,
  html_content text,
  text_content text,
  storage_path text,
  crawled_at timestamptz default now()
);

-- Changes detected between snapshots
create table if not exists changes (
  id uuid primary key default gen_random_uuid(),
  tracked_page_id uuid references tracked_pages(id) on delete cascade,
  before_snapshot_id uuid references page_snapshots(id),
  after_snapshot_id uuid references page_snapshots(id),
  diff_html text,
  ai_summary text,
  ai_signal text,
  confidence integer,
  risk_score integer,
  theme text,
  impact_bullets jsonb,
  suggested_actions jsonb,
  detected_at timestamptz default now()
);

-- Watchlists
create table if not exists watchlists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists watchlist_competitors (
  watchlist_id uuid references watchlists(id) on delete cascade,
  competitor_id uuid references competitors(id) on delete cascade,
  primary key (watchlist_id, competitor_id)
);

-- Weekly digests
create table if not exists digests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  week_start date not null,
  content jsonb,
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- RLS: enable on all tables
alter table organizations enable row level security;
alter table org_members enable row level security;
alter table competitors enable row level security;
alter table tracked_pages enable row level security;
alter table page_snapshots enable row level security;
alter table changes enable row level security;
alter table watchlists enable row level security;
alter table watchlist_competitors enable row level security;
alter table digests enable row level security;

-- RLS policies: members can only see their org's data
create policy "org_members can view their org" on organizations
  for select using (
    id in (select org_id from org_members where user_id = auth.uid())
  );

create policy "org members can view competitors" on competitors
  for all using (
    org_id in (select org_id from org_members where user_id = auth.uid())
  );

create policy "org members can view tracked pages" on tracked_pages
  for all using (
    competitor_id in (
      select id from competitors where org_id in (
        select org_id from org_members where user_id = auth.uid()
      )
    )
  );

create policy "org members can view changes" on changes
  for all using (
    tracked_page_id in (
      select id from tracked_pages where competitor_id in (
        select id from competitors where org_id in (
          select org_id from org_members where user_id = auth.uid()
        )
      )
    )
  );

create policy "org members can view digests" on digests
  for all using (
    org_id in (select org_id from org_members where user_id = auth.uid())
  );
