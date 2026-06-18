-- Fix: org_members had RLS enabled with no policies — all reads returned empty.
-- This caused org creation to always re-attempt and fail on the organizations INSERT.

-- Allow users to read their own org memberships
create policy "users can view own memberships" on org_members
  for select using (user_id = auth.uid());

-- Allow authenticated users to insert themselves as org members
-- (actual insert is done server-side via service role, but this covers client-side flows)
create policy "users can insert own membership" on org_members
  for insert with check (user_id = auth.uid());

-- Allow org admins to read all members of their org
create policy "org admins can view all members" on org_members
  for select using (
    org_id in (select org_id from org_members where user_id = auth.uid())
  );
