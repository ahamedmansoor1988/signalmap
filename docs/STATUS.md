# SignalMap — Sprint Status

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

### .env.local — keys needed before full pipeline works
```
NEXT_PUBLIC_SUPABASE_URL=https://smmcvglmwrddtyaebwnu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase dashboard → Project Settings → API>
SUPABASE_SERVICE_ROLE_KEY=<Supabase dashboard → Project Settings → API>
ANTHROPIC_API_KEY=<console.anthropic.com>
CRON_SECRET=<any random string, e.g. openssl rand -hex 32>
```

### DB Migration — run this before testing
Paste `supabase/migrations/20240101000000_initial_schema.sql` into the Supabase SQL editor.
Then enable Google OAuth in Supabase Auth → Providers → Google.

### How the data pipeline works
1. User adds competitor + pages in `/settings`
2. Cron hits `/api/cron` every 24h with `Authorization: Bearer <CRON_SECRET>`
3. For each tracked page: crawl → snapshot → diff against previous → Claude analysis → store change
4. Changes appear in `/changes` and competitor risk scores update on the Market Map

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

## Sprint 3 — TODO

### Priority Order
1. **Weekly Digest** (`/digest`) — generate AI briefing from the week's changes, send to Slack
2. **Trend Timeline** — chart theme activity across competitors over time
3. **Battle Room** — head-to-head comparison page
4. **Realtime map updates** — Supabase Realtime subscription so map nodes pulse when new changes detected
5. **Manual crawl trigger** — button in settings to trigger a crawl immediately (no waiting for cron)
6. **Slack webhook** — `/api/webhooks/slack` for digest delivery

---

## Architecture Decisions

### Why Canvas API for Market Map?
No D3.js or react-force-graph — a raw Canvas 2D API with spring physics gives full visual control, 60fps, zero dependencies.

### Why shadcn v4 + Base UI?
shadcn CLI now scaffolds with @base-ui/react. CSS normalized to hsl() for Tailwind v3 compatibility.

### Why raw fetch for Anthropic?
Per spec. All calls in lib/ai.ts — thin wrapper, strips fences, returns parsed JSON.

### Crawler fallback strategy
playwright-core is used when the binary is available (local dev). Falls back to fetch() for Vercel serverless where binary can't be bundled. For production Playwright support on Vercel, use @sparticuz/chromium-min.

### Supabase TypeScript types
Hand-written types with full Relationships arrays (matching supabase gen types format) to enable proper TypeScript inference for the Supabase JS client. Zero any casts in production code paths.
