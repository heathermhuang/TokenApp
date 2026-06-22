# Rankings Categories & Market Share Implementation Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OpenRouter's two scraping-dependent rankings features — per-category app leaderboards and a token-share-by-author market-share chart — on top of the time-aware rankings shipped in Phase A.

**Architecture:** A new D1 migration adds a nullable `category` column to `rankings_snapshots` (NULL = the existing global board; a slug = a category-scoped app row) plus a `market_share_snapshots` table. Market share is extracted **on the existing hourly `/rankings` render** (zero extra page loads) and read back as the last snapshot per day. Categories are scraped **once per day** via a guard inside the existing `scheduled` handler (NOT a new cron — `wrangler.toml` is gitignored), reusing one puppeteer session over the 15 category pages. The UI adds a hand-rolled stacked-area SVG chart and category tabs, with the same honesty-gating as the apps board.

**Tech Stack:** Cloudflare Workers, Hono, D1 (SQLite), `@cloudflare/puppeteer`, vanilla TS/JS SSR template.

**Grounding:** Built directly on the Phase B spike — `docs/superpowers/specs/2026-06-22-rankings-spike-findings.md` (category list + market-share selector + cost). Parent spec: `docs/superpowers/specs/2026-06-22-rankings-time-series-and-categories-design.md`.

**Verification:** This project has **no test runner** (deliberate — 2 runtime deps). Established gates are `npx tsc --noEmit`, `npx wrangler d1 execute … --local` for schema, and `npx wrangler dev` + cache-busted `curl` for routes. Scraper tasks need the real Browser Rendering binding, so they verify with `npx wrangler dev --remote` (binds live Browser Rendering + remote D1) and a manual `POST /api/refresh` (Bearer `REFRESH_SECRET`), then `curl`. Each task below ends in a concrete gate.

**Branch:** `feature/rankings-time-series` (continues from Phase A; spike committed at `1a7f878`).

---

## File structure

| File | Responsibility | Change |
|------|----------------|--------|
| `migrations/0002_categories_and_market_share.sql` | `category` column + index; `market_share_snapshots` table + indexes | Create |
| `src/categories.ts` | Static `APP_CATEGORIES` seed (slug/group/label) + `categoryUrl()` + `CATEGORY_SLUGS` | Create |
| `src/types.ts` | `MarketSharePoint`/`MarketShareAuthor`/`MarketShareData`, `AppCategory`; `category?` on `RankingsData` | Modify |
| `src/fetchers.ts` | Market-share extractor + write; category extractor/scraper + write; daily guard in `refreshAllData`; category-aware app reads; `readMarketShare` | Modify |
| `src/index.ts` | `?category=` on `/api/rankings`; new `/api/market-share`, `/api/rankings/categories` | Modify |
| `src/template.ts` | `areaChartSvg()` + `authorColor()`; market-share chart section; category tabs; fetch/render wiring; CSS | Modify |

`category` is nullable so all existing rows and the hourly global scrape stay `NULL` — no backfill. Category rows reuse `kind='app'`, `period='day'`; only the new column distinguishes them.

---

## PHASE C — Schema, scrapers, reads & routes

### Task C1: Migration 0002 — category column + market-share table

**Files:**
- Create: `migrations/0002_categories_and_market_share.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Phase C: category-scoped app rankings + market-share-by-author history.
-- See docs/superpowers/specs/2026-06-22-rankings-spike-findings.md.

-- 1) Category column on the existing snapshots table.
--    NULL  = global board (all existing + future hourly global app rows).
--    <slug>= a category-scoped app row (kind='app', period='day', category=slug).
ALTER TABLE rankings_snapshots ADD COLUMN category TEXT;

CREATE INDEX IF NOT EXISTS idx_snapshots_category
  ON rankings_snapshots (kind, category, snapshot_at DESC);

-- 2) Token share by model author over time (OpenRouter /rankings #market-share).
--    One row per (author, scrape). Read path takes the LAST row per author/day.
CREATE TABLE IF NOT EXISTS market_share_snapshots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_at  TEXT    NOT NULL,                 -- ISO8601 UTC
  snapshot_day TEXT    NOT NULL,                 -- YYYY-MM-DD
  author       TEXT    NOT NULL,                 -- provider slug, e.g. 'anthropic'
  token_total  INTEGER NOT NULL,
  share_pct    REAL    NOT NULL,                 -- 0..100
  period       TEXT    NOT NULL DEFAULT 'day'
);

CREATE INDEX IF NOT EXISTS idx_market_share_lookup
  ON market_share_snapshots (snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_share_author
  ON market_share_snapshots (author, snapshot_at DESC);
```

- [ ] **Step 2: Apply locally and verify**

Run: `npx wrangler d1 migrations apply token-app-rankings --local`
Then: `npx wrangler d1 execute token-app-rankings --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name='market_share_snapshots';"`
Expected: one row, `market_share_snapshots`.
Then: `npx wrangler d1 execute token-app-rankings --local --command "PRAGMA table_info(rankings_snapshots);"`
Expected: the column list now includes `category`.

- [ ] **Step 3: Apply to remote (production D1)**

Run: `npx wrangler d1 migrations apply token-app-rankings --remote`
Expected: migration `0002_categories_and_market_share` reported as applied.

- [ ] **Step 4: Commit**

```bash
git add migrations/0002_categories_and_market_share.sql
git commit -m "feat(rankings): migration 0002 — category column + market_share_snapshots"
```

---

### Task C2: Types + category seed constant

**Files:**
- Modify: `src/types.ts` (add after `RankingsData`, ~`:144`)
- Create: `src/categories.ts`

- [ ] **Step 1: Add market-share + category types**

In `src/types.ts`, after the `RankingsData` interface (ends ~`:144`):

```ts
// ── Market share by model author (scraped from OpenRouter /rankings) ─────────
export interface MarketSharePoint { day: string; sharePct: number; tokens: number; }
export interface MarketShareAuthor { author: string; points: MarketSharePoint[]; }
export interface MarketShareData {
  authors: MarketShareAuthor[];
  window: number;       // trailing days requested
  historyDays: number;  // distinct calendar days collected (honesty gating)
  fetchedAt: string;
}

// One OpenRouter app category. Path-addressable: /apps/category/{group}/{slug}.
export interface AppCategory { group: string; slug: string; label: string; }
```

- [ ] **Step 2: Add `category` echo to `RankingsData`**

In `RankingsData` (`:131-144`), add after the `asOf?: string;` field:

```ts
  // When set, the apps board is scoped to this category slug (models stay global).
  category?: string;
```

- [ ] **Step 3: Create the category seed**

`src/categories.ts`:

