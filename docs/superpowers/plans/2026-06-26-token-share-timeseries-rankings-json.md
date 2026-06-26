# Token Share time-series chart + rankings JSON migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken stacked-stripe "Token Share" chart with a real interactive
stacked-area time-series (a year of weekly history, crosshair tooltip, author/model toggle,
30D/90D/1Y), and migrate all primary rankings data from the fragile puppeteer scrape to
OpenRouter's clean JSON endpoints — keeping puppeteer only for the 15 per-category boards.

**Architecture:** Cron fetches OpenRouter `/api/frontend/v1/rankings/*` JSON, normalizes to
weekly share series + leaderboards, stores in KV; D1 keeps accumulating app/model snapshots
(sparklines + "view as of" continuity) and category boards (puppeteer). The single-file SPA
template (`getHtml()`) renders the chart and reads `/api/market-share` + `/api/rankings`.

**Tech Stack:** Cloudflare Workers, Hono, KV, D1, TypeScript, inline SVG/vanilla JS (no
framework, no chart lib).

**Verification model (project reality — no test runner; local wrangler/miniflare is broken):**
each task verifies via the project's real tooling, per the spec:
- `npx tsc --noEmit` — type check
- `npx wrangler deploy --dry-run --outdir /tmp/wb` — bundles the Worker
- esbuild-render of `getHtml()` to static HTML (claude-mem `tokenapp-local-preview-workaround`) for template tasks
- `curl` smoke against the deploy preview for data/API tasks
- browser preview (mcp Claude_Preview) for chart interaction

---

## File structure

- `src/types.ts` — **modify**: add `SharePoint`/`ShareEntity`/`ShareSeries`/`MarketShareResponse`; add KV keys `SHARE_SERIES`, `APPS_BOARDS`. Keep `MarketShareData` only if still referenced; otherwise remove.
- `src/openrouter-json.ts` — **create**: pure JSON fetch + normalization for the rankings endpoints (one focused module; keeps `fetchers.ts` from growing further). Exports `fetchShareSeries`, `fetchAppsBoards`, `normalizeShareSeries`, `modelBoardFromSeries`.
- `src/fetchers.ts` — **modify**: `refreshAllData` calls the new JSON fetchers + writes KV/D1; `getRankings` reads KV for the global board, D1 for category boards; remove `fetchRankingsFromOpenRouter` (puppeteer model/app/market-share), `writeMarketShareSnapshot`, `readMarketShare`, market-share gate. Keep `fetchCategoryRankings` + category D1.
- `src/index.ts` — **modify**: `/api/market-share` returns `{author, model}` from KV; `/api/rankings` unchanged signature but now KV-backed for global; drop nothing in routing.
- `src/template.ts` — **modify**: rewrite chart (`areaChartSvg` → `shareChartSvg` + crosshair handler), `marketShareLegend` (add window delta), author/model + 30/90/365 toggles, `renderMarketShare`/`loadMarketShare`, copy; model sparklines now come from the series.
- `src/providers.ts` — **modify** (if needed): color fallback for model-key entities.

---

## Phase A — Data layer (JSON fetch + normalization)

### Task 1: Types and KV keys

**Files:**
- Modify: `src/types.ts:148-166`

- [ ] **Step 1: Add share-series types** (replace the `MarketShare*` block at `src/types.ts:148-156`)

```ts
// ── Token share time-series (OpenRouter /rankings JSON) ──────────────────────
export interface SharePoint { date: string; pct: number; tokens: number }
export interface ShareEntity {
  key: string;        // author slug ("deepseek") or model permaslug ("xiaomi/mimo-v2.5-...")
  label: string;      // display label
  latestPct: number;  // share in the most recent week
  points: SharePoint[]; // weekly, ascending; pct sums to 100 across entities per week
}
export interface ShareSeries { entities: ShareEntity[]; weeks: number; fetchedAt: string }
export interface MarketShareResponse { author: ShareSeries; model: ShareSeries; fetchedAt: string }
```

- [ ] **Step 2: Add KV keys** (in the `KV_KEYS` object at `src/types.ts:161-166`)

```ts
export const KV_KEYS = {
  MODELS: 'models:all',
  MODELS_UPDATED: 'models:last_updated',
  SUBSCRIPTIONS: 'subscriptions:all',
  RANKINGS: 'rankings:all',
  SHARE_SERIES: 'share:series',   // MarketShareResponse (author + model)
  APPS_BOARDS: 'rankings:apps',    // { day, week, month, fetchedAt } AppRanking arrays
} as const;
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` (expect errors only where removed `MarketShareData` is still referenced — those are fixed in later tasks; confirm no syntax errors in types.ts itself by `npx tsc --noEmit src/types.ts` if isolatable, else proceed).
- [ ] **Step 4: Commit** — `git add src/types.ts && git commit -m "feat(types): share-series types + KV keys for rankings JSON"`

