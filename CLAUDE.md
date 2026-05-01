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
- **Last updated**: 2026-05-01
- **What shipped this session**: one deploy to prod.
  - `5358533` `fix(models): use Hugging Face IDs for canonical model links` — DeepSeek model rows were linking to `github.com/deepseek-ai/<openrouter-slug>` (e.g. `deepseek-chat-v3-0324`), but actual repos use PascalCase (`DeepSeek-V3-0324`); most 404'd. Mistral had the same problem with `mistral.ai/models/<slug>`. Fix: pass OpenRouter's `hugging_face_id` field through `NormalizedModel` and prefer `huggingface.co/<id>` when present. Now canonical for every open-weight family on OpenRouter (DeepSeek, Llama, Qwen, Gemma, Mistral, NVIDIA Nemotron, GLM, Kimi, MiniMax, etc. — 181/371 models). Also fixed broken Amazon Bedrock listing URL in `PROVIDER_URLS` and `MODEL_PAGE_URLS`. KV refreshed via cron at 2026-05-01 08:00:37 UTC.
- **Prior sessions shipped**:
  - `b8939fd` OAuth 2.0 / OIDC discovery metadata; `d648a4a` OAuth Protected Resource Metadata (RFC 9728).
  - `1100384`, `b069219`: MCP server, `/mcp` JSON-RPC + card aliases, `Accept: text/markdown` negotiation, API Catalog, Agent Skills index, WebMCP injection, homepage Keyring/Usage/About nav + BYOK hero pill.
- **isitagentready.com score**: Level 4 → expected Level 5. OAuth discovery + Protected Resource should both flip to pass (12/13). Only remaining fail: A2A Agent Card (peer protocol, low-value until token.app needs peer-agent handshakes).
- **Live in prod** (all 200 unless noted):
  - `https://token.app/.well-known/oauth-authorization-server`
  - `https://token.app/.well-known/openid-configuration`
  - `https://token.app/.well-known/oauth-protected-resource`
  - `https://token.app/.well-known/jwks.json` (`{"keys":[]}`)
  - `https://token.app/oauth/authorize` → 501 with OAuth error JSON (expected)
  - `https://token.app/oauth/token` — POST `client_credentials` with `client_secret=$REFRESH_SECRET`
  - `POST https://token.app/api/refresh` without bearer → 401 with `WWW-Authenticate: Bearer ... resource_metadata="..."`
  - `https://token.app/mcp` — MCP JSON-RPC (POST) + server card (GET)
  - `https://token.app/.well-known/{api-catalog,mcp,mcp.json,agent-skills/index.json}`
  - `https://token.app/` with `Accept: text/markdown` → `text/markdown`
