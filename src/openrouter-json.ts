// OpenRouter rankings — clean JSON source.
//
// OpenRouter exposes all rankings data under /api/frontend/v1/rankings/* as plain
// JSON (GET + browser UA, no auth). This module fetches and normalizes it,
// replacing the fragile puppeteer/Browser-Rendering scrape for everything except
// the per-category agent boards (those are served by a Next.js server action with
// a deploy-volatile hash — see fetchers.ts fetchCategoryRankings, still puppeteer).
//
// Endpoints (verified 2026-06-26):
//   market-share          → { data: [{ x, ys: { <author>: tokens, others } }] }  (52 weekly points)
//   model-rankings-chart  → { data: { data: [{ x, ys: { <model>: tokens, Others } }], cachedAt } }
//   apps                  → { data: { day:[…], week:[…], month:[…] } }  (top-20 each, current)

import type { ShareSeries, ShareEntity, AppRanking, ModelRanking } from './types';

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

// Normalize a weekly token-count series to per-week share %. Display set = the
// latest week's top-N named entities; everything else (incl. the endpoint's own
// "others" bucket and non-display top entities of older weeks) folds into one
// "others" band, so every week sums to 100%.
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

type RawModelRow = {
  date: string; model_permaslug: string; variant: string;
  total_prompt_tokens: number; total_completion_tokens: number; count: number;
};

// Weekly model leaderboard from /rankings/models. Each row's token totals are the
// trailing weekly total as of its `date`, so we take the latest date only and sum
// variants of the same permaslug — this reproduces OpenRouter's live leaderboard
// exactly (verified: deepseek-v4-flash 4.94T, mimo-v2.5 4.42T, …). Sparklines and
// deltas are attached downstream from accumulated D1 history (same as before).
export async function fetchModelBoard(topN = 15): Promise<ModelRanking[]> {
  const { data } = await getJson<{ data: RawModelRow[] }>('models');
  if (!data || data.length === 0) return [];
  const latest = data.reduce((mx, r) => (r.date > mx ? r.date : mx), data[0].date);
  const byModel = new Map<string, number>();
  for (const r of data) {
    if (r.date !== latest) continue;
    const tok = (r.total_prompt_tokens || 0) + (r.total_completion_tokens || 0);
    byModel.set(r.model_permaslug, (byModel.get(r.model_permaslug) || 0) + tok);
  }
  const date = latest.slice(0, 10);
  return Array.from(byModel.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([permaslug, tokens]): ModelRanking => {
      const provider = permaslug.split('/')[0] || '';
      return { modelSlug: `${provider}/${modelLabel(permaslug)}`, totalTokens: tokens, totalRequests: 0, date };
    });
}
