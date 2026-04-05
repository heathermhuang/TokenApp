# token.app

Real-time AI token pricing and subscription cost tracker. Compare 350+ models from 55+ providers.

**Live site:** [token.app](https://token.app) | [token-app.measurable.workers.dev](https://token-app.measurable.workers.dev)

## What it does

token.app aggregates pricing data for AI language models and subscription products into a single, searchable interface. Data is refreshed hourly from the [OpenRouter API](https://openrouter.ai/docs/api-reference/list-available-models) and supplemented with official provider pricing pages.

**API pricing** -- input/output token costs (USD per 1M tokens) for models from OpenAI, Anthropic, Google, Meta, Mistral, DeepSeek, xAI, Alibaba, NVIDIA, Cohere, and 45+ more providers.

**Subscription pricing** -- monthly/annual costs for ChatGPT Plus, Claude Pro, Gemini Advanced, Kimi, Doubao, and other AI products, with CNY pricing for China-market products.

**Filtering** -- by modality (text, vision, audio, reasoning), provider, free/paid, open source, and full-text search.

**AI-friendly** -- serves `llms.txt` and `llms-full.txt` following the [llmstxt.org](https://llmstxt.org) standard so AI answer engines (ChatGPT, Claude, Perplexity) can cite current pricing data.

## Architecture

```
Cloudflare Worker (Hono)
    |
    |-- GET /               Server-side rendered HTML (all model data inline)
    |-- GET /api/models     JSON API: all normalized model pricing
    |-- GET /api/subs       JSON API: subscription plans
    |-- POST /api/refresh   Admin: trigger data refresh (auth required)
    |-- GET /{provider}     Provider-specific pricing pages (10 providers)
    |-- GET /about          Methodology and data sources
    |-- GET /llms.txt       AI crawler index
    |-- GET /llms-full.txt  Full pricing data as plain text
    |-- GET /robots.txt     Search + AI crawler directives
    |-- GET /sitemap.xml    Sitemap with all pages
    |-- GET /og.png         Open Graph social preview image
    |
    |-- KV Store
    |     |-- models:all           Cached model data (JSON)
    |     |-- models:last_updated  ISO timestamp of last refresh
    |     |-- subscriptions:all    Subscription data (JSON)
    |
    |-- Cron Trigger (hourly)
          |-- Fetches from OpenRouter API
          |-- Normalizes pricing to USD/1M tokens
          |-- Writes to KV
```

### Source files

```
src/
  index.ts          Hono routes, middleware, security headers
  template.ts       Server-side HTML template (CSS, client JS, all rendering)
  fetchers.ts       OpenRouter API client, KV read/write, data normalization
  providers.ts      Provider metadata (display names, domains, URLs)
  subscriptions.ts  Static subscription plan data
  types.ts          TypeScript interfaces for models, subscriptions, OpenRouter API
```

### Key design decisions

- **Single-file frontend** -- all HTML, CSS, and JS live in `template.ts` as a server-rendered template string. No build step for the frontend, no framework, no bundler. The Worker serves a complete HTML document with all 350+ model rows pre-rendered.

- **No client-side fetch on first load** -- model data is injected as inline JSON during server-side rendering. The page is fully functional before any JavaScript runs. Client JS handles sorting, filtering, and theme toggling.

- **Hourly cron, not on-demand** -- pricing data is refreshed via Cloudflare Cron Trigger (every hour) and cached in KV. Page requests read from KV, never directly from OpenRouter. This keeps response times under 50ms and avoids rate limits.

- **No database** -- Cloudflare KV is the only storage. Model data is ephemeral (2h TTL, refreshed hourly). Subscription data is static (defined in `subscriptions.ts`, seeded to KV on first request).

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (installed as a dev dependency)

### Install

```bash
git clone https://github.com/heathermhuang/TokenApp.git
cd TokenApp
npm install
```

### Configure KV

Create a KV namespace for your deployment:

```bash
npx wrangler kv namespace create TOKEN_APP_KV
```

Copy the output `id` into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "TOKEN_APP_KV"
id = "your-namespace-id-here"
```

For local dev, also create a preview namespace:

```bash
npx wrangler kv namespace create TOKEN_APP_KV --preview
```

And add the `preview_id` to `wrangler.toml`.

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REFRESH_SECRET` | For `/api/refresh` | Bearer token for the admin refresh endpoint. If not set, the endpoint returns 500. |
| `ENVIRONMENT` | No | Set to `"production"` by default in `wrangler.toml`. |

Set secrets via Wrangler:

```bash
npx wrangler secret put REFRESH_SECRET
```

### Development

```bash
npm run dev
```

This starts a local Wrangler dev server at `http://localhost:8787`. On first load, it fetches live data from OpenRouter and seeds the local KV preview store.

### Deploy

```bash
npm run deploy
```

Deploys to Cloudflare Workers. The hourly cron trigger activates automatically.

### Custom domain

To serve from your own domain, add a [Custom Domain](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) in the Cloudflare dashboard or via `wrangler.toml`:

```toml
routes = [
  { pattern = "token.app", custom_domain = true }
]
```

## API

### GET /api/models

Returns all tracked models with normalized pricing.

```bash
curl https://token-app.measurable.workers.dev/api/models
```

```json
{
  "models": [
    {
      "id": "openai/gpt-4o",
      "slug": "gpt-4o",
      "name": "OpenAI: GPT-4o",
      "provider": "OpenAI",
      "providerId": "openai",
      "inputPer1M": 2.5,
      "outputPer1M": 10,
      "contextWindow": 128000,
      "isFree": false,
      "isVision": true,
      "isReasoning": false
    }
  ],
  "lastUpdated": "2026-04-05T12:00:00Z",
  "count": 349
}
```

### GET /api/subscriptions

Returns all tracked subscription plans.

```bash
curl https://token-app.measurable.workers.dev/api/subscriptions
```

### POST /api/refresh

Triggers an immediate data refresh from OpenRouter. Requires `REFRESH_SECRET` to be configured.

```bash
curl -X POST https://token-app.measurable.workers.dev/api/refresh \
  -H "Authorization: Bearer your-secret-here"
```

### GET /llms-full.txt

Full pricing dataset as human/AI-readable plain text. Updated hourly.

```bash
curl https://token-app.measurable.workers.dev/llms-full.txt
```

## Data sources

- **Model pricing**: [OpenRouter Models API](https://openrouter.ai/docs/api-reference/list-available-models) -- aggregates pricing from 55+ providers
- **Subscription pricing**: Manually maintained in `src/subscriptions.ts` from official provider pricing pages
- **Provider metadata**: Logos via [Google Favicon Service](https://www.google.com/s2/favicons), display names and URLs in `src/providers.ts`

## Security

- Security headers on all responses (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- URL scheme validation on all external links (rejects non-https:// URLs from upstream data)
- HTML entity escaping on all model/provider names rendered in the DOM
- Admin endpoint fails closed if `REFRESH_SECRET` is not configured
- No user data collected beyond anonymous GA4 analytics (opt-in via consent banner)
- CSO audit report available in `.gstack/security-reports/`

To report a security issue, email [hello@measurable.ai](mailto:hello@measurable.ai).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).

## Credits

Built by [Measurable AI](https://measurable.ai). Data sourced from [OpenRouter](https://openrouter.ai).
