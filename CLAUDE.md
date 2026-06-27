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
- **Last updated**: 2026-06-27 — **Rankings DESIGN pass shipped to `main` (NOT deployed).** Token Share chart redesigned (brand-stacked bands + per-model hover breakdown; By author/By model toggle removed) and agent-icon fallback added. Merged to local `main` @ `0c732fc`.
- **State**: `main` @ `0c732fc`, **8 commits ahead of `origin/main` — NOT pushed**. **Prod still on `8d203a2f`.** Both this design work AND last session's `[P1]` empty-overwrite fix (`05dec39`, now an ancestor of `main`) are undeployed.
- **NEXT — 1 action to ship**: `npx wrangler deploy` from `main` (user only — wrangler broken in Claude env) ships the design pass + `[P1]` fix together. Optionally `git push` first to sync origin (8 commits: spec, plan, 6 impl).
- **What shipped (`1054bac..0c732fc`)**: spec + plan in `docs/superpowers/{specs,plans}/2026-06-27-token-share-brand-bands*`. Code (`src/template.ts`): (1) provider color maps lifted to module scope + `isKnownProvider`/`isLightTheme`; (2) one-source color system — `brandColor`/`entityColor`/`modelTint`/`genHue` (stable hash-hue for unknown authors) + neutral `othersColor`; (3) single brand chart — `#ms-view-toggle`+`state.msView` removed, `renderMarketShare` slices author+model; (4) `attachShareHover(author,model)` tooltip = whole-week per-model breakdown (date-matched, ≤12 rows), brand-tinted; (5) `appIconHtml` fallback: favicon → `s2Favicon(originUrl)` → letter-tile.
- **Verified (NOT on prod)**: `tsc --noEmit` clean; new harness `scratchpad/verify.mjs` (esbuild-renders `getHtml()`, vm-syntax-checks inline scripts, writes `preview-{dark,light}.html` w/ mock data) = 0 errors; headless render both themes (`~/.browser-use-env` playwright `shoot.py`/`hover.py`) = zero console errors, bands distinct, hover model-breakdown works, icons (favicon/s2/letter-tile) all render. `scratchpad/` is gitignored — `verify.mjs` source is in the plan doc (Task 0) if it needs recreating.
- **Backlog (deferred)**: [P2] canonical model slug (codex: `fetchModelBoard` `modelSlug` from `modelLabel(permaslug)` strips dates/`:free`, same string keys D1 → two date-variants collide; fix = separate canonical slug, keep label). Real category-board JSON. Optional palette polish: bias `genHue` off the ~8 reserved brand hues; stronger sibling-shade nudge.
- **Toolchain**: local wrangler fully broken (even `wrangler --version` crashes under Node 22). Verify via `tsc --noEmit` + `scratchpad/verify.mjs`. User runs deploy.
- **Op note — REFRESH_SECRET**: rotated 2026-06-24; set via `wrangler secret put`; NEVER commit. Claude must not handle the value — user triggers `/api/refresh`.


codex will review your output once you are done
