# token.app

AI model pricing tracker and comparison tool built on Cloudflare Workers with Hono. Data sourced from OpenRouter API. Deployed at https://token.app (custom domain) and https://token-app.measurable.workers.dev.

## Stack
- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Storage**: Cloudflare KV (`TOKEN_APP_KV`)
- **Data**: OpenRouter `/api/v1/models` (JSON) + `/rankings` (RSC payload scraping)
- **Secrets**: `REFRESH_SECRET` via `wrangler secret put`

## Key files
- `src/index.ts` — Hono routes (API + SSR page)
- `src/template.ts` — Full HTML/CSS/JS template (SSR, single-file SPA)
- `src/fetchers.ts` — OpenRouter data fetching, normalization, KV read/write
- `src/subscriptions.ts` — Static subscription plan data
- `src/types.ts` — All TypeScript interfaces
- `src/providers.ts` — Provider metadata (colors, display names)

## Dev
- `npx wrangler dev --port 8799` — local dev server
- `npx wrangler deploy` — deploy to production
- Cron runs hourly (`0 * * * *`) to refresh model + rankings data
- Manual refresh: `POST /api/refresh` with `Authorization: Bearer <REFRESH_SECRET>`
- `wrangler.toml` is gitignored (contains KV namespace IDs)

## Gotchas
- **RSC double-escaping**: OpenRouter `/rankings` RSC payload uses `\\"` when fetched server-side vs `\"` locally. Parsers must normalize before extracting JSON.
- **Template literal escaping**: Model descriptions can contain backticks and `${` — use `safeLiteral()` before embedding in template.ts.
- **`\'` is invalid in JS template literals**: backslash is silently ignored for single quotes. Use `this.hidden=true` instead of `this.style.display='none'` in inline handlers.

## Current Work
- **Last updated**: 2026-04-13
- **What shipped**:
  - Added 24H/7D/30D period toggle to Agent Usage Leaderboard (e377c34)
  - Fetcher now parses all three rankMap periods (day, week, month) from OpenRouter RSC payload
  - Added rankings diagnostics to `/api/refresh` endpoint (a885201)
  - Updated SEO/AEO — meta tags, JSON-LD, FAQ, and About section mention rankings (6fe708e)
  - Set up `REFRESH_SECRET` via `wrangler secret put` (value: `tokenapp-refresh-2026`)
- **Uncommitted changes**: `.claude/` directory (launch.json for preview server), `CLAUDE.md`
- **Next steps**:
  - Model leaderboard only has weekly data (OpenRouter limitation) — no period toggle for models
  - Could add click-through links on model leaderboard items (link to OpenRouter model page)
  - Could add rank change indicators (up/down arrows) if OpenRouter provides delta data
