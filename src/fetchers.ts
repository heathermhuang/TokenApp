import puppeteer from '@cloudflare/puppeteer';
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

// ── Fetch rankings from OpenRouter ───────────────────────────────────────────
//
// As of ~2026-05, openrouter.ai/rankings is fully client-rendered (turbopack
// Next.js app). The data is no longer present in the SSR HTML — it arrives
// after JS hydration via POST Server Action calls. Worker `fetch()` can't run
// JS, so we use Cloudflare's Browser Rendering binding (puppeteer) to load the
// page, wait for content to hydrate, then extract from the rendered DOM.
//
// Sentinels:
//   - Models: each row tagged with data-testid="model-rankings-leaderboard-row"
//     and contains an <a href="/{provider}/{slug}"> to the model page.
//   - Apps:   no stable testid — rendered as a numbered list inside the
//     "Top Apps" section. Extract via the section's innerText.

const RANKINGS_PAGE_URL = 'https://openrouter.ai/rankings';
const RANKINGS_RENDER_TIMEOUT_MS = 45_000;

// Extractor runs inside the rendered openrouter.ai/rankings page. Passed as a
// string so TS won't try to type-check DOM references in a non-DOM context.
const RANKINGS_EXTRACTOR_SOURCE = `(function () {
  function parseTokens(raw) {
    if (!raw) return 0;
    var m = String(raw).replace(/,/g, '').match(/([\\d.]+)\\s*([KMBT])?/i);
    if (!m) return 0;
    var num = parseFloat(m[1]);
    var unit = (m[2] || '').toUpperCase();
    var mults = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
    var mult = mults[unit] || 1;
    return Math.round(num * mult);
  }

  // ── Models — stable data-testid per row ─────────────────────────────────
  var modelRows = Array.prototype.slice.call(
    document.querySelectorAll('[data-testid="model-rankings-leaderboard-row"]')
  );
  var models = [];
  for (var mi = 0; mi < modelRows.length; mi++) {
    var row = modelRows[mi];
    var link = row.querySelector('a[href^="/"]');
    var slug = link ? link.getAttribute('href').replace(/^\\//, '') : '';
    var name = link ? (link.textContent || '').trim() : '';
    var rowText = row.innerText || '';
    var tm = rowText.match(/([\\d.]+\\s*[KMBT]?)\\s*tokens/i);
    var totalTokens = tm ? parseTokens(tm[1]) : 0;
    if (slug && totalTokens > 0) {
      models.push({ modelSlug: slug, modelName: name, totalTokens: totalTokens });
    }
  }

  // ── Apps — no testid; walk from "Top Apps" heading ──────────────────────
  var headings = Array.prototype.slice.call(document.querySelectorAll('h1,h2,h3'));
  var appsHeading = null;
  for (var hi = 0; hi < headings.length; hi++) {
    var ht = (headings[hi].textContent || '').trim();
    if (/^Top Apps$/i.test(ht)) { appsHeading = headings[hi]; break; }
  }
  var apps = [];
  if (appsHeading) {
    var section = appsHeading.parentElement;
    for (var d = 0; d < 8 && section; d++, section = section.parentElement) {
      var text = section.innerText || '';
      var ranks = text.match(/(^|\\n)\\d+\\.(\\s|$)/g);
      if (!ranks || ranks.length < 3) continue;

      var lines = text.split('\\n');
      for (var li = 0; li < lines.length; li++) lines[li] = lines[li].trim();

      for (var i = 0; i < lines.length && apps.length < 30; i++) {
        var rm = lines[i].match(/^(\\d+)\\.$/);
        if (!rm) continue;
        var rank = parseInt(rm[1], 10);
        var title = (lines[i + 1] || '').trim();
        if (!title || /^Show more$/i.test(title)) continue;

        var descLines = [];
        var tokensRaw = '';
        for (var j = i + 2; j < Math.min(i + 15, lines.length); j++) {
          var candidate = lines[j];
          if (/tokens$/i.test(candidate)) {
            tokensRaw = candidate.replace(/tokens$/i, '');
            break;
          }
          if (candidate) descLines.push(candidate);
        }
        if (!tokensRaw) continue;

        var description = descLines.filter(function (l) { return l.length > 6; }).join(' ').slice(0, 240);

        var candidates = Array.prototype.slice.call(section.querySelectorAll('a, h2, h3, div, span'));
        var headEl = null;
        for (var ci = 0; ci < candidates.length; ci++) {
          var ct = (candidates[ci].textContent || '').trim();
          if (ct === title || ct.indexOf(title + ' ') === 0 || ct.indexOf(title + '\\n') === 0) {
            headEl = candidates[ci];
            break;
          }
        }
        var originUrl = '';
        var faviconUrl = null;
        if (headEl) {
          var linkEl = headEl.closest('a[href^="http"]');
          if (linkEl) originUrl = linkEl.href;
          var walk = headEl;
          for (var k = 0; k < 5 && walk; k++, walk = walk.parentElement) {
            var img = walk.querySelector('img');
            if (img && img.src) { faviconUrl = img.src; break; }
          }
        }

        apps.push({
          rank: rank,
          title: title,
          description: description,
          totalTokens: parseTokens(tokensRaw),
          originUrl: originUrl,
          faviconUrl: faviconUrl
        });
      }
      if (apps.length > 0) break;
    }
  }

  return { models: models, apps: apps };
})()`;

