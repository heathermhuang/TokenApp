/**
 * Per-provider endpoints for a single model — OpenRouter
 * `/api/v1/models/{id}/endpoints` (verified 200 unauthenticated, 2026-08-05).
 *
 * WHY THIS IS THE MOST ON-BRAND FEATURE WE HAVE: the SAME model is resold by a
 * dozen-plus hosts at prices that differ by multiples, and the cheap ones are
 * sometimes cheap because they serve a fraction of the context window or run
 * fp4 weights. Measured today: GLM-5.2 has 33 hosts; Llama-3.3-70B spans 4.5×
 * ($0.10 → $0.45 input) and one host caps context at 6k instead of 131k.
 * llm-stats prints a single "Best provider" line. This is a pricing question,
 * which is our whole remit.
 *
 * FETCH STRATEGY — lazily, per model, cached in KV:
 * 338 models × 1 request would blow the cron's budget, and we cannot know which
 * models have multiple hosts without asking. So the model page fetches on demand
 * behind a read-through KV cache. Only models people actually look at cost a
 * request, the cron is untouched, and a slow or dead upstream degrades to "panel
 * omitted" rather than a blocked page render (see the timeout in getModelEndpoints).
 *
 * NOT AVAILABLE HERE: `latency_last_30m` and `throughput_last_30m` came back null
 * on every endpoint of every model probed. Do not build a speed feature on them.
 */

import type { Env, ModelEndpoints, ProviderEndpoint } from './types';

const PER_M = 1_000_000;
const TTL_SECONDS = 6 * 60 * 60;  // hosts/prices move slowly; 6h is plenty
const FETCH_TIMEOUT_MS = 4000;

function usdPerM(raw: unknown): number | null {
  const n = Number.parseFloat(String(raw));
  if (!Number.isFinite(n) || n < 0) return null;
  return n * PER_M;
}

// Same 3:1 input:output basis used by the main table, the frontier chart and the
// compare pages. One ratio everywhere, or the site contradicts itself about which
// of two hosts is cheaper.
function blend(inP: number | null, outP: number | null): number | null {
  if (inP === null || outP === null) return null;
  return inP * 0.75 + outP * 0.25;
}

interface RawEndpoint {
  name?: string;
  provider_name?: string;
  tag?: string;
  context_length?: number | null;
  max_completion_tokens?: number | null;
  quantization?: string | null;
  uptime_last_1d?: number | null;
  supports_implicit_caching?: boolean;
  pricing?: {
    prompt?: string; completion?: string;
    input_cache_read?: string;
    overrides?: { min_prompt_tokens?: number; prompt?: string; completion?: string }[];
  };
}

export function normalizeEndpoints(modelId: string, raw: RawEndpoint[]): ModelEndpoints {
  const endpoints: ProviderEndpoint[] = raw.map((e) => {
    const provider = e.provider_name ?? 'Unknown';
    const inputPer1M = usdPerM(e.pricing?.prompt);
    const outputPer1M = usdPerM(e.pricing?.completion);
    const quant = e.quantization && e.quantization !== 'unknown' ? e.quantization : null;

    // A provider legitimately appears several times, and `tag` says why: a
    // SERVICE TIER (openai/flex $2.50 vs openai $5 vs openai/priority $10), a
    // REGION (azure/eu, amazon-bedrock/eu-west-1, google-vertex/us-east5), or a
    // secondary pool (anthropic/2). Numbering them "#1 #2 #3" — the first thing
    // I tried — throws that away and tells the reader nothing. Use the tag
    // suffix, minus the quantization case where it just repeats the Weights
    // column (streamlake/fp8).
    const suffix = (e.tag ?? '').includes('/') ? (e.tag as string).split('/').slice(1).join('/') : '';
    const label = suffix && suffix !== quant ? `${provider} (${suffix})` : provider;

    // Long-context re-pricing tier, when the host publishes one.
    const ov = (e.pricing?.overrides ?? [])
      .filter((o) => typeof o.min_prompt_tokens === 'number')
      .sort((a, b) => (a.min_prompt_tokens ?? 0) - (b.min_prompt_tokens ?? 0))[0];
    const longContext = ov
      ? {
          minPromptTokens: ov.min_prompt_tokens as number,
          inputPer1M: usdPerM(ov.prompt) ?? (inputPer1M ?? 0),
          outputPer1M: usdPerM(ov.completion) ?? (outputPer1M ?? 0),
        }
      : null;

    return {
      provider,
      label,
      tag: e.tag ?? '',
      inputPer1M,
      outputPer1M,
      blendedPer1M: blend(inputPer1M, outputPer1M),
      cacheReadPer1M: usdPerM(e.pricing?.input_cache_read),
      contextLength: e.context_length ?? null,
      maxOutput: e.max_completion_tokens ?? null,
      // "unknown" is not information — normalized away above so the UI can decide
      // whether to show a quantization column at all.
      quantization: quant,
      uptimeDay: typeof e.uptime_last_1d === 'number' ? e.uptime_last_1d : null,
      implicitCaching: Boolean(e.supports_implicit_caching),
      longContext,
    };
  });

  // Unpriced hosts sort last rather than pretending to be free.
  endpoints.sort((a, b) => {
    if (a.blendedPer1M === null) return 1;
    if (b.blendedPer1M === null) return -1;
    return a.blendedPer1M - b.blendedPer1M;
  });

  return { modelId, endpoints, fetchedAt: new Date().toISOString() };
}

export async function fetchModelEndpoints(modelId: string): Promise<ModelEndpoints> {
  const url = `https://openrouter.ai/api/v1/models/${modelId}/endpoints`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'token.app/1.0 (+https://token.app)' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cf: { cacheTtl: 1800, cacheEverything: true },
  });
  if (!res.ok) throw new Error(`endpoints ${res.status} for ${modelId}`);
  const json = (await res.json()) as { data?: { endpoints?: RawEndpoint[] } };
  return normalizeEndpoints(modelId, json.data?.endpoints ?? []);
}

/**
 * Read-through KV cache. Returns null on any failure — callers render without
 * the panel rather than failing the page. A model legitimately served by one
 * host is also "null-ish" for display purposes, but that judgement belongs to
 * the caller, so we still return the single-endpoint payload here.
 */
export async function getModelEndpoints(env: Env, modelId: string): Promise<ModelEndpoints | null> {
  const key = `endpoints:${modelId}`;
  try {
    const cached = await env.TOKEN_APP_KV.get(key);
    if (cached) return JSON.parse(cached) as ModelEndpoints;
  } catch {
    // Corrupt cache entry — fall through and re-fetch.
  }

  try {
    const fresh = await fetchModelEndpoints(modelId);
    // Don't cache an empty result: an upstream blip would then persist as "no
    // hosts" for six hours (the empty-overwrite lesson, applied to a read cache).
    if (fresh.endpoints.length > 0) {
      await env.TOKEN_APP_KV.put(key, JSON.stringify(fresh), { expirationTtl: TTL_SECONDS });
    }
    return fresh;
  } catch (err) {
    console.error(`endpoints fetch failed for ${modelId} (non-fatal):`, err);
    return null;
  }
}
