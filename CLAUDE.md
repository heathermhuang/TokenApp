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
- **Model token-usage chart source = `model-rankings-chart`, NOT `/models`** (verified 2026-06-28): the year-long per-MODEL chart is built from `model-rankings-chart` (52 weekly points; each week = its top-9 + an "Others" bucket). `/rankings/models?view=week` is the LEADERBOARD feed and only carries the last ~6 days — it CANNOT drive a year chart. "Others" is genuinely ~40%/week and that MATCHES OpenRouter (confirmed against their own hover tooltip: Others is the big PINK base band, ~47%). `modelShareSeries` displays the UNION of every week's top-9 (canonicalized keys, for cross-week continuity) and keeps "Others" as `entities[0]` → the BOTTOM band. The old bug projected TODAY's top-9 backward → historical weeks rendered empty/grey (was mislabelled a "D1 depth" caveat).

## Current Work
- **Last updated**: 2026-06-28 — **Token-usage chart now matches OpenRouter (per-MODEL, union of each week's top-9 + Others base) — DEPLOYED & LIVE-VERIFIED.**
- **State**: deployed — **Prod Version `6fcf1f10-96cd-4eed-943c-41d8c44c663c`**. New commit `4ef6b84` (feat) on `main`. Bindings (KV/D1/`BROWSER`) + cron `0 * * * *` + `REFRESH_SECRET` untouched. The 10:00Z cron auto-populated the new KV series; live-verified linear+log on token.app (legend = 9 models + Others 39.8%, first week coloured, every week sums 100%).
- **The fix (`src/openrouter-json.ts`, `4ef6b84`)**: reverted chart source from the `/models` experiment back to `model-rankings-chart`; `modelShareSeries(raw: RawPoint[])` shows the UNION of each week's top-9 (canon keys) + the endpoint's "Others" as `entities[0]` (BOTTOM band, ~40%, matches OpenRouter). Legend filters to latest-week models only. **See the new Gotcha — `/models` is 6-day-only, don't use it for the year chart.**
- **Resolves the old "Others ≈100% on older bars" caveat**: that was the fixed-top-9-backward bug, NOT D1 depth. All 52 weeks now coloured from model-rankings-chart history.
- **Also live (prior WIP, committed in `4ef6b84`)**: dead-code cleanup (`attachShareHover`/`modelTint`/`pointForDate`/`mixHex` gone) + subs mobile polish (3 features/tier via `.tier-feature:nth-child(n+4)`). Linear/Log toggle (`#ms-scale-toggle`) unchanged & working.
- **Cosmetic diff from OpenRouter**: our "Others" base is grey; theirs is pink. Intentional — grey avoids colliding with the hashed model hues. Trivial to switch if wanted.
- **Backlog**: OpenRouter parity remaining — two-column leaderboard; "top models by task" treemap. [P2] canonical model-slug collision (`fetchModelBoard`).
- **Verify (gitignored `scratchpad/`)**: `verify_model_series.mjs` (unit-checks `modelShareSeries` on real `mrc.json`); `verify.mjs` (renders `getHtml()` feeding the REAL series through the prod path); `shoot2.py` (local chart linear/log/hover + subs mobile); `live_verify.py` (shots live token.app); `compare.py` (side-by-side vs OpenRouter). Playwright python = `~/.browser-use-env/bin/python`. **TOOLCHAIN**: wrangler "hang" = corrupted `miniflare`; fix = `npm ci`.
- **Op note — REFRESH_SECRET**: set via `wrangler secret put`; NEVER commit; user triggers `/api/refresh` (or the hourly `0 * * * *` cron auto-refreshes ~:00–:01).


codex will review your output once you are done
