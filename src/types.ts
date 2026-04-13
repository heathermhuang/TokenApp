export interface Env {
  TOKEN_APP_KV: KVNamespace;
  ENVIRONMENT?: string;
  REFRESH_SECRET?: string;
}

// ── Normalized model (stored in KV) ──────────────────────────────────────────

export interface NormalizedModel {
  id: string;            // e.g. "openai/gpt-4o"
  slug: string;          // e.g. "gpt-4o"
  name: string;          // e.g. "GPT-4o"
  provider: string;      // e.g. "OpenAI"
  providerId: string;    // e.g. "openai"
  inputPer1M: number | null;   // USD per 1M input tokens
  outputPer1M: number | null;  // USD per 1M output tokens
  imagePricePer: number | null; // USD per image (if applicable)
  contextWindow: number | null;
  maxOutput: number | null;
  inputModalities: string[];   // ["text", "image"]
  outputModalities: string[];  // ["text"]
  isFree: boolean;
  isVision: boolean;
  isReasoning: boolean;
  isOpenSource: boolean;
  hasToolUse: boolean;
  isDeprecated: boolean;
  createdAt: number | null;    // unix timestamp
  description?: string;
}

// ── Subscription data (static) ────────────────────────────────────────────────

export interface SubscriptionTier {
  name: string;
  monthlyPrice: number | null;         // USD (international)
  annualMonthlyPrice: number | null;   // USD annual
  cnMonthlyPrice?: number | null;      // CNY domestic price
  cnAnnualMonthlyPrice?: number | null;// CNY domestic annual
  perSeat: boolean;
  features: string[];
  highlight: boolean;  // recommended tier
  badge?: string;      // e.g. "Most Popular"
}

export interface Subscription {
  id: string;
  name: string;
  provider: string;
  providerId: string;
  description: string;
  tiers: SubscriptionTier[];
  url: string;
  category: 'chat' | 'coding' | 'search' | 'media' | 'other';
  underlyingModels?: string[];  // model IDs powering this service
}

// ── OpenRouter raw types ──────────────────────────────────────────────────────

export interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  description: string;
  context_length: number;
  architecture: {
    modality: string;  // e.g. "text+image->text"
    tokenizer: string;
    instruct_type: string | null;
  };
  pricing: {
    prompt: string;
    completion: string;
    image?: string;
    request?: string;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens: number | null;
    is_moderated: boolean;
  };
  per_request_limits: null | {
    prompt_tokens: string;
    completion_tokens: string;
  };
}

export interface OpenRouterResponse {
  data: OpenRouterModel[];
}

// ── Rankings data (scraped from OpenRouter) ──────────────────────────────────

export interface ModelRanking {
  modelSlug: string;       // e.g. "qwen/qwen3.6-plus-04-02"
  totalTokens: number;     // prompt + completion
  totalRequests: number;
  date: string;
}

export interface AppRanking {
  rank: number;
  title: string;
  description: string;
  categories: string[];
  originUrl: string;
  faviconUrl: string | null;
  totalTokens: number;
  totalRequests: number;
}

export type RankingPeriod = 'day' | 'week' | 'month';

export interface RankingsData {
  topModels: ModelRanking[];
  topApps: Record<RankingPeriod, AppRanking[]>;
  fetchedAt: string;
}

// ── KV storage keys ───────────────────────────────────────────────────────────

export const KV_KEYS = {
  MODELS: 'models:all',
  MODELS_UPDATED: 'models:last_updated',
  SUBSCRIPTIONS: 'subscriptions:all',
  RANKINGS: 'rankings:all',
} as const;