---

### Task 2: JSON fetch + normalization module

**Files:**
- Create: `src/openrouter-json.ts`

Endpoint facts (verified 2026-06-26):
- `GET https://openrouter.ai/api/frontend/v1/rankings/market-share` → `{data:[{x:"YYYY-MM-DD", ys:{<author>:tokens, others:tokens}}]}` (52 weekly points).
- `GET .../rankings/model-rankings-chart` → `{data:{data:[{x, ys:{<model>:tokens, Others:tokens}}], cachedAt}}` (52 weekly points).
- `GET .../rankings/apps` → `{data:{day:[...], week:[...], month:[...]}}` each 20 rows: `{app_id, total_tokens:"<str>", total_requests, rank, app:{title, description, slug, origin_url, favicon_url, ...}}`.
- All return 200 to a plain GET with a browser `User-Agent`; no auth.

- [ ] **Step 1: Create the module with normalization** (`src/openrouter-json.ts`)

```ts
import type { ShareSeries, ShareEntity, SharePoint, AppRanking } from './types';

const UA = 'Mozilla/5.0 (compatible; token.app/1.0; +https://token.app)';
const BASE = 'https://openrouter.ai/api/frontend/v1/rankings';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    cf: { cacheTtl: 0 },
  });
  if (!res.ok) throw new Error(`OpenRouter ${path} HTTP ${res.status}`);
  return (await res.json()) as T;
}

type RawPoint = { x: string; ys: Record<string, number> };

// Normalize a weekly token-count series to per-week share %, with a fixed
// display set = the latest week's top-N named entities (rest fold into "others").
export function normalizeShareSeries(
  raw: RawPoint[],
  topN = 9,
  label: (key: string) => string = (k) => k,
): ShareSeries {
  const clean = (raw || []).filter((p) => p && p.ys && p.x);
  if (clean.length === 0) return { entities: [], weeks: 0, fetchedAt: new Date().toISOString() };
  const othersKey = (ys: Record<string, number>) =>
    'others' in ys ? 'others' : 'Others' in ys ? 'Others' : null;

  const last = clean[clean.length - 1].ys;
  const lok = othersKey(last);
  const display = Object.entries(last)
    .filter(([k]) => k !== lok)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([k]) => k);

  const entities: ShareEntity[] = display.map((key) => ({ key, label: label(key), latestPct: 0, points: [] }));
  const others: ShareEntity = { key: 'others', label: 'Others', latestPct: 0, points: [] };

  for (const p of clean) {
    const total = Object.values(p.ys).reduce((s, v) => s + (v || 0), 0) || 1;
    let displayed = 0;
    for (const e of entities) {
      const tok = p.ys[e.key] || 0;
      const pct = (tok / total) * 100;
      e.points.push({ date: p.x, pct: Math.round(pct * 100) / 100, tokens: tok });
      displayed += pct;
    }
    const oPct = Math.max(0, 100 - displayed);
    others.points.push({ date: p.x, pct: Math.round(oPct * 100) / 100, tokens: Math.round((oPct / 100) * total) });
  }
  for (const e of [...entities, others]) e.latestPct = e.points[e.points.length - 1]?.pct ?? 0;
  return { entities: [...entities, others], weeks: clean.length, fetchedAt: new Date().toISOString() };
}

// Pretty model label from a permaslug ("xiaomi/mimo-v2.5-20260422" → "mimo-v2.5").
function modelLabel(permaslug: string): string {
  const tail = permaslug.split('/').pop() || permaslug;
  return tail.replace(/-20\d{6}$/, '').replace(/:free$/, ' (free)');
}

export async function fetchShareSeries(): Promise<{ author: ShareSeries; model: ShareSeries }> {
  const [ms, mc] = await Promise.all([
    getJson<{ data: RawPoint[] }>('market-share'),
    getJson<{ data: { data: RawPoint[] } }>('model-rankings-chart'),
  ]);
  return {
    author: normalizeShareSeries(ms.data, 9),
    model: normalizeShareSeries(mc.data.data, 9, modelLabel),
  };
}
```

- [ ] **Step 2: Add apps-board fetch + mapping** (append to `src/openrouter-json.ts`)

