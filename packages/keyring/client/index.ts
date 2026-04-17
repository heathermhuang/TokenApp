// keyring-client — v0 BYOK client.
//
// Reads the Keyring registry, stores user-supplied keys in localStorage
// (browser) or an injected KeyStore (Node / other runtimes), validates them
// against each provider's validation endpoint, and returns a provider-agnostic
// `chat()` / `stream()` you can call with a canonical model id.
//
// Zero runtime dependencies. Works in browsers, Workers, Bun, Deno, Node 18+.
// Import types from `../registry/schema` if you want to introspect the registry
// directly.

import type {
  KeyringRegistry,
  Provider,
  RegistryModel,
  AuthConfig,
} from '../registry/schema';

// ── Configuration ────────────────────────────────────────────────────────────

export interface KeyringClientOptions {
  /** Where to fetch the registry from. Defaults to https://token.app/registry.json. */
  registryUrl?: string;
  /** Pre-fetched registry, if you want to skip the network call. */
  registry?: KeyringRegistry;
  /** Custom key store. Defaults to localStorage in browsers, in-memory otherwise. */
  keyStore?: KeyStore;
  /** Custom fetch (for testing / Node pre-18). */
  fetch?: typeof fetch;
}

export interface KeyStore {
  get(providerId: string): string | null | Promise<string | null>;
  set(providerId: string, key: string): void | Promise<void>;
  remove(providerId: string): void | Promise<void>;
}

const DEFAULT_REGISTRY_URL = 'https://token.app/registry.json';
const KEY_STORE_PREFIX = 'keyring:v1:';

// ── Key stores ───────────────────────────────────────────────────────────────

function localStorageKeyStore(): KeyStore {
  return {
    get: (id) => globalThis.localStorage?.getItem(KEY_STORE_PREFIX + id) ?? null,
    set: (id, key) => globalThis.localStorage?.setItem(KEY_STORE_PREFIX + id, key),
    remove: (id) => globalThis.localStorage?.removeItem(KEY_STORE_PREFIX + id),
  };
}

function memoryKeyStore(): KeyStore {
  const m = new Map<string, string>();
  return {
    get: (id) => m.get(id) ?? null,
    set: (id, key) => void m.set(id, key),
    remove: (id) => void m.delete(id),
  };
}

function defaultKeyStore(): KeyStore {
  if (typeof globalThis.localStorage !== 'undefined') return localStorageKeyStore();
  return memoryKeyStore();
}

// ── Main client ──────────────────────────────────────────────────────────────

export class Keyring {
  private registry: KeyringRegistry | null;
  private registryUrl: string;
  private keyStore: KeyStore;
  private fetchImpl: typeof fetch;

  constructor(opts: KeyringClientOptions = {}) {
    this.registry = opts.registry ?? null;
    this.registryUrl = opts.registryUrl ?? DEFAULT_REGISTRY_URL;
    this.keyStore = opts.keyStore ?? defaultKeyStore();
    this.fetchImpl = opts.fetch ?? fetch.bind(globalThis);
  }

  /** Fetch (or return cached) registry. */
  async getRegistry(): Promise<KeyringRegistry> {
    if (this.registry) return this.registry;
    const res = await this.fetchImpl(this.registryUrl);
    if (!res.ok) throw new Error(`Registry fetch failed: ${res.status}`);
    this.registry = (await res.json()) as KeyringRegistry;
    return this.registry;
  }

  async providers(): Promise<Provider[]> {
    return (await this.getRegistry()).providers;
  }

  async getProvider(id: string): Promise<Provider | null> {
    const reg = await this.getRegistry();
    return reg.providers.find((p) => p.id === id) ?? null;
  }

  /** Look up a model by canonical id, returning both the model and its provider. */
  async resolveModel(canonicalId: string): Promise<{ provider: Provider; model: RegistryModel } | null> {
    const reg = await this.getRegistry();
    for (const provider of reg.providers) {
      const m = provider.models.find(
        (m) => m.id === canonicalId || m.aliases?.includes(canonicalId)
      );
      if (m) return { provider, model: m };
    }
    return null;
  }

  // ── Key management ────────────────────────────────────────────────────────

  async setKey(providerId: string, key: string): Promise<void> {
    await this.keyStore.set(providerId, key);
  }

  async getKey(providerId: string): Promise<string | null> {
    return await this.keyStore.get(providerId);
  }

  async removeKey(providerId: string): Promise<void> {
    await this.keyStore.remove(providerId);
  }

