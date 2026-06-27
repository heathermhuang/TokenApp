import puppeteer from '@cloudflare/puppeteer';
import { APP_CATEGORIES, CATEGORY_SCRAPE_CAP, categoryUrl } from './categories';
import type { Env, NormalizedModel, OpenRouterModel, OpenRouterResponse, RankingsData, ModelRanking, AppRanking, RankingPeriod, RankDelta } from './types';
import { KV_KEYS } from './types';
import { getProvider } from './providers';
import { SUBSCRIPTIONS } from './subscriptions';
import { fetchShareSeries, fetchAppsBoards, fetchModelBoard } from './openrouter-json';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';

const DEPRECATED_IDS = new Set([
  // OpenAI legacy
  'openai/gpt-3.5-turbo-0301', 'openai/gpt-3.5-turbo-0613', 'openai/gpt-3.5-turbo-16k-0613',
  'openai/gpt-4-0314', 'openai/gpt-4-0613', 'openai/gpt-4-32k', 'openai/gpt-4-32k-0314',
  'openai/gpt-4-32k-0613', 'openai/text-davinci-002', 'openai/text-davinci-003',
  // Anthropic legacy
  'anthropic/claude-2', 'anthropic/claude-2.0', 'anthropic/claude-2.1',
  'anthropic/claude-instant-1', 'anthropic/claude-instant-1.2',
  'anthropic/claude-1', 'anthropic/claude-1.2',
  // Google legacy
  'google/palm-2-chat-bison', 'google/palm-2-codechat-bison',
  'google/palm-2-chat-bison-32k', 'google/palm-2-codechat-bison-32k',
]);

const POPULAR_RANK: Record<string, number> = {
  'openai/gpt-4o': 1,
  'openai/o3': 2,
  'openai/o4-mini': 3,
  'anthropic/claude-opus-4': 4,
  'anthropic/claude-sonnet-4-5': 5,
  'anthropic/claude-3-5-sonnet': 6,
  'anthropic/claude-3-7-sonnet': 7,
  'google/gemini-2.5-pro-preview': 8,
  'google/gemini-2.0-flash-001': 9,
  'deepseek/deepseek-r1': 10,
  'x-ai/grok-3': 11,
  'x-ai/grok-3-mini': 12,
  'openai/gpt-4o-mini': 13,
  'meta-llama/llama-4-maverick': 14,
  'meta-llama/llama-4-scout': 15,
};

// ── OpenRouter → NormalizedModel ──────────────────────────────────────────────

function parseModality(modality: string): { input: string[]; output: string[] } {
  const [inputPart, outputPart] = modality.split('->');
  const parseList = (s: string) =>
    s?.split('+').map((m) => m.trim().toLowerCase()).filter(Boolean) ?? [];
  return {
    input: parseList(inputPart ?? ''),
    output: parseList(outputPart ?? ''),
  };
}

function toMillion(pricePerToken: string): number | null {
  const n = parseFloat(pricePerToken);
  if (isNaN(n)) return null;
  if (n === 0) return 0;
  return parseFloat((n * 1_000_000).toFixed(4));
}

