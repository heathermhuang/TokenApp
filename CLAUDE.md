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
- **Last updated**: 2026-06-27 — **Rankings chart parity (segment by MODEL + Linear/Log toggle), mobile subs polish, and dead-code cleanup — DEPLOYED & live.**
- **State**: deployed — **Prod Version `fb5e135e-6459-486f-9f8a-787aa9e5fa6c`** (`npx wrangler deploy` from the Claude env; **wrangler authed here, Claude CAN deploy**). New commits on `main`: `844944a` (feat) + this docs. Bindings (KV/D1/`BROWSER`) + cron `0 * * * *` + `REFRESH_SECRET` untouched. Live-verified linear+log with real data.
- **Chart now segments by MODEL (`src/template.ts`, `844944a`)**: render path uses `state.shareSeries.model` (fallback `.author`). `entityColor` hashes a `provider/model` key → distinct hue (`modelHue`), so same-brand siblings (Sonnet vs Haiku, 4o vs 4o-mini) DON'T collide; plain author slugs still use the brand palette; "Others" = grey top band. **Don't recolor models by provider — that re-introduces the collision.**
- **Linear/Log toggle (`#ms-scale-toggle`, `state.msScale`)**: `shareChartSvg(series, scale)`. Log = decade gridlines (…100B/1T/10T), each bar's TOP at `log(weekly total)`, segments fill PROPORTIONALLY (linear-stacking on a log total would misplace boundaries). Linear path unchanged (nice-round B/T axis).
- **Subs mobile polish (`≤768`)**: 3 features/tier (was 5) via `.tier-feature:nth-child(n+4){display:none}` + tighter `.tier-features` gap; no JS resize listener (slice(0,5) still feeds desktop).
- **Cleanup**: removed dead `attachShareHover`/`modelTint`/`pointForDate` + transitively-dead `mixHex`; fixed stale "multi-line chart" comment above `shareChartSvg`.
- **Data caveat (live)**: real `model` series → "Others" ≈40% and the model-level breakdown only exists for the recent ~8 weeks (older bars are ~100% grey "Others") — D1 model-history depth + top-N breadth, NOT a render bug. Follow-up if desired: widen model top-N / backfill model snapshots.
- **Backlog**: OpenRouter parity remaining — two-column leaderboard; "top models by task" treemap. [P2] canonical model-slug collision (`fetchModelBoard`).
- **Verify (gitignored `scratchpad/`)**: `verify.mjs` (render `getHtml()` + vm syntax-check + previews; mock model series now has a growth ramp so Linear vs Log is visible); `shoot2.py` (local: chart linear+log+hover dark/light, subs mobile); `live_verify.py` (shots live token.app). Playwright python = `~/.browser-use-env/bin/python`. **TOOLCHAIN**: wrangler "hang" = corrupted `miniflare`; fix = `npm ci`.
- **Op note — REFRESH_SECRET**: rotated 2026-06-24; set via `wrangler secret put`; NEVER commit; user triggers `/api/refresh`.


codex will review your output once you are done