```ts
import type { AppCategory } from './types';

// OpenRouter app categories, enumerated from sitemap.xml in the 2026-06-22 spike
// (docs/superpowers/specs/2026-06-22-rankings-spike-findings.md). Slugs + groups
// are the authoritative scrape targets; labels are seeds — the daily scraper
// overwrites each with the live <h1> label from the rendered page.
export const APP_CATEGORIES: AppCategory[] = [
  { group: 'coding',        slug: 'cli-agent',          label: 'CLI Agents' },
  { group: 'coding',        slug: 'cloud-agent',        label: 'Cloud Agents' },
  { group: 'coding',        slug: 'ide-extension',      label: 'IDE Extensions' },
  { group: 'coding',        slug: 'native-app-builder', label: 'Native App Builders' },
  { group: 'coding',        slug: 'programming-app',    label: 'Programming App' },
  { group: 'creative',      slug: 'audio-gen',          label: 'Audio Generation' },
  { group: 'creative',      slug: 'creative-writing',   label: 'Creative Writing' },
  { group: 'creative',      slug: 'image-gen',          label: 'Image Generation' },
  { group: 'creative',      slug: 'video-gen',          label: 'Video Generation' },
  { group: 'entertainment', slug: 'game',               label: 'Game' },
  { group: 'entertainment', slug: 'roleplay',           label: 'Roleplay' },
  { group: 'productivity',  slug: 'general-chat',       label: 'General Chat' },
  { group: 'productivity',  slug: 'legal',              label: 'Legal' },
  { group: 'productivity',  slug: 'personal-agent',     label: 'Personal Agents' },
  { group: 'productivity',  slug: 'writing-assistant',  label: 'Writing Assistants' },
];

// Soft cap so a future OpenRouter UI change can't make the daily job unbounded.
export const CATEGORY_SCRAPE_CAP = 20;

export const CATEGORY_SLUGS = new Set(APP_CATEGORIES.map((c) => c.slug));
export const CATEGORY_LABELS = new Map(APP_CATEGORIES.map((c) => [c.slug, c.label] as const));

export function categoryUrl(c: AppCategory): string {
  return `https://openrouter.ai/apps/category/${c.group}/${c.slug}`;
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0 (new types are additive; nothing imports them yet).

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/categories.ts
git commit -m "feat(rankings): market-share + category types and category seed"
```

---

### Task C3: Market-share extraction (piggyback on the hourly /rankings render)

**Files:**
- Modify: `src/fetchers.ts` — extractor return (`:302`), `RankingsScrape` (`:313`), `fetchRankingsFromOpenRouter` (`:352-384`), add `writeMarketShareSnapshot` (after `writeRankingsSnapshot`, ~`:420`), wire into `refreshAllData` (`:674-676`)

- [ ] **Step 1: Extend the page extractor to read the market-share legend**

In `RANKINGS_EXTRACTOR_SOURCE`, replace the final `return { models: models, apps: apps };` (`:302`) with the market-share walk + extended return:

```js
  // ── Market share — legend rows under #market-share ──────────────────────
  // Each named author is a <button> containing <a href="/{author}">, a token
  // total ("148B"), and a share percent ("18.0%"). The aggregate "Others" row
  // has no author link and is intentionally skipped (named authors only).
  var marketShare = [];
  var msSeen = {};
  var msSection = document.getElementById('market-share');
  if (msSection) {
    var msLinks = Array.prototype.slice.call(msSection.querySelectorAll('a[href^="/"]'));
    for (var ms = 0; ms < msLinks.length; ms++) {
      var aEl = msLinks[ms];
      var author = aEl.getAttribute('href').replace(/^\\//, '');
      if (!author || author.indexOf('/') !== -1 || msSeen[author]) continue;
      var rowEl = aEl.closest('button') || aEl.parentElement;
      var rowText = rowEl ? (rowEl.innerText || '') : '';
      var pctM = rowText.match(/([\\d.]+)\\s*%/);
      if (!pctM) continue;
      var tokM = rowText.match(/([\\d.]+\\s*[KMBT])\\b/i);
      msSeen[author] = true;
      marketShare.push({
        author: author,
        sharePct: parseFloat(pctM[1]),
        tokenTotal: tokM ? parseTokens(tokM[1]) : 0
      });
    }
  }

  return { models: models, apps: apps, marketShare: marketShare };
```

- [ ] **Step 2: Extend `RankingsScrape` and the evaluate result type**

In `RankingsScrape` (`:313-324`), add after `apps: Array<…>;`:

```ts
  marketShare: Array<{ author: string; tokenTotal: number; sharePct: number }>;
```

In `fetchRankingsFromOpenRouter`, extend the `page.evaluate` cast (`:352-362`) to include `marketShare`, then build it into the return. After the `apps` dedup loop (`:371-378`) and before `return {`:

```ts
    const marketShare = (extracted.marketShare ?? [])
      .filter((m) => m.author && m.sharePct > 0)
      .slice(0, 12);
```

Update the cast at `:352`:

```ts
    const extracted = (await page.evaluate(RANKINGS_EXTRACTOR_SOURCE)) as {
      models: Array<{ modelSlug: string; modelName: string; totalTokens: number }>;
      apps: Array<{ rank: number; title: string; description: string; totalTokens: number; originUrl: string; faviconUrl: string | null }>;
      marketShare: Array<{ author: string; tokenTotal: number; sharePct: number }>;
    };
```

And add `marketShare,` to the returned object (`:380-384`):

```ts
    return {
      fetchedAt: new Date().toISOString(),
      modelsWeek,
      apps,
      marketShare,
    };
```

- [ ] **Step 3: Add `writeMarketShareSnapshot`**

After `writeRankingsSnapshot` (ends `:420`):

```ts
// Append a market-share snapshot. Empty result = skip the insert (the table is
// append-only, so the read path just keeps the last good day — no overwrite).
async function writeMarketShareSnapshot(env: Env, scrape: RankingsScrape): Promise<void> {
  if (!scrape.marketShare || scrape.marketShare.length === 0) return;
  const snapshotAt = scrape.fetchedAt;
  const snapshotDay = snapshotAt.slice(0, 10);
  const stmt = env.RANKINGS_DB.prepare(`
    INSERT INTO market_share_snapshots
      (snapshot_at, snapshot_day, author, token_total, share_pct, period)
    VALUES (?, ?, ?, ?, ?, 'day')
  `);
  const batch = scrape.marketShare.map((m) =>
    stmt.bind(snapshotAt, snapshotDay, m.author, m.tokenTotal, m.sharePct));
  await env.RANKINGS_DB.batch(batch);
}
```

- [ ] **Step 4: Call it from `refreshAllData`**

In `refreshAllData`, right after `await writeRankingsSnapshot(env, scrape);` (`:675`):

```ts
    // 1b) Append market share (extracted from the same render — zero extra
    //     page loads). Best-effort: it's inside the rankings try/catch already.
    await writeMarketShareSnapshot(env, scrape);
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Verify against live Browser Rendering**

Run: `npx wrangler dev --remote --port 8799` (binds real Browser Rendering + remote D1; background).
Trigger a refresh: `curl -s -X POST 'http://localhost:8799/api/refresh' -H "Authorization: Bearer $REFRESH_SECRET"`
Expected JSON includes `"rankings":"models: …, apps: …"` and no `rankingsError`.
Then: `npx wrangler d1 execute token-app-rankings --remote --command "SELECT author, share_pct FROM market_share_snapshots ORDER BY snapshot_at DESC LIMIT 10;"`
Expected: ~9 rows (anthropic, deepseek, …) with plausible `share_pct` values (0–100).

- [ ] **Step 7: Commit**

```bash
git add src/fetchers.ts
git commit -m "feat(rankings): extract + store market-share by author on hourly scrape"
```

---

### Task C4: Category scraper + daily guard

**Files:**
- Modify: `src/fetchers.ts` — add `CATEGORY_EXTRACTOR_SOURCE`, `CategoryScrape`, `fetchCategoryRankings`, `writeCategorySnapshot` (after `fetchRankingsFromOpenRouter`, ~`:388`); daily guard in `refreshAllData` (after the rankings try/catch, ~`:711`)
- Import `APP_CATEGORIES`, `CATEGORY_SCRAPE_CAP`, `categoryUrl` from `./categories`

- [ ] **Step 1: Import the category seed**

At the top of `src/fetchers.ts`, with the other imports:

```ts
import { APP_CATEGORIES, CATEGORY_SCRAPE_CAP, categoryUrl } from './categories';
```

- [ ] **Step 2: Add the category page extractor + scraper**

After `fetchRankingsFromOpenRouter` (ends `:388`):

```ts
// Extractor for a category leaderboard page (/apps/category/{group}/{slug}).
// Reads the live label from <h1> ("<Label> Rankings") and the ranked app list.
// The app rows are the same shape as the global Top Apps board, so we reuse the
// proven innerText line-walk (duplicated, not shared, to avoid touching the
// working hourly extractor).
const CATEGORY_EXTRACTOR_SOURCE = `(function () {
  function parseTokens(raw) {
    if (!raw) return 0;
    var m = String(raw).replace(/,/g, '').match(/([\\d.]+)\\s*([KMBT])?/i);
    if (!m) return 0;
    var num = parseFloat(m[1]);
    var mults = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
    return Math.round(num * (mults[(m[2] || '').toUpperCase()] || 1));
  }

  var h1 = document.querySelector('h1');
  var label = h1 ? (h1.textContent || '').trim().replace(/\\s*Rankings\\s*$/i, '') : '';

  // Find the container with the most "N." rank markers (the app list), then
  // line-parse it the same way the global Top Apps extractor does.
  var containers = Array.prototype.slice.call(document.querySelectorAll('main *'));
  var best = null, bestCount = 0;
  for (var ci = 0; ci < containers.length; ci++) {
    var t = containers[ci].innerText || '';
    var ranks = t.match(/(^|\\n)\\d+\\.(\\s|$)/g);
    var c = ranks ? ranks.length : 0;
    if (c >= 3 && c > bestCount) { best = containers[ci]; bestCount = c; }
  }

  var apps = [];
  if (best) {
    var lines = (best.innerText || '').split('\\n').map(function (l) { return l.trim(); });
    for (var i = 0; i < lines.length && apps.length < 20; i++) {
      var rm = lines[i].match(/^(\\d+)\\.$/);
      if (!rm) continue;
      var rank = parseInt(rm[1], 10);
      var title = (lines[i + 1] || '').trim();
      if (!title || /^Show more$/i.test(title)) continue;
      var descLines = [], tokensRaw = '';
      for (var j = i + 2; j < Math.min(i + 15, lines.length); j++) {
        if (/tokens$/i.test(lines[j])) { tokensRaw = lines[j].replace(/tokens$/i, ''); break; }
        if (lines[j]) descLines.push(lines[j]);
      }
      if (!tokensRaw) continue;
      apps.push({
        rank: rank,
        title: title,
        description: descLines.filter(function (l) { return l.length > 6; }).join(' ').slice(0, 240),
        totalTokens: parseTokens(tokensRaw),
        originUrl: '',
        faviconUrl: null
      });
    }
  }
  return { label: label, apps: apps };
})()`;

interface CategoryScrape {
  fetchedAt: string;
  categories: Array<{
    slug: string;
    group: string;
    label: string;
    apps: Array<{ rank: number; title: string; description: string; totalTokens: number; originUrl: string; faviconUrl: string | null }>;
  }>;
}

const CATEGORY_RENDER_TIMEOUT_MS = 30_000;

// Scrape every category leaderboard in ONE reused browser session. A page that
// fails or yields 0 apps is skipped (per-section empty guard) — never recorded
// empty, never aborts the rest. ~15 pages, ~2-3 min (see spike findings).
export async function fetchCategoryRankings(env: Env): Promise<CategoryScrape> {
  if (!env.BROWSER) {
    throw new Error('BROWSER binding not configured (requires Cloudflare Browser Rendering)');
  }
  const browser = await puppeteer.launch(env.BROWSER);
  const out: CategoryScrape = { fetchedAt: new Date().toISOString(), categories: [] };
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (compatible; token.app/1.0; +https://token.app)');
    await page.setViewport({ width: 1280, height: 1600 });

    for (const cat of APP_CATEGORIES.slice(0, CATEGORY_SCRAPE_CAP)) {
      try {
        await page.goto(categoryUrl(cat), { waitUntil: 'networkidle0', timeout: CATEGORY_RENDER_TIMEOUT_MS });
        await new Promise((r) => setTimeout(r, 1200));
        const res = (await page.evaluate(CATEGORY_EXTRACTOR_SOURCE)) as {
          label: string;
          apps: Array<{ rank: number; title: string; description: string; totalTokens: number; originUrl: string; faviconUrl: string | null }>;
        };
        const apps = (res.apps ?? []).filter((a) => a.title && a.totalTokens > 0).slice(0, 20);
        if (apps.length > 0) {
          out.categories.push({ slug: cat.slug, group: cat.group, label: res.label || cat.label, apps });
        }
      } catch (err) {
        console.error('Category scrape failed for', cat.slug, err);
      }
    }
  } finally {
    await browser.close();
  }
  return out;
}

// Append category app rows (kind='app', period='day', category=slug). Skips a
// category that scraped 0 apps; append-only, so a skip keeps the last good day.
async function writeCategorySnapshot(env: Env, scrape: CategoryScrape): Promise<void> {
  const snapshotAt = scrape.fetchedAt;
  const snapshotDay = snapshotAt.slice(0, 10);
  const stmt = env.RANKINGS_DB.prepare(`
    INSERT INTO rankings_snapshots
      (snapshot_at, snapshot_day, kind, period, rank, identifier, name, description, total_tokens, origin_url, favicon_url, category)
    VALUES (?, ?, 'app', 'day', ?, ?, NULL, ?, ?, ?, ?, ?)
  `);
  const batch: D1PreparedStatement[] = [];
  for (const cat of scrape.categories) {
    if (cat.apps.length === 0) continue;
    for (const a of cat.apps) {
      batch.push(stmt.bind(
        snapshotAt, snapshotDay, a.rank, a.title, a.description,
        a.totalTokens, a.originUrl || null, a.faviconUrl, cat.slug,
      ));
    }
  }
  if (batch.length > 0) await env.RANKINGS_DB.batch(batch);
}
```

- [ ] **Step 3: Add the once-per-day guard in `refreshAllData`**

Change the `refreshAllData` return type and add the category block after the rankings `try/catch` (after `:711`, before `return {`):

```ts
  // ── Categories: scrape AT MOST once per calendar day. The guard lives INSIDE
  //    the hourly scheduled handler (NOT a new cron trigger — wrangler.toml is
  //    gitignored, so a new [[triggers]] entry wouldn't survive a clean deploy).
  let categoriesStatus: string | undefined;
  let categoriesError: string | undefined;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const already = await env.RANKINGS_DB
      .prepare(`SELECT 1 FROM rankings_snapshots WHERE kind = 'app' AND category IS NOT NULL AND snapshot_day = ? LIMIT 1`)
      .bind(today)
      .first();
    if (already) {
      categoriesStatus = 'skipped (already scraped today)';
    } else {
      const catScrape = await fetchCategoryRankings(env);
      await writeCategorySnapshot(env, catScrape);
      categoriesStatus = `${catScrape.categories.length} categories`;
    }
  } catch (err) {
    console.error('Category scrape failed (non-fatal):', err);
    categoriesError = String(err);
  }

  return { models: models.length, rankings: rankingsStatus, rankingsError, categories: categoriesStatus, categoriesError };
```

Update the signature (`:649`):

```ts
export async function refreshAllData(env: Env): Promise<{ models: number; rankings?: string; rankingsError?: string; categories?: string; categoriesError?: string }> {
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Verify against live Browser Rendering**

With `npx wrangler dev --remote --port 8799` running:
`curl -s -X POST 'http://localhost:8799/api/refresh' -H "Authorization: Bearer $REFRESH_SECRET"`
Expected JSON includes `"categories":"<N> categories"` (N up to 15) on first run today, or `"skipped (already scraped today)"` on a second call.
Then: `npx wrangler d1 execute token-app-rankings --remote --command "SELECT category, COUNT(*) FROM rankings_snapshots WHERE category IS NOT NULL GROUP BY category;"`
Expected: a handful of category slugs (e.g. `roleplay`, `cli-agent`) each with several app rows.

- [ ] **Step 6: Commit**

```bash
git add src/fetchers.ts
git commit -m "feat(rankings): daily category scraper with once-per-day guard"
```

---

### Task C5: Category-aware app reads + `getRankings(category)`

**Files:**
- Modify: `src/fetchers.ts` — new `appSnapshotAtBefore`; thread `category` into `readLatestApps` (`:463`), `aggregateRange` (`:485`), `aggregateApps` (`:535`), `countAppDaysInRange` (`:526`), `readSeries` (`:558`); `getRankings` (`:768`)

> **Critical correctness point:** category scrapes write `kind='app', period='day'` rows with a *daily* `snapshot_at`. The existing global app reads use `MAX(snapshot_at)` for `kind='app'` and would otherwise pick up a category scrape and serve category rows as the global board. Every global app read MUST filter `category IS NULL`.

- [ ] **Step 1: Add a category-aware snapshot anchor**

After `snapshotAtBefore` (ends `:446`):

```ts
// Latest app snapshot_at for a category bucket: NULL = global board, a slug =
// that category. asOf re-anchors to the snapshot at/just-before that time.
async function appSnapshotAtBefore(env: Env, asOf: string | undefined, category: string | null): Promise<string | null> {
  const catClause = category == null ? 'category IS NULL' : 'category = ?';
  const upperClause = asOf ? ' AND snapshot_at <= ?' : '';
  const binds: unknown[] = [];
  if (category != null) binds.push(category);
  if (asOf) binds.push(asOf);
  const row = await env.RANKINGS_DB
    .prepare(`SELECT MAX(snapshot_at) AS s FROM rankings_snapshots WHERE kind = 'app' AND period = 'day' AND ${catClause}${upperClause}`)
    .bind(...binds)
    .first<{ s: string | null }>();
  return row?.s ?? null;
}
```

- [ ] **Step 2: Make `readLatestApps` category-aware**

Replace `readLatestApps` (`:463-480`):

```ts
async function readLatestApps(env: Env, asOf?: string, category: string | null = null): Promise<AppRanking[]> {
  const latest = await appSnapshotAtBefore(env, asOf, category);
  if (!latest) return [];
  const catClause = category == null ? 'category IS NULL' : 'category = ?';
  const binds: unknown[] = ['app', 'day', latest];
  if (category != null) binds.push(category);
  const result = await env.RANKINGS_DB
    .prepare(`SELECT identifier, description, total_tokens, rank, origin_url, favicon_url FROM rankings_snapshots WHERE kind = ? AND period = ? AND snapshot_at = ? AND ${catClause} ORDER BY rank ASC LIMIT 20`)
    .bind(...binds)
    .all<{ identifier: string; description: string | null; total_tokens: number; rank: number; origin_url: string | null; favicon_url: string | null }>();
  return (result.results ?? []).map((r) => ({
    rank: r.rank,
    title: r.identifier,
    description: r.description ?? '',
    categories: category ? [category] : [],
    originUrl: r.origin_url ?? '',
    faviconUrl: r.favicon_url ?? null,
    totalTokens: Number(r.total_tokens) || 0,
    totalRequests: 0,
  }));
}
```

- [ ] **Step 3: Make the aggregation + history-count category-aware**

In `aggregateRange` (`:485`), add a `category` param and clause. Change the signature and the `WHERE`:

```ts
async function aggregateRange(env: Env, kind: 'model' | 'app', days: number, category: string | null = null): Promise<
  Array<{ identifier: string; name: string | null; description: string | null; origin_url: string | null; favicon_url: string | null; total: number }>
> {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  const catClause = kind === 'app' ? (category == null ? ' AND category IS NULL' : ' AND category = ?') : '';
  const sql = `
    WITH daily_last AS (
      SELECT identifier, name, description, origin_url, favicon_url, total_tokens, snapshot_day,
        ROW_NUMBER() OVER (PARTITION BY identifier, snapshot_day ORDER BY snapshot_at DESC) AS rn
      FROM rankings_snapshots
      WHERE kind = ? AND period = 'day' AND snapshot_at >= ?${catClause}
    )
    SELECT identifier, MAX(name) AS name, MAX(description) AS description,
      MAX(origin_url) AS origin_url, MAX(favicon_url) AS favicon_url, SUM(total_tokens) AS total
    FROM daily_last WHERE rn = 1 GROUP BY identifier ORDER BY total DESC LIMIT 20
  `;
  const binds: unknown[] = [kind, cutoff];
  if (kind === 'app' && category != null) binds.push(category);
  const result = await env.RANKINGS_DB.prepare(sql).bind(...binds)
    .all<{ identifier: string; name: string | null; description: string | null; origin_url: string | null; favicon_url: string | null; total: number }>();
  return result.results ?? [];
}
```

In `aggregateApps` (`:535`):

```ts
async function aggregateApps(env: Env, days: number, category: string | null = null): Promise<AppRanking[]> {
  const rows = await aggregateRange(env, 'app', days, category);
  return rows.map((r, i) => ({
    rank: i + 1,
    title: r.identifier,
    description: r.description ?? '',
    categories: category ? [category] : [],
    originUrl: r.origin_url ?? '',
    faviconUrl: r.favicon_url ?? null,
    totalTokens: Number(r.total) || 0,
    totalRequests: 0,
  }));
}
```

In `countAppDaysInRange` (`:526`):

```ts
async function countAppDaysInRange(env: Env, days: number, category: string | null = null): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  const catClause = category == null ? 'category IS NULL' : 'category = ?';
  const binds: unknown[] = [cutoff];
  if (category != null) binds.push(category);
  const row = await env.RANKINGS_DB
    .prepare(`SELECT COUNT(DISTINCT snapshot_day) AS n FROM rankings_snapshots WHERE kind = 'app' AND period = 'day' AND ${catClause} AND snapshot_at >= ?`)
    .bind(...binds)
    .first<{ n: number }>();
  return Number(row?.n) || 0;
}
```

- [ ] **Step 4: Keep global sparklines clean in `readSeries`**

In `readSeries` (`:576-582`), add `AND category IS NULL` to the inner `WHERE` so the global apps/models series never mixes in category rows (models are always `NULL`, so this is a no-op for them; category-board sparklines are out of v1 scope). Change the `WHERE` line:

```ts
      FROM rankings_snapshots
      WHERE kind = ? AND period = ? AND category IS NULL AND snapshot_at >= ?${upperClause}
```

- [ ] **Step 5: Thread `category` through `getRankings`**

Replace the `getRankings` signature + body up to the return (`:768-823`). Models stay global; apps are category-scoped; trends attach only for the global board (category history is sparse in v1 — documented limitation):

```ts
export async function getRankings(
  env: Env,
  period: RankingPeriod = 'day',
  asOf?: string,
  category?: string | null,
): Promise<RankingsData | null> {
  const cat = category ?? null;
  const requiredDays = period === 'week' ? 7 : period === 'month' ? 30 : 0;
  try {
    const modelsTask = readLatestModels(env, 'week', asOf); // models are always the global weekly board

    let apps: AppRanking[];
    let appsHistoryDays: number | undefined;
    if (period === 'day') {
      apps = await readLatestApps(env, asOf, cat);
    } else {
      appsHistoryDays = await countAppDaysInRange(env, requiredDays, cat);
      apps = appsHistoryDays >= requiredDays ? await aggregateApps(env, requiredDays, cat) : [];
    }

    const models = await modelsTask;
    if (models.length > 0 || apps.length > 0 || appsHistoryDays !== undefined) {
      const periodDays = period === 'month' ? 30 : period === 'week' ? 7 : 1;
      await Promise.all([
        attachTrends(env, 'model', 'week',
          models.map((m): TrendRow => ({
            identifier: m.modelSlug,
            set: (sp, d) => { m.sparkline = sp; m.delta = d; },
          })), 7, asOf),
        // Category boards skip trends in v1 — daily category history is too
        // sparse to compute an honest sparkline/delta until snapshots accumulate.
        cat == null
          ? attachTrends(env, 'app', 'day',
              apps.map((a): TrendRow => ({
                identifier: a.title,
                set: (sp, d) => { a.sparkline = sp; a.delta = period === 'day' ? d : null; },
              })), periodDays, asOf)
          : Promise.resolve(),
      ]);

      const topApps: Record<RankingPeriod, AppRanking[]> = { day: [], week: [], month: [] };
      topApps[period] = apps;
      return {
        topModels: models,
        topApps,
        fetchedAt: (await snapshotAtBefore(env, 'model', 'week', asOf)) ?? new Date().toISOString(),
        appsHistoryDays,
        appsHistoryRequired: requiredDays > 0 ? requiredDays : undefined,
        asOf: asOf || undefined,
        category: cat || undefined,
      };
    }
  } catch (err) {
    console.error('D1 rankings read failed, falling back to KV:', err);
  }

  const raw = await env.TOKEN_APP_KV.get(KV_KEYS.RANKINGS);
  if (!raw) return null;
  return JSON.parse(raw) as RankingsData;
}
```

- [ ] **Step 6: Type-check + verify category read**

Run: `npx tsc --noEmit` → exit 0.
With `npx wrangler dev --remote --port 8799` running (and Task C4 data present):
`curl -s 'http://localhost:8799/api/rankings?category=roleplay' | head -c 600`
Expected: `topApps.day` holds roleplay apps (e.g. Janitor AI, SillyTavern), `"category":"roleplay"` echoed, `topModels` still the global weekly board.
`curl -s 'http://localhost:8799/api/rankings?period=day' | head -c 300`
Expected: global apps board unchanged (NOT category rows) — confirms the `category IS NULL` scoping.

- [ ] **Step 7: Commit**

```bash
git add src/fetchers.ts
git commit -m "feat(rankings): category-scoped app reads + getRankings category param"
```

---

### Task C6: `readMarketShare` reader

**Files:**
- Modify: `src/fetchers.ts` — add `countMarketShareDays` + `readMarketShare` (after `getRankings`, ~`:833`); import `MarketShareData`, `MarketSharePoint`

- [ ] **Step 1: Ensure the market-share types are imported**

At the `import type … from './types'` line in `src/fetchers.ts`, add `MarketShareData, MarketSharePoint` to the imported type list.

- [ ] **Step 2: Add the reader + history count**

After `getRankings` (ends `:833`):

```ts
// Distinct calendar days of market-share snapshots in the window (honesty gate:
// the area chart needs >= 2 days to be meaningful, else show an empty state).
async function countMarketShareDays(env: Env, days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  const row = await env.RANKINGS_DB
    .prepare('SELECT COUNT(DISTINCT snapshot_day) AS n FROM market_share_snapshots WHERE snapshot_at >= ?')
    .bind(cutoff)
    .first<{ n: number }>();
  return Number(row?.n) || 0;
}

// Author-share time series over the trailing window. One point per author per
// calendar day (the LAST snapshot that day). Authors sorted by latest share.
export async function readMarketShare(env: Env, windowDays: number, asOf?: string): Promise<MarketShareData> {
  const anchor = asOf ?? new Date().toISOString();
  const cutoff = new Date(new Date(anchor).getTime() - windowDays * 86400_000).toISOString();
  const upperClause = asOf ? ' AND snapshot_at <= ?' : '';
  const binds: unknown[] = [cutoff];
  if (asOf) binds.push(asOf);
  const sql = `
    WITH daily AS (
      SELECT author, snapshot_day AS day, share_pct, token_total,
        ROW_NUMBER() OVER (PARTITION BY author, snapshot_day ORDER BY snapshot_at DESC) AS rn
      FROM market_share_snapshots
      WHERE snapshot_at >= ?${upperClause}
    )
    SELECT author, day, share_pct, token_total FROM daily WHERE rn = 1 ORDER BY day ASC
  `;
  const res = await env.RANKINGS_DB.prepare(sql).bind(...binds)
    .all<{ author: string; day: string; share_pct: number; token_total: number }>();

  const byAuthor = new Map<string, MarketSharePoint[]>();
  for (const r of res.results ?? []) {
    const arr = byAuthor.get(r.author) ?? [];
    arr.push({ day: r.day, sharePct: Number(r.share_pct) || 0, tokens: Number(r.token_total) || 0 });
    byAuthor.set(r.author, arr);
  }
  const historyDays = await countMarketShareDays(env, windowDays);
  const authors = Array.from(byAuthor.entries())
    .map(([author, points]) => ({ author, points }))
    .sort((a, b) => (b.points[b.points.length - 1]?.sharePct || 0) - (a.points[a.points.length - 1]?.sharePct || 0));
  return { authors, window: windowDays, historyDays, fetchedAt: anchor };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/fetchers.ts
git commit -m "feat(rankings): readMarketShare time-series reader + history gate"
```

---

### Task C7: API routes — `?category=`, `/api/market-share`, `/api/rankings/categories`

**Files:**
- Modify: `src/index.ts` — `/api/rankings` handler (`:98-119`); add two routes after it; import `readMarketShare`, `APP_CATEGORIES`, `CATEGORY_SLUGS`, `CATEGORY_LABELS`

- [ ] **Step 1: Imports**

Update `:5`:

```ts
import { getModels, getSubscriptions, getRankings, refreshAllData, readMarketShare } from './fetchers';
```

Add:

```ts
import { APP_CATEGORIES, CATEGORY_SLUGS, CATEGORY_LABELS } from './categories';
```

- [ ] **Step 2: Add `?category=` to `/api/rankings`**

In the `/api/rankings` handler, after the `asOf` line (`:108`) and before the `getRankings` call:

```ts
      const categoryRaw = c.req.query('category');
      const category = categoryRaw && CATEGORY_SLUGS.has(categoryRaw) ? categoryRaw : undefined;
      const rankings = await getRankings(c.env, period, asOf, category);
```

And echo it in the response (`:113`):

```ts
      return c.json({ ...rankings, period, category });
```

- [ ] **Step 3: Add `/api/market-share`**

After the `/api/rankings` route block (`:119`):

```ts
app.get(
  '/api/market-share',
  cache({ cacheName: 'token-app-market-share', cacheControl: 'max-age=3600, stale-while-revalidate=86400' }),
  async (c) => {
    try {
      const windowRaw = parseInt(c.req.query('window') || '30', 10);
      const window = [7, 30, 90].includes(windowRaw) ? windowRaw : 30;
      const data = await readMarketShare(c.env, window);
      return c.json(data);
    } catch (err) {
      console.error('Failed to get market share:', err);
      return c.json({ error: 'Failed to load market share' }, 500);
    }
  }
);
```

- [ ] **Step 4: Add `/api/rankings/categories`**

After the market-share route:

```ts
app.get(
  '/api/rankings/categories',
  cache({ cacheName: 'token-app-categories', cacheControl: 'max-age=3600, stale-while-revalidate=86400' }),
  async (c) => {
    try {
      // Only surface categories that actually have scraped data, so tabs light
      // up as the daily scrape fills them. Labels come from the seed (or the
      // slug, derived) — the seed is the stable source of display names.
      const res = await c.env.RANKINGS_DB
        .prepare("SELECT DISTINCT category FROM rankings_snapshots WHERE kind = 'app' AND category IS NOT NULL")
        .all<{ category: string }>();
      const present = new Set((res.results ?? []).map((r) => r.category));
      const categories = APP_CATEGORIES
        .filter((cat) => present.has(cat.slug))
        .map((cat) => ({ slug: cat.slug, group: cat.group, label: CATEGORY_LABELS.get(cat.slug) || cat.label }));
      return c.json({ categories });
    } catch (err) {
      console.error('Failed to get categories:', err);
      return c.json({ categories: [] });
    }
  }
);
```

- [ ] **Step 5: Type-check + verify all three routes**

Run: `npx tsc --noEmit` → exit 0.
With `npx wrangler dev --remote --port 8799` running (Task C3 + C4 data present):
`curl -s 'http://localhost:8799/api/market-share?window=30' | head -c 400`
Expected: `{"authors":[{"author":"anthropic","points":[{"day":"…","sharePct":…}]}…],"window":30,"historyDays":…}`.
`curl -s 'http://localhost:8799/api/rankings/categories'`
Expected: `{"categories":[{"slug":"roleplay","group":"entertainment","label":"Roleplay"}, …]}` (only categories with data).
`curl -s 'http://localhost:8799/api/rankings?category=bogus' | head -c 120`
Expected: behaves as global (invalid slug ignored), `"category":null` or absent.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "feat(rankings): ?category=, /api/market-share, /api/rankings/categories routes"
```

---

### Task C8: Ship Phase C

- [ ] **Step 1: Full type-check** — `npx tsc --noEmit` → exit 0.
- [ ] **Step 2: Confirm remote migration applied** — `npx wrangler d1 migrations list token-app-rankings --remote` shows `0002` applied (from C1 Step 3; re-run if needed).
- [ ] **Step 3: Deploy** — `npx wrangler deploy`.
- [ ] **Step 4: Trigger a production refresh** — `curl -s -X POST 'https://token.app/api/refresh' -H "Authorization: Bearer $REFRESH_SECRET"` → JSON shows `rankings`, `categories` populated, no errors.
- [ ] **Step 5: Prod smoke (cache-busted)**

```bash
curl -s "https://token.app/api/market-share?window=30&_cb=$(date +%s)" | head -c 400
curl -s "https://token.app/api/rankings/categories?_cb=$(date +%s)"
curl -s "https://token.app/api/rankings?category=roleplay&_cb=$(date +%s)" | head -c 400
```
Expected: market-share authors + history; non-empty categories list; roleplay apps board.

- [ ] **Step 6: Commit any fixups** (if smoke surfaced issues) and proceed to Phase D.

---

## PHASE D — UI for scraped data

### Task D1: `areaChartSvg` + `authorColor` helpers + CSS

**Files:**
- Modify: `src/template.ts` — add helpers near `sparklineSvg` (`:2316`); add CSS near `.period-btn` (`:1073`) and `:root` vars (`:172`)

- [ ] **Step 1: Add the stacked-area chart helper + author color resolver**

After `deltaBadge` (ends `:2334`):

```js
// Author band color. Reuse the model-table provider styling; 'Others' + unknown
// authors fall back to a neutral gray. getProviderStyle() already exists in this
// template (returns { color }), keyed by provider slug.
function authorColor(author) {
  if (!author || author.toLowerCase() === 'others') return '#94a3b8';
  try { var s = getProviderStyle(author); if (s && s.color) return s.color; } catch (e) {}
  return '#94a3b8';
}

// Hand-rolled stacked-area chart of author token share over time. `authors` is
// [{ author, points: [{ day, sharePct }] }]. Renders one band per author across
// the union of days, normalized to the 0-100% axis. No charting library.
function areaChartSvg(authors) {
  if (!authors || authors.length === 0) return '';
  var days = [];
  var seen = {};
  authors.forEach(function (a) {
    (a.points || []).forEach(function (p) { if (!seen[p.day]) { seen[p.day] = true; days.push(p.day); } });
  });
  days.sort();
  if (days.length < 2) return '';
  var w = 720, h = 240, n = days.length;
  var x = function (i) { return (i / (n - 1)) * w; };
  var y = function (pct) { return h - (pct / 100) * h; };
  // Per-day share lookup per author, stacked bottom-up in author order.
  var shareAt = function (a, day) {
    var pts = a.points || [];
    for (var k = 0; k < pts.length; k++) if (pts[k].day === day) return pts[k].sharePct || 0;
    return 0;
  };
  var baseline = days.map(function () { return 0; });
  var bands = authors.map(function (a) {
    var top = days.map(function (day, i) { return baseline[i] + shareAt(a, day); });
    var upper = top.map(function (v, i) { return x(i) + ',' + y(v).toFixed(1); });
    var lower = days.map(function (day, i) { return x(n - 1 - i) + ',' + y(baseline[n - 1 - i]).toFixed(1); });
    var poly = '<polygon points="' + upper.join(' ') + ' ' + lower.join(' ') +
      '" fill="' + authorColor(a.author) + '" fill-opacity="0.85" stroke="none"><title>' +
      escape(a.author) + '</title></polygon>';
    baseline = top;
    return poly;
  });
  return '<svg class="ms-chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" ' +
    'role="img" aria-label="Token share by model author over time">' + bands.join('') + '</svg>';
}

// Legend: author swatch + latest share %, sorted as provided (latest share desc).
function marketShareLegend(authors) {
  return authors.map(function (a) {
    var pts = a.points || [];
    var latest = pts.length ? pts[pts.length - 1].sharePct : 0;
    return '<span class="ms-legend-item"><i class="ms-swatch" style="background:' + authorColor(a.author) + '"></i>' +
      escape(a.author) + ' <b>' + (Math.round(latest * 10) / 10) + '%</b></span>';
  }).join('');
}
```

- [ ] **Step 2: Add CSS**

Near `.period-btn` rules (`:1073`):

```css
    .market-share { margin-bottom: 24px; }
    .market-share-head { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-bottom:8px; }
    .ms-chart { width:100%; height:240px; display:block; background:var(--card, transparent); border-radius:8px; }
    .ms-legend { display:flex; flex-wrap:wrap; gap:12px; margin-top:10px; font-size:12px; color:var(--text2,#9aa); }
    .ms-legend-item { display:inline-flex; align-items:center; gap:5px; }
    .ms-swatch { width:10px; height:10px; border-radius:2px; display:inline-block; }
    .ms-empty { padding:32px; text-align:center; color:var(--text3); }
    .category-tabs { display:flex; flex-wrap:wrap; gap:6px; margin:4px 0 12px; }
    .cat-tab { background:none; border:1px solid var(--border,#333); border-radius:999px; padding:4px 12px; font-size:12px; color:var(--text2,#9aa); cursor:pointer; }
    .cat-tab:hover { color:var(--text); }
    .cat-tab.active { background:var(--accent-dim); border-color:var(--accent); color:var(--accent); }
```

- [ ] **Step 3: Type-check (template is a string — confirms no TS breakage)**

Run: `npx tsc --noEmit` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/template.ts
git commit -m "feat(rankings): areaChartSvg + authorColor + market-share/tabs CSS"
```

---

### Task D2: Market-share chart section (markup + fetch + render)

**Files:**
- Modify: `src/template.ts` — markup atop `#rankings-section` (`:1547`, after the as-of bar); `state` (`:1684`); a `loadMarketShare()` + render; init call

- [ ] **Step 1: Add the chart markup**

In `#rankings-section`, immediately after the `</div>` closing `.rankings-asof` (`:1547`) and before `<div class="rankings-grid">`:

```html
  <div class="market-share" id="market-share-section">
    <div class="market-share-head">
      <div>
        <div class="leaderboard-title">Token Share by Model Author</div>
        <div class="leaderboard-subtitle">Share of OpenRouter tokens over time · source: OpenRouter</div>
      </div>
      <div class="period-toggle" id="ms-window-toggle">
        <button class="period-btn active" data-window="30">30D</button>
        <button class="period-btn" data-window="90">90D</button>
      </div>
    </div>
    <div id="market-share-body">
      <div class="ms-empty">Loading market share…</div>
    </div>
  </div>
```

- [ ] **Step 2: Add chart state**

In `state` (`:1684-1690`), add:

```js
  msWindow: 30,        // market-share chart window in days
  marketShare: null,   // cached MarketShareData
```

- [ ] **Step 3: Add fetch + render (history-gated)**

Near `loadRankingsPeriod` (`:2703`), add:

```js
  function renderMarketShare() {
    var body = document.getElementById('market-share-body');
    if (!body) return;
    var data = state.marketShare;
    // Honesty gate: need >= 2 distinct days to draw a trend, mirroring the
    // apps board. Otherwise show how much history is collected.
    if (!data || !data.authors || data.authors.length === 0 || (data.historyDays || 0) < 2) {
      var collected = data && typeof data.historyDays === 'number' ? data.historyDays : 0;
      body.innerHTML = '<div class="ms-empty">Market-share history is still building — ' +
        collected + '/2 days collected. The chart unlocks once daily snapshots accumulate.</div>';
      return;
    }
    body.innerHTML = areaChartSvg(data.authors) +
      '<div class="ms-legend">' + marketShareLegend(data.authors) + '</div>';
  }

  async function loadMarketShare() {
    try {
      var res = await fetch('/api/market-share?window=' + encodeURIComponent(state.msWindow));
      var data = await res.json();
      if (data && !data.error) { state.marketShare = data; renderMarketShare(); }
    } catch (err) { /* leave the loading/empty state */ }
  }

  document.getElementById('ms-window-toggle').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-window]');
    if (!btn) return;
    state.msWindow = parseInt(btn.dataset.window, 10);
    document.querySelectorAll('#ms-window-toggle .period-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    loadMarketShare();
  });
```

- [ ] **Step 4: Trigger the initial load when the Rankings tab opens**

Find where the rankings view first loads (the `switchView('rankings')` path / the existing rankings init). Add a `loadMarketShare();` call alongside the existing initial `loadRankingsPeriod(state.rankingsPeriod)` so the chart fetches when Rankings is shown. (Search for the first `loadRankingsPeriod(` call in the init/switchView code near `:2589-2620` and add `loadMarketShare();` next to it.)

- [ ] **Step 5: Verify in the browser preview**

Start `npx wrangler dev --remote --port 8799`, open `/`, switch to the Rankings tab.
- With ≥2 days of market-share history: the stacked-area chart renders with a colored legend (anthropic, deepseek, …); 30D/90D toggle refetches.
- With <2 days: the honest "X/2 days collected" message shows (no fake chart).
Use the preview tooling (snapshot/screenshot) to confirm. Check `preview_console_logs` for errors.

- [ ] **Step 6: Commit**

```bash
git add src/template.ts
git commit -m "feat(rankings): market-share area chart section with history gating"
```

---

### Task D3: Category tabs on the apps board

**Files:**
- Modify: `src/template.ts` — tabs markup in the apps leaderboard header (`:1568`); `state` (`:1684`); `buildRankingsUrl` (`:2679`); a `loadCategories()` + tab handler; cache invalidation on category change

- [ ] **Step 1: Add the tabs container**

In the apps leaderboard header, right after the `.leaderboard-subtitle` line (`:1568`):

```html
        <div class="category-tabs" id="category-tabs"></div>
```

- [ ] **Step 2: Add category state**

In `state` (`:1684`), add:

```js
  category: null,                 // active category slug, null = global "All"
  categories: [],                 // [{slug,label,group}] from /api/rankings/categories
```

- [ ] **Step 3: Thread `category` into the rankings URL**

Replace `buildRankingsUrl` (`:2679-2683`):

```js
  function buildRankingsUrl(period) {
    var u = '/api/rankings?period=' + encodeURIComponent(period);
    if (state.asOf) u += '&asOf=' + encodeURIComponent(state.asOf);
    if (state.category) u += '&category=' + encodeURIComponent(state.category);
    return u;
  }
```

- [ ] **Step 4: Fetch + render the tabs, wire selection**

Near `loadMarketShare` (Task D2), add:

```js
  function renderCategoryTabs() {
    var host = document.getElementById('category-tabs');
    if (!host) return;
    var tabs = [{ slug: null, label: 'All' }].concat(state.categories);
    host.innerHTML = tabs.map(function (t) {
      var active = (state.category || null) === (t.slug || null) ? ' active' : '';
      return '<button class="cat-tab' + active + '" data-cat="' + (t.slug || '') + '">' + escape(t.label) + '</button>';
    }).join('');
  }

  async function loadCategories() {
    try {
      var res = await fetch('/api/rankings/categories');
      var data = await res.json();
      if (data && data.categories) { state.categories = data.categories; renderCategoryTabs(); }
    } catch (err) { /* no tabs if the call fails */ }
  }

  document.getElementById('category-tabs').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-cat]');
    if (!btn) return;
    state.category = btn.dataset.cat || null;
    // The per-period cache keys on period only — invalidate on category change
    // (same rule as asOf), or a category view would serve stale global data.
    state.rankingsByPeriod = { day: null, week: null, month: null };
    renderCategoryTabs();
    loadRankingsPeriod(state.rankingsPeriod);
  });
```

- [ ] **Step 5: Load tabs on init**

Next to the `loadMarketShare();` init call (Task D2 Step 4), add `loadCategories();`.

- [ ] **Step 6: Verify in the browser preview**

Start `npx wrangler dev --remote --port 8799`, open `/`, Rankings tab.
- Tabs render: "All" + each category with data (Roleplay, CLI Agents, …).
- Click a category → apps board refetches and shows that category's apps; "All" restores the global board.
- The model board stays the global weekly board across category switches.
Confirm with preview snapshot/screenshot; check `preview_console_logs`.

- [ ] **Step 7: Commit**

```bash
git add src/template.ts
git commit -m "feat(rankings): category tabs on the apps leaderboard"
```

---

### Task D4: Ship Phase D

- [ ] **Step 1: Full type-check** — `npx tsc --noEmit` → exit 0.
- [ ] **Step 2: Deploy** — `npx wrangler deploy`.
- [ ] **Step 3: Prod smoke (browser)** — open `https://token.app`, Rankings tab: market-share chart + legend render; category tabs switch the apps board; as-of picker + period toggle still work; honest empty-states show where history is short.
- [ ] **Step 4: Prod smoke (API, cache-busted)**

```bash
curl -s "https://token.app/api/market-share?window=90&_cb=$(date +%s)" | head -c 300
curl -s "https://token.app/api/rankings?category=cli-agent&_cb=$(date +%s)" | head -c 300
```

- [ ] **Step 5: Update `## Current Work`** in `CLAUDE.md` (Phases C–D shipped; new routes; what to verify) and **merge the branch to main** (Phase A–D complete). Commit `docs: update Current Work`.

---

## Self-review

**Spec coverage** (vs `2026-06-22-rankings-time-series-and-categories-design.md`):
- Data model migration `0002` (`category` col + `market_share_snapshots`) → **C1**.
- Daily scrape, one reused session, per-section empty-overwrite guards, no new cron → **C3** (market share, hourly piggyback), **C4** (categories, daily guard).
- API: `?category=` → **C5/C7**; `/api/market-share?window=` → **C6/C7**; `/api/rankings/categories` → **C7**.
- UI: stacked-area market-share chart (`areaChartSvg`, providers.ts colors, "source: OpenRouter") → **D1/D2**; category tabs → **D3**; history-gating preserved → **D2** (chart), **C5** (category boards reuse `countAppDaysInRange`/`emptyAppsMessage`).
- Honesty gating, empty-overwrite guards, single-file vanilla SVG, `escape()` on scraped text → upheld throughout.

**Deviations from spec (intentional, documented):**
- Market share is extracted on the **hourly** `/rankings` render and read as last-per-day (simpler + zero extra page loads), rather than a separate daily scrape — matches spike recommendation #3.
- Category boards skip sparklines/deltas in v1 (sparse daily history); models stay global on category views. Both noted at the relevant tasks.

**Placeholder scan:** No "TBD/handle errors/similar to Task N". Every code step shows the actual code; every gate is a concrete `tsc`/`d1 execute`/`curl`/preview command with expected output. The only prose step (D2 Step 4 / D3 Step 5 init wiring) points at an exact existing call site to extend, not a vague instruction.

**Type consistency:** `MarketShareData{authors,window,historyDays,fetchedAt}` / `MarketSharePoint{day,sharePct,tokens}` defined in **C2**, produced in **C6** (`readMarketShare`), consumed in **D1/D2** (`areaChartSvg`/`marketShareLegend`/`renderMarketShare`). `AppCategory{group,slug,label}` defined in **C2**, used in **C4/C7**. `RankingsScrape.marketShare{author,tokenTotal,sharePct}` consistent across **C3** (extractor → `writeMarketShareSnapshot`). `getRankings(env, period, asOf, category)` signature in **C5** matches the call in **C7**. `category` threads as `string | null` consistently (`null` = global) across `appSnapshotAtBefore`/`readLatestApps`/`aggregateRange`/`aggregateApps`/`countAppDaysInRange`/`getRankings`.
