// Extract + validate a `tokenapp.usage.v1` block from pasted text.
// Pure TypeScript, no dependencies — runs both in the Worker and in the browser
// (the latter via an inlined copy in usage-template.ts; keep this file pure JS
// features only — no Node/CF-specific APIs).

import type { UsageEvent, UsageExport } from './types';

const FENCE_RE = /```tokenapp-usage\s*\n([\s\S]*?)\n```/;

export interface ExtractResult {
  ok: boolean;
  data?: UsageExport;
  errors: string[];
  warnings: string[];
}

// Pull the fenced block. If the user pasted bare JSON, we also accept that as a
// fallback so copy-paste slip-ups don't punish them.
export function extractFenceOrBareJson(text: string): string | null {
  const fence = FENCE_RE.exec(text);
  if (fence && fence[1]) return fence[1].trim();

  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;

  return null;
}

const KNOWN_PROVIDERS = new Set([
  'openai', 'anthropic', 'google', 'meta', 'meta-llama', 'mistral', 'mistralai',
  'deepseek', 'xai', 'x-ai', 'qwen', 'cohere', 'perplexity', 'perplexityai',
  'amazon', 'microsoft', 'nvidia', 'bytedance', 'baidu', 'moonshotai',
  'tencent', 'zhipuai', 'z-ai', 'other',
]);

// Normalize a freeform model id to a canonical form. This mirrors the rules
// the prompts ask the LLM to apply, but we re-apply them server-side because
// LLM output is never 100% compliant.
export function normalizeModelId(raw: string): string {
  if (!raw) return '';
  let id = raw.toLowerCase().trim();

  // Strip leading provider prefix if present (we track it separately)
  id = id.replace(/^(openai|anthropic|google|meta-llama|meta|mistralai|mistral|deepseek|x-ai|xai|qwen|cohere|nvidia|amazon)\//, '');

  // Strip date suffixes: "-20240608", "-2024-06-08", "-0608"
  id = id.replace(/-\d{8}$/, '');
  id = id.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  id = id.replace(/-\d{4}$/, (m) => {
    // Only strip 4-digit suffix if it looks like a date (0101-1231), not a version
    const n = parseInt(m.slice(1));
    return n >= 101 && n <= 1231 ? '' : m;
  });

  return id;
}

function inferProvider(modelId: string, hinted: string | undefined): string {
  if (hinted) {
    const h = hinted.toLowerCase();
    if (KNOWN_PROVIDERS.has(h)) return h === 'meta' ? 'meta-llama' : h === 'xai' ? 'x-ai' : h === 'mistral' ? 'mistralai' : h;
  }
  const id = modelId.toLowerCase();
  if (id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4') || id.startsWith('text-')) return 'openai';
  if (id.startsWith('claude')) return 'anthropic';
  if (id.startsWith('gemini') || id.startsWith('gemma') || id.startsWith('palm')) return 'google';
  if (id.startsWith('llama')) return 'meta-llama';
  if (id.startsWith('mistral') || id.startsWith('mixtral') || id.startsWith('codestral')) return 'mistralai';
  if (id.startsWith('deepseek')) return 'deepseek';
  if (id.startsWith('grok')) return 'x-ai';
  if (id.startsWith('qwen') || id.startsWith('qwq')) return 'qwen';
  if (id.startsWith('command')) return 'cohere';
  return 'other';
}

function validateEvent(raw: unknown, idx: number, warnings: string[]): UsageEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;

  const ts = typeof e.ts === 'string' ? e.ts : null;
  const modelIdRaw = typeof e.modelId === 'string' ? e.modelId : '';
  if (!ts || !modelIdRaw) {
    warnings.push(`event[${idx}] dropped: missing ts or modelId`);
    return null;
  }

  const tsDate = new Date(ts);
  if (isNaN(tsDate.getTime())) {
    warnings.push(`event[${idx}] dropped: invalid ts "${ts}"`);
    return null;
  }

  const modelId = normalizeModelId(modelIdRaw);
  const providerHint = typeof e.provider === 'string' ? e.provider : undefined;
  const provider = inferProvider(modelId, providerHint);

  const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return isNaN(n) ? null : n;
  };
  const toInt = (v: unknown): number => {
    const n = toNum(v);
    return n === null ? 0 : Math.max(0, Math.floor(n));
  };

  return {
    ts: tsDate.toISOString(),
    provider,
    modelId,
    inputTokens: toNum(e.inputTokens),
    outputTokens: toNum(e.outputTokens),
    cachedInputTokens: toInt(e.cachedInputTokens),
    cacheCreationTokens: toInt(e.cacheCreationTokens),
    requests: toNum(e.requests),
    costUSD: toNum(e.costUSD),
    sessionId: typeof e.sessionId === 'string' ? e.sessionId.slice(0, 32) : undefined,
    taskContext: typeof e.taskContext === 'string' ? e.taskContext.slice(0, 64) : undefined,
  };
}

export function parseUsagePaste(text: string): ExtractResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const jsonStr = extractFenceOrBareJson(text);
  if (!jsonStr) {
    errors.push('No ```tokenapp-usage fenced block found. Paste the full output from the AI prompt.');
    return { ok: false, errors, warnings };
  }

  let obj: unknown;
  try {
    obj = JSON.parse(jsonStr);
  } catch (err) {
    errors.push(`JSON parse failed: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, errors, warnings };
  }

  if (!obj || typeof obj !== 'object') {
    errors.push('Parsed value is not an object.');
    return { ok: false, errors, warnings };
  }

  const raw = obj as Record<string, unknown>;
  if (raw.schema !== 'tokenapp.usage.v1') {
    errors.push(`Unexpected schema: "${raw.schema}". Expected "tokenapp.usage.v1".`);
    return { ok: false, errors, warnings };
  }

  const source = typeof raw.source === 'string' ? raw.source : 'other';
  const capturedAt = typeof raw.capturedAt === 'string' && !isNaN(Date.parse(raw.capturedAt))
    ? raw.capturedAt
    : new Date().toISOString();

  const eventsRaw = Array.isArray(raw.events) ? raw.events : [];
  const events: UsageEvent[] = [];
  eventsRaw.forEach((ev, i) => {
    const parsed = validateEvent(ev, i, warnings);
    if (parsed) events.push(parsed);
  });

  if (events.length === 0) {
    errors.push('No valid events found in the paste.');
    return { ok: false, errors, warnings };
  }

  return {
    ok: true,
    data: {
      schema: 'tokenapp.usage.v1',
      source,
      capturedAt,
      currency: typeof raw.currency === 'string' ? raw.currency : 'USD',
      events,
      notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    },
    errors,
    warnings,
  };
}

// Stable fingerprint for dedupe across re-imports of overlapping date ranges.
export function eventFingerprint(e: UsageEvent): string {
  const day = e.ts.slice(0, 10);
  return [
    day,
    e.provider,
    e.modelId,
    e.inputTokens ?? 'n',
    e.outputTokens ?? 'n',
    e.sessionId ?? '',
  ].join('|');
}
