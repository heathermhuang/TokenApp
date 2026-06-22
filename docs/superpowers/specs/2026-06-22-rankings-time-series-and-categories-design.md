# Rankings: Point-in-Time Snapshots, Trends, Charts & Categories

- **Date:** 2026-06-22
- **Status:** Draft for review
- **Topic:** Make the Rankings tab time-aware and close the gap vs OpenRouter's rankings page.

## Problem & motivation

Our Rankings tab is two flat leaderboards — top-20 models by weekly tokens, and top
apps by 24H/7D/30D tokens — each row showing only rank + name + token count. OpenRouter's
rankings page is far richer: a **token-share-by-author chart over time**, **category
leaderboards** (`/apps/category/{group}/{slug}`), and trend signals.

Meanwhile we've been appending hourly snapshots to D1 (`rankings_snapshots`) since
2026-05-28 — ~25 calendar days as of 2026-06-22 — that we never surface beyond window
aggregation. This spec turns that history into time-aware rankings and adds the two
scraping-dependent features (categories + real market share).

## Goals

1. **Trends & deltas** — rank movement (▲▼) and % token change vs the prior period on every leaderboard row.
2. **Time-series charts** — per-row inline SVG sparklines + a market-share-by-author stacked-area chart.
3. **"As of" snapshots** — view the leaderboard as it stood at a chosen past date/time.
4. **Category leaderboards** — top apps per OpenRouter category (coding, roleplay, agents, productivity, …).

## Non-goals (v1)

- Tool-call and image-model leaderboards (OpenRouter has them; out of scope unless requested later).
- Per-model / per-app detail pages with their own history view (future).
- Replacing or restructuring the existing hourly main scrape.

## Constraints inherited from the current system

- **Models are a weekly-rolling board only** — no daily model granularity from OpenRouter.
  Model sparklines/deltas are week-over-week; only **apps** get daily granularity.
- **Honesty gating** — never show a delta/sparkline/aggregate derived from insufficient
  history (the 2026-05-28 "fake 7D" regression). Render an honest empty/progress state instead.
- **Empty-overwrite guard** — a scrape yielding zero rows must NOT overwrite good data
  (existing guard in `refreshAllData`). Extend the same guard to each new daily scrape section.
- **Single-file vanilla template** — no framework, no build step. Charts are hand-rolled inline SVG.
- **Template-literal escaping** — run scraped strings through `safeLiteral()` before embedding
  in `template.ts`; never use `\'` inside inline handlers (use `this.hidden=true`).

## Resolved decisions

- **Charts:** hand-rolled inline SVG, no charting library (keep zero-build single-file ethos).
- **Market share:** scrape OpenRouter's real author-share data (faithful + attributed), not an approximation from our top-20.
- **New-scrape cadence:** daily, with a feasibility spike first.

## Data model (D1)

The existing `rankings_snapshots` table already supports trends / series / "as of"
(query by `snapshot_at` / `snapshot_day`) — **no change needed for Phase A**.

Migration `0002_categories_and_market_share.sql`:

- `ALTER TABLE rankings_snapshots ADD COLUMN category TEXT;`
  - `NULL` = global board (current behaviour); set = category-scoped app row.
  - New index: `(kind, category, snapshot_at DESC)`.
  - Category app rows reuse `kind='app'`, `period='day'` — only the new column distinguishes them.
- New table `market_share_snapshots`:
  - `id, snapshot_at TEXT, snapshot_day TEXT, author TEXT, token_total INTEGER, share_pct REAL, period TEXT`
  - Indexes: `(snapshot_at DESC)`, `(author, snapshot_at DESC)`.

## Scraping

Two cadences:

- **Hourly (unchanged):** `fetchRankingsFromOpenRouter` → top-20 weekly models + daily apps → `rankings_snapshots`.
- **New daily job:** triggered by a separate cron entry (e.g. `30 0 * * *`) or a once-per-day
  guard inside the hourly handler. Reuses **one** puppeteer browser session across all target
  URLs to amortize launch cost.
  - **Categories:** for each known category URL `/apps/category/{group}/{slug}`, render and
    extract top apps (reuse the apps extractor scoped to the category page). Store as `kind='app'`
    rows with `category=slug`.
  - **Market share:** extract OpenRouter's author-share series → `market_share_snapshots`
    (`author`, `token_total`, `share_pct`).

