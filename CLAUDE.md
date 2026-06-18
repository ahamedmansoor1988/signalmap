# SignalMap — CTO Context

## Project
Competitive intelligence dashboard for PMM and content teams. Visual market map as the WOW feature.

## Key Facts
- Port: 3003 (3000 = Memry, 3001 = Signalz)
- GitHub: https://github.com/ahamedmansoor1988/signalmap.git
- Supabase: https://smmcvglmwrddtyaebwnu.supabase.co
- Deployment: Vercel (auto-deploy from main)

## Rules
- TypeScript strict mode, no `any`
- Server components by default, `use client` only when necessary
- All Anthropic calls go through `/lib/ai.ts` only — never inline
- Model: `claude-sonnet-4-6`
- All AI responses return JSON — strip markdown fences before parsing
- All prompts are named exports in `/lib/prompts/`
- Never commit `.env.local`
- Always update `docs/STATUS.md` at end of session

## Stack
- Next.js 14 App Router
- Supabase (Postgres + Auth + Storage + Realtime)
- Tailwind CSS + shadcn/ui
- Anthropic Claude API via raw fetch ONLY (no LangChain, no Vercel AI SDK)
- Playwright for crawling (Sprint 2)

## Feature Priority
1. Market Map (WOW — done in Sprint 1)
2. Competitor Profile
3. Change Explorer
4. Trend Timeline
5. Battle Room
6. Weekly Digest
7. Theme Workspace
