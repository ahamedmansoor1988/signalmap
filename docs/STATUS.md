# SignalMap — Sprint Status

## Sprint 3 — COMPLETE ✅
**Date:** 2026-06-18

### Completed
- [x] **Light theme** — removed dark mode, bg-gray-50 base, white cards, gray text throughout all pages and components
- [x] **AI Onboarding** — poll-style competitor selection: describe product → Groq suggests 12 competitors → toggle-card grid → bulk add. "Suggest more" (appends new cards, excludes already shown) + "Add your own" inline form
- [x] **Auth callback** — redirects to /onboarding if no org membership, else /map
- [x] **Org creation RLS fix** — SECURITY DEFINER RPC `create_user_org` bypasses recursive org_members policy (42P17). Dropped self-referencing SELECT policy.
- [x] **Middleware fix** — /api/ routes excluded from auth middleware matcher so cron can be called without session cookie
- [x] **Market Map fixes** — themes spread by index (no more all-in-one-cluster), physics stops after 250 ticks, light canvas background
- [x] **Historical tracking migration** — 3 new tables: `competitor_snapshots`, `competitor_diffs`, `risk_score_history` with RLS
- [x] **Structured extraction** (`lib/extractor.ts`) — `extractPageData()` calls Groq to pull key_items from page content by type (pricing plans, headlines, job titles, changelog entries). `diffParsedPages()` compares key_items arrays. `calculateRiskScores()` scores product_velocity / messaging_overlap / market_reach from 30-day diff window
- [x] **Cron v3** — extraction only runs on changed pages (not every page), 2s inter-page sleep to stay under Groq 12k TPM. Baseline extraction for pages with no prior structured snapshot
- [x] **Activity Timeline** (`components/competitor/activity-timeline.tsx`) — groups competitor_diffs into This Week / This Month / This Quarter with colored change-type icons
- [x] **Risk Sparkline** (`components/competitor/risk-sparkline.tsx`) — SVG polyline from risk_score_history with trend arrow
- [x] **Competitor Profile rewrite** — 4-stat header, Activity Timeline + Risk Breakdown grid, per-metric sparklines, 30d total sparkline, Monitored Pages section, AI Signals feed
- [x] **Groq rate limit fix** — structured extraction skipped for no_changes pages that already have a baseline; one-time baseline extraction on first encounter
- [x] **All 12 competitors baselined** — 23 competitor_snapshots rows across 12 competitors (Desk.com/pricing excluded — permanent 403)

### DB Migrations run
- `supabase/migrations/20240101000000_initial_schema.sql` — original schema
- `supabase/migrations/20240104000000_historical_tracking.sql` — competitor_snapshots, competitor_diffs, risk_score_history

### Cron status
- Runs daily at 8am UTC via `vercel.json`
- Manual trigger: `curl -H "Authorization: Bearer <CRON_SECRET>" https://signalmap-sigma.vercel.app/api/cron`
- First real diffs will appear tomorrow (compares today's baselines vs tomorrow's crawl)
- Desk.com/pricing (`tracked_page id: 5f4a5da2`) is a permanent 403 — safe to delete from tracked_pages to save a cron slot

### How the data pipeline works (v3)
1. Cron crawls each tracked page (20/run, ordered by oldest last_crawled_at)
2. Compares raw text against previous page_snapshot — if no changes, skip AI (0 tokens)
3. If first snapshot: extract structured baseline via Groq → store in competitor_snapshots
4. If no_changes but no baseline yet: extract baseline once, then skip forever
5. If changes: extract → diff against yesterday's competitor_snapshot → store competitor_diff → AI summarize → store change record
6. After all pages: calculate risk scores from 30-day diff window → upsert risk_score_history

---

## Sprint 2 — COMPLETE ✅
**Date:** 2026-06-18