export function normalizeModel(raw: OpenRouterModel): NormalizedModel {
  const [providerId, ...rest] = raw.id.split('/');
  const slug = rest.join('/') || raw.id;

  const modality = parseModality(raw.architecture?.modality ?? 'text->text');
  const inputPer1M = toMillion(raw.pricing?.prompt ?? '0');
  const outputPer1M = toMillion(raw.pricing?.completion ?? '0');
  const imagePricePer = raw.pricing?.image
    ? parseFloat(raw.pricing.image) || null
    : null;

  const isVision =
    modality.input.includes('image') || modality.input.includes('vision');
  const isAudio = modality.input.includes('audio') || modality.output.includes('audio');
  const isVideo = modality.input.includes('video') || modality.output.includes('video');

  // Heuristics for reasoning/chain-of-thought models
  const nameLC = raw.name.toLowerCase();
  const isReasoning =
    nameLC.includes('reason') ||
    nameLC.includes(' o1') ||
    nameLC.includes(' o3') ||
    nameLC.includes(' o4') ||
    nameLC.includes('think') ||
    nameLC.includes('r1') ||
    nameLC.includes('r2') ||
    slug.includes('o1') ||
    slug.includes('o3') ||
    slug.includes('r1') ||
    nameLC.includes('qwq');

  // Open-source heuristics
  const openSourceProviders = ['meta-llama', 'mistralai', 'qwen', 'deepseek', '01-ai', 'google', 'cohere'];
  const isOpenSource =
    openSourceProviders.some((p) => providerId?.startsWith(p)) ||
    nameLC.includes('llama') ||
    nameLC.includes('mistral') ||
    nameLC.includes('gemma') ||
    nameLC.includes('qwen');

  // Tool use heuristic - most frontier models support it
  const hasToolUse =
    !nameLC.includes('instruct') ||
    ['openai', 'anthropic', 'google', 'mistralai', 'deepseek', 'x-ai', 'cohere'].includes(
      providerId ?? ''
    );

  const provider = getProvider(providerId ?? '');

  return {
    id: raw.id,
    slug,
    name: raw.name,
    provider: provider.displayName,
    providerId: providerId ?? 'unknown',
    inputPer1M,
    outputPer1M,
    imagePricePer,
    contextWindow: raw.context_length ?? null,
    maxOutput: raw.top_provider?.max_completion_tokens ?? null,
    inputModalities: modality.input,
    outputModalities: modality.output,
    isFree: inputPer1M === 0 && outputPer1M === 0,
    isVision,
    isReasoning,
    isOpenSource,
    hasToolUse,
    isDeprecated: DEPRECATED_IDS.has(raw.id) ||
      raw.name.toLowerCase().includes('deprecated') ||
      raw.name.toLowerCase().includes('(old)'),
    createdAt: raw.created ?? null,
    description: raw.description,
    huggingFaceId: raw.hugging_face_id || null,
  };
}

// ── Fetch from OpenRouter ─────────────────────────────────────────────────────

