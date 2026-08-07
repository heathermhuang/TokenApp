export interface Env {
  TOKEN_APP_KV: KVNamespace;
  ENVIRONMENT?: string;
  REFRESH_SECRET?: string;
  BROWSER: Fetcher;       // Cloudflare Browser Rendering binding (used by @cloudflare/puppeteer)
  RANKINGS_DB: D1Database; // Cloudflare D1 — append-only history of ranking snapshots
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
  huggingFaceId?: string | null;  // e.g. "deepseek-ai/DeepSeek-V3" — when present, canonical model card link
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
  lastVerified?: string;  // ISO date (YYYY-MM-DD) prices last checked against the provider page
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
  hugging_face_id?: string | null;
  canonical_slug?: string | null;
}

export interface OpenRouterResponse {
  data: OpenRouterModel[];
}

// ── Rankings data (scraped from OpenRouter) ──────────────────────────────────

// Rank/volume movement vs the prior comparable period. null fields mean there
// is not enough history to compute the delta honestly — render NOTHING rather
// than a fabricated number (the 2026-05-28 "fake 7D" lesson).
export interface RankDelta {
  rankChange: number | null;  // prior_rank - current_rank; + = moved up, - = moved down
  pctChange: number | null;   // (now - prior) / prior, as a fraction; null when prior is 0/absent
}

export interface ModelRanking {
  modelSlug: string;       // e.g. "qwen/qwen3.6-plus-04-02"
  totalTokens: number;     // prompt + completion
  totalRequests: number;
  date: string;
  sparkline?: number[];    // token totals, one point/day ascending; omitted when < 2 points
  delta?: RankDelta | null;// null when insufficient history
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
  sparkline?: number[];    // daily token totals, ascending; omitted when < 2 points
  delta?: RankDelta | null;// null when insufficient history (apps: only on the 24H board)
}

export type RankingPeriod = 'day' | 'week' | 'month';

export interface RankingsData {
  topModels: ModelRanking[];
  topApps: Record<RankingPeriod, AppRanking[]>;
  fetchedAt: string;
  // Distinct calendar days of app snapshots in the requested window. Only
  // set for week/month responses — day reads the latest snapshot directly.
  // When this is < appsHistoryRequired, topApps[period] is empty and the
  // client renders an "accumulating history" state rather than a fake total.
  appsHistoryDays?: number;
  appsHistoryRequired?: number;
  // When set, the board reflects the snapshot at/just-before this ISO time
  // (the "view as of" picker) rather than the latest.
  asOf?: string;
  // When set, the apps board is scoped to this category slug (models stay global).
  category?: string;
}

// ── Token share time-series (OpenRouter /rankings JSON) ──────────────────────
// Weekly share-over-time, sourced from OpenRouter's frontend JSON endpoints
// (market-share = by author, model-rankings-chart = by model). Both normalize to
// the same shape: a fixed display set (latest week's top-N) + an "others" band,
// pct summing to 100 per week.
export interface SharePoint { date: string; pct: number; tokens: number }
export interface ShareEntity {
  key: string;        // author slug ("deepseek") or model permaslug ("xiaomi/mimo-v2.5-...")
  label: string;      // display label
  latestPct: number;  // share in the most recent week
  points: SharePoint[]; // weekly, ascending
}
export interface ShareSeries { entities: ShareEntity[]; weeks: number; fetchedAt: string }
export interface MarketShareResponse { author: ShareSeries; model: ShareSeries; fetchedAt: string }

// ── Top models by task (the "Top models by task" treemap) ────────────────────
// Sourced from OpenRouter /rankings/task-spend (spend half). Tiles are sized by
// each task's share of total spend and coloured by macroCategory; each task
// carries its own top-model leaderboard.
export interface TaskSpendModel {
  slug: string;     // permaslug, e.g. "anthropic/claude-4.7-opus-20260416"
  label: string;    // pretty, e.g. "claude-4.7-opus"
  provider: string; // e.g. "anthropic"
  share: number;    // share of this task's spend, 0..1
  deltaPp: number;  // change in percentage points vs the prior window
}
export interface TaskSpendTask {
  tag: string;          // e.g. "code:general_impl"
  label: string;        // curated display label, e.g. "Code Generation"
  macroCategory: string;// "code" | "agent" | "general" | "data"
  share: number;        // share of TOTAL spend, 0..1 (drives tile size)
  models: TaskSpendModel[];
}
export interface TaskSpendCategory { key: string; label: string; share: number }
// One metric's view of the breakdown — spend ($) or raw tokens. Same tags and
// shape; only the shares and per-task model ordering differ between the halves.
export interface TaskSpendMetric {
  categories: TaskSpendCategory[];
  tasks: TaskSpendTask[];
}
export interface TaskSpend {
  windowDays: number;
  // Top-level = the spend half, kept flat for back-compat with already-stored KV
  // and the empty-guard checks in fetchers. `tokens` carries the parallel half
  // (absent on pre-toggle KV blobs → client just hides the Spend/Tokens toggle).
  categories: TaskSpendCategory[];
  tasks: TaskSpendTask[];
  tokens?: TaskSpendMetric;
  fetchedAt: string;
}