```ts
type RawApp = {
  rank: number; total_tokens: string; total_requests: number;
  app: { title: string; description: string | null; slug: string;
         origin_url: string | null; favicon_url: string | null };
};

function mapApp(r: RawApp): AppRanking {
  return {
    rank: r.rank,
    title: r.app.title,
    description: r.app.description || '',
    categories: [],
    originUrl: r.app.origin_url || '',
    faviconUrl: r.app.favicon_url || null,
    totalTokens: Number(r.total_tokens) || 0,
    totalRequests: r.total_requests || 0,
  };
}

export async function fetchAppsBoards(): Promise<Record<'day' | 'week' | 'month', AppRanking[]>> {
  const { data } = await getJson<{ data: Record<'day' | 'week' | 'month', RawApp[]> }>('apps');
  return {
    day: (data.day || []).map(mapApp),
    week: (data.week || []).map(mapApp),
    month: (data.month || []).map(mapApp),
  };
}
```

- [ ] **Step 3: Add model-leaderboard derivation from the series** (append)

```ts
import type { ModelRanking } from './types';

// Build the weekly model leaderboard from the model share series: rank by latest
// week tokens (exclude "others"), sparkline = last 8 weeks of tokens, delta =
// week-over-week token % change.
export function modelBoardFromSeries(model: ShareSeries): ModelRanking[] {
  const date = model.entities[0]?.points.at(-1)?.date ?? new Date().toISOString().slice(0, 10);
  return model.entities
    .filter((e) => e.key !== 'others')
    .map((e) => {
      const pts = e.points;
      const tokens = pts.at(-1)?.tokens ?? 0;
      const prev = pts.at(-2)?.tokens ?? 0;
      const spark = pts.slice(-8).map((p) => p.tokens);
      const pctChange = prev > 0 ? (tokens - prev) / prev : null;
      return {
        modelSlug: e.key,
        totalTokens: tokens,
        totalRequests: 0,
        date,
        sparkline: spark.length >= 2 ? spark : undefined,
        delta: pctChange === null ? null : { rankChange: null, pctChange },
      } as ModelRanking;
    })
    .sort((a, b) => b.totalTokens - a.totalTokens);
}
```

