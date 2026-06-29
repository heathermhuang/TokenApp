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

import type {
  ShareSeries, ShareEntity, AppRanking, ModelRanking,
  TaskSpend, TaskSpendTask, TaskSpendCategory,
} from './types';

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

// Canonical model key: "provider/name", date suffix (-YYYYMMDD) stripped and the
// ":free" variant preserved, so a model's band stays continuous across weeks even
// as its dated permaslug rolls over (xiaomi/mimo-v2.5-20260422 → xiaomi/mimo-v2.5).
function canonModel(permaslug: string): string {
  const provider = permaslug.split('/')[0] || '';
  let tail = permaslug.slice(provider.length + 1);
  const free = /:free$/.test(tail);
  tail = tail.replace(/:free$/, '').replace(/-20\d{6}$/, '');
  return `${provider}/${tail}${free ? ':free' : ''}`;
}

// Build the per-MODEL weekly share series from model-rankings-chart points. The
// endpoint gives each week its OWN top models + an "Others" bucket (verified:
// "Others" is ~40%/week and is exactly what OpenRouter's chart shows as the big
// base band). The old bug projected TODAY's top-9 backward, leaving historical
// weeks empty/grey. Here the display set is the UNION of every week's named
// models (so each era's leaders are coloured), keys are canonicalized for
// continuity, and "Others" is kept as entities[0] → the BOTTOM band, matching
// OpenRouter's Top Models chart.
export function modelShareSeries(raw: RawPoint[]): ShareSeries {
  const now = new Date().toISOString();
  const clean = (raw || []).filter((p) => p && p.ys && p.x);
  if (clean.length === 0) return { entities: [], weeks: 0, fetchedAt: now };
  const isOthers = (k: string) => k.toLowerCase() === 'others';
  // Per week: sum named models by canonical key, capture the endpoint's Others.
  const wk = clean.map((p) => {
    const m = new Map<string, number>();
    let oth = 0;
    for (const [k, v] of Object.entries(p.ys)) {
      if (isOthers(k)) { oth += v || 0; continue; }
      const ck = canonModel(k);
      m.set(ck, (m.get(ck) || 0) + (v || 0));
    }
    return { x: p.x, m, oth };
  });
  // Display every named model that ever appears (the endpoint already caps each
  // week to ~9, so this union is just the set of all weeks' leaders), ordered by
  // all-time volume for stable stacking.
  const allTime = new Map<string, number>();
  for (const w of wk) for (const [k, v] of w.m) allTime.set(k, (allTime.get(k) || 0) + v);
  const ordered = [...allTime.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const others: ShareEntity = { key: 'others', label: 'Others', latestPct: 0, points: [] };
  const entities: ShareEntity[] = ordered.map((key) => ({ key, label: modelLabel(key), latestPct: 0, points: [] }));
  for (const w of wk) {
    let total = w.oth; for (const v of w.m.values()) total += v; total = total || 1;
    others.points.push({ date: w.x, pct: Math.round((w.oth / total) * 10000) / 100, tokens: w.oth });
    for (const e of entities) {
      const tok = w.m.get(e.key) || 0;
      e.points.push({ date: w.x, pct: Math.round((tok / total) * 10000) / 100, tokens: tok });
    }
  }
  const all = [others, ...entities];   // Others first → bottom of the stack
  for (const e of all) e.latestPct = e.points[e.points.length - 1]?.pct ?? 0;
  return { entities: all, weeks: wk.length, fetchedAt: now };
}

export async function fetchShareSeries(): Promise<{ author: ShareSeries; model: ShareSeries }> {
  const [ms, mc] = await Promise.all([
    getJson<{ data: RawPoint[] }>('market-share'),
    getJson<{ data: { data: RawPoint[] } }>('model-rankings-chart'),
  ]);
  return {
    author: normalizeShareSeries(ms.data, 9),
    model: modelShareSeries(mc.data.data),
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
  // Group by CANONICAL key, not the raw permaslug. Two permaslugs that differ
  // only by a date suffix (xiaomi/mimo-v2.5-20260422 vs -20260510) both map to
  // the same display slug downstream (modelLabel strips the date) — so keying
  // the accumulator by the raw permaslug emitted DUPLICATE leaderboard rows with
  // split token counts, sinking the model's true rank ([P2] slug-collision bug).
  // canonModel() collapses the date suffix while preserving the `:free` variant,
  // matching the per-model chart's continuity keys. `sample` keeps a concrete
  // permaslug for the pretty label (date-independent after modelLabel()).
  const byCanon = new Map<string, { tokens: number; sample: string }>();
  for (const r of data) {
    if (r.date !== latest) continue;
    const tok = (r.total_prompt_tokens || 0) + (r.total_completion_tokens || 0);
    const ck = canonModel(r.model_permaslug);
    const cur = byCanon.get(ck);
    if (cur) cur.tokens += tok;
    else byCanon.set(ck, { tokens: tok, sample: r.model_permaslug });
  }
  const date = latest.slice(0, 10);
  return Array.from(byCanon.values())
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, topN)
    .map(({ tokens, sample }): ModelRanking => {
      const provider = sample.split('/')[0] || '';
      return { modelSlug: `${provider}/${modelLabel(sample)}`, totalTokens: tokens, totalRequests: 0, date };
    });
}

// ── Top models by task (the "Top models by task" treemap) ────────────────────
// Sourced from /rankings/task-spend. The payload carries two parallel metrics —
// `spend` ($) and `tokens` — each as { windowDays, macroCategories, tasks }.
// OpenRouter's treemap labels read "X% of all SPEND", so we surface the `spend`
// half: tiles sized by each task's share, coloured by macro-category, and each
// task carries its own top-model leaderboard. Tasks are tagged
// ("code:general_impl"); OpenRouter curates the human labels (TASK_LABELS).

type RawSpendBlock = {
  windowDays: number;
  macroCategories: { key: string; label: string; spendShare: number }[];
  tasks: {
    tag: string; macroCategory: string; spendShareOfTotal: number;
    models: { model: string; share: number; deltaPp: number }[];
  }[];
};
type RawTaskSpend = { data: { spend: RawSpendBlock; tokens: RawSpendBlock } };

// Curated tag → display label, verified against OpenRouter's rendered treemap
// (2026-06-28). Unknown/new tags fall back to prettyTag().
const TASK_LABELS: Record<string, string> = {
  'agent:workflow_execution': 'Workflow Execution',
  'agent:multi_step_planning': 'Multi-step Planning',
  'agent:tool_dispatch': 'Tool Dispatch',
  'agent:memory_extraction': 'Memory Extraction',
  'agent:web_search': 'Web Search',
  'classification_tagging': 'Classification',
  'content_writing': 'Content Writing',
  'qa_knowledge': 'Q&A & Knowledge',
  'conversational_reply': 'Conversation',
  'roleplay_fiction': 'Roleplay & Fiction',
  'customer_support': 'Customer Support',
  'summarization': 'Summarization',
  'image_prompting': 'Image Prompting',
  'research_report': 'Research & Reports',
  'finance_trading': 'Finance & Trading',
  'translation': 'Translation',
  'math': 'Math',
  'security_audit': 'Security Audit',
  'devops': 'DevOps',
  'code:general_impl': 'Code Generation',
  'code:debugging': 'Debugging',
  'code:file_read_write': 'File I/O',
  'code:frontend_ui': 'Frontend & UI',
  'code:review_security': 'Code Review',
  'code:shell_execution': 'Shell Execution',
  'code:repo_scan': 'Repo Scanning',
  'code:sql_database': 'SQL & Database',
  'code:devops_config': 'DevOps & Config',
  'data:extraction': 'Data Extraction',
  'data:transformation': 'Data Transformation',
};

function prettyTag(tag: string): string {
  const tail = tag.includes(':') ? tag.slice(tag.indexOf(':') + 1) : tag;
  return tail.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Pure transform (network-free, so the verify harness can run it on captured
// JSON — same split as modelShareSeries/fetchShareSeries).
export function taskSpendFromRaw(raw: RawTaskSpend): TaskSpend {
  const now = new Date().toISOString();
  const block = raw && raw.data && raw.data.spend;
  if (!block || !Array.isArray(block.tasks)) {
    return { windowDays: 0, categories: [], tasks: [], fetchedAt: now };
  }
  const categories: TaskSpendCategory[] = (block.macroCategories || []).map((c) => ({
    key: c.key, label: c.label, share: c.spendShare,
  }));
  const tasks: TaskSpendTask[] = block.tasks
    .filter((t) => t && t.tag)
    .map((t) => ({
      tag: t.tag,
      label: TASK_LABELS[t.tag] || prettyTag(t.tag),
      macroCategory: t.macroCategory,
      share: t.spendShareOfTotal || 0,
      models: (t.models || []).slice(0, 10).map((m) => ({
        slug: m.model,
        label: modelLabel(m.model),
        provider: m.model.split('/')[0] || '',
        share: m.share || 0,
        deltaPp: m.deltaPp || 0,
      })),
    }))
    .sort((a, b) => b.share - a.share);
  return { windowDays: block.windowDays || 0, categories, tasks, fetchedAt: now };
}

export async function fetchTaskSpend(): Promise<TaskSpend> {
  return taskSpendFromRaw(await getJson<RawTaskSpend>('task-spend'));
}
