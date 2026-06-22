# Time-Aware Rankings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Rankings tab time-aware — per-row trend deltas + inline SVG sparklines and an "as of" historical view — built on the D1 snapshot history we already collect, then add the scraping-dependent market-share chart and category boards.

**Architecture:** Phase A computes deltas/series server-side from the existing `rankings_snapshots` table and renders hand-rolled inline SVG in the single-file template — no new deps, no schema change. Phase B is a feasibility spike that unblocks Phases C–D (categories + real market share), which are deferred to a second plan written from the spike's findings (their scraping code can't be specified without knowing OpenRouter's data source).

**Tech Stack:** Cloudflare Workers, Hono, D1 (SQLite), `@cloudflare/puppeteer`, vanilla TS/JS SSR template.

**Verification:** This project has **no test runner** (deliberate — 2 runtime deps). Established verification is `npx tsc --noEmit` + local `npx wrangler dev` + cache-busted `curl` assertions. Each task below ends in a concrete type-check + curl/dev assertion gate, matching that pattern. (If you'd prefer real unit tests for the delta/sparkline math, add `vitest` — flagged, not assumed.)

**Branch:** `feature/rankings-time-series` (already created; spec committed at `75d30af`).

---

## File structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/types.ts` | Add `RankDelta`; add optional `sparkline`/`delta` to `ModelRanking` + `AppRanking` | Modify |
| `src/fetchers.ts` | New `readSeries()` (batched daily series query) + `deltaFromSeries()` + `attachTrends()`; extend `getRankings()` for series/delta + `asOf` | Modify |
| `src/index.ts` | Parse `?asOf=` on `/api/rankings`, thread into `getRankings()` | Modify `:98-116` |
| `src/template.ts` | `sparklineSvg()`, `deltaBadge()` helpers; render them in `renderRankings()`; "as of" date input + state/fetch wiring; CSS | Modify |

Phase A touches only the four files above. No migration. Phases C–D (separate plan) add `migrations/0002_*.sql`, new `fetchers.ts` scrape/read functions, new routes, and chart/tab UI.

---

## PHASE A — Trends, sparklines & "as of" (existing data, ships independently)

### Task A1: Types for trend data

**Files:**
- Modify: `src/types.ts` (`ModelRanking` ~`:99-104`, `AppRanking` ~`:106-115`)

- [ ] **Step 1: Add the delta interface and optional fields**

```ts
// Rank/volume movement vs the prior comparable period. null fields = not enough
// history to compute honestly (do NOT render a fake delta — the 2026-05-28 lesson).
export interface RankDelta {
  rankChange: number | null;  // prior_rank - current_rank; + = moved up, - = moved down
  pctChange: number | null;   // (now - prior) / prior, fraction; null when prior tokens are 0/absent
}
```

Add to `ModelRanking` and `AppRanking` (both):

```ts
  sparkline?: number[];        // token totals, one point/day ascending; omitted when < 2 points
  delta?: RankDelta | null;    // null when insufficient history
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0 (fields are optional; nothing breaks yet).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(rankings): add RankDelta + sparkline/delta fields to ranking types"
```

---

### Task A2: Batched daily-series reader + delta math

**Files:**
- Modify: `src/fetchers.ts` (add after `aggregateApps`, ~`:534`)

- [ ] **Step 1: Add `readSeries()` — one query for all visible identifiers**

```ts
interface SeriesPoint { day: string; tokens: number; rank: number; }

// One row per (identifier, calendar day) = the LAST snapshot that day, for the
// given identifiers, over the trailing `days` window ending at `upperIso`
// (defaults to now). Models use period='week' rows (weekly-rolling total over
// time); apps use period='day'. Bounded to <= 20 identifiers (the board size).
async function readSeries(
  env: Env,
  kind: 'model' | 'app',
  period: 'day' | 'week',
  identifiers: string[],
  days: number,
  upperIso?: string,
): Promise<Map<string, SeriesPoint[]>> {
  const out = new Map<string, SeriesPoint[]>();
  if (identifiers.length === 0) return out;
  const upper = upperIso ?? new Date().toISOString();
  const cutoff = new Date(new Date(upper).getTime() - days * 86400_000).toISOString();
  const placeholders = identifiers.map(() => '?').join(',');
  const sql = `
    WITH daily AS (
      SELECT identifier, snapshot_day AS day, total_tokens AS tokens, rank,
        ROW_NUMBER() OVER (PARTITION BY identifier, snapshot_day ORDER BY snapshot_at DESC) AS rn
      FROM rankings_snapshots
      WHERE kind = ? AND period = ? AND snapshot_at >= ? AND snapshot_at <= ?
        AND identifier IN (${placeholders})
    )
    SELECT identifier, day, tokens, rank FROM daily WHERE rn = 1 ORDER BY identifier, day ASC
  `;
  const res = await env.RANKINGS_DB
    .prepare(sql)
    .bind(kind, period, cutoff, upper, ...identifiers)
    .all<{ identifier: string; day: string; tokens: number; rank: number }>();
  for (const r of res.results ?? []) {
    const arr = out.get(r.identifier) ?? [];
    arr.push({ day: r.day, tokens: Number(r.tokens) || 0, rank: r.rank });
    out.set(r.identifier, arr);
  }
  return out;
}
```

- [ ] **Step 2: Add `deltaFromSeries()` — compare latest vs ~periodDays ago**

```ts
function isoDayMinus(day: string, n: number): string {
  return new Date(new Date(day + 'T00:00:00Z').getTime() - n * 86400_000)
    .toISOString().slice(0, 10);
}

// Delta vs the last point on/before (latest_day - periodDays). Returns null when
// there is no prior point (history too short) — caller omits the badge.
function deltaFromSeries(series: SeriesPoint[], periodDays: number): RankDelta | null {
  if (!series || series.length < 2) return null;
  const latest = series[series.length - 1];
  const target = isoDayMinus(latest.day, periodDays);
  let prior: SeriesPoint | null = null;
  for (const p of series) { if (p.day <= target) prior = p; }
  if (!prior || prior.day === latest.day) return null;
  const pctChange = prior.tokens > 0 ? (latest.tokens - prior.tokens) / prior.tokens : null;
  return { rankChange: prior.rank - latest.rank, pctChange };
}
```

- [ ] **Step 3: Add `attachTrends()` — mutate board rows in place**

```ts
// periodDays: day=1, week=7, month=30. Attaches sparkline (>=2 pts) + delta.
async function attachTrends(
  env: Env,
  kind: 'model' | 'app',
  seriesPeriod: 'day' | 'week',
  rows: Array<{ identifier: string; sparkline?: number[]; delta?: RankDelta | null }>,
  periodDays: number,
  upperIso?: string,
): Promise<void> {
  const ids = rows.map((r) => r.identifier);
  const series = await readSeries(env, kind, seriesPeriod, ids, Math.max(14, periodDays + 1), upperIso);
  for (const row of rows) {
    const s = series.get(row.identifier) ?? [];
    if (s.length >= 2) row.sparkline = s.map((p) => p.tokens);
    row.delta = deltaFromSeries(s, periodDays);
  }
}
```

> Note: `rows` are typed by their concrete shape at the call site (`ModelRanking` has `modelSlug`, not `identifier`). In `getRankings`, build a small adapter array `[{ identifier: m.modelSlug, ref: m }]` (or map `title` for apps), call `attachTrends`, then copy `sparkline`/`delta` back onto the real row. Keep `attachTrends` keyed on a generic `identifier` to stay reusable.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/fetchers.ts
git commit -m "feat(rankings): batched daily-series reader + delta computation"
```

---

### Task A3: Wire trends + `asOf` into `getRankings()`

**Files:**
- Modify: `src/fetchers.ts` `getRankings()` (`:657-701`)

- [ ] **Step 1: Add an `asOf` param + an "as of" snapshot resolver**

Change the signature to `getRankings(env, period = 'day', asOf?: string)`. Add a helper next to `latestSnapshotAt`:

```ts
// Most-recent snapshot_at for (kind, period) at or before `asOf` (or overall when omitted).
async function snapshotAtBefore(
  env: Env, kind: 'model' | 'app', period: 'day' | 'week', asOf?: string,
): Promise<string | null> {
  if (!asOf) return latestSnapshotAt(env, kind, period);
  const row = await env.RANKINGS_DB
    .prepare('SELECT MAX(snapshot_at) AS s FROM rankings_snapshots WHERE kind = ? AND period = ? AND snapshot_at <= ?')
    .bind(kind, period, asOf)
    .first<{ s: string | null }>();
  return row?.s ?? null;
}
```

`readLatestModels` / `readLatestApps` get an optional `asOf` and call `snapshotAtBefore` instead of `latestSnapshotAt`. (v1 scope: `asOf` re-anchors the models board + the apps **day** board; week/month aggregations stay "current window" — documented limitation, fine for v1.)

- [ ] **Step 2: After building `models` and `apps`, attach trends**

In `getRankings`, after `const models = await modelsTask;` and the apps branch, before returning:

```ts
const periodDays = period === 'month' ? 30 : period === 'week' ? 7 : 1;
await Promise.all([
  attachTrends(env, 'model', 'week', models.map((m) => ({
    identifier: m.modelSlug,
    set: (sp?: number[], d?: RankDelta | null) => { m.sparkline = sp; m.delta = d; },
  })) as any, 7, asOf),  // models are weekly → delta always week-over-week
  apps.length > 0
    ? attachTrends(env, 'app', 'day', apps.map((a) => ({
        identifier: a.title,
        set: (sp?: number[], d?: RankDelta | null) => { a.sparkline = sp; a.delta = d; },
      })) as any, periodDays, asOf)
    : Promise.resolve(),
]);
```

> Implementation choice: give `attachTrends` rows a `set(sparkline, delta)` callback instead of copying fields, so it writes straight back onto the real `ModelRanking`/`AppRanking`. Update `attachTrends`'s row type to `{ identifier: string; set: (sp?: number[], d?: RankDelta | null) => void }` and call `row.set(s.length >= 2 ? s.map(p=>p.tokens) : undefined, deltaFromSeries(s, periodDays))`. (Pick this OR the adapter-array approach from A2 Step 3 — not both. This callback form is cleaner; update A2's `attachTrends` signature to match.)

- [ ] **Step 3: Echo `asOf` in the response + `fetchedAt`**

When `asOf` is set, `fetchedAt` should be the resolved snapshot time (`await snapshotAtBefore(env, 'model', 'week', asOf)`), and add `asOf` to the returned object so the client can confirm it. Add `asOf?: string` to `RankingsData` in `types.ts`.

- [ ] **Step 4: Type-check + local verify**

Run: `npx tsc --noEmit` → exit 0.
Run: `npx wrangler dev --port 8799` (background), then:
`curl -s 'http://localhost:8799/api/rankings?period=day' | head -c 1200`
Expected: model/app rows now include `"sparkline":[...]` (for entities with ≥2 days history) and `"delta":{...}` or `"delta":null`.
`curl -s 'http://localhost:8799/api/rankings?period=week&asOf=2026-06-15T00:00:00Z' | head -c 400`
Expected: `"asOf":"2026-06-15..."` echoed; board reflects the ≤ asOf snapshot.

- [ ] **Step 5: Commit**

```bash
git add src/fetchers.ts src/types.ts
git commit -m "feat(rankings): attach sparkline+delta and support asOf in getRankings"
```

---

### Task A4: `?asOf=` on the API route

**Files:**
- Modify: `src/index.ts` `/api/rankings` handler (`:98-116`)

- [ ] **Step 1: Parse and validate `asOf`, pass through**

```ts
const asOfRaw = c.req.query('asOf');
// Accept only ISO8601 we can trust; ignore garbage rather than 500.
const asOf = asOfRaw && !isNaN(Date.parse(asOfRaw)) ? new Date(asOfRaw).toISOString() : undefined;
const rankings = await getRankings(c.env, period, asOf);
```

Return `c.json({ ...rankings, period, asOf })`.

- [ ] **Step 2: Type-check + verify**

Run: `npx tsc --noEmit` → exit 0.
Run (dev server up): `curl -s 'http://localhost:8799/api/rankings?asOf=not-a-date' | head -c 200`
Expected: 200 OK, behaves as latest (invalid asOf ignored), no `asOf` echoed or `asOf:undefined`.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(rankings): accept ?asOf= on /api/rankings"
```

---

### Task A5: SVG sparkline + delta badge helpers (client)

**Files:**
- Modify: `src/template.ts` (add near `fmtTokens` ~`:2242`; CSS near `.lb-*` rules)

- [ ] **Step 1: Add pure helpers (vanilla, inside the template's client JS)**

```js
// Inline sparkline: normalize to a 64x18 box; flat/short series -> ''.
function sparklineSvg(points) {
  if (!points || points.length < 2) return '';
  var w = 64, h = 18, n = points.length;
  var min = Math.min.apply(null, points), max = Math.max.apply(null, points);
  var span = (max - min) || 1;
  var pts = points.map(function (v, i) {
    var x = (i / (n - 1)) * (w - 2) + 1;
    var y = h - 1 - ((v - min) / span) * (h - 2);
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  var up = points[n - 1] >= points[0];
  return '<svg class="lb-spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h +
    '" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="' +
    (up ? 'var(--up)' : 'var(--down)') + '" stroke-width="1.5"/></svg>';
}

// ▲3 / ▼2 rank move + +14% / -6% tokens. Empty when delta is null.
function deltaBadge(d) {
  if (!d) return '';
  var parts = [];
  if (typeof d.rankChange === 'number' && d.rankChange !== 0) {
    var upR = d.rankChange > 0;
    parts.push('<span class="lb-delta ' + (upR ? 'up' : 'down') + '">' +
      (upR ? '▲' : '▼') + Math.abs(d.rankChange) + '</span>');
  }
  if (typeof d.pctChange === 'number') {
    var upP = d.pctChange >= 0;
    parts.push('<span class="lb-delta ' + (upP ? 'up' : 'down') + '">' +
      (upP ? '+' : '') + Math.round(d.pctChange * 100) + '%</span>');
  }
  return parts.join('');
}
```

- [ ] **Step 2: Add CSS variables + classes**

Add `--up: #2ea043; --down: #d1242f;` to the `:root` block (check both light/dark themes). Add:

```css
.lb-spark { vertical-align: middle; margin-right: 8px; }
.lb-delta { font-size: 11px; font-weight: 600; margin-left: 6px; }
.lb-delta.up { color: var(--up); }
.lb-delta.down { color: var(--down); }
```

- [ ] **Step 3: Type-check (template is a string, so this just confirms no TS breakage)**

Run: `npx tsc --noEmit` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/template.ts
git commit -m "feat(rankings): sparklineSvg + deltaBadge client helpers"
```

---

### Task A6: Render sparkline + badge in the leaderboards

**Files:**
- Modify: `src/template.ts` `renderRankings()` (`:2263-2336`)

- [ ] **Step 1: Inject into the model row stats block**

In the `.lb-stats` div for models, change the tokens line to include the sparkline and badge:

```js
'<div class="lb-stats">' +
  sparklineSvg(m.sparkline) +
  '<div class="lb-tokens">' + fmtTokens(m.totalTokens) + deltaBadge(m.delta) + '</div>' +
  reqsHtml(m.totalRequests) +
'</div>' +
```

- [ ] **Step 2: Same for the app row stats block** (use `a.sparkline` / `a.delta`).

- [ ] **Step 3: Verify in the browser preview**

Start dev server, open `/`, switch to Rankings tab. Confirm: sparklines draw for rows with history; badges show ▲/▼ + %; rows without enough history show neither (no `NaN`, no `▲0`). Use the preview tooling (snapshot/screenshot) to confirm render.

- [ ] **Step 4: Commit**

```bash
git add src/template.ts
git commit -m "feat(rankings): render sparklines + trend badges in leaderboards"
```

---

### Task A7: "As of" date picker

**Files:**
- Modify: `src/template.ts` — markup near the rankings header (`:1512-1540`), state (`:1652-1656`), fetch + handlers

- [ ] **Step 1: Add the control + state**

Markup (place in `#rankings-section`, above the grid):

```html
<div class="rankings-asof">
  <label>View as of <input type="date" id="asof-input" max=""></label>
  <button id="asof-reset" class="period-btn" hidden>Latest</button>
  <span id="asof-note" class="leaderboard-subtitle"></span>
</div>
```

Add `asOf: null` to `state`. Set the input's `max` to today on init (`new Date().toISOString().slice(0,10)`).

- [ ] **Step 2: Wire fetch + handlers**

Where rankings are fetched, append `asOf` when set:

```js
var url = '/api/rankings?period=' + state.rankingsPeriod + (state.asOf ? '&asOf=' + encodeURIComponent(state.asOf) : '');
```

On `#asof-input` change: set `state.asOf = e.target.value ? e.target.value + 'T23:59:59Z' : null`, show/hide `#asof-reset`, clear the per-period cache (`state.rankingsByPeriod = {day:null,week:null,month:null}`) so a historical view isn't served stale, refetch, and set `#asof-note` to "showing snapshot from <fetchedAt>". `#asof-reset` click clears `state.asOf` and refetches.

> Gotcha: the period cache (`rankingsByPeriod`) keys on period only — when `asOf` changes you MUST invalidate it, or you'll show "latest" data under a past date.

- [ ] **Step 3: Verify**

Dev server: pick a past date → board + sparklines reflect that snapshot; note shows the snapshot time; "Latest" resets. Network tab shows `&asOf=` round-trips.

- [ ] **Step 4: Commit**

```bash
git add src/template.ts
git commit -m "feat(rankings): as-of date picker for historical snapshots"
```

---

### Task A8: Ship Phase A

- [ ] **Step 1: Full type-check** — `npx tsc --noEmit` → exit 0.
- [ ] **Step 2: Deploy** — `npx wrangler deploy`.
- [ ] **Step 3: Prod smoke (cache-busted)**

```bash
curl -s "https://token.app/api/rankings?period=week&_cb=$(date +%s)" | head -c 1200
curl -s "https://token.app/api/rankings?period=day&asOf=2026-06-10T23:59:59Z&_cb=$(date +%s)" | head -c 400
```
Expected: rows carry `sparkline`/`delta`; `asOf` echoed and board re-anchored.

- [ ] **Step 4: Update `## Current Work`** in `CLAUDE.md` (what shipped, prod-verified values) and commit `docs: update Current Work`.

---

## PHASE B — Feasibility spike (unblocks C–D)

### Task B1: Categories + market-share source spike

**Goal:** produce `docs/superpowers/specs/2026-06-22-rankings-spike-findings.md` answering three questions. No production code.

- [ ] **Step 1: Enumerate category URLs.** From `https://openrouter.ai/apps`, list every category link (`/apps/category/{group}/{slug}`) — slug, group, display label. (Confirmed example: `entertainment/roleplay`.) Record the full set.
- [ ] **Step 2: Locate market-share data.** Probe `https://openrouter.ai/data` and `https://openrouter.ai/rankings` for a structured author-share source: a JSON/CSV endpoint, an embedded data array, or the RSC flight payload. Prefer a structured source over chart-DOM scraping. Record exactly where the `author → token share over time` series lives.
- [ ] **Step 3: Measure cost.** Render N category pages + the market-share source in one puppeteer session; record total runtime and page count to decide whether N must be capped and confirm the daily cadence is affordable.
- [ ] **Step 4: Write findings** to the spike doc with concrete selectors/endpoints, the category list, and a go/no-go + recommended extraction method per source.
- [ ] **Step 5: Commit** `docs: rankings spike findings`.

---

## PHASE C–D — Categories + market share (DEFERRED to Plan 2)

These are intentionally **not** broken into tasks here: their scraping/extraction code depends on Phase B's findings, and writing complete-code tasks against an unknown data source would be guesswork (a plan-failure per writing-plans). After B1 lands, write `docs/superpowers/plans/2026-06-22-rankings-categories-marketshare.md` covering:

- **Migration `0002_categories_and_market_share.sql`** — `ALTER TABLE rankings_snapshots ADD COLUMN category TEXT;` + index `(kind, category, snapshot_at DESC)`; `CREATE TABLE market_share_snapshots (id, snapshot_at, snapshot_day, author, token_total, share_pct, period)` + indexes.
- **Daily scrape** — once-per-day guard inside the existing `scheduled` handler (NOT a new cron trigger — `wrangler.toml` is gitignored). One reused puppeteer session over the category URLs + market-share source. Per-section empty-overwrite guards mirroring `refreshAllData`.
- **Reads + routes** — `?category=<slug>` on `/api/rankings` (kind='app', category=slug); `/api/market-share?window=<days>`; `/api/rankings/categories`.
- **UI** — `areaChartSvg()` stacked-area market-share chart (colors from `providers.ts`, labeled "source: OpenRouter"); category tabs on the apps board; same history-gating discipline.

---

## Self-review

**Spec coverage:** (1) Trends & deltas → A2–A3, A6. (2) Time-series charts → sparklines A5–A6; market-share chart → Phase C–D (gated on B). (3) "As of" snapshots → A3, A4, A7. (4) Category leaderboards → Phase C–D (gated on B). All four spec goals map to tasks; the two scraping-dependent ones are correctly deferred behind the spike.

**Placeholder scan:** No "TBD/handle edge cases" in Phase A — every code step shows real code and a concrete curl/type-check gate. Phase C–D is explicitly deferred with a named follow-up plan (not a placeholder inside an executable task).

**Type consistency:** `RankDelta` (A1) is used identically in `deltaFromSeries`/`attachTrends` (A2), `getRankings` (A3), and `deltaBadge` (A5, reading `rankChange`/`pctChange`). `SeriesPoint` is internal to fetchers. A2 Step 3 and A3 Step 2 note the ONE design choice to lock (callback `set()` form) so `attachTrends`'s signature is consistent across both tasks — resolve to the callback form when implementing A2.