### Completed
- [x] **Add Competitor form** — settings page with name + website + tracked URLs, saves to Supabase
- [x] **Competitor list** — shows all tracked competitors with risk badge, delete, links to profile
- [x] **Auto org creation** — first-time user automatically gets a personal org on settings visit
- [x] **Market Map wired to DB** — loads real competitors from Supabase, falls back to 12 mock competitors when DB is empty. "Demo data" banner with link to Settings when showing mock data.
- [x] **Playwright crawler** (`lib/crawler.ts`) — uses playwright-core with graceful fallback to fetch for serverless environments
- [x] **Diff engine** (`lib/diff.ts`) — line-by-line Myers diff using `diff` package, returns added/removed lines + HTML diff markup
- [x] **`/api/crawl`** — crawls a tracked page, stores snapshot, returns snapshot IDs for diffing
- [x] **`/api/diff`** — takes two snapshot IDs, computes diff, calls Claude for AI analysis, stores change record, updates competitor risk score
- [x] **`/api/cron`** — full crawl-and-diff pipeline, processes 20 pages per run, protected by CRON_SECRET
- [x] **`vercel.json`** — cron schedule set to 8am UTC daily
- [x] **Change Explorer** (`/changes`) — lists all detected changes with AI signal, theme badge, risk score
- [x] **Change Detail** (`/changes/[id]`) — full view with signal, AI summary, impact bullets, suggested actions, risk score bar, HTML diff
- [x] **Competitor Profile** (`/competitor/[id]`) — stats, monitored pages with last crawl time, full activity feed
- [x] **Competitors list** (`/competitor`) — all competitors with risk levels, links to profiles
- [x] **TypeScript types fixed** — added `Relationships` arrays to all tables, `CompositeTypes` to schema. Zero type errors.
- [x] Zero compile errors, dev server clean on port 3003

---

## Sprint 1 — COMPLETE ✅
**Date:** 2026-06-18

### Completed
- [x] Next.js 14 App Router + TypeScript strict mode + Tailwind CSS + shadcn/ui
- [x] Full folder structure per spec
- [x] Supabase browser/server clients with typed schema
- [x] Auth: Google OAuth + magic link with middleware protection
- [x] DB migration SQL with RLS for all 9 tables
- [x] Market Map canvas — force-directed physics, 12 mock competitors, 5 theme clusters, click drawer
- [x] AI layer: `lib/ai.ts` + all 5 prompts
- [x] API routes stubbed
- [x] Dashboard nav sidebar
- [x] Dev server on port 3003

---

## Sprint 4 — TODO

### Priority Order
1. **Weekly Digest** (`/digest`) — generate AI briefing from the week's changes, send to Slack
2. **Trend Timeline** — chart theme activity across competitors over time
3. **Battle Room** — head-to-head comparison page
4. **Realtime map updates** — Supabase Realtime subscription so map nodes pulse when new changes detected
5. **Manual crawl trigger** — button in settings to trigger a crawl immediately
6. **Slack webhook** — `/api/webhooks/slack` for digest delivery
7. **Remove Desk.com/pricing** from tracked_pages (permanent 403, wastes cron slot)

---

## Architecture Decisions

### Why Canvas API for Market Map?
No D3.js or react-force-graph — a raw Canvas 2D API with spring physics gives full visual control, 60fps, zero dependencies.

### Why raw fetch for Groq?
Per spec. All calls in lib/ai.ts — thin wrapper, strips fences, returns parsed JSON. Model: llama-3.3-70b-versatile.

### Crawler fallback strategy
playwright-core is used when the binary is available (local dev). Falls back to fetch() for Vercel serverless where binary can't be bundled.

### Supabase TypeScript types
Hand-written types with full Relationships arrays (matching supabase gen types format) to enable proper TypeScript inference. Zero any casts in production code paths.

### Cron token budget (Groq free tier: 12k TPM)
- no_changes pages with existing baseline: 0 tokens
- first_snapshot or no_changes without baseline: ~800 tokens (extraction only)
- change_detected: ~1,600 tokens (extraction + summarize)
- 2s inter-page sleep spreads burst usage across the TPM window
