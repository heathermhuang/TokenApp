// Capability and alias derivation for RegistryModel entries.
//
// The OpenRouter source data tells us about vision, tools, and reasoning, but
// not about prompt caching, structured outputs, or provider-side model aliases.
// Those are per-family facts — Anthropic added prompt caching in Aug 2024,
// OpenAI added structured outputs in Aug 2024, etc. We encode those as rules
// keyed on (providerId, modelId).
//
// When a provider ships a new capability family-wide, update the predicate.
// When a single model breaks the pattern, add it to the allow/deny overrides.

import type { ModelCapability } from './schema';

export interface CapabilityInput {
  providerId: string;
  canonicalId: string;      // Keyring canonical id for this provider+model
  providerModelId: string;  // What the provider's API expects
  displayName: string;
  releasedAt?: string;      // ISO8601
}

// ── Public API ──────────────────────────────────────────────────────────────

export function deriveExtraCapabilities(m: CapabilityInput): ModelCapability[] {
  const caps: ModelCapability[] = [];
  if (supportsPromptCache(m)) caps.push('prompt-cache');
  if (supportsStructuredOutputs(m)) caps.push('structured-outputs');
  if (supportsJsonMode(m)) caps.push('json-mode');
  return caps;
}

export function deriveAliases(m: CapabilityInput): string[] {
  const aliases = new Set<string>();

  // Hand-curated aliases for models that have multiple public-facing IDs.
  // Keys are provider-scoped to avoid cross-contamination.
  const entries = ALIAS_MAP[m.providerId]?.[m.canonicalId];
  if (entries) for (const a of entries) aliases.add(a);

  // Auto-alias: date-suffixed IDs (gpt-4o-2024-11-20, claude-opus-4-7-20260115)
  // often have a date-free canonical variant that providers accept. Expose
  // the inverse — the bare form and the "-latest" convention — as discoverable
  // aliases so clients can target them.
  const dateStripped = stripDateSuffix(m.providerModelId);
  if (dateStripped && dateStripped !== m.canonicalId && dateStripped !== m.providerModelId) {
    aliases.add(dateStripped);
  }

  return Array.from(aliases);
}

// ── Prompt caching ───────────────────────────────────────────────────────────
//
// Sources (verified against public docs):
//   OpenAI:    automatic prompt caching on gpt-4o, gpt-4o-mini, gpt-4.1,
//              o1, o3, o4-mini, gpt-5 family (since late 2024).
//   Anthropic: claude-3-5-sonnet-2024-10-22 and later; claude-3-7, claude-4,
//              claude-opus-4*, claude-sonnet-4*, claude-haiku-4* all support.
//   DeepSeek:  deepseek-chat and deepseek-reasoner (context caching).
//   Google:    gemini-1.5-*, gemini-2.0-*, gemini-2.5-* (context caching).
//   xAI:       grok-3+ (documented late 2025).
//   Mistral:   No documented prompt cache as of 2026-04.
//   Cohere:    No documented prompt cache as of 2026-04.

function supportsPromptCache(m: CapabilityInput): boolean {
  const id = m.canonicalId;
  switch (m.providerId) {
    case 'openai':
      return /^(gpt-4o|gpt-4\.1|gpt-5|o1|o3|o4)/.test(id);
    case 'anthropic':
      return /^claude-(3-5-sonnet|3-7|opus-4|sonnet-4|haiku-4)/.test(id);
    case 'deepseek':
      return /^deepseek-(chat|reasoner|v3|r1)/.test(id);
    case 'google':
      return /^gemini-(1\.5|2\.|2\.5)/.test(id);
    case 'x-ai':
      return /^grok-[3-9]/.test(id);
    case 'openrouter':
      // OpenRouter passes through underlying provider's prompt cache.
      return (
        /^openai\/(gpt-4o|gpt-4\.1|gpt-5|o1|o3|o4)/.test(id) ||
        /^anthropic\/claude-(3-5-sonnet|3-7|opus-4|sonnet-4|haiku-4)/.test(id) ||
        /^deepseek\//.test(id) ||
        /^google\/gemini-(1\.5|2)/.test(id) ||
        /^x-ai\/grok-[3-9]/.test(id)
      );
    default:
      return false;
  }
}

// ── Structured outputs (JSON Schema-constrained generation) ──────────────────
//
//   OpenAI:    gpt-4o-2024-08-06 and later, gpt-4o-mini-2024-07-18 and later,
//              gpt-4.1, o1/o3/o4, gpt-5 family.
//   Anthropic: No native JSON-schema mode; approximated via tool use.
//              We mark it false to be honest — clients can still fall back
//              to the tool-use pattern.
//   Google:    gemini-1.5+ via responseSchema.
//   Mistral:   mistral-large-2+, mistral-small via response_format.
//   DeepSeek:  JSON mode yes, schema-constrained no as of 2026-04.
//   Cohere:    Command R+ via response_format: { type: 'json_object', schema: ... }

