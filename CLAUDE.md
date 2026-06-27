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
- **Last updated**: 2026-06-27 — **Migration verified live on prod + codex review + [P1] fix merged.** Prod KV refreshed and confirmed serving the new shape. Codex found 2 issues; the critical one is fixed on `main`. **One action left: deploy `05dec39` to prod.**
- **State**: `main` @ `05dec39` == `origin/main`. **Prod still on `8d203a2f`** (pre-fix) — needs `npx wrangler deploy`. Migration feature itself shipped last session (`8d203a2f`).
- **Verified live on prod (2026-06-27)**: `/api/market-share` → `{author,model}` each 52wk; `/api/rankings?period=week` → apps.week=20, topModels=15, history-gate fields null (KV fast path). Rankings tab: no console errors, stacked-area chart renders (10 area polygons + axes + 30 legend sparklines), **By author/By model** + **30D/90D/1Y** toggles work live (re-render + active-state flip). Crosshair: ships in SSR JS, verified last session; headless `hover` could not re-trigger it this session (needs real continuous pointer movement — not a regression).
- **Codex review (cross-model)**: GATE FAIL. **[P1] FIXED** (`05dec39`): empty-overwrite guard was all-or-nothing — a partial upstream failure (share empty, models/apps OK) overwrote `SHARE_SERIES` with empty data → chart 404. Now each KV write (`SHARE_SERIES`/`APPS_BOARDS`/`RANKINGS`) is gated on its own payload; total-failure throw kept for `rankingsError` observability. **[P2] DEFERRED** (latent, low-prob): `fetchModelBoard` builds `modelSlug` from `modelLabel(permaslug)` (strips `-20YYMMDD`, rewrites `:free`) — the same string keys D1 (`writeJsonSnapshots`/`attachTrends`), so two date-variants of one model in the same top-15 would collide. Date-strip aids week-over-week continuity, so fix = add a separate canonical slug, keep label for display.
- **NEXT (next session = DESIGN pass)**: 1) **Deploy `05dec39`** first (`npx wrangler deploy`, user only — wrangler broken in Claude env). 2) **Redesign the Token Share chart — colors are bad, esp the By-model view.** Root cause: band-color fns at `src/template.ts:2329-2352` (`authorBandColor` + model variant) return the SAME grey `#94a3b8` for "Others" *and* any entity missing the provider palette, so By-model collapses to a muddy grey slab. Fix: give each stacked band a distinct, stable color (extend palette or hash-slug→hue), handle Others/unknown distinctly, make legend swatches match. SVG builder = `shareChartSvg()` @ `template.ts:2362`; provider palette `src/providers.ts:9-27`; app/agent palette `template.ts:1773-1811`. 3) **Fix agent icons** — apps/agent board icons blank when `faviconUrl` missing (`template.ts:2504-2505`, `.lb-icon`, `onerror="this.hidden=true"`); add a real fallback (google s2 favicon helper @ `template.ts:2025`, or a letter-tile). 4) [P2] canonical model slug (see codex note above). 5) Backlog: real category-board JSON.
- **Toolchain**: local wrangler now **fully broken** (even `wrangler --version` crashes under Node 22 — not just `dev`; `deploy`/`--dry-run` can't run from Claude env this session). Verify via `tsc --noEmit` + esbuild-render harness (`scratchpad/render.mjs` + `.claude/launch.json` `share-preview`). User runs deploy.
- **Op note — REFRESH_SECRET**: rotated 2026-06-24; set via `wrangler secret put`; NEVER commit. Claude must not handle the value — user triggers `/api/refresh`.


codex will review your output once you are done
