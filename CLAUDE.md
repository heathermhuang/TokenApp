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
- **`/api/refresh` can't run the long category scrape**: HTTP `ctx.waitUntil()` is cancelled ~30s after the response (Cloudflare limit); only the *scheduled* (cron) handler has the 15-min budget for the ~2-3 min category scrape. `refreshAllData(env, { includeCategories })` gates it — cron passes `true`, `/api/refresh` awaits the fast path (models+rankings+market-share, ~45-60s, under the ~100s edge timeout) and leaves categories to the cron. Backgrounding a long job after a 202 silently truncates — don't.
- **Market-share legend: extract by CONTENT, not tag**: the `#market-share` rows are NOT reliably `<button>`-wrapped (OpenRouter changed the DOM; the spike's `<button>` assumption broke extraction → empty for 2 days). Walk up from each `a[href="/{author}"]` to the nearest ancestor whose text has a `%`, anchored on the link label. Reject non-author links (clean-slug regex + denylist) — the section holds a `/models?fmt=cards` CTA next to the unnamed "Others" aggregate. Sanitize on read too (`isAuthorSlug` in `readMarketShare`). Also: `page.waitForFunction(string)` THROWS under `@cloudflare/puppeteer` — poll with `page.evaluate(string)` instead.

## Current Work
- **Last updated**: 2026-06-24 — **Phase C scrapers verified live + 3 fixes shipped to prod.** Market-share was silently empty for 2 days (extractor bug, now fixed). PR #7 open. Phase D (UI) is the remaining feature work.
- **Branch**: `feature/rankings-time-series` (NOT merged). PR: https://github.com/heathermhuang/TokenApp/pull/7. Plans/specs on branch under `docs/superpowers/`.
- **Shipped this session** (deployed, prod version `e064ca7a`): `6f36211` /api/refresh awaits fast path + categories cron-only (supersedes a broken `waitUntil`+202 — see new gotchas) · `234f2ad` market-share extract-by-content + slug filter (the real empty-market-share fix) · `d234b54` read-side author sanitizer. Earlier intermediate commits `a1373b0`/`a519092` are superseded but kept in branch history. All codex-reviewed clean + tsc-clean.
- **Verified live**: `POST /api/refresh` → 41s, no 524, returns counts, `categories: skipped (cron-only)`. `GET /api/market-share?window=30` → 9 named authors (deepseek 15.9% … z-ai 4.8%), `historyDays:1`, no junk. `GET /api/rankings/categories` → 11/15 (route is DB-gated — shows only categories with scraped rows; seed has all 15; the 4 absent are sparse/empty boards — by design, not a bug).
- **Next steps**:
  1. **Merge PR #7 → main** when ready (squash collapses the superseded intermediate commits).
  2. **Phase D (UI)** — Plan 2 tasks D1–D4: `areaChartSvg` + `authorColor` + category tabs, history-gated. Market-share chart needs **≥2 days** of snapshots (honesty gate) — today is day 1, so build/verify Phase D from ~2026-06-25.
- **Known residual**: one stale `models?fmt=cards` row in D1 for 2026-06-24 (debug-deploy artifact) — harmless, filtered by the read-side sanitizer; optionally `DELETE FROM market_share_snapshots WHERE author='models?fmt=cards'` later.
- **Phase C v1 limitations**: category boards skip sparklines/deltas; models stay global on category views; market-share writes hourly (cron) + reads last-per-day.
- **Backlog (unchanged)**: P0 publish `keyring-client` to npm (blocked on `npm login`); P1 `/usage` roadmap; P2 keyring v0.2 + `/usage` polish. Skip: benchmark overlays, receipt import.
- **Op note — REFRESH_SECRET** = `2021@RewardMe`; rotate to a strong random via `wrangler secret put REFRESH_SECRET` when convenient.
- **Local state**: on `feature/rankings-time-series`, clean apart from `.DS_Store` + `.claude/` (untracked, expected).


codex will review your output once you are done
