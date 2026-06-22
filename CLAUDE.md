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
- **Last updated**: 2026-06-22 — Phase A of the time-aware rankings overhaul shipped to prod.
- **Branch**: `feature/rankings-time-series` (NOT yet merged to main). Spec + plan live there: `docs/superpowers/specs/2026-06-22-rankings-time-series-and-categories-design.md`, `docs/superpowers/plans/2026-06-22-rankings-time-series.md`.
- **What shipped this session** (deployed, version `840da0a5`):
  - `9938971` `feat(rankings): server-side sparklines, deltas, asOf` — `readSeries()` (one batched daily-series query/board; open upper bound on the live view so the series ends at the board's current value, bounded by asOf for history), `deltaFromSeries()` (rank move + token % vs prior period, **null when history too short** — no fake deltas), `getRankings()` attaches sparkline+delta (models week-over-week; apps delta only on the 24H board) + accepts `?asOf=`. `/api/rankings` parses `?asOf=` (invalid dates ignored, not 500).
  - `8f7684f` `feat(rankings): sparklines + trend badges + as-of picker` — vanilla `sparklineSvg()`/`deltaBadge()` (reuse `--green`/`--red`), rendered in both boards; "view as of" date input re-anchors all boards via shared `loadRankingsPeriod()`, clearing the per-period cache on asOf change (it keys on period only).
- **Verified on prod (cache-busted)**: `?period=day` → model0 `deepseek-v4-flash` 4.94T, 15-pt sparkline, delta `+12%`; app0 `Hermes Agent` 911B, 15-pt, `+5.3%`. `?asOf=2026-06-10…` → re-anchors (`fetchedAt` 06-10, model 4.23T vs 4.94T now, 14-pt). Honest `null` gating confirmed locally at short horizons.
- **Next steps — finish the spec (Phases B–D, on the branch)**:
  1. **Phase B spike** → write `docs/superpowers/specs/2026-06-22-rankings-spike-findings.md`: enumerate category URLs (`/apps/category/{group}/{slug}`, confirmed addressable); locate the market-share-by-author source (probe `openrouter.ai/data` for structured data, else the chart/RSC payload); measure per-run browser-render cost.
  2. **Phase C** — migration `0002` (`category` col + `market_share_snapshots` table); daily scrape via a once-per-day guard INSIDE the existing `scheduled` handler (NOT a new cron — `wrangler.toml` is gitignored); per-section empty-overwrite guards.
  3. **Phase D** — hand-rolled stacked-area market-share chart + category tabs; same history-gating discipline. Then merge → main.
- **Carried-forward backlog (unchanged)**: P0 publish `keyring-client` to npm (blocked on npm auth — needs `npm login`/token; builds clean, dry-run 10 files/9.6 KB); P1 `/usage` roadmap (byModel cross-links, "Load my usage", forecast slider); P2 keyring v0.2 + `/usage` polish. Skip: benchmark overlays, receipt import.
- **Op note — REFRESH_SECRET** was rotated to `2021@RewardMe` (user-typed, looks like a real password); rotate to a strong random via `wrangler secret put REFRESH_SECRET` when convenient.
- **Local state**: on `feature/rankings-time-series`, clean apart from `.DS_Store` + `.claude/` (untracked, expected).


codex will review your output once you are done