export async function fetchModelsFromOpenRouter(): Promise<NormalizedModel[]> {
  const resp = await fetch(OPENROUTER_API, {
    headers: {
      'HTTP-Referer': 'https://token.app',
      'X-Title': 'token.app - AI Pricing Tracker',
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!resp.ok) {
    throw new Error(`OpenRouter API error: ${resp.status} ${resp.statusText}`);
  }

  const json: OpenRouterResponse = await resp.json();

  return json.data
    .map(normalizeModel)
    .sort((a, b) => {
      const aRank = POPULAR_RANK[a.id];
      const bRank = POPULAR_RANK[b.id];
      const aIsFeatured = aRank !== undefined;
      const bIsFeatured = bRank !== undefined;

      // Free models (not in popular list) always go last
      if (!aIsFeatured && !bIsFeatured) {
        if (a.isFree !== b.isFree) return a.isFree ? 1 : -1;
      }

      // Both have a popularity rank: sort by rank ascending
      if (aIsFeatured && bIsFeatured) return aRank - bRank;

      // One has rank, other doesn't: ranked one comes first
      if (aIsFeatured) return -1;
      if (bIsFeatured) return 1;

      // Neither has rank: sort by createdAt descending (newest first), nulls last
      const aCreated = a.createdAt ?? -Infinity;
      const bCreated = b.createdAt ?? -Infinity;
      return bCreated - aCreated;
    });
}


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

// ── D1 history storage ────────────────────────────────────────────────────────
//
// Each cron tick appends ~60 rows: 20 day-models + 20 week-models + 20 apps.
// Indefinite retention. Queries are bounded by snapshot_at >= cutoff so growth
// doesn't slow lookups.

// Append the JSON-sourced day app board + weekly model board to D1. The JSON
// endpoints already carry their own history (52-week share series) for the chart,
// but app/model sparklines + deltas + "view as of" are computed from accumulated
// D1 snapshots, so we keep writing one row-set per refresh. Append-only.
async function writeJsonSnapshots(
  env: Env, models: ModelRanking[], appsDay: AppRanking[], fetchedAt: string,
): Promise<void> {
  const snapshotDay = fetchedAt.slice(0, 10);
  const stmt = env.RANKINGS_DB.prepare(`
    INSERT INTO rankings_snapshots
      (snapshot_at, snapshot_day, kind, period, rank, identifier, name, description, total_tokens, origin_url, favicon_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const batch: D1PreparedStatement[] = [];
  models.forEach((m, i) => {
    batch.push(stmt.bind(fetchedAt, snapshotDay, 'model', 'week', i + 1, m.modelSlug, m.modelSlug, null, m.totalTokens, null, null));
  });
  for (const a of appsDay) {
    batch.push(stmt.bind(fetchedAt, snapshotDay, 'app', 'day', a.rank, a.title, null, a.description || null, a.totalTokens, a.originUrl || null, a.faviconUrl));
  }
  if (batch.length > 0) await env.RANKINGS_DB.batch(batch);
}

// ── Period-aware reads ────────────────────────────────────────────────────────

// Returns the snapshot_at of the most recent batch for (kind, period). Use it
// to scope the query so we only return rows from that snapshot — D1 will
// otherwise return rows from every prior snapshot too.
async function latestSnapshotAt(env: Env, kind: 'model' | 'app', period: 'day' | 'week'): Promise<string | null> {
  const row = await env.RANKINGS_DB
    .prepare('SELECT MAX(snapshot_at) AS s FROM rankings_snapshots WHERE kind = ? AND period = ?')
    .bind(kind, period)
    .first<{ s: string | null }>();
  return row?.s ?? null;
}

// Most-recent snapshot_at for (kind, period) at or before `asOf` (overall when
// omitted). Powers the "view as of" picker — re-anchors which snapshot is "current".
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

async function readLatestModels(env: Env, period: 'day' | 'week', asOf?: string): Promise<ModelRanking[]> {
  const latest = await snapshotAtBefore(env, 'model', period, asOf);
  if (!latest) return [];
  const result = await env.RANKINGS_DB
    .prepare('SELECT identifier, name, total_tokens, rank, snapshot_day FROM rankings_snapshots WHERE kind = ? AND period = ? AND snapshot_at = ? ORDER BY rank ASC LIMIT 20')
    .bind('model', period, latest)
    .all<{ identifier: string; name: string | null; total_tokens: number; rank: number; snapshot_day: string }>();
  return (result.results ?? []).map((r) => ({
    modelSlug: r.identifier,
    totalTokens: Number(r.total_tokens) || 0,
    totalRequests: 0,
    date: r.snapshot_day,
  }));
}

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

// Aggregate over the last `days` daily snapshots. For each identifier, take
// the LAST snapshot of each calendar day (end-of-day total) and SUM across
// days. This gives a meaningful total token volume over the window.
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

// Count distinct calendar days of app snapshots in the trailing `days` window.
// Gates week/month aggregations: with < N days of history, SUMming daily
// snapshots would label a 1- or 2-day total as a "7D"/"30D" total — fake.
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

// ── Trend computation (sparklines + deltas from D1 history) ───────────────────
//
// All visible board rows share ONE batched query per kind. Models read
// period='week' rows (the weekly-rolling total sampled over time); apps read
// period='day'. Honesty rule: a sparkline needs >= 2 daily points and a delta
// needs a prior point ~periodDays back — otherwise emit nothing, never a guess.

interface SeriesPoint { day: string; tokens: number; rank: number; }

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
  const anchor = upperIso ?? new Date().toISOString();
  const cutoff = new Date(new Date(anchor).getTime() - days * 86400_000).toISOString();
  const placeholders = identifiers.map(() => '?').join(',');
  // Bound above ONLY when viewing "as of" a past time. For the live view we
  // leave it open so the series includes the newest snapshot and the sparkline
  // ends at the board's current value (snapshots are always past-dated in prod,
  // so an open bound == MAX anyway, but this avoids any wall-clock skew gap).
  const upperClause = upperIso ? ' AND snapshot_at <= ?' : '';
  const sql = `
    WITH daily AS (
      SELECT identifier, snapshot_day AS day, total_tokens AS tokens, rank,
        ROW_NUMBER() OVER (PARTITION BY identifier, snapshot_day ORDER BY snapshot_at DESC) AS rn
      FROM rankings_snapshots
      WHERE kind = ? AND period = ? AND category IS NULL AND snapshot_at >= ?${upperClause}
        AND identifier IN (${placeholders})
    )
    SELECT identifier, day, tokens, rank FROM daily WHERE rn = 1 ORDER BY identifier, day ASC
  `;
  const binds = upperIso
    ? [kind, period, cutoff, upperIso, ...identifiers]
    : [kind, period, cutoff, ...identifiers];
  const res = await env.RANKINGS_DB
    .prepare(sql)
    .bind(...binds)
    .all<{ identifier: string; day: string; tokens: number; rank: number }>();
  for (const r of res.results ?? []) {
    const arr = out.get(r.identifier) ?? [];
    arr.push({ day: r.day, tokens: Number(r.tokens) || 0, rank: r.rank });
    out.set(r.identifier, arr);
  }
  return out;
}

function isoDayMinus(day: string, n: number): string {
  return new Date(new Date(day + 'T00:00:00Z').getTime() - n * 86400_000)
    .toISOString()
    .slice(0, 10);
}

// Compare the latest point to the last point on/before (latest_day - periodDays).
// Returns null when there is no prior point — caller omits the badge.
function deltaFromSeries(series: SeriesPoint[], periodDays: number): RankDelta | null {
  if (!series || series.length < 2) return null;
  const latest = series[series.length - 1];
  const target = isoDayMinus(latest.day, periodDays);
  let prior: SeriesPoint | null = null;
  for (const p of series) {
    if (p.day <= target) prior = p;
  }
  if (!prior || prior.day === latest.day) return null;
  const pctChange = prior.tokens > 0 ? (latest.tokens - prior.tokens) / prior.tokens : null;
  return { rankChange: prior.rank - latest.rank, pctChange };
}

interface TrendRow {
  identifier: string;
  set: (sparkline: number[] | undefined, delta: RankDelta | null) => void;
}

// Batched: one readSeries call covers every row, then attach sparkline + delta.
async function attachTrends(
  env: Env,
  kind: 'model' | 'app',
  seriesPeriod: 'day' | 'week',
  rows: TrendRow[],
  periodDays: number,
  upperIso?: string,
): Promise<void> {
  if (rows.length === 0) return;
  const series = await readSeries(
    env, kind, seriesPeriod, rows.map((r) => r.identifier),
    Math.max(14, periodDays + 1), upperIso,
  );
  for (const row of rows) {
    const s = series.get(row.identifier) ?? [];
    row.set(s.length >= 2 ? s.map((p) => p.tokens) : undefined, deltaFromSeries(s, periodDays));
  }
}

// ── KV refresh (called by cron) ───────────────────────────────────────────────

// `includeCategories` gates the once-per-day, ~2-3 min category scrape (up to 15
// Browser Rendering pages). Only the scheduled (cron) handler passes true — it has
// a 15-min wall-clock budget. The HTTP /api/refresh path leaves it false: Cloudflare
// cancels HTTP ctx.waitUntil() work 30s after the response is sent, far short of
// this scrape, so there is nowhere in a request to run it. Categories stay cron-owned.
export async function refreshAllData(
  env: Env,
  opts: { includeCategories?: boolean } = {},
): Promise<{ models: number; rankings?: string; rankingsError?: string; categories?: string; categoriesError?: string }> {
  const models = await fetchModelsFromOpenRouter();

  await env.TOKEN_APP_KV.put(KV_KEYS.MODELS, JSON.stringify(models), {
    expirationTtl: 7200, // 2 hours TTL (cron runs every hour)
  });
  await env.TOKEN_APP_KV.put(KV_KEYS.MODELS_UPDATED, new Date().toISOString());

  // Store subscriptions (static data, updated on deploy)
  await env.TOKEN_APP_KV.put(KV_KEYS.SUBSCRIPTIONS, JSON.stringify(SUBSCRIPTIONS));

  // Fetch and store rankings from OpenRouter's JSON endpoints (best-effort, don't
  // fail the whole refresh). Replaces the old puppeteer scrape for all primary
  // data — only the per-category boards still use Browser Rendering (below).
  let rankingsStatus: string | undefined;
  let rankingsError: string | undefined;
  try {
    const [{ author, model }, apps, topModels] = await Promise.all([
      fetchShareSeries(), fetchAppsBoards(), fetchModelBoard(),
    ]);

    // Total-failure guard: if EVERY section is empty, keep all last-good KV and
    // surface the error rather than silently no-op'ing.
    if (topModels.length === 0 && apps.day.length === 0 && author.entities.length === 0) {
      throw new Error('Rankings JSON returned empty — KV left unchanged');
    }

    // Per-section empty-overwrite guards: a PARTIAL upstream failure (e.g. the
    // share endpoints come back empty while models/apps succeed) must not
    // overwrite a healthy section's last-good KV with empty data — that 404s the
    // chart or empties a board. Each write is gated on its own payload, so a bad
    // section leaves the previous KV value intact (empty-overwrite lesson applied
    // per-key; see codex review 2026-06-27).
    const fetchedAt = new Date().toISOString();

    if (author.entities.length > 0 && model.entities.length > 0) {
      await env.TOKEN_APP_KV.put(KV_KEYS.SHARE_SERIES,
        JSON.stringify({ author, model, fetchedAt }), { expirationTtl: 7200 });
    }
    if (apps.day.length > 0) {
      await env.TOKEN_APP_KV.put(KV_KEYS.APPS_BOARDS,
        JSON.stringify({ ...apps, fetchedAt }), { expirationTtl: 7200 });
    }
    if (topModels.length > 0 || apps.day.length > 0) {
      const ssrPayload: RankingsData = {
        topModels,
        topApps: { day: apps.day, week: apps.week, month: apps.month },
        fetchedAt,
      };
      await env.TOKEN_APP_KV.put(KV_KEYS.RANKINGS, JSON.stringify(ssrPayload), { expirationTtl: 7200 });
    }

    // D1 continuity: keep accumulating the day app board + weekly model board so
    // app/model sparklines, deltas, and "view as of" keep working going forward.
    await writeJsonSnapshots(env, topModels, apps.day, fetchedAt);

    rankingsStatus = `models: ${topModels.length}, apps: ${apps.day.length}d, series: ${author.weeks}w`;
  } catch (err) {
    console.error('Rankings JSON fetch failed (non-fatal):', err);
    rankingsError = String(err);
  }

  // ── Categories: scrape AT MOST once per calendar day. Long-running (~2-3 min,
  //    up to 15 Browser Rendering pages), so it ONLY runs when the caller has the
  //    wall-clock budget — the hourly scheduled handler (15-min cron limit) passes
  //    includeCategories. The HTTP /api/refresh path skips it (CF cancels HTTP
  //    ctx.waitUntil() 30s after the response, so a 2-3 min job can't run in a
  //    request). The daily guard below still dedupes across the cron's hourly runs.
  //    (No new cron trigger — wrangler.toml is gitignored, so a new [[triggers]]
  //    entry wouldn't survive a clean deploy.)
  let categoriesStatus: string | undefined;
  let categoriesError: string | undefined;
  if (opts.includeCategories) {
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
  } else {
    categoriesStatus = 'skipped (cron-only)';
  }

  return { models: models.length, rankings: rankingsStatus, rankingsError, categories: categoriesStatus, categoriesError };
}

// ── Read from KV (with stale-while-revalidate fallback) ──────────────────────

export async function getModels(env: Env): Promise<{
  models: NormalizedModel[];
  lastUpdated: string | null;
}> {
  const [raw, lastUpdated] = await Promise.all([
    env.TOKEN_APP_KV.get(KV_KEYS.MODELS),
    env.TOKEN_APP_KV.get(KV_KEYS.MODELS_UPDATED),
  ]);

  if (!raw) {
    // KV is empty — fetch live (first run or expired)
    const models = await fetchModelsFromOpenRouter();
    await env.TOKEN_APP_KV.put(KV_KEYS.MODELS, JSON.stringify(models), {
      expirationTtl: 7200,
    });
    const now = new Date().toISOString();
    await env.TOKEN_APP_KV.put(KV_KEYS.MODELS_UPDATED, now);
    return { models, lastUpdated: now };
  }

  return {
    models: JSON.parse(raw) as NormalizedModel[],
    lastUpdated,
  };
}

export async function getSubscriptions(env: Env) {
  const raw = await env.TOKEN_APP_KV.get(KV_KEYS.SUBSCRIPTIONS);
  if (!raw) {
    // Seed KV with static data on first request
    await env.TOKEN_APP_KV.put(KV_KEYS.SUBSCRIPTIONS, JSON.stringify(SUBSCRIPTIONS));
    return SUBSCRIPTIONS;
  }
  return JSON.parse(raw);
}

// Period-aware reader.
//
// Models: OpenRouter's UI only publishes a weekly rolling leaderboard, so the
// model leaderboard returned here is ALWAYS the latest weekly snapshot
// regardless of the requested period. The UI shows a small note explaining
// this — the period toggle effectively only affects the apps panel.
//
// Apps: 'day' = latest day snapshot; 'week' = SUM over the last 7 daily
// snapshots BUT only when 7 distinct calendar days of history exist;
// 'month' = same with 30. With insufficient history we return an empty list
// plus `appsHistoryDays` so the UI can render an honest progress state
// instead of a fabricated total derived from fewer than N days of data.
//
// Falls back to KV (legacy single-period blob) when D1 reads fail.
export async function getRankings(
  env: Env,
  period: RankingPeriod = 'day',
  asOf?: string,
  category?: string | null,
): Promise<RankingsData | null> {
  const cat = category ?? null;

  // Fast path — global board, latest: straight from the cron-written KV blob
  // (JSON-sourced). Apps day/week/month all come from OpenRouter directly, so the
  // 7D/30D agent boards light up immediately (no D1 accumulation gate). Sparklines
  // + deltas still come from accumulated D1 history.
  if (cat == null && !asOf) {
    const raw = await env.TOKEN_APP_KV.get(KV_KEYS.RANKINGS);
    if (raw) {
      const base = JSON.parse(raw) as RankingsData;
      const models = base.topModels || [];
      const apps = (base.topApps && base.topApps[period]) || [];
      try {
        const periodDays = period === 'month' ? 30 : period === 'week' ? 7 : 1;
        await Promise.all([
          attachTrends(env, 'model', 'week', models.map((m): TrendRow => ({
            identifier: m.modelSlug, set: (sp, d) => { m.sparkline = sp; m.delta = d; },
          })), 7, undefined),
          attachTrends(env, 'app', 'day', apps.map((a): TrendRow => ({
            identifier: a.title, set: (sp, d) => { a.sparkline = sp; a.delta = period === 'day' ? d : null; },
          })), periodDays, undefined),
        ]);
      } catch (err) { console.error('Trend attach failed (non-fatal):', err); }
      const topApps: Record<RankingPeriod, AppRanking[]> = { day: [], week: [], month: [] };
      topApps[period] = apps;
      return { topModels: models, topApps, fetchedAt: base.fetchedAt };
    }
    // KV empty (first run / expired) → fall through to the D1 path.
  }

  // "View as of", category boards, or KV miss → D1 (categories via puppeteer; the
  // global board's day/week snapshots are accumulated by writeJsonSnapshots).
  return getRankingsFromD1(env, period, asOf, cat);
}

async function getRankingsFromD1(
  env: Env,
  period: RankingPeriod,
  asOf: string | undefined,
  cat: string | null,
): Promise<RankingsData | null> {
  const requiredDays = period === 'week' ? 7 : period === 'month' ? 30 : 0;
  try {
    const modelsTask = readLatestModels(env, 'week', asOf); // models are always the global weekly board

    let apps: AppRanking[];
    let appsHistoryDays: number | undefined;
    if (period === 'day') {
      apps = await readLatestApps(env, asOf, cat);
    } else {
      // Gate the aggregation behind real days-of-history. Without this check,
      // 1 day of snapshots SUMs to ~the same total as 24H but gets labelled
      // "7D"/"30D" — misleading. (Aggregations stay trailing-from-now in v1;
      // asOf re-anchors only the day + models boards.)
      appsHistoryDays = await countAppDaysInRange(env, requiredDays, cat);
      apps = appsHistoryDays >= requiredDays
        ? await aggregateApps(env, requiredDays, cat)
        : [];
    }

    const models = await modelsTask;
    if (models.length > 0 || apps.length > 0 || appsHistoryDays !== undefined) {
      // Attach sparklines + deltas from history. Models: always week-over-week
      // (the board is weekly-rolling). Apps: sparkline on every period, but a
      // delta only on the 24H board — a window-vs-window delta for the 7D/30D
      // SUM aggregates is out of v1 scope (would mislead next to a sum).
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

      // Return apps under the requested period key so the client doesn't
      // have to know about empty-array vs missing-key fallback semantics.
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

  // Fallback to KV (legacy single-period blob)
  const raw = await env.TOKEN_APP_KV.get(KV_KEYS.RANKINGS);
  if (!raw) return null;
  return JSON.parse(raw) as RankingsData;
}

