# Token Share time-series chart + rankings JSON migration — design

**Date:** 2026-06-26
**Status:** Design for review
**Author:** session with Heatherm

## Problem

The Rankings tab's "Token Share by Model Author" chart is unusable:

- It's a stacked **area chart over time** (`areaChartSvg` in `src/template.ts`), but only
  **3 days** of D1 history exist and shares barely move day-to-day, so it collapses into
  flat, meaningless horizontal stripes.
- "Hover" is a bare SVG `<title>` (author name only) — no %, no date, no change.
- `preserveAspectRatio="none"` distorts the geometry.
- A 10-segment stack is the wrong form for "who holds what share and who's moving."

User verdict: "the chart is terrible, no mouse over info, no point in time changes, no
idea what is that for, terrible design." Correct on all counts.

## Key discovery

OpenRouter exposes **all** rankings data as clean public JSON under
`/api/frontend/v1/rankings/*` (plain GET + browser UA, no auth). This both fixes the chart
(real history to draw) and lets us retire the fragile puppeteer/Browser-Rendering scrape
that the entire CLAUDE.md "Gotchas" section is about.

| Data | Endpoint | What it returns |
|---|---|---|
| Author share | `/rankings/market-share` | **52 weekly points** (1 yr), `{x, ys:{author→tokens, others}}` |
| Model share | `/rankings/model-rankings-chart` | **52 weekly points** (1 yr), `{data:[{x, ys:{model→tokens, Others}}], cachedAt}` |
| Model leaderboard | `/rankings/models` | Current — 419 models, daily token totals (latest day only is dense) |
| Agent/app board | `/rankings/apps` | Current — `{day, week, month}`, top-20 each |
| Per-category agent boards | *(none)* | **Next.js server action** (POST to page URL, build-hashed) — not safely replicable |

Verified: `market-share` latest week reproduces today's legend exactly (deepseek 16.0%,
anthropic 15.4%, others 13.2%, … z-ai 5.3%). Share% = `author_tokens / Σ(ys incl. others)`.

The per-category boards were confirmed (via live browser network capture) to be served by a
server action — a POST to `https://openrouter.ai/apps/category/{group}/{slug}` keyed by a
deploy-volatile hash. Replicating that would be more fragile than scraping, so categories
stay on puppeteer.

## Locked decisions

1. **Direction:** fix the real time-series chart (proper axes, crosshair tooltip, no
   distortion) — not the ranked-bars alternative. Backfill makes the history-gate moot.
2. **Window toggle:** **30D / 90D / 1Y**, driving both the x-axis range AND each series'
   change-over-window delta (Δ = latest vs first point in window).
3. **Data source:** switch market share from puppeteer legend-scrape to the JSON endpoint.
4. **Backfill:** pull all available history — authors **and** models (52 weeks each).
   Agents have no deep history (apps endpoint is current-only); the win there is immediate
   7D/30D unlock + going-forward accumulation.
5. **Scope:** **replace puppeteer entirely** for primary data; **hybrid** — keep puppeteer
   ONLY for the 15 per-category agent boards (server action, not replicable).
6. **Chart views:** add a **By author / By model** toggle (both are identical 52-week
   weekly-share series → one chart component, two datasets).

## Architecture

### Fetch layer (`src/fetchers.ts`)

Replace puppeteer-based scraping for primary data with JSON fetchers (plain `fetch` +
browser `User-Agent` header; parse JSON; tolerate failure → keep last-good KV):

- `fetchMarketShareSeries(env)` → GET `/rankings/market-share`. Normalize to weekly share
  (see Normalization). Powers the author chart view.
