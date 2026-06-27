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
- **Last updated**: 2026-06-26 — **Token Share chart rewrite + rankings JSON migration — SHIPPED.** Merged to `main`, pushed to origin, deployed to prod (version `8d203a2f`), smoke-confirmed. Awaiting first data refresh to fully light up.
- **State**: `main` @ `e8389d5` == `origin/main`. Prod live (version `8d203a2f`). 10 commits this session (`feature/rankings-json-share-chart` kept). Spec + plan in `docs/superpowers/{specs,plans}/2026-06-26-token-share-timeseries-rankings-json*`.
- **What changed**: replaced the flat stacked-stripe "market share" chart with an interactive **stacked-area time-series** (1yr weekly history, crosshair tooltip listing every entity per week, **By author / By model** toggle, **30D/90D/1Y**, legend latest% + window Δ). Title now "Token Share Over Time".
- **Data migration (puppeteer → JSON)**: new `src/openrouter-json.ts` fetches OpenRouter `/api/frontend/v1/rankings/{market-share,model-rankings-chart,models,apps}`. `refreshAllData` writes KV (`SHARE_SERIES`, `APPS_BOARDS`, `RANKINGS`) + D1 continuity snapshots. `getRankings`: fast KV path (global+latest, **unlocks 7D/30D agents — no more gate**) / D1 path (as-of + categories). `/api/market-share` now serves `{author,model}` 52-wk series from KV. Deleted the puppeteer rankings scrape + `market_share_snapshots` read path. **Puppeteer remains ONLY for the 15 per-category agent boards** (their data is a deploy-volatile Next.js server action — confirmed via live network capture, not safely replicable).
- **Verified**: tsc clean; `wrangler --dry-run` bundles; normalization vs live data (52wk, sums 100%, deepseek 15.97%); model board exact match to leaderboard (4.9T/4.4T/3.8T…); **browser-rendered chart + crosshair + all toggles** (esbuild-render harness, classifier-flaky preview).
- **NEXT (resume here)**: 1) **Populate KV** — run `POST /api/refresh` with `REFRESH_SECRET` (user only) OR wait for the top-of-hour cron; until then the chart 404s and agent 7D/30D are empty. 2) Re-smoke after refresh: `/api/market-share` → `{author,model}` 52wk; `/api/rankings?period=week` → apps.week=20; open prod Rankings tab → chart + crosshair + toggles. 3) `/codex` review. 4) Backlog: real category-board JSON if OpenRouter ever exposes it (today it's a deploy-volatile server action — puppeteer stays for the 15 category boards).
- **Toolchain**: local `wrangler dev` (miniflare) broken; `deploy`/`--dry-run` fine. Preview via esbuild-render harness (`scratchpad/render.mjs` + `.claude/launch.json` `share-preview`).
- **Op note — REFRESH_SECRET**: rotated 2026-06-24; set via `wrangler secret put`; NEVER commit. Claude must not handle the value — user triggers `/api/refresh`.


codex will review your output once you are done
