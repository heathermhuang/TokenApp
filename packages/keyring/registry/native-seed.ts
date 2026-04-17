// Native model seeds for providers that don't map 1:1 to an OpenRouter slug.
//
// Groq, Together, Fireworks, and similar "open-model hosting" providers resell
// the same models that appear elsewhere in the registry (Llama, DeepSeek, Qwen,
// etc.), but expose them under their own `providerModelId` via their own
// endpoints. OpenRouter doesn't enumerate them as a distinct provider, so we
// hand-curate the most popular ones here.
//
// Pricing is recorded per snapshot date. Providers update it periodically.
// Consumers should treat pricing as a hint, not a contract — the authoritative
// source is the provider's own console. The `pricingAsOf` metadata lives in
// the provider-level section, not per-model, to keep the schema clean.
//
// Adding a model: copy an existing entry, fill in `providerModelId` exactly
// as the provider expects it in the API `model` field, and update the
// `pricingAsOf` on the owning provider if you also touched prices.

import type { RegistryModel } from './schema';

// Shortcut builders to keep the seed dense and legible.
const text = { input: ['text'], output: ['text'] };
const vision = { input: ['text', 'image'], output: ['text'] };
const usd = (inputPer1M: number | null, outputPer1M: number | null) =>
  inputPer1M == null && outputPer1M == null
    ? null
    : { inputPer1M, outputPer1M, currency: 'USD' as const };

// ── Groq ──────────────────────────────────────────────────────────────────────
// Source: https://console.groq.com/docs/models + https://groq.com/pricing
// Ultra-low-latency hosting; models rotate aggressively, so keep this list tight.

const GROQ: RegistryModel[] = [
  {
    id: 'llama-3.3-70b-versatile',
    providerModelId: 'llama-3.3-70b-versatile',
    displayName: 'Llama 3.3 70B (Versatile)',
    contextWindow: 128000,
    maxOutput: 32768,
    pricing: usd(0.59, 0.79),
    modalities: text,
    capabilities: ['streaming', 'tools', 'json-mode'],
  },
  {
    id: 'llama-3.1-8b-instant',
    providerModelId: 'llama-3.1-8b-instant',
    displayName: 'Llama 3.1 8B (Instant)',
    contextWindow: 128000,
    maxOutput: 8192,
    pricing: usd(0.05, 0.08),
    modalities: text,
    capabilities: ['streaming', 'tools', 'json-mode'],
  },
  {
    id: 'gemma2-9b-it',
    providerModelId: 'gemma2-9b-it',
    displayName: 'Gemma 2 9B Instruct',
    contextWindow: 8192,
    maxOutput: 8192,
    pricing: usd(0.20, 0.20),
    modalities: text,
    capabilities: ['streaming', 'tools'],
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    providerModelId: 'deepseek-r1-distill-llama-70b',
    displayName: 'DeepSeek R1 Distill Llama 70B',
    contextWindow: 131072,
    maxOutput: 131072,
    pricing: usd(0.75, 0.99),
    modalities: text,
    capabilities: ['streaming', 'reasoning'],
  },
  {
    id: 'qwen-2.5-32b',
    providerModelId: 'qwen-2.5-32b',
    displayName: 'Qwen 2.5 32B',
    contextWindow: 128000,
    maxOutput: 8192,
    pricing: usd(0.79, 0.79),
    modalities: text,
    capabilities: ['streaming', 'tools'],
  },
  {
    id: 'qwen-2.5-coder-32b',
    providerModelId: 'qwen-2.5-coder-32b',
    displayName: 'Qwen 2.5 Coder 32B',
    contextWindow: 128000,
    maxOutput: 8192,
    pricing: usd(0.79, 0.79),
    modalities: text,
    capabilities: ['streaming', 'tools'],
  },
];

// ── Together AI ───────────────────────────────────────────────────────────────
// Source: https://docs.together.ai/docs/serverless-models + together.ai/pricing
// Hosts 100+ open models; we list the ~top-tier Turbo/Instruct offerings.

