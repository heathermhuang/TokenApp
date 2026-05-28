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
- **OpenRouter /rankings is JS-rendered now**: the SSR HTML no longer contains ranking data (turbopack Next.js app). `fetchRankingsFromOpenRouter()` uses the Cloudflare Browser Rendering binding via `@cloudflare/puppeteer`. Stable selector: `[data-testid="model-rankings-leaderboard-row"]` for models; Top Apps section has no testid (fallback to innerText regex). Requires `[browser]` binding in `wrangler.toml` and Workers Paid plan.
- **OpenRouter /rankings has NO period toggle**: the "This Week" / "Today" buttons in the new UI are model-search comboboxes, not period selectors. Models are fixed at 7-day rolling; apps are today-only. Don't try to click them to switch periods — won't work and silently produces duplicate data. To support UI 24H/7D/30D toggle, we accumulate hourly snapshots in D1 and aggregate over windows ourselves.
- **D1 rankings history**: append-only `rankings_snapshots` table (`migrations/0001_*.sql`). Cron writes ~30 rows/hour. Read paths: `readLatestModels(env, 'week')` for any UI period (models don't change with toggle); `readLatestApps(env)` for day, `aggregateApps(env, days)` for week/month. Aggregation takes LAST snapshot per identifier per day then SUMs across days.
- **Week/month aggregations are gated behind real history**: `getRankings(env, 'week'|'month')` calls `countAppDaysInRange()` first and returns `topApps[period]=[]` plus `appsHistoryDays/appsHistoryRequired` when fewer than N distinct calendar days of snapshots exist. Without this gate, a 1-day SUM gets labelled "7D" and looks identical to 24H — the "fake rankings" bug from 2026-05-28. Client (`emptyAppsMessage()` in `template.ts`) renders "X/Y days of history collected" so users see why the panel is empty. Real data lights up automatically as snapshots accumulate.
- **Empty-overwrite guard**: `refreshAllData` refuses to record a snapshot when scraping yields 0 models AND 0 apps. Stops silent cache poisoning if OpenRouter's UI changes again — keeps last-good D1 data and surfaces `rankingsError` instead.
- **`[]` is truthy in JS**: `appsData.week || appsData.day` returns the empty `.week` array, not `.day`. The rankings UI fallback checks `byPeriod.length > 0` instead. Worth remembering for any future period-keyed shape.
- **Template literal escaping**: Model descriptions can contain backticks and `${` — use `safeLiteral()` before embedding in template.ts.
- **`\'` is invalid in JS template literals**: backslash is silently ignored for single quotes. Use `this.hidden=true` instead of `this.style.display='none'` in inline handlers.

## Current Work
- **Last updated**: 2026-05-28 (evening — rankings honesty pass).
- **What shipped this session** (2 deploys to prod):
  - `f6d99a1` `fix(rankings): stop serving fake 7D/30D apps before history accumulates` — `aggregateApps()` was SUMming 1 day of snapshots into a "7D" total that looked identical to 24H. `getRankings('week'|'month')` now calls new `countAppDaysInRange()` first; when fewer than 7/30 distinct calendar days exist, returns `topApps[period]=[]` plus `appsHistoryDays`+`appsHistoryRequired`. Client `emptyAppsMessage()` renders "1/7 days of history collected. 7-day rankings unlock once 6 more daily snapshots accumulate." Also stopped non-day periods falling back to `.day` data (that fallback was the bug enabler).
  - `af6d653` `fix(rankings): hide reqs column when count is zero` — new OpenRouter UI never renders request counts so every row was printing "0 reqs". `reqsHtml()` returns empty string for zero/missing; column disappears until a future source surfaces real counts.
- **Verified on prod (cache-busted)**: `/api/rankings?period=week` → `{appsHistoryDays:1, appsHistoryRequired:7, topApps.week:[], topModels:10}`. `?period=month` → same with `Required:30`. `?period=day` unchanged. Deployed HTML contains `emptyAppsMessage`/`reqsHtml` and no `'0 reqs'` literal.
- **History bootstrap status** — D1 has 1 calendar day of app snapshots (2026-05-28, 4 hourly snapshots). With the new gate, 7D/30D tabs now show the honest progress message instead of fake numbers. Hourly cron keeps accumulating. Real 7D data unlocks ~2026-06-04; real 30D ~2026-06-27.
- **Known caveats (unchanged)**:
  - Models leaderboard is fixed at OpenRouter's 7-day rolling window regardless of UI period toggle. The "Top models by weekly token volume" subtitle is the only signal — toggle visually scoped to apps panel only.
  - App `originUrl` is best-effort empty; favicon URL works via Google's faviconV2 proxy.
- **Op note — REFRESH_SECRET** was rotated earlier to `2021@RewardMe` (user-typed). Looks like a real password; rotate to a strong random via `wrangler secret put REFRESH_SECRET` at your convenience.
- **Local state**: on `main` at `af6d653`, clean apart from `.DS_Store` + `.claude/` (both untracked, expected).
- **Next steps (prioritized, carried forward)**:
  1. **P0 — publish `keyring-client` to npm** (blocked on auth — no `npm whoami`, no `~/.npmrc`, no `NPM_TOKEN`. Package builds clean; dry-run shows 10 files / 9.6 KB. Names available: `keyring-client`, `@tokenapp/keyring-client`, `@tokenapp-io/keyring`, `@token-app/keyring`. Unblock: user runs `npm login` or supplies a granular token).
  2. **P1 — resume `/usage` roadmap**: cross-link byModel rows → `/models/{provider}/{slug}`; "Load my usage" button on `/models` reading localStorage; month-end forecast + "switch model X → Y" slider; landing "Best coding agent by cost" comparison.
  3. **P2 — keyring v0.2**: expand native seeds (Mistral, DeepSeek direct, xAI); broaden `validateKey` coverage; CI schema check on `/registry.json`.
  4. **P2 — `/usage` polish**: calendar heatmap, per-provider export guides with screenshots.
  5. **P3 — agent-readiness Level 5**: A2A Agent Card (low value until token.app needs peer-agent handshakes).
  6. **P3 — keyring protocol phase**: wallet-style scoped-key approval flow. Only worth starting once registry + SDK have real adoption.
- **Skip**: benchmark overlays (needs server submission — breaks no-accounts posture); image/receipt import for `/usage` (prompt flow covers it).


codex will review your output once you are done
