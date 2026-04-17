# Keyring

**An open registry + SDK for bring-your-own-key LLM access. WalletConnect for model keys.**

Every AI app re-implements the same thing: a key-entry modal, a hardcoded list of providers, a stale model dropdown, a switch statement mapping provider → base URL + auth header + streaming format. The list rots the moment you ship.

Keyring is the shared layer underneath:

1. **The Registry** — a public, versioned JSON manifest of every major LLM provider: endpoints, auth schemes, streaming formats, key validation, current model IDs, prices, capabilities, deprecations. Auto-updated from token.app's existing OpenRouter pipeline + hand-curated provider metadata. Hosted at `https://token.app/registry.json`.

2. **The Client SDK** (`keyring-client`) — a tiny library that reads the registry, renders a key-entry UI, validates keys against each provider, and hands your app a provider-agnostic `chat()` / `stream()` function. BYO-key, no vault required. Phase 1.

3. **The Protocol** (later phase) — a JSON-RPC protocol (analog of WalletConnect) so a separate **vault** app can hold keys and proxy/sign requests on behalf of client apps. Enables scoped sub-keys, revocation, cross-device. Not in v0.

## Why "Keyring"

Physical metaphor — it holds your keys. Plural-ready (you have many providers). Extends to `keyring.dev` / `keyring.app` / `useKeyring()`. Fallback brand if needed: `byok-*`.

## v0 Scope (this repo)

```
packages/keyring/
├── registry/
│   ├── schema.ts         # TypeScript types for the registry
│   ├── providers.ts      # hand-curated seed — auth, endpoints, protocol family
│   └── build.ts          # merges seed + token.app models → registry JSON
├── client/
│   └── index.ts          # BYOK client: key storage, validation, chat/stream wrapper
└── README.md
```

Served at: `GET /registry.json` on token.app (cached, CORS-enabled).

## Principles

- **Registry is the wedge.** Ship it first. Valuable to every AI tool even without the client or protocol.
- **Keys never leave the user's device in v0.** Client-side localStorage. No server submission. No accounts.
- **Canonical IDs, not provider IDs.** `claude-opus-4-7` resolves to `anthropic`'s `claude-opus-4-7-20260115` (or whatever). Aliases are first-class.
- **Capability flags over hardcoded switches.** `protocol.family: 'openai' | 'anthropic' | 'google' | 'cohere'` tells the client how to shape requests; everything else is data.
- **Deprecation as a first-class field.** Providers churn model IDs constantly. The registry tells you when a model dies and what to migrate to.

## Non-goals (v0)

- Key custody / vault app
- Server-side proxy / relay
- Usage metering (that's `/usage` on token.app)
- Billing

## Consumption

```ts
// The dumbest possible client — just fetch the registry and use it.
const reg = await fetch('https://token.app/registry.json').then(r => r.json());
const openai = reg.providers.find(p => p.id === 'openai');
const gpt5 = openai.models.find(m => m.id === 'gpt-5');

await fetch(openai.endpoints.base + openai.endpoints.chat, {
  method: 'POST',
  headers: { [openai.auth.headerName]: openai.auth.headerPrefix + userKey },
  body: JSON.stringify({ model: gpt5.providerModelId, messages: [...] }),
});
```

The SDK just wraps that.