**Spike (Phase B) — must complete before Phase C:**

1. Enumerate the full category list + exact URL pattern from the `/apps` category nav.
2. Locate the market-share data source — is `openrouter.ai/data` structured/downloadable
   (preferred), else scrape the chart payload (page data array / RSC flight payload).
3. Measure per-run Browser-Rendering cost & runtime for N category pages; decide whether N must be capped.

**Guards:** each new scrape section refuses to overwrite good D1/KV data on an empty result;
failures surface via the existing `rankingsError` channel rather than poisoning the cache.

## API

1. **Extend `/api/rankings`:**
   - existing `?period=day|week|month`
   - new `?category=<slug>` — category-scoped app board.
   - new `?asOf=<ISO8601>` — board as of the snapshot at/just-before that time (per kind's native period).
   - each row gains `delta: { rankChange: number|null, pctChange: number|null }` and
     `sparkline: number[]` (compact series, last N points) — both computed server-side and
     history-gated (null/empty when insufficient).
2. **New `/api/market-share?window=<days>`** — author-share time series:
   `{ authors: [{ author, points: [{ day, sharePct, tokens }] }], window, fetchedAt }`.
3. **New `/api/rankings/categories`** — available category slugs+labels for the tabs (from latest scrape).

All cached via the existing Hono `cache()` middleware; preserve stale-while-revalidate.

## UI (`template.ts`, vanilla SVG)

Rankings tab redesign:

- **Market-share area chart** atop the rankings section — stacked-area SVG of author share
  over the selected window, legend colored from `providers.ts`. Labeled
  "Token share by model author · source: OpenRouter".
- **Leaderboard rows** gain:
  - a small inline SVG **sparkline** of that entity's token series;
  - a **delta badge** — ▲3 / ▼2 (rank) and +14% / −6% (tokens) vs prior period; hidden when history-gated.
- **Category tabs** on the apps board (All / Coding / Roleplay / Agents / Productivity / …) → refetch `?category=`.
- **"As of" date picker** — pick a past date; refetch with `?asOf=`; default = latest, show snapshot timestamp.
- Keep the existing honest empty-states (`emptyAppsMessage`) for insufficient history.

New pure helpers (testable): `sparklineSvg(points)`, `deltaBadge(rankChange, pctChange)`, `areaChartSvg(series)`.

## Phasing (one spec, incremental delivery)

- **Phase A — history features on existing data (no scraping).** Server-side delta + sparkline
  computation, `/api/rankings` sparkline/delta + `?asOf=` extensions, UI sparklines + delta
  badges + date picker. Ships first; lowest risk; this is the literal "point-in-time snapshots" ask.
- **Phase B — spike.** Confirm category URLs + market-share source + per-run cost. Output: a short findings note that unblocks C.
- **Phase C — new daily scraper + schema.** Migration `0002`, daily category + market-share scrape with guards, `/api/market-share` + `?category=`.
- **Phase D — UI for scraped data.** Market-share area chart + category tabs.

## Testing / verification

- **Unit:** delta math, history-gating thresholds, sparkline point selection, `fmtTokens` edges.
- **D1:** `asOf` + aggregation queries against seeded fixtures.
- **Scrape:** extractor run against saved HTML fixtures of a category page + the market-share page.
- **Manual (prod, cache-busted):** `/api/rankings?asOf=…`, `?category=coding`, `/api/market-share`.
- **Honesty checks:** with `< N` history, deltas/sparklines are absent, not faked.

## Risks

- **Scraper fragility** — new selectors = new breakage points. Mitigate: per-section empty-overwrite
  guards; prefer the `/data` structured source; surface failures via `rankingsError`.
- **Browser-render cost** for N category pages — mitigate with daily cadence, a single reused session, and capping N if needed.
- **Market-share honesty** — now sourced from OpenRouter directly, so faithful; must attribute clearly and gate on a successful scrape.
- **Sparse early history** — short/absent sparklines until more snapshots accumulate; gate on minimum point count.
