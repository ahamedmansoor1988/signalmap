-- Brand intelligence: store extracted product names and brand profile
ALTER TABLE public.competitors
  ADD COLUMN IF NOT EXISTS product_names  text[]  DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS brand_metadata jsonb   DEFAULT '{}'::jsonb;

-- Sitemap discovery: track how a page was found and its type
ALTER TABLE public.tracked_pages
  ADD COLUMN IF NOT EXISTS page_type       text,
  ADD COLUMN IF NOT EXISTS auto_discovered boolean DEFAULT false;

-- Index for fast product_names search (GIN for array contains)
CREATE INDEX IF NOT EXISTS idx_competitors_product_names
  ON public.competitors USING GIN (product_names);
