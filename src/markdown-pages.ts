// Markdown representations of token.app pages, served when a client requests
// `Accept: text/markdown`. Keeps the SSR'd HTML intact while giving AI agents
// a clean, structured view they can ingest without DOM parsing.

import type { NormalizedModel, Subscription } from './types';
import { getProvider } from './providers';

function fmt(n: number | null | undefined): string {
  if (n == null) return 'free';
  return '$' + n.toFixed(2);
}

function fmtCtx(ctx: number | null): string {
  if (!ctx) return '';
  if (ctx >= 1_000_000) return (ctx / 1_000_000).toFixed(0) + 'M';
  if (ctx >= 1_000) return (ctx / 1_000).toFixed(0) + 'K';
  return String(ctx);
}

function modelLine(m: NormalizedModel): string {
  const ctx = fmtCtx(m.contextWindow);
  const ctxPart = ctx ? `, ${ctx} ctx` : '';
  return `- **${m.name || m.id}** (\`${m.id}\`) — input ${fmt(m.inputPer1M)}/1M, output ${fmt(m.outputPer1M)}/1M${ctxPart}`;
}

export function buildHomeMarkdown(
  models: NormalizedModel[],
  subs: Subscription[],
  lastUpdated: string | null
): string {
  const updatedStr = lastUpdated ? new Date(lastUpdated).toUTCString() : 'unknown';
  const providerCount = new Set(models.map((m) => m.providerId)).size;

  const byProvider: Record<string, NormalizedModel[]> = {};
  for (const m of models) {
    (byProvider[m.providerId] ||= []).push(m);
  }

  const topProviders = Object.entries(byProvider)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);

  const providerBlocks = topProviders
    .map(([pid, pModels]) => {
      const sample = pModels
        .slice()
        .sort((a, b) => (a.inputPer1M ?? Infinity) - (b.inputPer1M ?? Infinity))
        .slice(0, 5)
        .map(modelLine)
        .join('\n');
      return `### ${pid} (${pModels.length} models)\n${sample}`;
    })
    .join('\n\n');

  const subLines = subs
    .slice(0, 15)
    .map((s) => {
      const tiers = s.tiers
        .filter((t) => t.monthlyPrice != null)
        .map((t) => `${t.name} $${t.monthlyPrice}/mo`)
        .join(', ');
      return `- **${s.name}** (${s.providerId}) — ${tiers || 'Contact sales'}`;
    })
    .join('\n');

  return `# token.app

> Real-time AI model pricing tracker. ${models.length} models from ${providerCount} providers, refreshed hourly.

- Last updated: ${updatedStr}
- Full pricing data (plain text): https://token.app/llms-full.txt
- JSON API: https://token.app/api/models
- Keyring registry: https://token.app/registry.json
- MCP server: https://token.app/mcp

## Cheapest models per provider (top 10 providers by model count)

${providerBlocks}

## Subscription plans

${subLines}

## More

- Provider pages: https://token.app/openai, https://token.app/anthropic, https://token.app/google, etc.
- Usage dashboard: https://token.app/usage
- BYOK keyring demo: https://token.app/keyring
- About: https://token.app/about
`;
}

export function buildProviderMarkdown(
  providerId: string,
  models: NormalizedModel[]
): string {
  const displayName = getProvider(providerId).displayName;
  const sorted = models
    .slice()
    .sort((a, b) => (a.inputPer1M ?? Infinity) - (b.inputPer1M ?? Infinity));

  const rows = sorted.map(modelLine).join('\n');

  return `# ${displayName} — token.app

> ${models.length} ${displayName} models tracked on token.app. Prices in USD per 1M tokens, refreshed hourly.

- JSON: https://token.app/api/models (filter by \`providerId=${providerId}\`)
- Full HTML: https://token.app/${providerId}

## Models (sorted by input price)

${rows}
`;
}

export function buildAboutMarkdown(): string {
  return `# About token.app

token.app is a live pricing tracker for AI language models and subscription services. No accounts, no tracking — just current prices and open data.

## Data sources

- **Models**: [OpenRouter Models API](https://openrouter.ai/api/v1/models) — canonical catalog with ${'normalized pricing'}
- **Rankings**: Scraped hourly from OpenRouter's public rankings page
- **Subscriptions**: Maintained manually from provider pricing pages

## Refresh cadence

Data is refreshed every hour via a Cloudflare Cron Trigger. Always verify prices against provider docs before billing.

## Machine-readable endpoints

- \`GET /api/models\` — all models as JSON
- \`GET /api/subscriptions\` — all subscription plans as JSON
- \`GET /llms-full.txt\` — full pricing in AI-readable plain text
- \`GET /registry.json\` — BYOK keyring registry
- \`GET /.well-known/api-catalog\` — linkset of all public APIs
- \`GET /.well-known/mcp\` — MCP server card
- \`POST /mcp\` — MCP JSON-RPC endpoint

## Contact

heathermhuang@gmail.com
`;
}
