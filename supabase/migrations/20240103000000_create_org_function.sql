-- Drop the incomplete INSERT policy that didn't work
DROP POLICY IF EXISTS "authenticated users can create orgs" ON organizations;

-- SECURITY DEFINER function: creates org + member atomically, bypassing RLS.
-- Called from server components via supabase.rpc() — never exposed client-side.
CREATE OR REPLACE FUNCTION create_user_org(
  p_user_id uuid,
  p_name text,
  p_slug text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  INSERT INTO organizations (name, slug)
  VALUES (p_name, p_slug)
  RETURNING id INTO v_org_id;

  INSERT INTO org_members (org_id, user_id, role)
  VALUES (v_org_id, p_user_id, 'admin');

  RETURN v_org_id;
END;
$$;
