# SignalMap — Sprint Status

## Sprint 1 — COMPLETE ✅
**Date:** 2026-06-18

### Completed
- [x] Next.js 14 App Router + TypeScript strict mode + Tailwind CSS + shadcn/ui
- [x] Full folder structure per spec (app routes, components, lib, docs, supabase)
- [x] Supabase client configured: browser client (`lib/supabase/client.ts`) and server client (`lib/supabase/server.ts`)
- [x] Full TypeScript types for all DB tables (`lib/supabase/types.ts`)
- [x] Auth: Google OAuth + magic link via Supabase (`app/(auth)/login/page.tsx`)
- [x] Auth middleware protecting all dashboard routes, redirects to /login
- [x] Auth callback route at `/auth/callback`
- [x] DB migration SQL for all tables with RLS (`supabase/migrations/20240101000000_initial_schema.sql`)
- [x] Market Map canvas — force-directed physics simulation, animated cluster formation
  - 12 mock competitors across 5 themes
  - Nodes sized by risk score
  - Theme clusters with radial gradient halos + color-coded labels
  - Click node → right drawer (CompetitorDrawer) with risk score, signals, strategic summary
  - Search filter + theme filter buttons
  - Replay animation button
- [x] AI layer: `lib/ai.ts` — all Anthropic calls centralized, JSON parsing with fence stripping
- [x] All 5 prompts: summarize, classify, diff, risk-score, digest
- [x] API routes stubbed: `/api/crawl`, `/api/summarize`, `/api/diff`, `/api/digest`
- [x] Dashboard nav sidebar with all routes
- [x] Dev server running on port 3003 with no errors
- [x] `.env.local` in gitignore

### What's in .env.local (needs real values)
```
NEXT_PUBLIC_SUPABASE_URL=https://smmcvglmwrddtyaebwnu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<fill in from Supabase dashboard>
SUPABASE_SERVICE_ROLE_KEY=<fill in from Supabase dashboard>
ANTHROPIC_API_KEY=<fill in>
```

### Known Issues / Blockers
- Supabase keys need to be filled in `.env.local` before auth works end-to-end
- DB migration needs to be run against the Supabase project manually:
  `npx supabase db push` or copy SQL from `supabase/migrations/` into Supabase SQL editor
- Google OAuth provider must be configured in Supabase dashboard
- Market Map uses mock data; real data wiring is Sprint 2

---

## Sprint 2 — TODO

### Priority Order
1. **DB + Auth end-to-end**: Fill .env.local keys, run migration, test Google OAuth
2. **Real competitor data**: Add competitor form → `/app/(dashboard)/settings/page.tsx`
   - Form: name, website, tracked URLs
   - Save to Supabase `competitors` + `tracked_pages`
   - Load from DB on Market Map (replace mock data)
3. **Crawler**: Implement `lib/crawler.ts` with Playwright
   - Crawl tracked pages, store snapshots in Supabase Storage
   - Cron job via API route + Vercel cron
4. **Change detection**: `lib/diff.ts` + `/api/diff` 
   - Compare latest two snapshots
   - Run through AI summarize prompt
   - Store in `changes` table
5. **Competitor Profile drawer**: Wire real data from DB
6. **Change Explorer page**: List of changes with before/after diff view
7. **Realtime**: Supabase Realtime for live map updates when new changes detected

---

## Architecture Decisions

### Why Canvas API for Market Map?
D3.js or react-force-graph add significant bundle weight and complex abstractions. A raw Canvas 2D API with a simple spring physics simulation gives full visual control, 60fps performance, and zero dependencies. The physics runs in requestAnimationFrame — no external physics engine needed.

### Why shadcn v4 + Base UI?
The project was initialized with the latest shadcn CLI which now uses `@base-ui/react` instead of Radix UI. The API is similar enough to not require component rewrites. CSS was normalized to use hsl() variables instead of oklch() for Tailwind v3 compatibility.

### Why raw fetch for Anthropic?
Per spec — no LangChain, no Vercel AI SDK. All calls go through `lib/ai.ts` which is a thin wrapper: builds the request, calls the API, strips markdown fences, returns parsed JSON.
