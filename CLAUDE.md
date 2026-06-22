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
- **Last updated**: 2026-06-22 — Phase B spike complete + Plan 2 written (investigation/planning only, no prod code this session). Phase A remains the last thing deployed.
- **Branch**: `feature/rankings-time-series` (NOT yet merged to main). Docs on branch: spec `…specs/2026-06-22-rankings-time-series-and-categories-design.md`, Plan 1 (A/B) `…plans/2026-06-22-rankings-time-series.md`, **spike `…specs/2026-06-22-rankings-spike-findings.md`**, **Plan 2 (C/D) `…plans/2026-06-22-rankings-categories-marketshare.md`**.
- **What landed this session**: `1a7f878` spike findings · `20ecef3` Plan 2.
- **Spike verdict — GO on both** (used curl for static probes + a live Chrome network/DOM session):
  - **Categories**: 15 leaves / 4 groups, enumerate from `openrouter.ai/sitemap.xml` (JS-free) — NOT the on-page chips (those are an incomplete subset). Each leaf page renders `<h1>` "{Label} Rankings" + a scrapeable ranked app list (reuse apps extractor).
  - **Market share**: no structured `/data` source; data is a Next.js **server-action POST to `/rankings`** rendered into the `#market-share` legend (`<button>` → `a[href="/{author}"]` + token total + share %). Scrape the legend, accumulate our own daily series. Piggybacks on the existing hourly `/rankings` render (0 extra pages). ~15 category pages/day in one reused session, ~2-3 min — no hard cap (soft cap 20).
- **Next step — execute Plan 2** (Phases C–D, 12 tasks): C = migration `0002` (`category` col + `market_share_snapshots`) + market-share/category scrapers (daily once-per-day guard inside `scheduled`, NOT a new cron) + category-aware reads (`category IS NULL` scoping) + `?category=`/`/api/market-share`/`/api/rankings/categories`. D = hand-rolled `areaChartSvg` + category tabs, history-gated. Then merge → main.
- **Carried-forward backlog (unchanged)**: P0 publish `keyring-client` to npm (blocked on npm auth — needs `npm login`/token; builds clean, dry-run 10 files/9.6 KB); P1 `/usage` roadmap (byModel cross-links, "Load my usage", forecast slider); P2 keyring v0.2 + `/usage` polish. Skip: benchmark overlays, receipt import.
- **Op note — REFRESH_SECRET** was rotated to `2021@RewardMe` (user-typed, looks like a real password); rotate to a strong random via `wrangler secret put REFRESH_SECRET` when convenient.
- **Local state**: on `feature/rankings-time-series`, clean apart from `.DS_Store` + `.claude/` (untracked, expected).


codex will review your output once you are done