- **New files**: `src/oauth-discovery.ts` (metadata builders + empty JWKS). Also `src/mcp.ts`, `src/markdown-pages.ts`, `src/agent-extras.ts` from prior session — all self-contained, no cross-imports beyond types/providers.
- **Local state**: on `main` at `5358533`, clean apart from this CLAUDE.md update and untracked `.claude/`. Nothing stashed.
- **Gotcha — OpenRouter `hugging_face_id` is undocumented but reliable**: 181/371 models expose it (100% of DeepSeek, Llama, Nemotron; high coverage on Qwen, Gemma, GLM, Kimi, MiniMax). When constructing model URLs, prefer this over scraping per-provider URL patterns — provider repo naming conventions diverge from OpenRouter slugs and silently 404. Anthropic, x-ai, OpenAI, Cohere, Perplexity have 0 coverage (closed-weight) — keep per-provider docs URLs as fallback for them.
- **Gotcha — Cloudflare KV refresh after a model-shape change**: rolling out a new field on `NormalizedModel` is a code-only deploy, but the rendered page reads from KV. Until cron fires (or manual `POST /api/refresh` with bearer), users see old objects without the new field. The page falls through to provider-listing URLs in that window; not broken but degraded. Worst case is ~59 min on cron alone.
- **Gotcha — scanner path for RFC 9728**: probes exactly `/.well-known/oauth-protected-resource` (singular); don't be tempted to also alias `/oauth-protected-resources`. The required fields are just `resource` and `authorization_servers` (array).
- **Gotcha — Cloudflare edge cache on first probe**: first `curl https://token.app/.well-known/oauth-protected-resource` after deploy came back 404 while `https://token-app.measurable.workers.dev/...` was 200. Resolved within ~10s. If a newly added `.well-known/*` route appears broken on the custom domain right after deploy, hit the workers.dev URL before assuming a code bug.
- **Design note — OAuth honest stub**: token.app has no user accounts; only `POST /api/refresh` is protected by the static `REFRESH_SECRET`. The discovery doc models this as a client_credentials-only authorization server with `response_types_supported=["none"]`, `id_token_signing_alg_values_supported=["none"]`, empty JWKS, and scope `admin:refresh`. This contradicts an earlier decision (marked P3 "not worth pursuing") that OAuth discovery conflicts with the no-accounts posture — this session implemented it honestly instead of dropping the posture. `/oauth/token` genuinely accepts the secret so the advertised grant is not a lie; `/oauth/authorize` 501s so no interactive flow is implied.
- **Gotcha this session — MCP card probe paths**: isitagentready scanner probes THREE paths (`/.well-known/mcp/server-card.json`, `/.well-known/mcp/server-cards.json`, `/.well-known/mcp.json`) and does NOT check `/.well-known/mcp`. First deploy passed everything except MCP card for this reason. Fix: `MCP_CARD_PATHS` array in `src/index.ts` registers all four paths. If adding other `/.well-known/*` discovery docs later, rescan and check evidence URLs — scanners rarely check a single canonical path.
- **Gotcha — WebMCP via HTML injection**: `injectWebMcp(html)` in `src/agent-extras.ts` does a string replace on `</body>`. Cheaper than editing the three templates in `template.ts` but it's order-dependent — if any future template changes the closing tag structure (e.g. fragment without body), the injection silently no-ops. Verified once in preview; add a test if we start injecting more.
- **Blocker — npm publish of `keyring-client` (P0)**: local env has no npm auth (`npm whoami` → ENEEDAUTH), no `~/.npmrc`, no `NPM_TOKEN`. Package builds clean (`npm run build` in `packages/keyring/` produces valid dist). Dry-run shows 10 files, 9.6 KB tarball, public access. All four candidate names (`keyring-client`, `@tokenapp/keyring-client`, `@tokenapp-io/keyring`, `@token-app/keyring`) are available on npm. Claude cannot drive `npm login --auth-type=web` (interactive browser OAuth in user's session). Unblock path: user runs `npm login` or pastes a granular access token, then Claude runs `npm publish` from `packages/keyring/`. Recommended name: unscoped `keyring-client`.
- **Next steps (prioritized)**:
  1. **P0 — publish `keyring-client` to npm** (still blocked on auth, see above).
  2. **P1 — resume `/usage` roadmap**:
     - cross-linking: byModel rows → `/models/{provider}/{slug}`; subBreakeven rows → `/subscriptions`; "Load my usage" button on `/models` reading localStorage
     - forecasting: month-end projection + "switch model X → Y" slider
     - landing: "Best coding agent by cost" (Cursor / Claude Code / Codex / Aider)
  3. **P2 — keyring v0.2**: expand native seeds (Mistral, DeepSeek direct, xAI), add `validateKey` coverage for more providers, CI check that `/registry.json` schema doesn't regress.
  4. **P2 — `/usage` polish**: calendar heatmap, per-provider export guides with screenshots.
  5. **P3 — agent-readiness Level 5**: OAuth discovery + Protected Resource Metadata both shipped this session. A2A Agent Card still low value until token.app needs peer-agent handshakes.
  6. **P3 — keyring protocol phase**: wallet-style approval flow where apps request capabilities and the user approves a key scoped to that app. Only worth starting once the registry + SDK have real adoption.
- **Skip**: benchmark overlays (needs server submission — breaks no-accounts posture), image/receipt import for `/usage` (prompt flow covers it).


codex will review your output once you are done
