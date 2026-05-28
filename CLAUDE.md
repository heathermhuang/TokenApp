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
- **D1 rankings history**: append-only `rankings_snapshots` table (`migrations/0001_*.sql`). Cron writes ~30 rows/hour. Read paths: `readLatestModels(env, 'week')` for any UI period (models don't change with toggle); `readLatestApps(env)` for day, `aggregateApps(env, days)` for week/month. Aggregation takes LAST snapshot per identifier per day then SUMs across days, so it produces a sensible cumulative-tokens window even though OpenRouter's underlying numbers are running daily totals.
- **Empty-overwrite guard**: `refreshAllData` refuses to record a snapshot when scraping yields 0 models AND 0 apps. Stops silent cache poisoning if OpenRouter's UI changes again — keeps last-good D1 data and surfaces `rankingsError` instead.
- **`[]` is truthy in JS**: `appsData.week || appsData.day` returns the empty `.week` array, not `.day`. The rankings UI fallback checks `byPeriod.length > 0` instead. Worth remembering for any future period-keyed shape.
- **Template literal escaping**: Model descriptions can contain backticks and `${` — use `safeLiteral()` before embedding in template.ts.
- **`\'` is invalid in JS template literals**: backslash is silently ignored for single quotes. Use `this.hidden=true` instead of `this.style.display='none'` in inline handlers.

## Current Work
- **Last updated**: 2026-05-28
- **What shipped this session**: three deploys to prod.
  - `354550e` `fix(rankings): scrape rendered DOM via @cloudflare/puppeteer` — rankings tab had been empty for days. OpenRouter rebuilt `/rankings` on a turbopack Next.js app and removed all ranking data from the SSR HTML. Switched to Cloudflare Browser Rendering binding + `@cloudflare/puppeteer` to load the page, wait for hydration, extract from rendered DOM. Stable selector `[data-testid="model-rankings-leaderboard-row"]` for models; innerText regex for apps. Empty-overwrite guard added so future scraper breakage keeps last-good data.
  - `cb42e7b` `feat(rankings): D1-backed history + period-aware /api/rankings` — followup to discover that OpenRouter's new UI has NO period toggle at all (the "This Week" / "Today" buttons are model-search comboboxes). To still satisfy the UI's 24H/7D/30D period toggle, added a Cloudflare D1 binding (`RANKINGS_DB`) backed by an append-only `rankings_snapshots` table. Hourly cron writes ~30 rows per tick (10 weekly-model + 10 daily-app rows… D1 free tier handles years of this). `/api/rankings?period=day|week|month` reads back: models always reflect the latest weekly snapshot (OpenRouter's only published view), apps return latest-day for `day`, SUM over the last 7 daily snapshots for `week`, SUM over 30 for `month`. UI period toggle rewired to fetch on demand and cache per-period; loading state only on the apps panel (models don't change with the toggle).
- **New deps + bindings**:
  - `@cloudflare/puppeteer ^1.1.0`. 4 moderate npm audit warnings (transitive) — not blocking.
  - `wrangler.toml`: `[browser] binding = "BROWSER"` + `[[d1_databases]] binding = "RANKINGS_DB" database_name = "token-app-rankings" database_id = "b5ba0d81-1566-45ba-bd05-9ebffd946c2b"`. Requires Workers Paid plan for Browser Rendering.
  - `src/types.ts` Env now includes `BROWSER: Fetcher` and `RANKINGS_DB: D1Database`.
  - `migrations/0001_create_rankings_snapshots.sql` checked in; applied to remote D1 this session.
- **History bootstrap status** — 7d and 30d app aggregations need accumulated daily snapshots to be meaningful. As of last check D1 had 3 snapshots from today (manual triggers + 10:00 UTC cron). Hourly cron writes ~24 snapshots/day going forward — week-tab apps become real ~2026-06-04, month-tab apps ~2026-06-27. Until then those tabs show the same data as 24H (the only snapshots available).
- **Known caveats**:
  - **Models leaderboard is fixed at OpenRouter's 7-day rolling window** regardless of UI period toggle. UI's small "Top models by weekly token volume" subtitle is the only signal. If we ever want true daily model data, we'd need a different source (OpenRouter's `/api/v1/...` doesn't expose it publicly).
  - `totalRequests` is always `0` (new UI doesn't render request counts). UI shows "0 reqs" — consider hiding that column in `src/template.ts`.
  - App `originUrl` is best-effort empty currently; favicon URL works via Google's faviconV2 proxy.
  - 10 orphan rows in D1 with `kind='model' period='day'` from the initial broken click logic. Harmless (no query reads them). Can be deleted via `wrangler d1 execute token-app-rankings --remote --command "DELETE FROM rankings_snapshots WHERE kind='model' AND period='day'"` if desired.
- **Op note — REFRESH_SECRET was rotated this session** to `2021@RewardMe` (user-typed during verification). Looks like a real password; rotate to a strong random value at your convenience.
- **Local state**: on `main` at `cb42e7b`, clean apart from `.DS_Store` + `.claude/` (both untracked, expected).
- **Next steps (prioritized, carried forward)**:
  1. **P0 — publish `keyring-client` to npm** (still blocked on auth — no `npm whoami`, no `~/.npmrc`, no `NPM_TOKEN`. Package builds clean; dry-run shows 10 files / 9.6 KB. Names available: `keyring-client`, `@tokenapp/keyring-client`, `@tokenapp-io/keyring`, `@token-app/keyring`. Unblock: user runs `npm login` or supplies a granular token).
  2. **P1 — rankings polish**: hide "X reqs" column when totalRequests is always 0; hide week/month period toggle on Rankings tab (or relabel).
  3. **P1 — resume `/usage` roadmap**: cross-link byModel rows → `/models/{provider}/{slug}`; "Load my usage" button on `/models` reading localStorage; month-end forecast + "switch model X → Y" slider; landing "Best coding agent by cost" comparison.
  4. **P2 — keyring v0.2**: expand native seeds (Mistral, DeepSeek direct, xAI); broaden `validateKey` coverage; CI schema check on `/registry.json`.
  5. **P2 — `/usage` polish**: calendar heatmap, per-provider export guides with screenshots.
  6. **P3 — agent-readiness Level 5**: A2A Agent Card (low value until token.app needs peer-agent handshakes).
  7. **P3 — keyring protocol phase**: wallet-style scoped-key approval flow. Only worth starting once registry + SDK have real adoption.
- **Skip**: benchmark overlays (needs server submission — breaks no-accounts posture); image/receipt import for `/usage` (prompt flow covers it).


codex will review your output once you are done
