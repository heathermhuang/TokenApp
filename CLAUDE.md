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
- **OpenRouter /rankings is JS-rendered now**: the SSR HTML no longer contains ranking data (turbopack Next.js app). `fetchRankingsFromOpenRouter()` uses the Cloudflare Browser Rendering binding via `@cloudflare/puppeteer`. Stable selector: `[data-testid="model-rankings-leaderboard-row"]` for models; Top Apps section has no testid (fallback to innerText regex). Requires `[browser]` binding in `wrangler.toml` and Workers Paid plan.
- **Empty-overwrite guard on rankings KV**: `refreshAllData` refuses to write to KV when scraping yields 0 models AND 0 apps. Stops silent cache poisoning if OpenRouter's UI changes again — keeps last-good data and surfaces `rankingsError` instead.
- **Template literal escaping**: Model descriptions can contain backticks and `${` — use `safeLiteral()` before embedding in template.ts.
- **`\'` is invalid in JS template literals**: backslash is silently ignored for single quotes. Use `this.hidden=true` instead of `this.style.display='none'` in inline handlers.

## Current Work
- **Last updated**: 2026-05-28
- **What shipped this session**: one deploy to prod.
  - `354550e` `fix(rankings): scrape rendered DOM via @cloudflare/puppeteer` — rankings tab had been empty for days. OpenRouter rebuilt `/rankings` on a turbopack Next.js app and removed all ranking data from the SSR HTML (every parser anchor — `rankingData`, `rankMap`, `model_permaslug`, `"day":[` — gone). The hourly cron silently overwrote KV with empty arrays. Fix: switched to Cloudflare Browser Rendering binding + `@cloudflare/puppeteer` to load the page, wait for hydration, extract from rendered DOM. Stable selector `[data-testid="model-rankings-leaderboard-row"]` for models; innerText regex for apps. Added empty-overwrite guard in `refreshAllData` so KV keeps last-good data on future breakages. Manual `POST /api/refresh` returned `{"ok":true,"models":356,"rankings":"10 models, apps: 10d/0w/0m"}`; rendered live page now shows real ranks ("1. deepseek-v4-flash — 3.6T tokens", "1. Hermes Agent — 569.0B tokens").
- **New deps + bindings**:
  - `@cloudflare/puppeteer ^1.1.0` (production dep). 4 moderate npm audit warnings (transitive) — not blocking.
  - `wrangler.toml`: added `[browser] binding = "BROWSER"`. Requires Workers Paid plan.
  - `src/types.ts` Env now includes `BROWSER: Fetcher`.
- **Caveats from the new fetcher** (cosmetic, follow-ups):
  - `totalRequests` is always `0` for both models and apps (new UI no longer renders it). UI shows "0 reqs" — consider hiding that column in `src/template.ts`.
  - App `originUrl` extraction is best-effort; in current runs it's empty (favicon URL still works via Google's faviconV2 proxy).
  - Week/month app periods are empty (OpenRouter dropped those toggles). UI's existing `appsData[period] || appsData.day` fallback keeps it sensible.
- **Op note — REFRESH_SECRET was rotated this session** to `2021@RewardMe` (user-typed during verification). Looks like a real password; rotate to a strong random value at your convenience.
- **Local state**: on `main` at `354550e`, clean apart from `.DS_Store` + `.claude/` (both gitignored or untracked).
- **Next steps (prioritized, carried forward)**:
  1. **P0 — publish `keyring-client` to npm** (still blocked on auth — no `npm whoami`, no `~/.npmrc`, no `NPM_TOKEN`. Package builds clean; dry-run shows 10 files / 9.6 KB. Names available: `keyring-client`, `@tokenapp/keyring-client`, `@tokenapp-io/keyring`, `@token-app/keyring`. Unblock: user runs `npm login` or supplies a granular token).
  2. **P1 — rankings polish**: hide "X reqs" column when totalRequests is always 0; hide week/month period toggle on Rankings tab (or relabel).
  3. **P1 — resume `/usage` roadmap**: cross-link byModel rows → `/models/{provider}/{slug}`; "Load my usage" button on `/models` reading localStorage; month-end forecast + "switch model X → Y" slider; landing "Best coding agent by cost" comparison.
  4. **P2 — keyring v0.2**: expand native seeds (Mistral, DeepSeek direct, xAI); broaden `validateKey` coverage; CI schema check on `/registry.json`.
  5. **P2 — `/usage` polish**: calendar heatmap, per-provider export guides with screenshots.
  6. **P3 — agent-readiness Level 5**: A2A Agent Card (low value until token.app needs peer-agent handshakes).
  7. **P3 — keyring protocol phase**: wallet-style scoped-key approval flow. Only worth starting once registry + SDK have real adoption.
- **Skip**: benchmark overlays (needs server submission — breaks no-accounts posture); image/receipt import for `/usage` (prompt flow covers it).


codex will review your output once you are done
