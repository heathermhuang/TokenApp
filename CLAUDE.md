# token.app

AI model pricing tracker and comparison tool built on Cloudflare Workers with Hono. Data sourced from OpenRouter API. Deployed at https://token.app (custom domain) and https://token-app.measurable.workers.dev.

## Stack
- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Storage**: Cloudflare KV (`TOKEN_APP_KV`)
- **Data**: OpenRouter `/api/v1/models` (JSON) + `/rankings` (RSC payload scraping)
- **Secrets**: `REFRESH_SECRET` via `wrangler secret put`

## Key files
- `src/index.ts` — Hono routes (API + SSR page)
- `src/template.ts` — Full HTML/CSS/JS template (SSR, single-file SPA)
- `src/fetchers.ts` — OpenRouter data fetching, normalization, KV read/write
- `src/subscriptions.ts` — Static subscription plan data
- `src/types.ts` — All TypeScript interfaces
- `src/providers.ts` — Provider metadata (colors, display names)

## Dev
- `npx wrangler dev --port 8799` — local dev server
- `npx wrangler deploy` — deploy to production
- Cron runs hourly (`0 * * * *`) to refresh model + rankings data
- Manual refresh: `POST /api/refresh` with `Authorization: Bearer <REFRESH_SECRET>`
- `wrangler.toml` is gitignored (contains KV namespace IDs)

## Gotchas
- **RSC double-escaping**: OpenRouter `/rankings` RSC payload uses `\\"` when fetched server-side vs `\"` locally. Parsers must normalize before extracting JSON.
- **Template literal escaping**: Model descriptions can contain backticks and `${` — use `safeLiteral()` before embedding in template.ts.
- **`\'` is invalid in JS template literals**: backslash is silently ignored for single quotes. Use `this.hidden=true` instead of `this.style.display='none'` in inline handlers.

## Current Work
- **Last updated**: 2026-04-16
- **What shipped this session**: nothing committed — `/usage` dashboard built end-to-end but sitting uncommitted
- **Uncommitted changes**:
  - `src/usage-prompts.ts` (new) — 4 copy-paste prompts that make any LLM emit `tokenapp.usage.v1` JSON fenced in ` ```tokenapp-usage `
  - `src/usage-schema.ts` (new) — dependency-free parser: `extractFenceOrBareJson`, `normalizeModelId`, `parseUsagePaste`, `eventFingerprint` (dedupe)
  - `src/usage-pricer.ts` (new) — `buildDashboard`: totals, spendOverTime, byModel/byProvider, subscription breakeven (≥7 days extrapolated), cheaper equivalents
  - `src/usage-template.ts` (new) — full `/usage` page HTML (prompt modal + paste box + KPI cards + SVG spend chart + tables), client-side localStorage only
  - `src/types.ts` — added `UsageEvent`, `UsageExport`, `UsageStore`
  - `src/index.ts` — registered `GET /usage`, added to sitemap.xml + llms.txt
- **Verified**: wrangler dev on :8799 returned HTTP 200, headless node test parsed + priced 6 sample events (total $2.478), subBreakeven + cheaperEquivalents rendered correctly
- **Known issue**: `claude-sonnet-4-5` returns null from `findModel` in `usage-pricer.ts` — shows up in `unmatchedModels`. Likely a canonical-id mismatch vs the OpenRouter price table. Small fix in `normalizeModelId` or `findModel` fallbacks.
- **Next steps (prioritized)**:
  1. **P0 — ship `/usage`**: fix the `claude-sonnet-4-5` match, commit the 6 files, deploy. Add entry link from homepage hero + `/subscriptions`.
  2. **P1 — cross-linking**: byModel rows → `/models/{provider}/{slug}`; subBreakeven rows → `/subscriptions`; "Load my usage" button on `/models` reading localStorage.
  3. **P1 — forecasting on `/usage`**: month-end projection + "switch model X → Y" slider that recomputes projected cost client-side.
  4. **P1 — landing: "Best coding agent by cost"** (Cursor / Claude Code / Codex / Aider) — high SEO intent, showcases `/usage`.
  5. **P2 — `/usage` polish**: calendar heatmap, `taskContext` / `sessionId` grouping, per-provider export guides with screenshots.
  6. **P3 carry-over**: model leaderboard click-throughs to OpenRouter pages; rank-delta arrows if OR exposes deltas.
- **Skip**: benchmark overlays (needs server submission — breaks no-accounts posture), image/receipt import (expensive, prompt flow covers it).