// One OpenRouter app category. Path-addressable: /apps/category/{group}/{slug}.
export interface AppCategory { group: string; slug: string; label: string; }

// ── Benchmarks (Epoch AI, CC BY) ─────────────────────────────────────────────

// One benchmark result for one model. Deliberately mirrors the shape the
// llm-stats open dataset uses (CC BY): every score carries its provenance so
// nothing can render without a citation. `isSelfReported` is false for every
// Epoch row — Epoch RUNS these evals rather than reprinting vendor claims,
// which is the entire reason we source from them.
export interface BenchmarkScore {
  benchmark: string;        // display label, e.g. "GPQA Diamond"
  benchmarkId: string;      // stable slug, e.g. "gpqa_diamond"
  score: number;            // normalized 0–1
  stderr: number | null;    // standard error, when published
  isSelfReported: boolean;  // false for Epoch-run evals
  variant: string | null;   // e.g. "max" — the effort/config the score came from
  recordedAt: string | null;// ISO date the run happened
  source: string;           // attribution label, e.g. "Epoch AI"
  sourceUrl: string;        // citation link
}

export interface ModelBenchmarks {
  modelId: string;          // OpenRouter model id — the join key
  epochModel: string;       // Epoch's display name, kept for auditability
  scores: BenchmarkScore[];
  // Every raw `id_model_version` that contributed a score here. Effort variants
  // of one model are merged on purpose, so this list is normally several rows of
  // the same base — but it is the ONLY place a bad merge becomes visible, since
  // `versionBase()` infers "effort variant" from a suffix and a future Epoch id
  // that genuinely ends in one of those words would collapse silently. Audit
  // this when coverage changes unexpectedly.
  versions: string[];
}

export interface BenchmarksPayload {
  models: ModelBenchmarks[];
  benchmarks: { id: string; label: string; blurb: string }[]; // the surfaced set, in display order
  // Models present in the Epoch feed that we have no OpenRouter id mapping for.
  // Surfaced so the mapping table can be extended in a data-only PR rather than
  // silently under-covering the catalogue.
  unmapped: string[];
  // Mapped names whose Epoch rows span more than one MODEL VERSION (two dated
  // snapshots, or two harnesses) with no VERSION_PIN to disambiguate. Dropped
  // rather than merged — welding one snapshot's GPQA to another's SWE-bench
  // produces a model record that never existed. Surfaced so a pin can be added.
  ambiguous: { model: string; versions: string[] }[];
  attribution: { text: string; url: string; license: string; licenseUrl: string };
  fetchedAt: string;
}

// ── Per-provider endpoints (OpenRouter /models/{id}/endpoints) ───────────────

// One host serving one model. The same model is frequently offered by a dozen+
// providers at wildly different prices AND different context limits and weight
// quantizations — the thing a pricing site should obviously surface and which
// nobody displays well.
export interface ProviderEndpoint {
  provider: string;            // e.g. "DeepInfra"
  label: string;               // disambiguated when a provider appears twice (regional Bedrock etc.)
  tag: string;
  inputPer1M: number | null;
  outputPer1M: number | null;
  blendedPer1M: number | null; // 3:1, same basis as the rest of the site
  cacheReadPer1M: number | null;
  contextLength: number | null;
  maxOutput: number | null;
  quantization: string | null; // fp4 / fp8 / bf16 / unknown — a real quality difference
  uptimeDay: number | null;    // % over the last day
  implicitCaching: boolean;
  // Some hosts re-price above a prompt-length threshold (Claude doubles above
  // 200k). Rendering only the headline price would understate long-context cost.
  longContext: { minPromptTokens: number; inputPer1M: number; outputPer1M: number } | null;
}

export interface ModelEndpoints {
  modelId: string;
  endpoints: ProviderEndpoint[]; // ascending by blended price
  fetchedAt: string;
}

export const KV_KEYS = {
  MODELS: 'models:all',
  MODELS_UPDATED: 'models:last_updated',
  SUBSCRIPTIONS: 'subscriptions:all',
  RANKINGS: 'rankings:all',
  SHARE_SERIES: 'share:series',   // MarketShareResponse (author + model weekly series)
  APPS_BOARDS: 'rankings:apps',    // { day, week, month, fetchedAt } AppRanking arrays
  TASK_SPEND: 'rankings:taskspend',// TaskSpend (top models by task treemap)
  BENCHMARKS: 'benchmarks:all',    // BenchmarksPayload (Epoch AI, CC BY)
} as const;
