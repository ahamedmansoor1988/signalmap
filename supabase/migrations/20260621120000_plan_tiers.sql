-- Update plan constraint to include new tier names
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_plan_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_plan_check
  CHECK (plan = ANY (ARRAY['starter','pro','business','elite','growth','scale']));

-- Set correct competitor limits per plan for any existing orgs
UPDATE public.organizations SET competitor_limit = 5   WHERE plan = 'starter';
UPDATE public.organizations SET competitor_limit = 10  WHERE plan = 'pro';
UPDATE public.organizations SET competitor_limit = 20  WHERE plan = 'business';
UPDATE public.organizations SET competitor_limit = 9999 WHERE plan = 'elite';

-- Update new-org default to starter (5 competitors)
ALTER TABLE public.organizations
  ALTER COLUMN plan SET DEFAULT 'starter',
  ALTER COLUMN competitor_limit SET DEFAULT 5;

-- Recreate trigger function: elite plan bypasses limit check
CREATE OR REPLACE FUNCTION public.check_competitor_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_plan text;
  v_limit int;
  v_count int;
BEGIN
  SELECT plan, competitor_limit
    INTO v_plan, v_limit
    FROM public.organizations
   WHERE id = NEW.org_id;

  -- elite has unlimited access
  IF v_plan = 'elite' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.competitors
   WHERE org_id = NEW.org_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Competitor limit reached for this organization plan';
  END IF;

  RETURN NEW;
END;
$$;
