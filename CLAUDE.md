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
- **Last updated**: 2026-04-18
- **What shipped this session**: two deploys to prod.
  - `1100384` `feat(agent-readiness)` — MCP server at `/mcp` (JSON-RPC, 4 tools) + card aliased at `/.well-known/mcp{,.json,/server-card.json,/server-cards.json}`; `Accept: text/markdown` negotiation on `/`, `/{provider}`, `/about` (HTML still default, `Vary: Accept` set); RFC 9727 API Catalog at `/.well-known/api-catalog`; Agent Skills index at `/.well-known/{agent-skills,skills}/index.json` (4 skills); WebMCP `navigator.modelContext.registerTool` script injected into home/provider/about HTML; `Link:` header on all text responses advertising sitemap/llms.txt/api-catalog/MCP.
  - `b069219` `feat(home)` — homepage nav (Keyring [NEW] · Usage · About), hero announcement pill → `/keyring`, footer internal-links row. Closes the P1 "homepage entry for `/keyring`" task.
- **isitagentready.com score**: Level 2 (Bot-Aware) → **Level 4 (Agent-Integrated)**. 10/13 checks pass. Remaining fails are N/A: OAuth discovery + Protected Resource (no accounts), A2A Agent Card (peer protocol).
- **Live in prod** (all 200):
  - `https://token.app/mcp` — MCP JSON-RPC (POST) + server card (GET)
  - `https://token.app/.well-known/{api-catalog,mcp,mcp.json,agent-skills/index.json}`
  - `https://token.app/` with `Accept: text/markdown` → `text/markdown`
  - `https://token.app/` homepage shows Keyring/Usage/About nav + BYOK hero pill
- **New files**: `src/mcp.ts`, `src/markdown-pages.ts`, `src/agent-extras.ts` (all self-contained, no cross-imports beyond types/providers).
- **Local state**: on `main` at `b069219`, clean apart from this CLAUDE.md update and untracked `.claude/`. Nothing stashed.
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
  5. **P3 — agent-readiness Level 5**: not worth pursuing now. Level 5 requires OAuth discovery + protected resource metadata, which contradicts the no-accounts posture. A2A Agent Card is cheap but low value until token.app needs peer-agent handshakes.
  6. **P3 — keyring protocol phase**: wallet-style approval flow where apps request capabilities and the user approves a key scoped to that app. Only worth starting once the registry + SDK have real adoption.
- **Skip**: benchmark overlays (needs server submission — breaks no-accounts posture), image/receipt import for `/usage` (prompt flow covers it).


codex will review your output once you are done
