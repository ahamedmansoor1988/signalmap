-- Personal workspaces make each member's SignalMap account useful while keeping
-- commercial packaging organization-based and tied to monitored competitors.

alter table organizations
  add column if not exists plan text not null default 'starter'
    check (plan in ('starter', 'growth', 'scale')),
  add column if not exists competitor_limit integer not null default 15
    check (competitor_limit > 0);

create table if not exists member_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  display_name text,
  role_view text not null default 'all'
    check (role_view in ('all', 'sales', 'marketing', 'product', 'leadership')),
  browser_notifications boolean not null default true,
  action_notifications boolean not null default true,
  digest_frequency text not null default 'weekly'
    check (digest_frequency in ('daily', 'weekly', 'off')),
  minimum_risk integer not null default 0
    check (minimum_risk between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table if not exists action_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  change_id uuid references changes(id) on delete cascade,
  action_index integer not null default 0,
  action_type text not null default 'general'
    check (action_type in ('sales', 'marketing', 'product', 'general')),
  title text not null,
  assignee_user_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'done', 'dismissed')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, change_id, action_index)
);

create table if not exists signal_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  change_id uuid not null references changes(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, change_id)
);

create table if not exists organization_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists action_tasks_assignee_status_idx
  on action_tasks (assignee_user_id, status, created_at desc);

create or replace function enforce_competitor_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  current_count integer;
  allowed_count integer;
begin
  select competitor_limit into allowed_count from organizations where id = new.org_id;
  select count(*) into current_count from competitors where org_id = new.org_id;
  if current_count >= coalesce(allowed_count, 15) then
    raise exception 'Competitor limit reached for this organization plan';
  end if;
  return new;
end;
$$;

drop trigger if exists competitors_enforce_plan_limit on competitors;
create trigger competitors_enforce_plan_limit
  before insert on competitors for each row execute function enforce_competitor_limit();

create or replace function enforce_action_assignee_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_user_id is not null and not exists (
    select 1 from org_members
    where org_id = new.org_id and user_id = new.assignee_user_id
  ) then
    raise exception 'Action assignee must belong to the organization';
  end if;
  return new;
end;
$$;

drop trigger if exists action_tasks_enforce_assignee on action_tasks;
create trigger action_tasks_enforce_assignee
  before insert or update of assignee_user_id on action_tasks
  for each row execute function enforce_action_assignee_membership();

alter table member_preferences enable row level security;
alter table action_tasks enable row level security;
alter table signal_reads enable row level security;
alter table organization_invites enable row level security;

create policy "members can view org preferences" on member_preferences
  for select using (
    org_id in (select org_id from org_members where user_id = auth.uid())
  );

create policy "users can manage own preferences" on member_preferences
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and org_id in (select org_id from org_members where user_id = auth.uid())
  );

create policy "members can view org action tasks" on action_tasks
  for select using (
    org_id in (select org_id from org_members where user_id = auth.uid())
  );

create policy "members can create org action tasks" on action_tasks
  for insert with check (
    created_by = auth.uid()
    and org_id in (select org_id from org_members where user_id = auth.uid())
  );

create policy "assignees and creators can update action tasks" on action_tasks
  for update using (
    assignee_user_id = auth.uid()
    or created_by = auth.uid()
    or org_id in (
      select org_id from org_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "users can manage own signal reads" on signal_reads
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "admins can manage organization invites" on organization_invites
  for all using (
    org_id in (select org_id from org_members where user_id = auth.uid() and role = 'admin')
  )
  with check (
    invited_by = auth.uid()
    and org_id in (select org_id from org_members where user_id = auth.uid() and role = 'admin')
  );
