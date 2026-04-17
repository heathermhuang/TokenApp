// Runtime registry builder.
//
// Called by the /registry.json Worker route. Takes token.app's normalized model
// list (already in KV, refreshed hourly by cron) and merges it with the
// hand-curated provider seed to produce a KeyringRegistry document.
//
// No separate build step: the registry is always fresh as of the last cron run.

import type { NormalizedModel } from '../../../src/types';
import type { KeyringRegistry, Provider, RegistryModel, ModelCapability } from './schema';
import { PROVIDER_SEEDS, type ProviderSeed } from './providers';
import { NATIVE_MODEL_SEEDS, NATIVE_SEED_PRICING_AS_OF } from './native-seed';

export interface BuildOptions {
  sourceCommit?: string;
}

export function buildRegistry(
  models: NormalizedModel[],
  opts: BuildOptions = {}
): KeyringRegistry {
  const providers: Provider[] = PROVIDER_SEEDS.map((seed) =>
    attachModels(seed, models)
  );

  return {
    version: '1',
    generatedAt: new Date().toISOString(),
    sourceCommit: opts.sourceCommit,
    providers,
  };
}

function attachModels(seed: ProviderSeed, allModels: NormalizedModel[]): Provider {
  const { providerIdOnOpenRouter, nativeOnly, ...providerFields } = seed;

  let matched: NormalizedModel[] = [];

  if (providerIdOnOpenRouter === '*') {
    // OpenRouter exposes everything; include the full list, canonicalized.
    matched = allModels.filter((m) => !m.isDeprecated);
  } else if (providerIdOnOpenRouter) {
    matched = allModels.filter(
      (m) => m.providerId === providerIdOnOpenRouter && !m.isDeprecated
    );
  }

  const fromOpenRouter = matched.map((m) => toRegistryModel(m, seed.id));
  const native = NATIVE_MODEL_SEEDS[seed.id] ?? [];

  // Native seeds win on id collision — they carry the provider-native
  // `providerModelId` (e.g. 'accounts/fireworks/models/...') which is required
  // to actually call that provider's API.
  const byId = new Map<string, RegistryModel>();
  for (const m of fromOpenRouter) byId.set(m.id, m);
  for (const m of native) byId.set(m.id, m);
  const models = Array.from(byId.values());

  const pricingAsOf = NATIVE_SEED_PRICING_AS_OF[seed.id];

  return {
    ...providerFields,
    ...(pricingAsOf ? { pricingAsOf } : {}),
    models,
  } as Provider;
}

function toRegistryModel(m: NormalizedModel, providerKeyringId: string): RegistryModel {
  // The canonical id strips the provider prefix from OpenRouter ids.
  // 'anthropic/claude-opus-4-7' → 'claude-opus-4-7'
  // For OpenRouter itself, we keep the full slug so it's unambiguous when this
  // registry is used to hit the OpenRouter API directly.
  const canonicalId =
    providerKeyringId === 'openrouter' ? m.id : m.slug;

  // providerModelId = what the provider's own API expects. For the real owner,
  // that's the slug (e.g. 'gpt-4o'). For OpenRouter, it's the full id.
  const providerModelId =
    providerKeyringId === 'openrouter' ? m.id : m.slug;

  return {
    id: canonicalId,
    providerModelId,
    displayName: m.name,
    contextWindow: m.contextWindow,
    maxOutput: m.maxOutput,
    pricing:
      m.inputPer1M == null && m.outputPer1M == null
        ? null
        : {
            inputPer1M: m.inputPer1M,
            outputPer1M: m.outputPer1M,
            currency: 'USD',
          },
    modalities: {
      input: m.inputModalities,
      output: m.outputModalities,
    },
    capabilities: deriveCapabilities(m),
    releasedAt: m.createdAt
      ? new Date(m.createdAt * 1000).toISOString()
      : undefined,
    deprecated: m.isDeprecated || undefined,
  };
}

function deriveCapabilities(m: NormalizedModel): ModelCapability[] {
  const caps: ModelCapability[] = ['streaming'];
  if (m.hasToolUse) caps.push('tools');
  if (m.isVision || m.inputModalities.includes('image')) caps.push('vision');
  if (m.inputModalities.includes('audio')) caps.push('audio-in');
  if (m.outputModalities.includes('audio')) caps.push('audio-out');
  if (m.isReasoning) caps.push('reasoning');
  return caps;
}