- `fetchModelShareSeries(env)` → GET `/rankings/model-rankings-chart`. Same normalization.
  Powers: the model chart view, the **model leaderboard** (latest week ranked), and model
  **sparklines** (each model's weekly trajectory).
- `fetchAppsBoards(env)` → GET `/rankings/apps`. Returns `{day, week, month}` top-20.
  Replaces the puppeteer apps scrape AND removes the week/month history gate (data is now
  available directly).
- `fetchCategoryBoards(env)` → **unchanged puppeteer** (`scrapeCategoryLeaderboards` over
  the 15 `APP_CATEGORIES`). The only remaining Browser-Rendering use.

Remove: `fetchRankingsFromOpenRouter` puppeteer model/app/market-share extraction
(`RANKINGS_EXTRACTOR_SOURCE`, market-share DOM-walk), and the associated selectors.

### Model leaderboard source decision

The model leaderboard ("Top models by weekly token volume") is sourced from
`model-rankings-chart` **latest week** (top-9 named + Others, by weekly tokens). This keeps
weekly semantics, gives sparklines for free from the same series, and stays consistent with
the chart's model view.

- Behavioral change to flag: today's board shows top-10; the chart endpoint names top-9
  (the 10th is folded into "Others"). Net: model board becomes top-9. Acceptable; confirm
  in review. (`/rankings/models` gives all 419 models but only daily granularity, so it
  can't reproduce a weekly top-10 — not used as the board source.)

### Storage

- **KV (primary):** authoritative current data + full series live in KV, refreshed each
  cron. Proposed keys (or one consolidated `rankings` blob): `market_share_series`,
  `model_share_series`, `apps_boards`, `model_leaderboard`, `category_boards`.
  The JSON endpoints *are* the history, so no accumulation/dedup needed for series.
- **Empty-overwrite guard (retained):** if a fetch returns nothing, keep last-good KV and
  surface `rankingsError` rather than poisoning the cache.
- **D1 (`rankings_snapshots`):** keep writing **category** snapshots going forward (the
  only source of category history / "view as of" for categories). Continue snapshotting the
  JSON-sourced boards too if "view as of" continuity is wanted (see Scope boundaries).
- **D1 (`market_share_snapshots`) + daily aggregation + `historyDays`/gate logic:** becomes
  dead code (JSON gives a full year). Remove read paths; the empty "X/Y days collected"
  message goes away. Table/migration left in place (no destructive drop required).

### API (`src/index.ts`)

- `/api/market-share` → serve **both** normalized series (author + model) from KV in one
  payload (`{author: ShareSeries, model: ShareSeries}`, ~26KB). Client fetches once, then
  slices by window, switches author/model view, and computes deltas entirely client-side —
  zero refetch on any toggle.
- `/api/rankings` → serve model leaderboard + sparklines (from model series), apps boards
  (day/week/month from `apps_boards`), and category boards (from D1/KV). Drop the
  week/month history gate (`countAppDaysInRange`, `appsHistoryDays/Required`).
- Cron handler (`refreshAllData`): call the JSON fetchers (fast) + the category puppeteer
  scrape (slow, cron-only — keeps the existing `includeCategories` gating and the
  ~100s edge-timeout reasoning for `/api/refresh`).

### Normalization (shared by both series)

Input per week: `{x: "YYYY-MM-DD", ys: {<entity>: tokens, …, others}}`. The named-entity
set varies per week (top-N of that week). To build consistent stacked bands:

1. **Display set** = latest week's top-9 named entities (authors or models).
2. For each week and each display entity: `share = ys[entity] / weeklyTotal` if present,
   else `0` (it was outside that week's top-N → its volume sits inside that week's others).
3. `others = 100 − Σ(displayed shares that week)` — absorbs both the real "others" bucket
   and any non-display top entities of that week. Every week sums to 100%.

This yields a true story: today's leaders grow from ~0 a year ago while "others" shrinks.

Output shape (`src/types.ts`):

```ts
interface MarketSharePoint { date: string; sharePct: number; tokens: number }
interface ShareSeriesEntity { key: string; label: string; color?: string;
                              latestPct: number; points: MarketSharePoint[] }
interface ShareSeries { entities: ShareSeriesEntity[]; weeks: number; fetchedAt: string }
// MarketShareData → { author: ShareSeries, model: ShareSeries }  (or two KV blobs)
```

## The chart (rewrite `areaChartSvg` + render/handlers in `src/template.ts`)

A legible, interactive stacked-area time-series. Single component, fed either dataset.

- **Frame:** SVG with margins. Left Y-axis labels 0/25/50/75/100%; bottom X-axis a few week
  dates; horizontal gridlines in `--border`. **No `preserveAspectRatio="none"`.**
- **Bands:** one stacked area per entity, provider colors via `authorColor()` (extend for
  model keys), "others" neutral gray; 2px surface-gap between bands; `fill-opacity` ~0.85.
- **Crosshair hover:** mousemove → nearest week index → vertical guide line + a tooltip
  listing **every entity's exact share that week**, sorted desc, with color swatches. This
  is the missing "point-in-time" readout. Mouseleave hides it. Tooltip clamps to viewport
  (mobile-safe). Series data stored on a `state` field for the handler; no `position:fixed`.
- **Legend:** entity swatch + latest % + **change-over-window delta** (▲▼ pp), sorted by
  latest share desc. Delta baseline = first point in the selected window.
- **View toggle:** `By author` / `By model` — swaps dataset, re-renders, keeps window.
- **Window toggle:** `30D / 90D / 1Y` → `state.msWindow` ∈ {30,90,365}; slices the series
  client-side (30D ≈ 4–5 weekly points, 90D ≈ 13, 1Y = 52) and recomputes deltas.
- **Copy:** subtitle → accurate, e.g. "Weekly share of OpenRouter tokens · source:
  OpenRouter". Title gains the author/model view label.
- **States:** graceful empty state if KV missing ("Market share data unavailable"). The old
  "building history — X/Y days" gate is removed.
- **Theming/a11y:** works in light + dark (CSS vars for chrome, provider colors for bands);
  `role="img"` + an aria-label summarizing the latest top shares; the legend gives
  screen-reader-readable values.

## Backfill / rollout

No separate backfill job needed: the JSON endpoints return the full 52-week series on every
call, so the first cron (or first `/api/refresh`) populates KV with a full year immediately.
Deploy order: ship fetchers + KV + API + template together; run one refresh; verify.

## What's removed

- Puppeteer extraction for models, apps, and market share (DOM selectors, extractor source).
- `market_share_snapshots` read/aggregation + `historyDays`/gate; the "X/Y days collected"
  empty message; `appsHistoryDays/Required` week/month gate.
- `preserveAspectRatio="none"` stripe chart.

## What's kept

- Puppeteer + Browser Rendering binding **only** for the 15 per-category agent boards.
- D1 `rankings_snapshots` writes for category history (and optionally JSON-board continuity).
- `/api/refresh` fast-path vs cron `includeCategories` split and edge-timeout reasoning.
- Empty-overwrite guard; provider color styling; all "usage rankings" copy.

## Risks & mitigations

- **Undocumented `/api/frontend/v1/` endpoints could change.** Strictly sturdier than the
  current DOM scrape of the same frontend; keep last-good KV + `rankingsError` on failure;
  validate shape on parse.
- **Weekly cadence** → 30D shows only ~4–5 points (short line). Acceptable; 90D/1Y are rich.
- **Top-9 vs top-10** model board (above) — minor; confirm in review.
- **Server-action category boards** could change hash/shape → existing puppeteer risk,
  unchanged. Non-fatal (category scrape already isolated + skip-on-failure).

## Files touched

- `src/fetchers.ts` — JSON fetchers + normalization + KV; remove puppeteer for primary;
  keep category puppeteer.
- `src/index.ts` — `/api/market-share` (+ model view), `/api/rankings` from KV; drop gates;
  cron wiring.
- `src/template.ts` — chart rewrite (axes, crosshair, legend deltas), author/model toggle,
  30D/90D/1Y toggle, copy, states; model sparklines from model series.
- `src/types.ts` — `ShareSeries`/`MarketSharePoint`/board types.
- `src/providers.ts` — extend color lookup for model keys if needed.
- (No destructive D1 migration; dead tables left in place.)

## Scope boundaries / open items

- **"View as of" date picker:** authors/models now have 52 weekly points → as-of by week
  works from JSON. Apps/models leaderboards are current-only from JSON; historical "as of"
  for those remains limited to accumulated D1 (same as today, going forward). Confirm
  whether to keep snapshotting JSON boards into D1 for continuity.
- **Model board top-9** behavioral change — confirm acceptable.
- **REFRESH_SECRET** rotated 2026-06-24; never commit. Cron still owns the slow category
  scrape; `/api/refresh` stays on the fast JSON path.

## Verification plan

- Unit-check normalization: every week sums to 100%; latest author week matches the live
  legend exactly.
- Confirm `model-rankings-chart` latest week reproduces the model leaderboard's weekly
  totals (deepseek-v4-flash ≈ 4.9T, mimo-v2.5 ≈ 4.4T, …) — the one numeric check deferred
  from design (Bash classifier outage).
- `tsc` clean; `wrangler deploy --dry-run` bundles; esbuild-render check of `getHtml()`
  (local wrangler dev is broken — see claude-mem `tokenapp-local-preview-workaround`).
- Deploy + curl smoke: `/api/market-share` (author+model) returns 52-week series; `/api/
  rankings` returns apps day/week/month + categories; chart renders with crosshair in the
  browser preview (light + dark, mobile width).