- [ ] **Step 4: Verify normalization against live data** — write `/tmp/normcheck.mjs` that imports nothing (inline a copy isn't allowed; instead esbuild-bundle the module) OR run the equivalent check with this one-off:

Run:
```bash
npx esbuild src/openrouter-json.ts --bundle --format=esm --platform=node --outfile=/tmp/orj.mjs \
&& node --input-type=module -e "
import { fetchShareSeries } from '/tmp/orj.mjs';
const { author, model } = await fetchShareSeries();
const last = author.entities.map(e => [e.label, e.latestPct]);
const sum = author.entities.reduce((s,e)=>s+e.latestPct,0);
console.log('weeks', author.weeks, 'sum%', Math.round(sum), 'deepseek', last.find(x=>x[0]==='deepseek'));
console.log('model top', model.entities.filter(e=>e.key!=='others').slice(0,3).map(e=>[e.label, (e.points.at(-1).tokens/1e12).toFixed(2)+'T']));
"
```
Expected: `weeks 52`, `sum% 100`, deepseek ≈ 16; model top shows mimo-v2.5/deepseek-v4-flash ≈ 4–5T (confirms the model board maps to the leaderboard — the numeric check deferred from design).

- [ ] **Step 5: Commit** — `git add src/openrouter-json.ts && git commit -m "feat(rankings): JSON fetch + share-series normalization for OpenRouter endpoints"`

---

### Task 3: Wire JSON into `refreshAllData` + KV/D1 writes

**Files:**
- Modify: `src/fetchers.ts:901-1005` (`refreshAllData`)

- [ ] **Step 1: Import the new module** (top of `src/fetchers.ts`)

```ts
import { fetchShareSeries, fetchAppsBoards, modelBoardFromSeries } from './openrouter-json';
```

- [ ] **Step 2: Replace the rankings try-block** (`src/fetchers.ts:915-970`) with JSON-sourced writes.

Replace the body of the `try { const scrape = await fetchRankingsFromOpenRouter(env); … }` block with:

```ts
  let rankingsStatus: string | undefined;
  let rankingsError: string | undefined;
  try {
    const [{ author, model }, apps] = await Promise.all([fetchShareSeries(), fetchAppsBoards()]);
    const topModels = modelBoardFromSeries(model);

    // Empty-overwrite guard: keep last-good KV if OpenRouter returns nothing.
    if (topModels.length === 0 && apps.day.length === 0 && author.entities.length === 0) {
      throw new Error('Rankings JSON returned empty — KV left unchanged');
    }

    const fetchedAt = new Date().toISOString();
    await env.TOKEN_APP_KV.put(KV_KEYS.SHARE_SERIES,
      JSON.stringify({ author, model, fetchedAt }), { expirationTtl: 7200 });
    await env.TOKEN_APP_KV.put(KV_KEYS.APPS_BOARDS,
      JSON.stringify({ ...apps, fetchedAt }), { expirationTtl: 7200 });

    const ssrPayload: RankingsData = {
      topModels,
      topApps: { day: apps.day, week: apps.week, month: apps.month },
      fetchedAt,
    };
    await env.TOKEN_APP_KV.put(KV_KEYS.RANKINGS, JSON.stringify(ssrPayload), { expirationTtl: 7200 });

    // D1 continuity: keep accumulating the day app board + weekly model board so
    // app sparklines/deltas and "view as of" keep working going forward.
    await writeJsonSnapshots(env, topModels, apps.day, fetchedAt);

    rankingsStatus = `models: ${topModels.length}w, apps: ${apps.day.length}d, series: ${author.weeks}w`;
  } catch (err) {
    console.error('Rankings JSON fetch failed (non-fatal):', err);
    rankingsError = String(err);
  }
```

- [ ] **Step 3: Add `writeJsonSnapshots`** (new helper near the other D1 writers, replacing `writeMarketShareSnapshot` usage). It appends model `week` + app `day` rows to `rankings_snapshots` for sparkline/delta/view-as-of continuity.

```ts
async function writeJsonSnapshots(
  env: Env, models: ModelRanking[], appsDay: AppRanking[], fetchedAt: string,
): Promise<void> {
  const day = fetchedAt.slice(0, 10);
  const stmt = env.RANKINGS_DB.prepare(`
    INSERT INTO rankings_snapshots
      (snapshot_at, snapshot_day, kind, period, rank, identifier, name, description, total_tokens, origin_url, favicon_url, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`);
  const batch = [
    ...models.map((m, i) => stmt.bind(fetchedAt, day, 'model', 'week', i + 1, m.modelSlug, m.modelSlug, null, m.totalTokens, null, null)),
    ...appsDay.map((a) => stmt.bind(fetchedAt, day, 'app', 'day', a.rank, a.title, a.title, a.description || null, a.totalTokens, a.originUrl || null, a.faviconUrl)),
  ];
  if (batch.length) await env.RANKINGS_DB.batch(batch);
}
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit` (expect remaining errors only in code paths removed in Task 5/6: `fetchRankingsFromOpenRouter`, `writeMarketShareSnapshot`, `readMarketShare`). Confirm `refreshAllData` and `writeJsonSnapshots` themselves type-check.
- [ ] **Step 5: Commit** — `git add src/fetchers.ts && git commit -m "feat(rankings): refreshAllData sources models/apps/share from JSON; D1 continuity snapshots"`

---

## Phase B — API + dead-code removal

### Task 4: `getRankings` global-from-KV, category-from-D1; remove market-share D1 path

**Files:**
- Modify: `src/fetchers.ts:1059-1131` (`getRankings`), remove `1133-1185` (`readMarketShare`, `isAuthorSlug`, `MARKET_SHARE_NON_AUTHORS`), remove `fetchRankingsFromOpenRouter` (`381-558`), `writeRankingsSnapshot` if now unused, `writeMarketShareSnapshot` (`649-666`).

- [ ] **Step 1: Rewrite `getRankings`** so the global board (category == null) reads KV; category boards keep the D1 path (puppeteer-fed).

```ts
export async function getRankings(
  env: Env, period: RankingPeriod = 'day', asOf?: string, category?: string | null,
): Promise<RankingsData | null> {
  const cat = category ?? null;

  // Category board: unchanged D1 path (puppeteer-fed, daily). Models stay global.
  if (cat != null) {
    return getCategoryRankings(env, period, asOf, cat); // extracted from old getRankings body
  }

  // Global board: KV (JSON-sourced). Models from RANKINGS; apps day/week/month
  // direct from APPS_BOARDS; app sparklines/deltas from D1 day history.
  const raw = await env.TOKEN_APP_KV.get(KV_KEYS.RANKINGS);
  if (!raw) return null;
  const base = JSON.parse(raw) as RankingsData;
  const apps = base.topApps[period] ?? [];
  try {
    await attachTrends(env, 'app', 'day',
      apps.map((a): TrendRow => ({ identifier: a.title,
        set: (sp, d) => { a.sparkline = sp; a.delta = period === 'day' ? d : null; } })),
      period === 'month' ? 30 : period === 'week' ? 7 : 1, asOf);
  } catch { /* sparkline best-effort */ }
  const topApps: Record<RankingPeriod, AppRanking[]> = { day: [], week: [], month: [] };
  topApps[period] = apps;
  return { topModels: base.topModels, topApps, fetchedAt: base.fetchedAt, asOf: asOf || undefined };
}
```

- [ ] **Step 2: Extract `getCategoryRankings`** — move the old `getRankings` body (the D1 read + gate + trends, `1066-1122`) verbatim into a new `async function getCategoryRankings(env, period, asOf, cat)` that always has `cat != null`. Keep the week/month gate (`countAppDaysInRange`) for categories.

- [ ] **Step 3: Delete dead code** — remove `fetchRankingsFromOpenRouter` and its extractor constants (`RANKINGS_EXTRACTOR_SOURCE`, market-share DOM-walk), `writeMarketShareSnapshot`, `readMarketShare`, `isAuthorSlug`, `MARKET_SHARE_NON_AUTHORS`, and the `MarketShareData`/`MarketSharePoint` imports if unused. Keep `fetchCategoryRankings`, `writeCategorySnapshot`, `attachTrends`, `aggregateApps`, `countAppDaysInRange`, `readLatestApps`, `readLatestModels`, `snapshotAtBefore`.

- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean; `npx wrangler deploy --dry-run --outdir /tmp/wb` bundles.
- [ ] **Step 5: Commit** — `git add src/fetchers.ts && git commit -m "refactor(rankings): KV global board + D1 category board; remove puppeteer model/app/market-share + D1 market-share path"`

---

### Task 5: `/api/market-share` returns author+model series

**Files:**
- Modify: `src/index.ts:90-104`, import update `src/index.ts:5`

- [ ] **Step 1: Replace the handler** (`src/index.ts:90-104`)

```ts
app.get(
  '/api/market-share',
  cache({ cacheName: 'token-app-market-share', cacheControl: 'max-age=3600, stale-while-revalidate=86400' }),
  async (c) => {
    try {
      const raw = await c.env.TOKEN_APP_KV.get(KV_KEYS.SHARE_SERIES);
      if (!raw) return c.json({ error: 'Market share not yet available' }, 404);
      return c.json(JSON.parse(raw));
    } catch (err) {
      console.error('Failed to get market share:', err);
      return c.json({ error: 'Failed to load market share' }, 500);
    }
  }
);
```

- [ ] **Step 2: Fix imports** — `src/index.ts:5` remove `readMarketShare`; add `KV_KEYS` import from `./types` if not present.
- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; `npx wrangler deploy --dry-run` bundles.
- [ ] **Step 4: Commit** — `git add src/index.ts && git commit -m "feat(api): /api/market-share serves author+model weekly series from KV"`

---

## Phase C — Template / chart rewrite

### Task 6: New stacked-area chart with axes (no distortion)

**Files:**
- Modify: `src/template.ts:2328-2359` (replace `areaChartSvg` with `shareChartSvg`), CSS `src/template.ts:1046`.

- [ ] **Step 1: Replace `areaChartSvg`** with a margined, undistorted stacked-area builder keyed on the new `ShareSeries` shape. Renders bands + Y gridlines (0/25/50/75/100%) + a few X date labels; assigns `data-i` week index hit-targets are handled by the overlay in Task 7.

```js
function shareChartSvg(series) {
  var ents = (series && series.entities) || [];
  if (ents.length === 0) return '';
  var pts0 = ents[0].points || [];
  var n = pts0.length;
  if (n < 2) return '<div class="ms-empty">Not enough history yet.</div>';
  var W = 760, H = 260, mL = 34, mR = 8, mT = 8, mB = 22;
  var pw = W - mL - mR, ph = H - mT - mB;
  var x = function (i) { return mL + (i / (n - 1)) * pw; };
  var y = function (pct) { return mT + (1 - pct / 100) * ph; };
  var grid = [0, 25, 50, 75, 100].map(function (g) {
    return '<line x1="' + mL + '" y1="' + y(g).toFixed(1) + '" x2="' + (W - mR) + '" y2="' + y(g).toFixed(1) +
      '" stroke="var(--border)" stroke-width="1"/>' +
      '<text x="' + (mL - 6) + '" y="' + (y(g) + 3).toFixed(1) + '" text-anchor="end" class="ms-axis">' + g + '%</text>';
  }).join('');
  // X labels: ~5 evenly spaced week dates (MMM d).
  var nLab = Math.min(5, n), xlab = '';
  for (var t = 0; t < nLab; t++) {
    var i = Math.round(t * (n - 1) / (nLab - 1));
    xlab += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" class="ms-axis">' +
      shortDate(pts0[i].date) + '</text>';
  }
  // Stacked bands bottom-up; baseline accumulates per week.
  var base = []; for (var k = 0; k < n; k++) base.push(0);
  var bands = ents.map(function (e) {
    var top = e.points.map(function (p, i) { return base[i] + (p.pct || 0); });
    var up = top.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); });
    var lo = []; for (var i = n - 1; i >= 0; i--) lo.push(x(i).toFixed(1) + ',' + y(base[i]).toFixed(1));
    base = top;
    return '<polygon points="' + up.join(' ') + ' ' + lo.join(' ') + '" fill="' + entityColor(e) +
      '" fill-opacity="0.85" stroke="var(--surface)" stroke-width="0.5"/>';
  }).join('');
  return '<svg class="ms-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
    shareChartAria(series) + '">' + grid + bands +
    '<line class="ms-crosshair" x1="0" y1="' + mT + '" x2="0" y2="' + (mT + ph) + '" stroke="var(--text3)" stroke-width="1" style="display:none"/>' +
    '<rect class="ms-hit" x="' + mL + '" y="' + mT + '" width="' + pw + '" height="' + ph + '" fill="transparent"/>' +
    xlab + '</svg>';
}
function shortDate(iso) { var d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); }
function shareChartAria(series) {
  return 'Weekly token share. Latest: ' + series.entities.slice(0, 4)
    .map(function (e) { return e.label + ' ' + Math.round(e.latestPct) + '%'; }).join(', ') + '.';
}
function entityColor(e) { return authorColor(e.key.indexOf('/') >= 0 ? e.key.split('/')[0] : e.key); }
```

- [ ] **Step 2: Add CSS** for `.ms-axis` (after `src/template.ts:1046`):

```
.ms-axis { fill: var(--text3); font-size: 10px; }
.ms-tip { position:absolute; pointer-events:none; opacity:0; transition:opacity .1s; background:var(--surface2); border:1px solid var(--border2); border-radius:8px; padding:8px 10px; font-size:12px; color:var(--text); z-index:5; min-width:150px; box-shadow:0 4px 16px rgba(0,0,0,.3); }
.ms-tip-row { display:flex; align-items:center; gap:6px; justify-content:space-between; }
#market-share-body { position:relative; }
```

- [ ] **Step 3: Verify render** — esbuild-render `getHtml()` to `/tmp/page.html` (claude-mem `tokenapp-local-preview-workaround`); confirm the SVG appears with axes when fed sample data. (Data wiring lands in Task 8; here verify the function compiles and `getHtml()` renders.)
- [ ] **Step 4: Commit** — `git add src/template.ts && git commit -m "feat(chart): margined stacked-area share chart with axes (replaces stripe chart)"`

---

### Task 7: Crosshair hover + tooltip

**Files:**
- Modify: `src/template.ts` (renderMarketShare area + a new `attachShareHover`)

- [ ] **Step 1: Add a tooltip element + hover handler.** `renderMarketShare` (Task 8) injects `<div class="ms-tip" id="ms-tip"></div>` into `#market-share-body`. Add:

```js
function attachShareHover(series) {
  var body = document.getElementById('market-share-body');
  var svg = body && body.querySelector('.ms-chart');
  var hit = svg && svg.querySelector('.ms-hit');
  var cross = svg && svg.querySelector('.ms-crosshair');
  var tip = document.getElementById('ms-tip');
  if (!svg || !hit || !tip) return;
  var ents = series.entities, n = ents[0].points.length;
  var vb = svg.viewBox.baseVal, mL = 34, pw = vb.width - mL - 8;
  hit.addEventListener('mousemove', function (ev) {
    var r = svg.getBoundingClientRect();
    var sx = (ev.clientX - r.left) / r.width * vb.width;
    var i = Math.max(0, Math.min(n - 1, Math.round((sx - mL) / pw * (n - 1))));
    var cx = mL + (i / (n - 1)) * pw;
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.style.display = '';
    var rows = ents.map(function (e) { return { label: e.label, pct: e.points[i].pct, key: e.key }; })
      .filter(function (rr) { return rr.pct >= 0.05; })
      .sort(function (a, b) { return b.pct - a.pct; });
    tip.innerHTML = '<div style="font-weight:600;margin-bottom:4px">' + shortDate(ents[0].points[i].date) + '</div>' +
      rows.map(function (rr) { return '<div class="ms-tip-row"><span><i class="ms-swatch" style="background:' +
        entityColor({ key: rr.key }) + '"></i>' + rr.label + '</span><b>' + rr.pct.toFixed(1) + '%</b></div>'; }).join('');
    tip.style.opacity = '1';
    var left = (cx / vb.width) * r.width + 12;
    if (left + 170 > r.width) left -= 194;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = '8px';
  });
  hit.addEventListener('mouseleave', function () { tip.style.opacity = '0'; cross.style.display = 'none'; });
}
```

- [ ] **Step 2: Verify** — esbuild-render compiles; defer live hover check to Task 9 browser preview.
- [ ] **Step 3: Commit** — `git add src/template.ts && git commit -m "feat(chart): crosshair + per-week tooltip listing every entity's share"`

---

### Task 8: Render wiring, legend deltas, author/model + window toggles, copy

**Files:**
- Modify: `src/template.ts` — `renderMarketShare`/`loadMarketShare` (`2803-2841`), `marketShareLegend` (`2362-2378`), state (`1667-1668`), the toggle HTML (`1508-1517`), the title/subtitle (`1510-1511`).

- [ ] **Step 1: Update state** (`src/template.ts:1667`)

```js
  msWindow: 90,        // 30 | 90 | 365 (days)
  msView: 'author',    // 'author' | 'model'
  shareSeries: null,   // { author: ShareSeries, model: ShareSeries }
```

- [ ] **Step 2: Replace the header toggle HTML** (`src/template.ts:1508-1517`) — add a By author/By model toggle and change window buttons to 30D/90D/1Y:

```html
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <div class="period-toggle" id="ms-view-toggle">
          <button class="period-btn active" data-view="author">By author</button>
          <button class="period-btn" data-view="model">By model</button>
        </div>
        <div class="period-toggle" id="ms-window-toggle">
          <button class="period-btn" data-window="30">30D</button>
          <button class="period-btn active" data-window="90">90D</button>
          <button class="period-btn" data-window="365">1Y</button>
        </div>
      </div>
```

Update subtitle (`src/template.ts:1511`): `Weekly share of OpenRouter tokens · source: OpenRouter`.

- [ ] **Step 3: Rewrite `renderMarketShare` + `loadMarketShare`** (`2803-2841`)

```js
  function windowSlice(series, days) {
    var weeks = Math.max(2, Math.round(days / 7));
    return {
      weeks: series.weeks,
      entities: series.entities.map(function (e) {
        var pts = e.points.slice(-weeks);
        return { key: e.key, label: e.label, latestPct: e.latestPct, points: pts };
      }),
    };
  }
  function renderMarketShare() {
    var body = document.getElementById('market-share-body');
    if (!body) return;
    if (!state.shareSeries) { body.innerHTML = '<div class="ms-empty">Market share data unavailable.</div>'; return; }
    var full = state.shareSeries[state.msView];
    if (!full || !full.entities.length) { body.innerHTML = '<div class="ms-empty">Market share data unavailable.</div>'; return; }
    var sliced = windowSlice(full, state.msWindow);
    body.innerHTML = shareChartSvg(sliced) +
      '<div class="ms-legend">' + marketShareLegend(sliced) + '</div>' +
      '<div class="ms-tip" id="ms-tip"></div>';
    attachShareHover(sliced);
  }
  async function loadMarketShare() {
    var body = document.getElementById('market-share-body');
    try {
      var res = await fetch('/api/market-share');
      var data = await res.json();
      if (data && !data.error) { state.shareSeries = data; renderMarketShare(); return; }
    } catch (err) {}
    if (body && !state.shareSeries) body.innerHTML = '<div class="ms-empty">Market share could not be loaded right now. It refreshes hourly.</div>';
  }
```

- [ ] **Step 4: Rewrite `marketShareLegend`** (`2362-2378`) — swatch + latest % + window delta (Δ first→last point in slice):

```js
function marketShareLegend(series) {
  return series.entities.map(function (e) {
    var pts = e.points, last = pts[pts.length - 1] ? pts[pts.length - 1].pct : 0, first = pts[0] ? pts[0].pct : last;
    var d = Math.round((last - first) * 10) / 10, cls = d > 0 ? 'up' : d < 0 ? 'down' : '';
    var dh = d === 0 ? '' : ' <span class="lb-delta ' + cls + '">' + (d > 0 ? '▲' : '▼') + Math.abs(d) + 'pp</span>';
    return '<span class="ms-legend-item"><i class="ms-swatch" style="background:' + entityColor(e) + '"></i>' +
      e.label + ' <b>' + (Math.round(last * 10) / 10) + '%</b>' + dh + '</span>';
  }).join('');
}
```

- [ ] **Step 5: Wire the toggles** (replace the `ms-window-toggle` listener at `2834-2841`; add a `ms-view-toggle` listener). Both re-render from cached `state.shareSeries` (no refetch):

```js
  document.getElementById('ms-window-toggle').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-window]'); if (!btn) return;
    state.msWindow = parseInt(btn.dataset.window, 10);
    document.querySelectorAll('#ms-window-toggle .period-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active'); renderMarketShare();
  });
  document.getElementById('ms-view-toggle').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-view]'); if (!btn) return;
    state.msView = btn.dataset.view;
    document.querySelectorAll('#ms-view-toggle .period-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active'); renderMarketShare();
  });
```

- [ ] **Step 6: Verify** — esbuild-render `getHtml()`; then browser preview: `preview_start`, load page, click Rankings tab, confirm chart draws, toggles switch author/model and 30D/90D/1Y, legend deltas show.
- [ ] **Step 7: Commit** — `git add src/template.ts && git commit -m "feat(chart): author/model + 30D/90D/1Y toggles, legend deltas, client-side windowing"`

---

### Task 9: Browser verification of interaction + dark mode + mobile

**Files:** none (verification only)

- [ ] **Step 1:** `preview_start`; navigate; Rankings tab.
- [ ] **Step 2:** `preview_console_logs` — no errors. Hover the chart → `preview_screenshot` shows crosshair + tooltip listing every entity at that week.
- [ ] **Step 3:** Toggle By model → bands + legend switch to models; 1Y shows 52 weeks, 30D shows ~4. `preview_screenshot` each.
- [ ] **Step 4:** `preview_resize` to dark mode + mobile width; confirm axes/tooltip readable, tooltip clamps in view.
- [ ] **Step 5:** Commit any fixes found; otherwise no-op.

---

## Phase D — Final verification

### Task 10: Full build + deploy + smoke

- [ ] **Step 1:** `npx tsc --noEmit` — clean.
- [ ] **Step 2:** `npx wrangler deploy --dry-run --outdir /tmp/wb` — bundles (confirms BROWSER binding still referenced only by category path).
- [ ] **Step 3:** Deploy: `npx wrangler deploy`. Then force a refresh to populate KV: `curl -s -X POST https://token.app/api/refresh -H "Authorization: Bearer $REFRESH_SECRET"` (REFRESH_SECRET from secret store; never echo it).
- [ ] **Step 4: Smoke**:
```bash
curl -s "https://token.app/api/market-share" | python3 -c "import sys,json;d=json.load(sys.stdin);print('author weeks',d['author']['weeks'],'model weeks',d['model']['weeks'])"
curl -s "https://token.app/api/rankings?period=week" | python3 -c "import sys,json;d=json.load(sys.stdin);print('models',len(d['topModels']),'apps.week',len(d['topApps']['week']))"
```
Expected: author/model weeks = 52; models = 9; apps.week = 20 (7D unlocked immediately).
- [ ] **Step 5:** Browser preview of production: chart renders with crosshair, toggles work, model board shows sparklines, agent 7D/30D populated.
- [ ] **Step 6:** Update `CLAUDE.md` Gotchas + Current Work (puppeteer now categories-only; market-share/models/apps via JSON; market_share_snapshots dead). Commit.

---

## Self-review notes

- **Spec coverage:** chart rewrite (Tasks 6–8), author/model toggle (Task 8), 30/90/365 + delta baseline (Task 8), crosshair (Task 7), JSON source for authors/models/apps (Tasks 2–3), puppeteer→categories-only (Task 4), KV-only share + dead market_share D1 (Tasks 3–5), model sparklines from series (Task 2 `modelBoardFromSeries`), 7D/30D agent unlock (Task 3 apps day/week/month + Task 4 global KV path, no gate), D1 continuity for "view as of"/app sparklines (Task 3 `writeJsonSnapshots`). Category boards unchanged (Task 4 `getCategoryRankings`).
- **Type consistency:** `ShareSeries`/`ShareEntity`/`SharePoint` used identically across `openrouter-json.ts`, `fetchers.ts`, `template.ts`; `entityColor(e)` takes a `{key}`; `modelBoardFromSeries` returns `ModelRanking[]` matching `types.ts`.
- **Known behavioral changes (approved):** model board top-9 (not 10); app sparklines build forward (no historical source); "view as of" for global board continues via D1 going forward.