  /** Verify a key is live by hitting the provider's validation endpoint. */
  async validateKey(providerId: string, key?: string): Promise<{ ok: boolean; status: number }> {
    const provider = await this.getProvider(providerId);
    if (!provider) throw new Error(`Unknown provider: ${providerId}`);
    const v = provider.keyValidation;
    if (!v) return { ok: true, status: 0 }; // can't validate — assume ok
    const k = key ?? (await this.getKey(providerId));
    if (!k) throw new Error(`No key for ${providerId}`);

    const res = await this.fetchImpl(provider.endpoints.base + v.path, {
      method: v.method,
      headers: buildHeaders(provider.auth, k),
      body: v.method === 'POST' && v.body ? JSON.stringify(v.body) : undefined,
    });
    return { ok: res.status === v.expectStatus, status: res.status };
  }

  // ── Requests ──────────────────────────────────────────────────────────────

  /** Shape-agnostic chat. Accepts OpenAI-style messages and adapts per family. */
  async chat(params: {
    model: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    providerId?: string;         // force a specific provider if aliases collide
    maxTokens?: number;
    temperature?: number;
    stream?: false;
  }): Promise<Response> {
    const { provider, model } = await this.requireModel(params.model, params.providerId);
    const key = await this.requireKey(provider.id);
    const body = buildRequestBody(provider, model, params);
    const url = buildChatUrl(provider, model);
    return this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildHeaders(provider.auth, key),
      },
      body: JSON.stringify(body),
    });
  }

  /** Returns the raw streaming Response; callers parse per `provider.protocol.streaming`. */
  async stream(params: Parameters<Keyring['chat']>[0]): Promise<Response> {
    const { provider, model } = await this.requireModel(params.model, params.providerId);
    const key = await this.requireKey(provider.id);
    const body = { ...buildRequestBody(provider, model, params), stream: true };
    const url = buildChatUrl(provider, model);
    return this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...buildHeaders(provider.auth, key),
      },
      body: JSON.stringify(body),
    });
  }

  private async requireModel(id: string, providerId?: string) {
    if (providerId) {
      const p = await this.getProvider(providerId);
      if (!p) throw new Error(`Unknown provider: ${providerId}`);
      const m = p.models.find((m) => m.id === id || m.aliases?.includes(id));
      if (!m) throw new Error(`Model ${id} not on provider ${providerId}`);
      return { provider: p, model: m };
    }
    const r = await this.resolveModel(id);
    if (!r) throw new Error(`Unknown model: ${id}`);
    return r;
  }

  private async requireKey(providerId: string): Promise<string> {
    const k = await this.getKey(providerId);
    if (!k) throw new Error(`No API key configured for provider: ${providerId}`);
    return k;
  }
}

// ── Helpers (exported for tests + advanced use) ─────────────────────────────

export function buildHeaders(auth: AuthConfig, key: string): Record<string, string> {
  const h: Record<string, string> = { ...(auth.extraHeaders ?? {}) };
  switch (auth.type) {
    case 'bearer': {
      const name = auth.headerName ?? 'Authorization';
      const prefix = auth.headerPrefix ?? 'Bearer ';
      h[name] = prefix + key;
      break;
    }
    case 'header':
    case 'header-with-version': {
      if (!auth.headerName) throw new Error('headerName required for header auth');
      h[auth.headerName] = key;
      break;
    }
    case 'query':
      break; // handled at URL-build time
  }
  return h;
}

export function buildChatUrl(provider: Provider, model: RegistryModel): string {
  let path = provider.endpoints.chat ?? '/chat/completions';
  // Google-style path template substitution.
  path = path.replace('{model}', encodeURIComponent(model.providerModelId));
  const url = provider.endpoints.base + path;
  // Query-param auth gets appended per-request in chat(); keep URL base clean here.
  return url;
}

export function buildRequestBody(
  provider: Provider,
  model: RegistryModel,
  params: { messages: Array<{ role: string; content: string }>; maxTokens?: number; temperature?: number }
): Record<string, unknown> {
  const fam = provider.protocol.family;

  if (fam === 'openai' || provider.protocol.acceptsOpenAIBody) {
    return {
      model: model.providerModelId,
      messages: params.messages,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
    };
  }

  if (fam === 'anthropic') {
    const system = params.messages.find((m) => m.role === 'system')?.content;
    const rest = params.messages.filter((m) => m.role !== 'system');
    return {
      model: model.providerModelId,
      system,
      messages: rest,
      max_tokens: params.maxTokens ?? 1024,
      temperature: params.temperature,
    };
  }

  if (fam === 'google') {
    return {
      contents: params.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        maxOutputTokens: params.maxTokens,
        temperature: params.temperature,
      },
    };
  }

  if (fam === 'cohere') {
    return {
      model: model.providerModelId,
      messages: params.messages,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
    };
  }

  // Unknown family — client must bring its own request shape.
  return {
    model: model.providerModelId,
    messages: params.messages,
  };
}

// ── Convenience factory ──────────────────────────────────────────────────────

export function createKeyring(opts?: KeyringClientOptions): Keyring {
  return new Keyring(opts);
}

export type { KeyringRegistry, Provider, RegistryModel } from '../registry/schema';
