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
- **Last updated**: 2026-06-27 — **Rankings chart = stacked-bar token-volume chart (OpenRouter "Top Models" match), DEPLOYED & live.** Built atop the polished data-dense pass (harmonized palette, tabular figures, calmer sparklines).
- **State**: deployed — **Prod Version `86d19a7f-4ba8-4084-a24e-25e2726d11d7`** (`wrangler deploy` from the Claude env; **wrangler is authed here, so Claude CAN deploy**). `main` == `origin/main` (0 ahead, all pushed). Bindings (KV/D1/`BROWSER`) + cron `0 * * * *` + `REFRESH_SECRET` untouched.
- **Chart (`src/template.ts`, `bbf694a`)**: `shareChartSvg` = stacked **bars**, one column/week, segments by brand, **absolute `tokens`** on a nice-rounded B/T y-axis (auto-fit to max weekly total). `attachBarHover` = per-brand token-volume tooltip. Default window **1Y** (`msWindow:365`), title "Token Usage Over Time". Path was stacked-area % (orig) → multi-line % (`9393ede`, WRONG) → stacked-bar volume. **OpenRouter's chart is stacked BARS of absolute volume — don't re-guess it as area/line.**
- **Palette pass (`a89870c`)**: entity-stable harmonized chart palette (`CHART_PALETTE_{DARK,LIGHT}`+`CHART_SLOT`, `chartColor`/`chartSlot`), decoupled from brand chips (`PROVIDER_STYLE_*` untouched); tabular-nums site-wide + font smoothing; sparkline single muted hue; micro-caps `.stat-label`.
- **Latent bug fixed**: template-literal `\s` trap — slug regex emitted as `/s+/g`, mangled slugs with "s" (`deepseek`→`deep-eek`). Now literal-space regex in `chartSlot`; watch for the same trap elsewhere in the inline JS.
- **Backlog**: dead code to remove (`attachShareHover`/`modelTint`/`pointForDate`, unused after the bar swap). OpenRouter parity (offered, not built): segment bars by **model** not brand; **Linear/Log** toggle; two-column leaderboard; "top models by task" treemap. [P2] canonical model-slug collision (`fetchModelBoard`).
- **Verify (gitignored `scratchpad/`)**: `verify.mjs` (render `getHtml()` + vm syntax-check + `preview-{dark,light}.html`); `shoot.py`/`liveshot.py` (playwright shots, local + live token.app); `dump_colors.py`/`tip_probe.py` (read swatch colors + tooltip text). **TOOLCHAIN**: wrangler "hang" = corrupted `miniflare`; fix = `npm ci`.
- **Op note — REFRESH_SECRET**: rotated 2026-06-24; set via `wrangler secret put`; NEVER commit; user triggers `/api/refresh`.


codex will review your output once you are done
