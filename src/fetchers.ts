import type { Env, NormalizedModel, OpenRouterModel, OpenRouterResponse, RankingsData, ModelRanking, AppRanking, RankingPeriod } from './types';
import { KV_KEYS } from './types';
import { getProvider } from './providers';
import { SUBSCRIPTIONS } from './subscriptions';

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

// ── Fetch rankings from OpenRouter ───────────────────────────────────────────

export async function fetchRankingsFromOpenRouter(): Promise<RankingsData> {
  const resp = await fetch('https://openrouter.ai/rankings', {
    headers: {
      'User-Agent': 'token.app/1.0 (https://token.app)',
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!resp.ok) {
    throw new Error(`OpenRouter rankings fetch error: ${resp.status}`);
  }

  const html = await resp.text();

  // Parse model rankings from RSC payload
  const topModels: ModelRanking[] = [];
  const modelMatch = html.match(/rankingData[\\"]* *: *\[(\{.*?\})\]/s);
  if (modelMatch) {
    try {
      const raw = '[' + modelMatch[1] + ']';
      const cleaned = raw.replace(/\\"/g, '"');
      const items = JSON.parse(cleaned) as Array<{
        model_permaslug?: string;
        variant_permaslug?: string;
        total_prompt_tokens?: number;
        total_completion_tokens?: number;
        count?: number;
        date?: string;
      }>;

      for (const item of items) {
        topModels.push({
          modelSlug: item.model_permaslug ?? item.variant_permaslug ?? '',
          totalTokens: (item.total_prompt_tokens ?? 0) + (item.total_completion_tokens ?? 0),
          totalRequests: item.count ?? 0,
          date: item.date ?? '',
        });
      }
    } catch {
      // Fallback: extract items individually
      const itemPattern = /\{"date":"([^"]*)"[^}]*"model_permaslug":"([^"]*)"[^}]*"total_completion_tokens":(\d+)[^}]*"total_prompt_tokens":(\d+)[^}]*"count":(\d+)/g;
      let m;
      while ((m = itemPattern.exec(html)) !== null) {
        topModels.push({
          modelSlug: m[2],
          totalTokens: parseInt(m[4]) + parseInt(m[3]),
          totalRequests: parseInt(m[5]),
          date: m[1],
        });
      }
    }
  }

  topModels.sort((a, b) => b.totalTokens - a.totalTokens);

  // Parse app rankings from RSC payload
  // The RSC payload uses double-escaped quotes (\\" instead of ") when fetched server-side.
  // Normalize first, then extract day/week/month arrays from the rankMap object.
  const normalizedHtml = html.replace(/\\"/g, '"');
  const periods: RankingPeriod[] = ['day', 'week', 'month'];
  const topApps: Record<RankingPeriod, AppRanking[]> = { day: [], week: [], month: [] };

  for (const period of periods) {
    const needle = `"${period}":[`;
    // Find this period key inside the rankMap object
    const rankMapIdx = normalizedHtml.indexOf('"rankMap":{');
    if (rankMapIdx < 0) continue;

    const periodIdx = normalizedHtml.indexOf(needle, rankMapIdx);
    if (periodIdx < 0) continue;

    const arrayStart = normalizedHtml.indexOf('[', periodIdx);
    if (arrayStart < 0) continue;

    let depth = 0;
    let arrayEnd = -1;
    for (let i = arrayStart; i < Math.min(arrayStart + 100_000, normalizedHtml.length); i++) {
      if (normalizedHtml[i] === '[') depth++;
      else if (normalizedHtml[i] === ']') {
        depth--;
        if (depth === 0) { arrayEnd = i + 1; break; }
      }
    }

    if (arrayEnd <= 0) continue;

    try {
      const items = JSON.parse(normalizedHtml.slice(arrayStart, arrayEnd)) as Array<{
        rank: number;
        total_tokens: string;
        total_requests: number;
        app: {
          title: string;
          description: string;
          origin_url: string;
          favicon_url: string | null;
          categories: string[];
        };
      }>;

      const seenApps = new Set<string>();
      for (const item of items) {
        const title = item.app?.title;
        if (!title || seenApps.has(title)) continue;
        seenApps.add(title);

        topApps[period].push({
          rank: item.rank,
          title,
          description: (item.app.description ?? '').slice(0, 120),
          categories: item.app.categories ?? [],
          originUrl: item.app.origin_url ?? '',
          faviconUrl: item.app.favicon_url ?? null,
          totalTokens: parseInt(item.total_tokens) || 0,
          totalRequests: item.total_requests ?? 0,
        });

        if (topApps[period].length >= 20) break;
      }
    } catch {
      // JSON parse failed for this period — leave it empty
    }

    topApps[period].sort((a, b) => b.totalTokens - a.totalTokens);
  }

  return {
    topModels: topModels.slice(0, 20),
    topApps,
    fetchedAt: new Date().toISOString(),
  };
}

// ── KV refresh (called by cron) ───────────────────────────────────────────────

export async function refreshAllData(env: Env): Promise<{ models: number; rankings?: string; rankingsError?: string }> {
  const models = await fetchModelsFromOpenRouter();

  await env.TOKEN_APP_KV.put(KV_KEYS.MODELS, JSON.stringify(models), {
    expirationTtl: 7200, // 2 hours TTL (cron runs every hour)
  });
  await env.TOKEN_APP_KV.put(KV_KEYS.MODELS_UPDATED, new Date().toISOString());

  // Store subscriptions (static data, updated on deploy)
  await env.TOKEN_APP_KV.put(KV_KEYS.SUBSCRIPTIONS, JSON.stringify(SUBSCRIPTIONS));

  // Fetch and store rankings (best-effort, don't fail the whole refresh)
  let rankingsStatus: string | undefined;
  let rankingsError: string | undefined;
  try {
    const rankings = await fetchRankingsFromOpenRouter();
    await env.TOKEN_APP_KV.put(KV_KEYS.RANKINGS, JSON.stringify(rankings), {
      expirationTtl: 7200,
    });
    const dayCount = rankings.topApps.day?.length ?? 0;
    const weekCount = rankings.topApps.week?.length ?? 0;
    const monthCount = rankings.topApps.month?.length ?? 0;
    rankingsStatus = `${rankings.topModels.length} models, apps: ${dayCount}d/${weekCount}w/${monthCount}m`;
  } catch (err) {
    console.error('Rankings fetch failed (non-fatal):', err);
    rankingsError = String(err);
  }

  return { models: models.length, rankings: rankingsStatus, rankingsError };
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

export async function getRankings(env: Env): Promise<RankingsData | null> {
  const raw = await env.TOKEN_APP_KV.get(KV_KEYS.RANKINGS);
  if (!raw) return null;
  return JSON.parse(raw) as RankingsData;
}