export async function fetchRankingsFromOpenRouter(env: Env): Promise<RankingsData> {
  if (!env.BROWSER) {
    throw new Error('BROWSER binding not configured (requires Cloudflare Browser Rendering)');
  }

  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (compatible; token.app/1.0; +https://token.app)');
    await page.setViewport({ width: 1280, height: 1600 });

    await page.goto(RANKINGS_PAGE_URL, {
      waitUntil: 'networkidle0',
      timeout: RANKINGS_RENDER_TIMEOUT_MS,
    });

    // Wait until model rows are hydrated (skeleton state replaced).
    await page.waitForSelector('[data-testid="model-rankings-leaderboard-row"]', {
      timeout: RANKINGS_RENDER_TIMEOUT_MS,
    });

    // Scroll to the bottom to trigger lazy rendering of the Top Apps section.
    // The extractor body is passed as a JS string because this file's tsconfig
    // does not include the DOM lib (worker code shouldn't reference DOM).
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight);');
    // Small settle delay for any lazy-loaded apps content.
    await new Promise((r) => setTimeout(r, 1500));

    const extracted = (await page.evaluate(RANKINGS_EXTRACTOR_SOURCE)) as {
      models: Array<{ modelSlug: string; modelName: string; totalTokens: number }>;
      apps: Array<{
        rank: number;
        title: string;
        description: string;
        totalTokens: number;
        originUrl: string;
        faviconUrl: string | null;
      }>;
    };

    const today = new Date().toISOString().slice(0, 10);
    const topModels: ModelRanking[] = extracted.models.slice(0, 20).map((m) => ({
      modelSlug: m.modelSlug,
      totalTokens: m.totalTokens,
      totalRequests: 0, // No longer rendered on the new page.
      date: today,
    }));

    const seen = new Set<string>();
    const dayApps: AppRanking[] = [];
    for (const a of extracted.apps) {
      if (seen.has(a.title)) continue;
      seen.add(a.title);
      dayApps.push({
        rank: a.rank,
        title: a.title,
        description: a.description,
        categories: [], // Not surfaced in the new UI.
        originUrl: a.originUrl,
        faviconUrl: a.faviconUrl,
        totalTokens: a.totalTokens,
        totalRequests: 0, // Not surfaced in the new UI.
      });
      if (dayApps.length >= 20) break;
    }

    // The new OpenRouter UI no longer exposes week/month app periods. Leave
    // those empty — the client falls back to `day` when a period is missing.
    return {
      topModels,
      topApps: { day: dayApps, week: [], month: [] },
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    await browser.close();
  }
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
    const rankings = await fetchRankingsFromOpenRouter(env);
    const modelCount = rankings.topModels.length;
    const dayCount = rankings.topApps.day?.length ?? 0;
    const weekCount = rankings.topApps.week?.length ?? 0;
    const monthCount = rankings.topApps.month?.length ?? 0;

    // Guard: refuse to overwrite KV with an empty result. The old scraper
    // failed silently for days because no anchors matched; that filled KV
    // with empty arrays every hour. If the fetcher returns nothing useful,
    // leave the previous KV value in place and surface an error instead.
    if (modelCount === 0 && dayCount === 0) {
      throw new Error('Rankings fetcher returned empty result — KV not overwritten');
    }

    await env.TOKEN_APP_KV.put(KV_KEYS.RANKINGS, JSON.stringify(rankings), {
      expirationTtl: 7200,
    });
    rankingsStatus = `${modelCount} models, apps: ${dayCount}d/${weekCount}w/${monthCount}m`;
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
