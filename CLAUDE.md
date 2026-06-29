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
- **"Top models by task" treemap = `task-spend` `spend` half, NOT `tokens`** (verified 2026-06-29): `/api/frontend/v1/rankings/task-spend` returns `{data:{spend,tokens}}`, each `{windowDays, macroCategories, tasks[]}`. OpenRouter's treemap tiles read "X% of all **spend**", so `taskSpendFromRaw` surfaces `data.spend` (classification 11.7% spend ≠ 9.76% tokens — they differ). Tasks are tagged (`code:general_impl`) with NO label in the payload — OpenRouter curates the human labels, mirrored in the `TASK_LABELS` map (`openrouter-json.ts`, fallback `prettyTag()`). It's a 30-day SNAPSHOT (no time-series) → store in KV like apps, NOT D1. Category palette sampled from OpenRouter: general `#f76b15`, agent `#6e56cf`, code `#30a46c`, data `#0090ff`. `deltaPp == share` in the payload (new taxonomy, prior window ~0) — OpenRouter's own UI shows the same, so it's faithful, not a bug. Fetch is non-fatal in `refreshAllData` (catch→empty) so a task-spend outage can't block the primary models/apps/share refresh.

## Current Work
- **Last updated**: 2026-06-29 — **4 Rankings features shipped & ALL LIVE-VERIFIED on token.app: Top-Models-by-Task treemap, two-column LLM leaderboard, Others→pink, slug-collision fix. The 01:00Z cron populated `TASK_SPEND`; treemap renders live (30 tiles, interactive, area-cover 100%), leaderboard deduped (0 duplicate rows).**
- **State**: deployed — **Prod Version `66ca3da6-3975-4031-98f0-3c28caa4e7c4`**. feat `fa36fd5` + docs `6c95db4` on `main`. **`main` is AHEAD of `origin` by 3 commits incl. this docs update — UNPUSHED** (next session: ask, then push). Bindings (KV/D1/`BROWSER`) + cron `0 * * * *` + `REFRESH_SECRET` untouched.
- **#2 Treemap** (`template.ts` client JS + `openrouter-json.ts`): squarified (Bruls), nested by macro-category, click a tile → its top-10 models (2-col). Source = `task-spend` **spend** half. See the new Gotcha. Legend matches OpenRouter (Gen ~35.7 / Agent ~30.5 / Code ~26.5 / Data ~7.4). **LIVE-VERIFIED** on token.app.
- **#3 Leaderboard**: full-width 2-col (ranks 1-5 | 6-10), vertical-stack Rankings tab (chart → leaderboard → treemap → apps). Model board `slice(0,10)` + `.leaderboard-list.two-col` grid (`grid-auto-flow:column`). LIVE.
- **#4 Pink**: `othersColor()` → `#fc68b4` / `#e86bab` (sampled from OR's chart). LIVE — replaces the old grey "cosmetic diff" caveat; now matches OpenRouter.
- **#5 Slug fix**: `fetchModelBoard` groups by `canonModel` (sums dated/`:free` variants into one row). 2 real collisions confirmed in the live `/models` feed (`z-ai/glm-4.6`, `qwen/qwen3.5-plus`). **Live: 0 duplicate rows** in the leaderboard after the 01:00Z cron repopulated RANKINGS KV.
- **Refresh paths**: the 01:00Z cron populated everything (it auto-fills `TASK_SPEND` early, before the long category scrape). `POST /api/refresh` also works (fast path includes task-spend — response shows `tasks: 30`). A graceful "refreshes hourly" empty-state covers any future KV gap.
- **Backlog**: treemap tile labels are curated in `TASK_LABELS` (re-verify if OR adds tasks); treemap spatial arrangement is squarify-ordered, not pixel-identical to OR (grouping+colours+legend match). Optional: spend/tokens toggle on the treemap.
- **Verify (gitignored `scratchpad/`)**: `verify.mjs` (renders `getHtml()` feeding real `modelShareSeries`+`taskSpendFromRaw` through the prod path, stubs `/api/*`); `shoot_features.py` (local: treemap/2-col/pink, light+dark); `live_features.py` (shots live token.app); `shoot2.py` (chart linear/log/hover + subs); `verify_model_series.mjs`; `or_*.py` (capture OpenRouter for parity). Playwright python = `~/.browser-use-env/bin/python`. **TOOLCHAIN**: wrangler "hang" = corrupted `miniflare`; fix = `npm ci`.
- **Op note — REFRESH_SECRET**: set via `wrangler secret put`; NEVER commit; user triggers `/api/refresh` (or the hourly `0 * * * *` cron auto-refreshes ~:00–:01).


codex will review your output once you are done