function supportsStructuredOutputs(m: CapabilityInput): boolean {
  const id = m.canonicalId;
  switch (m.providerId) {
    case 'openai':
      return (
        /^gpt-5/.test(id) ||
        /^gpt-4\.1/.test(id) ||
        /^o[1-4](-|$)/.test(id) ||
        /^gpt-4o-mini/.test(id) ||
        // Bare gpt-4o is a rolling alias for the latest snapshot, which
        // supports structured outputs. Only date-suffixed snapshots predating
        // 2024-08-06 should be excluded.
        id === 'gpt-4o' ||
        (/^gpt-4o/.test(id) && !isDateSuffixedBefore(id, '2024-08-06'))
      );
    case 'google':
      return /^gemini-(1\.5|2)/.test(id);
    case 'mistral':
      return /^(mistral-large|mistral-small|codestral|pixtral)/.test(id);
    case 'cohere':
      return /^command-r/.test(id);
    case 'openrouter':
      return (
        /^openai\/(gpt-5|gpt-4\.1|gpt-4o|o[1-4])/.test(id) ||
        /^google\/gemini-(1\.5|2)/.test(id) ||
        /^mistralai\/(mistral-large|mistral-small|codestral|pixtral)/.test(id) ||
        /^cohere\/command-r/.test(id)
      );
    default:
      return false;
  }
}

// ── JSON mode (loose JSON output, no schema enforcement) ─────────────────────

function supportsJsonMode(m: CapabilityInput): boolean {
  // If structured outputs are supported, JSON mode is implied.
  if (supportsStructuredOutputs(m)) return true;
  const id = m.canonicalId;
  if (m.providerId === 'deepseek') return /^deepseek-(chat|v3)/.test(id);
  if (m.providerId === 'groq') return true; // documented across the lineup
  return false;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isPreAug2024(m: CapabilityInput): boolean {
  if (!m.releasedAt) return false;
  return new Date(m.releasedAt).getTime() < new Date('2024-08-06').getTime();
}

// Extracts a date suffix from an id and compares it to a cutoff. Returns false
// if there's no date suffix (rolling aliases are treated as "latest").
function isDateSuffixedBefore(id: string, cutoff: string): boolean {
  const m = id.match(/-(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  return `${m[1]}-${m[2]}-${m[3]}` < cutoff;
}

function stripDateSuffix(id: string): string | null {
  // 'gpt-4o-2024-11-20' → 'gpt-4o'
  // 'claude-opus-4-7-20260115' → 'claude-opus-4-7'
  const m =
    id.match(/^(.*)-\d{4}-\d{2}-\d{2}$/) ||
    id.match(/^(.*)-\d{8}$/);
  return m ? m[1] : null;
}

// ── Curated alias map ────────────────────────────────────────────────────────
//
// Shape: { providerId: { canonicalId: [alias, ...] } }
// Keep it small — only obvious, high-value aliases. Rot risk is real.

const ALIAS_MAP: Record<string, Record<string, string[]>> = {
  openai: {
    'gpt-4o': ['chatgpt-4o-latest', 'gpt-4o-latest'],
    'gpt-4o-mini': ['gpt-4o-mini-latest'],
    'gpt-4.1': ['gpt-4.1-latest'],
    'o1': ['o1-latest'],
    'o3': ['o3-latest'],
    'o4-mini': ['o4-mini-latest'],
  },
  anthropic: {
    'claude-3-5-sonnet': ['claude-3-5-sonnet-latest', 'claude-3.5-sonnet'],
    'claude-3-5-haiku': ['claude-3-5-haiku-latest', 'claude-3.5-haiku'],
    'claude-3-7-sonnet': ['claude-3-7-sonnet-latest', 'claude-3.7-sonnet'],
    'claude-opus-4': ['claude-opus-4-latest'],
    'claude-sonnet-4': ['claude-sonnet-4-latest'],
    'claude-opus-4-7': ['claude-opus-4.7', 'claude-opus-4-7-latest'],
    'claude-sonnet-4-6': ['claude-sonnet-4.6', 'claude-sonnet-4-6-latest'],
  },
  google: {
    'gemini-2.5-pro': ['gemini-2.5-pro-latest'],
    'gemini-2.5-flash': ['gemini-2.5-flash-latest'],
    'gemini-2.0-flash': ['gemini-2.0-flash-latest'],
  },
};
