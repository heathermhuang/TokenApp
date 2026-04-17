// Keyring Registry — v1 schema.
//
// The registry is a single JSON document describing every supported LLM provider:
// how to authenticate, where to send requests, which protocol family to use, and
// which models they currently expose. Consumers (apps, SDKs, agents) fetch it,
// cache it, and use it to build BYOK experiences without hardcoding any of this.
//
// Stability: the schema is versioned. Breaking changes bump `version`. Additive
// fields are safe within a major version.

export type KeyringVersion = '1';

export interface KeyringRegistry {
  version: KeyringVersion;
  generatedAt: string;       // ISO8601
  sourceCommit?: string;     // git sha of the repo that generated this
  providers: Provider[];
}

// ── Provider ─────────────────────────────────────────────────────────────────

export interface Provider {
  id: string;                // canonical slug, e.g. 'openai', 'anthropic', 'x-ai'
  name: string;              // display name, e.g. 'OpenAI'
  website: string;           // marketing site
  docsUrl: string;           // API docs
  consoleUrl: string;        // where a user goes to create an API key
  logoUrl?: string;          // square logo (SVG/PNG)
  description?: string;      // one-liner

  auth: AuthConfig;
  endpoints: EndpointConfig;
  protocol: ProtocolConfig;
  keyValidation?: KeyValidation;

  // ISO8601 date. Present for providers whose model list + pricing come from a
  // hand-curated snapshot (see native-seed.ts) rather than the hourly OpenRouter
  // refresh. Absent when models are live-sourced from token.app's cron.
  pricingAsOf?: string;

  // Capability flags that affect how a vault/relay would integrate later.
  // Not required for v0 direct-key clients.
  capabilities: {
    scopedKeys: boolean;       // can users mint sub-keys with their own scope/limits?
    usageEndpoint: boolean;    // exposes a usage/billing endpoint?
    modelsEndpoint: boolean;   // exposes a live model list endpoint?
    openAICompatible: boolean; // accepts requests at an OpenAI-compatible path
  };

  // Hints for the UI when collecting keys.
  keyHints?: {
    prefix?: string;           // e.g. 'sk-', 'sk-ant-', 'xai-'
    pattern?: string;          // regex (as string) for shape validation
    sampleMask?: string;       // e.g. 'sk-••••••••••••••••••••••••'
    getKeyUrl?: string;        // deep link to key creation page, if different from consoleUrl
  };

  models: RegistryModel[];
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export type AuthType =
  | 'bearer'                 // Authorization: Bearer <key>
  | 'header'                 // custom header (e.g. x-api-key: <key>)
  | 'header-with-version'    // custom header + sibling version header (anthropic)
  | 'query';                 // ?key=<key> (discouraged)

export interface AuthConfig {
  type: AuthType;
  headerName?: string;       // for 'bearer' defaults to 'Authorization'
  headerPrefix?: string;     // for 'bearer' defaults to 'Bearer '
  queryParam?: string;       // for 'query'
  extraHeaders?: Record<string, string>; // e.g. { 'anthropic-version': '2023-06-01' }
}

// ── Endpoints ────────────────────────────────────────────────────────────────

export interface EndpointConfig {
  base: string;              // e.g. 'https://api.openai.com/v1'
  chat?: string;             // relative path, e.g. '/chat/completions'
  completions?: string;      // legacy text completions
  embeddings?: string;
  models?: string;           // live model list endpoint, if available
  images?: string;
  audio?: string;
}

// ── Protocol family ──────────────────────────────────────────────────────────
//
// Tells a client how to shape the request body and parse the response/stream.
// Most providers fall into one of these families. Pure data — no behavior.

export type ProtocolFamily =
  | 'openai'                 // /v1/chat/completions shape
  | 'anthropic'              // /v1/messages shape
  | 'google'                 // Generative Language API shape
  | 'cohere'                 // Cohere chat shape
  | 'custom';                // everything else; client must special-case

export type StreamFormat =
  | 'sse-openai'             // OpenAI-style SSE with `data:` frames + `[DONE]`
  | 'sse-anthropic'          // Anthropic-style SSE with named events
  | 'sse-google'             // Google streamGenerateContent SSE
  | 'none';

export interface ProtocolConfig {
  family: ProtocolFamily;
  streaming: StreamFormat;
  // True if the endpoint accepts OpenAI's request body shape even if the family
  // is different (e.g. Groq, Together, DeepSeek, OpenRouter, Fireworks).
  acceptsOpenAIBody: boolean;
}

// ── Key validation ───────────────────────────────────────────────────────────
//
// Optional: a cheap endpoint to verify a key is valid without consuming tokens.
// Clients should call this once after the user pastes a key.

export interface KeyValidation {
  method: 'GET' | 'POST';
  path: string;              // relative to endpoints.base
  expectStatus: number;      // usually 200
  // If POST, a small body that won't bill. Keep under ~10 tokens.
  body?: unknown;
}

// ── Model ────────────────────────────────────────────────────────────────────

export interface RegistryModel {
  id: string;                // canonical id used across the registry, e.g. 'gpt-4o', 'claude-opus-4-7'
  providerModelId: string;   // what you actually send in the API request body
  displayName: string;       // human-readable
  aliases?: string[];        // additional ids that map to this model

  contextWindow: number | null;
  maxOutput: number | null;

  pricing: {
    inputPer1M: number | null;       // USD
    outputPer1M: number | null;      // USD
    cachedInputPer1M?: number | null;
    currency: 'USD';
  } | null;

  modalities: {
    input: string[];         // ['text', 'image', 'audio']
    output: string[];
  };

  capabilities: ModelCapability[];

  releasedAt?: string;       // ISO8601
  deprecated?: boolean;
  deprecatedAt?: string;     // ISO8601
  replacedBy?: string;       // canonical id of the recommended successor
}

export type ModelCapability =
  | 'tools'                  // function calling
  | 'vision'
  | 'audio-in'
  | 'audio-out'
  | 'reasoning'              // native reasoning / thinking
  | 'json-mode'
  | 'structured-outputs'
  | 'prompt-cache'
  | 'streaming'
  | 'batch';