const TOGETHER: RegistryModel[] = [
  {
    id: 'llama-3.3-70b-instruct-turbo',
    providerModelId: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    displayName: 'Llama 3.3 70B Instruct Turbo',
    contextWindow: 131072,
    maxOutput: 8192,
    pricing: usd(0.88, 0.88),
    modalities: text,
    capabilities: ['streaming', 'tools'],
  },
  {
    id: 'llama-3.2-3b-instruct-turbo',
    providerModelId: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
    displayName: 'Llama 3.2 3B Instruct Turbo',
    contextWindow: 131072,
    maxOutput: 8192,
    pricing: usd(0.06, 0.06),
    modalities: text,
    capabilities: ['streaming'],
  },
  {
    id: 'llama-3.2-90b-vision-instruct-turbo',
    providerModelId: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo',
    displayName: 'Llama 3.2 90B Vision Instruct Turbo',
    contextWindow: 131072,
    maxOutput: 8192,
    pricing: usd(1.20, 1.20),
    modalities: vision,
    capabilities: ['streaming', 'vision'],
  },
  {
    id: 'qwen2.5-72b-instruct-turbo',
    providerModelId: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
    displayName: 'Qwen 2.5 72B Instruct Turbo',
    contextWindow: 32768,
    maxOutput: 8192,
    pricing: usd(1.20, 1.20),
    modalities: text,
    capabilities: ['streaming', 'tools'],
  },
  {
    id: 'qwen2.5-coder-32b-instruct',
    providerModelId: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    displayName: 'Qwen 2.5 Coder 32B Instruct',
    contextWindow: 32768,
    maxOutput: 8192,
    pricing: usd(0.80, 0.80),
    modalities: text,
    capabilities: ['streaming', 'tools'],
  },
  {
    id: 'qwq-32b-preview',
    providerModelId: 'Qwen/QwQ-32B-Preview',
    displayName: 'QwQ 32B Preview',
    contextWindow: 32768,
    maxOutput: 8192,
    pricing: usd(1.20, 1.20),
    modalities: text,
    capabilities: ['streaming', 'reasoning'],
  },
  {
    id: 'deepseek-v3',
    providerModelId: 'deepseek-ai/DeepSeek-V3',
    displayName: 'DeepSeek V3',
    contextWindow: 131072,
    maxOutput: 8192,
    pricing: usd(1.25, 1.25),
    modalities: text,
    capabilities: ['streaming', 'tools'],
  },
  {
    id: 'deepseek-r1',
    providerModelId: 'deepseek-ai/DeepSeek-R1',
    displayName: 'DeepSeek R1',
    contextWindow: 163840,
    maxOutput: 8192,
    pricing: usd(3.00, 7.00),
    modalities: text,
    capabilities: ['streaming', 'reasoning'],
  },
  {
    id: 'mixtral-8x7b-instruct',
    providerModelId: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    displayName: 'Mixtral 8x7B Instruct',
    contextWindow: 32768,
    maxOutput: 8192,
    pricing: usd(0.60, 0.60),
    modalities: text,
    capabilities: ['streaming'],
  },
  {
    id: 'gemma-2-27b-it',
    providerModelId: 'google/gemma-2-27b-it',
    displayName: 'Gemma 2 27B Instruct',
    contextWindow: 8192,
    maxOutput: 8192,
    pricing: usd(0.80, 0.80),
    modalities: text,
    capabilities: ['streaming'],
  },
];

// ── Fireworks AI ──────────────────────────────────────────────────────────────
// Source: https://fireworks.ai/models + https://fireworks.ai/pricing
// Uses "accounts/fireworks/models/<slug>" as the provider model id.

const FIREWORKS: RegistryModel[] = [
  {
    id: 'llama-v3p3-70b-instruct',
    providerModelId: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    displayName: 'Llama 3.3 70B Instruct',
    contextWindow: 131072,
    maxOutput: 8192,
    pricing: usd(0.90, 0.90),
    modalities: text,
    capabilities: ['streaming', 'tools'],
  },
  {
    id: 'llama-v3p1-8b-instruct',
    providerModelId: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
    displayName: 'Llama 3.1 8B Instruct',
    contextWindow: 131072,
    maxOutput: 8192,
    pricing: usd(0.20, 0.20),
    modalities: text,
    capabilities: ['streaming', 'tools'],
  },
  {
    id: 'deepseek-v3',
    providerModelId: 'accounts/fireworks/models/deepseek-v3',
    displayName: 'DeepSeek V3',
    contextWindow: 131072,
    maxOutput: 8192,
    pricing: usd(0.90, 0.90),
    modalities: text,
    capabilities: ['streaming', 'tools'],
  },
  {
    id: 'deepseek-r1',
    providerModelId: 'accounts/fireworks/models/deepseek-r1',
    displayName: 'DeepSeek R1',
    contextWindow: 163840,
    maxOutput: 8192,
    pricing: usd(8.00, 8.00),
    modalities: text,
    capabilities: ['streaming', 'reasoning'],
  },
  {
    id: 'qwen2p5-72b-instruct',
    providerModelId: 'accounts/fireworks/models/qwen2p5-72b-instruct',
    displayName: 'Qwen 2.5 72B Instruct',
    contextWindow: 32768,
    maxOutput: 8192,
    pricing: usd(0.90, 0.90),
    modalities: text,
    capabilities: ['streaming', 'tools'],
  },
  {
    id: 'qwen2p5-coder-32b-instruct',
    providerModelId: 'accounts/fireworks/models/qwen2p5-coder-32b-instruct',
    displayName: 'Qwen 2.5 Coder 32B Instruct',
    contextWindow: 32768,
    maxOutput: 8192,
    pricing: usd(0.90, 0.90),
    modalities: text,
    capabilities: ['streaming', 'tools'],
  },
  {
    id: 'mixtral-8x22b-instruct',
    providerModelId: 'accounts/fireworks/models/mixtral-8x22b-instruct',
    displayName: 'Mixtral 8x22B Instruct',
    contextWindow: 65536,
    maxOutput: 8192,
    pricing: usd(1.20, 1.20),
    modalities: text,
    capabilities: ['streaming'],
  },
];

// ── Export ────────────────────────────────────────────────────────────────────
// Keyed by Keyring provider id. Consumed by build.ts.

export const NATIVE_MODEL_SEEDS: Record<string, RegistryModel[]> = {
  groq: GROQ,
  together: TOGETHER,
  fireworks: FIREWORKS,
};

// Snapshot dates — surfaced in the registry so consumers can tell how fresh
// hand-curated pricing is vs OpenRouter-sourced pricing (which updates hourly).
export const NATIVE_SEED_PRICING_AS_OF: Record<string, string> = {
  groq: '2026-04-17',
  together: '2026-04-17',
  fireworks: '2026-04-17',
};
