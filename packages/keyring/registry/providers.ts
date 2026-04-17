// Hand-curated provider seed for the Keyring registry.
//
// Each entry describes how to talk to one LLM provider. Model lists are merged
// in at build time from token.app's existing OpenRouter-sourced pricing data,
// filtered and canonicalized per provider.
//
// Adding a provider: copy an existing entry, fill in auth + endpoints + protocol,
// and add a `providerIdOnOpenRouter` mapping so the build script can attach its
// models. If a provider isn't on OpenRouter, set `nativeOnly: true` and hand-add
// a minimal model list; it will still be useful to clients.

import type { Provider } from './schema';

export interface ProviderSeed extends Omit<Provider, 'models'> {
  // Maps this provider's Keyring id to its slug on OpenRouter (for model merging).
  // Some providers (e.g. groq, together) resell models from upstream creators;
  // the registry exposes them separately because endpoints/auth differ.
  providerIdOnOpenRouter?: string;
  nativeOnly?: boolean;
}

export const PROVIDER_SEEDS: ProviderSeed[] = [
  // ── OpenAI ────────────────────────────────────────────────────────────────
  {
    id: 'openai',
    name: 'OpenAI',
    website: 'https://openai.com',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
    consoleUrl: 'https://platform.openai.com/api-keys',
    description: 'ChatGPT, GPT-5, o-series reasoning models.',
    auth: {
      type: 'bearer',
      headerName: 'Authorization',
      headerPrefix: 'Bearer ',
    },
    endpoints: {
      base: 'https://api.openai.com/v1',
      chat: '/chat/completions',
      completions: '/completions',
      embeddings: '/embeddings',
      models: '/models',
      images: '/images/generations',
      audio: '/audio/speech',
    },
    protocol: {
      family: 'openai',
      streaming: 'sse-openai',
      acceptsOpenAIBody: true,
    },
    keyValidation: {
      method: 'GET',
      path: '/models',
      expectStatus: 200,
    },
    capabilities: {
      scopedKeys: true,        // project keys with spend limits
      usageEndpoint: true,     // /organization/usage
      modelsEndpoint: true,
      openAICompatible: true,
    },
    keyHints: {
      prefix: 'sk-',
      pattern: '^sk-[A-Za-z0-9_\\-]{20,}$',
      sampleMask: 'sk-••••••••••••••••••••••••',
      getKeyUrl: 'https://platform.openai.com/api-keys',
    },
    providerIdOnOpenRouter: 'openai',
  },

  // ── Anthropic ─────────────────────────────────────────────────────────────
  {
    id: 'anthropic',
    name: 'Anthropic',
    website: 'https://anthropic.com',
    docsUrl: 'https://docs.anthropic.com/en/api',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    description: 'Claude Opus, Sonnet, Haiku.',
    auth: {
      type: 'header-with-version',
      headerName: 'x-api-key',
      extraHeaders: { 'anthropic-version': '2023-06-01' },
    },
    endpoints: {
      base: 'https://api.anthropic.com/v1',
      chat: '/messages',
      models: '/models',
    },
    protocol: {
      family: 'anthropic',
      streaming: 'sse-anthropic',
      acceptsOpenAIBody: false,
    },
    keyValidation: {
      method: 'GET',
      path: '/models',
      expectStatus: 200,
    },
    capabilities: {
      scopedKeys: true,        // workspace keys
      usageEndpoint: false,
      modelsEndpoint: true,
      openAICompatible: false,
    },
    keyHints: {
      prefix: 'sk-ant-',
      pattern: '^sk-ant-[A-Za-z0-9_\\-]{20,}$',
      sampleMask: 'sk-ant-••••••••••••••••••••••••',
      getKeyUrl: 'https://console.anthropic.com/settings/keys',
    },
    providerIdOnOpenRouter: 'anthropic',
  },

  // ── Google (Gemini / AI Studio) ───────────────────────────────────────────
  {
    id: 'google',
    name: 'Google AI Studio',
    website: 'https://ai.google.dev',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
    consoleUrl: 'https://aistudio.google.com/apikey',
    description: 'Gemini 2.x Pro, Flash, and reasoning models.',
    auth: {
      type: 'header',
      headerName: 'x-goog-api-key',
    },
    endpoints: {
      base: 'https://generativelanguage.googleapis.com/v1beta',
      chat: '/models/{model}:generateContent',
      models: '/models',
    },
    protocol: {
      family: 'google',
      streaming: 'sse-google',
      acceptsOpenAIBody: true,   // /openai/v1/chat/completions compat mode
    },
    keyValidation: {
      method: 'GET',
      path: '/models',
      expectStatus: 200,
    },
    capabilities: {
      scopedKeys: false,
      usageEndpoint: false,
      modelsEndpoint: true,
      openAICompatible: true,
    },
    keyHints: {
      prefix: 'AIza',
      pattern: '^AIza[A-Za-z0-9_\\-]{35}$',
      sampleMask: 'AIza••••••••••••••••••••••••••••••••',
      getKeyUrl: 'https://aistudio.google.com/apikey',
    },
    providerIdOnOpenRouter: 'google',
  },

  // ── xAI ───────────────────────────────────────────────────────────────────
  {
    id: 'x-ai',
    name: 'xAI',
    website: 'https://x.ai',
    docsUrl: 'https://docs.x.ai',
    consoleUrl: 'https://console.x.ai',
    description: 'Grok reasoning and chat models.',
    auth: {
      type: 'bearer',
      headerName: 'Authorization',
      headerPrefix: 'Bearer ',
    },
    endpoints: {
      base: 'https://api.x.ai/v1',
      chat: '/chat/completions',
      models: '/models',
    },
    protocol: {
      family: 'openai',
      streaming: 'sse-openai',
      acceptsOpenAIBody: true,
    },
    keyValidation: {
      method: 'GET',
      path: '/models',
      expectStatus: 200,
    },
    capabilities: {
      scopedKeys: false,
      usageEndpoint: false,
      modelsEndpoint: true,
      openAICompatible: true,
    },
    keyHints: {
      prefix: 'xai-',
      pattern: '^xai-[A-Za-z0-9]{20,}$',
      sampleMask: 'xai-••••••••••••••••••••••••',
      getKeyUrl: 'https://console.x.ai',
    },
    providerIdOnOpenRouter: 'x-ai',
  },

  // ── DeepSeek ──────────────────────────────────────────────────────────────
  {
    id: 'deepseek',
    name: 'DeepSeek',
    website: 'https://deepseek.com',
    docsUrl: 'https://api-docs.deepseek.com',
    consoleUrl: 'https://platform.deepseek.com/api_keys',
    description: 'DeepSeek V3 chat and R1 reasoning.',
    auth: {
      type: 'bearer',
      headerName: 'Authorization',
      headerPrefix: 'Bearer ',
    },
    endpoints: {
      base: 'https://api.deepseek.com',
      chat: '/chat/completions',
      models: '/models',
    },
    protocol: {
      family: 'openai',
      streaming: 'sse-openai',
      acceptsOpenAIBody: true,
    },
    keyValidation: { method: 'GET', path: '/models', expectStatus: 200 },
    capabilities: {
      scopedKeys: false,
      usageEndpoint: false,
      modelsEndpoint: true,
      openAICompatible: true,
    },
    keyHints: {
      prefix: 'sk-',
      pattern: '^sk-[A-Za-z0-9]{20,}$',
      getKeyUrl: 'https://platform.deepseek.com/api_keys',
    },
    providerIdOnOpenRouter: 'deepseek',
  },

  // ── Mistral ───────────────────────────────────────────────────────────────
  {
    id: 'mistral',
    name: 'Mistral AI',
    website: 'https://mistral.ai',
    docsUrl: 'https://docs.mistral.ai/api',
    consoleUrl: 'https://console.mistral.ai/api-keys',
    description: 'Mistral Large, Small, Codestral, Pixtral.',
    auth: {
      type: 'bearer',
      headerName: 'Authorization',
      headerPrefix: 'Bearer ',
    },
    endpoints: {
      base: 'https://api.mistral.ai/v1',
      chat: '/chat/completions',
      embeddings: '/embeddings',
      models: '/models',
    },
    protocol: {
      family: 'openai',
      streaming: 'sse-openai',
      acceptsOpenAIBody: true,
    },
    keyValidation: { method: 'GET', path: '/models', expectStatus: 200 },
    capabilities: {
      scopedKeys: false,
      usageEndpoint: false,
      modelsEndpoint: true,
      openAICompatible: true,
    },
    keyHints: {
      getKeyUrl: 'https://console.mistral.ai/api-keys',
    },
    providerIdOnOpenRouter: 'mistralai',
  },

  // ── Cohere ────────────────────────────────────────────────────────────────
  {
    id: 'cohere',
    name: 'Cohere',
    website: 'https://cohere.com',
    docsUrl: 'https://docs.cohere.com/reference/about',
    consoleUrl: 'https://dashboard.cohere.com/api-keys',
    description: 'Command R+, Command R, Rerank, Embed.',
    auth: {
      type: 'bearer',
      headerName: 'Authorization',
      headerPrefix: 'Bearer ',
    },
    endpoints: {
      base: 'https://api.cohere.com/v2',
      chat: '/chat',
      embeddings: '/embed',
      models: '/models',
    },
    protocol: {
      family: 'cohere',
      streaming: 'sse-openai',
      acceptsOpenAIBody: false,
    },
    keyValidation: { method: 'GET', path: '/models', expectStatus: 200 },
    capabilities: {
      scopedKeys: false,
      usageEndpoint: false,
      modelsEndpoint: true,
      openAICompatible: false,
    },
    keyHints: {
      getKeyUrl: 'https://dashboard.cohere.com/api-keys',
    },
    providerIdOnOpenRouter: 'cohere',
  },

  // ── Groq ──────────────────────────────────────────────────────────────────
  {
    id: 'groq',
    name: 'Groq',
    website: 'https://groq.com',
    docsUrl: 'https://console.groq.com/docs',
    consoleUrl: 'https://console.groq.com/keys',
    description: 'Ultra-fast inference on Llama, Mixtral, Qwen, Kimi.',
    auth: {
      type: 'bearer',
      headerName: 'Authorization',
      headerPrefix: 'Bearer ',
    },
    endpoints: {
      base: 'https://api.groq.com/openai/v1',
      chat: '/chat/completions',
      models: '/models',
    },
    protocol: {
      family: 'openai',
      streaming: 'sse-openai',
      acceptsOpenAIBody: true,
    },
    keyValidation: { method: 'GET', path: '/models', expectStatus: 200 },
    capabilities: {
      scopedKeys: false,
      usageEndpoint: false,
      modelsEndpoint: true,
      openAICompatible: true,
    },
    keyHints: {
      prefix: 'gsk_',
      pattern: '^gsk_[A-Za-z0-9]{20,}$',
      getKeyUrl: 'https://console.groq.com/keys',
    },
    // Groq re-hosts open models; not a direct OpenRouter provider slug match.
    nativeOnly: true,
  },

  // ── Together AI ───────────────────────────────────────────────────────────
  {
    id: 'together',
    name: 'Together AI',
    website: 'https://together.ai',
    docsUrl: 'https://docs.together.ai',
    consoleUrl: 'https://api.together.xyz/settings/api-keys',
    description: 'Serverless inference for 100+ open-source models.',
    auth: {
      type: 'bearer',
      headerName: 'Authorization',
      headerPrefix: 'Bearer ',
    },
    endpoints: {
      base: 'https://api.together.xyz/v1',
      chat: '/chat/completions',
      completions: '/completions',
      embeddings: '/embeddings',
      models: '/models',
      images: '/images/generations',
    },
    protocol: {
      family: 'openai',
      streaming: 'sse-openai',
      acceptsOpenAIBody: true,
    },
    keyValidation: { method: 'GET', path: '/models', expectStatus: 200 },
    capabilities: {
      scopedKeys: false,
      usageEndpoint: false,
      modelsEndpoint: true,
      openAICompatible: true,
    },
    keyHints: {
      getKeyUrl: 'https://api.together.xyz/settings/api-keys',
    },
    nativeOnly: true,
  },

  // ── Fireworks ─────────────────────────────────────────────────────────────
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    website: 'https://fireworks.ai',
    docsUrl: 'https://docs.fireworks.ai',
    consoleUrl: 'https://fireworks.ai/account/api-keys',
    description: 'Fast serverless hosting for open-source LLMs.',
    auth: {
      type: 'bearer',
      headerName: 'Authorization',
      headerPrefix: 'Bearer ',
    },
    endpoints: {
      base: 'https://api.fireworks.ai/inference/v1',
      chat: '/chat/completions',
      completions: '/completions',
      embeddings: '/embeddings',
      models: '/models',
    },
    protocol: {
      family: 'openai',
      streaming: 'sse-openai',
      acceptsOpenAIBody: true,
    },
    keyValidation: { method: 'GET', path: '/models', expectStatus: 200 },
    capabilities: {
      scopedKeys: false,
      usageEndpoint: false,
      modelsEndpoint: true,
      openAICompatible: true,
    },
    keyHints: {
      prefix: 'fw_',
      getKeyUrl: 'https://fireworks.ai/account/api-keys',
    },
    nativeOnly: true,
  },

  // ── OpenRouter (the meta-provider) ────────────────────────────────────────
  {
    id: 'openrouter',
    name: 'OpenRouter',
    website: 'https://openrouter.ai',
    docsUrl: 'https://openrouter.ai/docs',
    consoleUrl: 'https://openrouter.ai/keys',
    description: 'One key for hundreds of models across every major provider.',
    auth: {
      type: 'bearer',
      headerName: 'Authorization',
      headerPrefix: 'Bearer ',
    },
    endpoints: {
      base: 'https://openrouter.ai/api/v1',
      chat: '/chat/completions',
      completions: '/completions',
      models: '/models',
    },
    protocol: {
      family: 'openai',
      streaming: 'sse-openai',
      acceptsOpenAIBody: true,
    },
    keyValidation: { method: 'GET', path: '/models', expectStatus: 200 },
    capabilities: {
      scopedKeys: true,          // provisioning keys
      usageEndpoint: true,
      modelsEndpoint: true,
      openAICompatible: true,
    },
    keyHints: {
      prefix: 'sk-or-',
      pattern: '^sk-or-[A-Za-z0-9_\\-]{20,}$',
      getKeyUrl: 'https://openrouter.ai/keys',
    },
    // Special-case: OpenRouter exposes all models. We attach them all in build.ts.
    providerIdOnOpenRouter: '*',
  },
];
