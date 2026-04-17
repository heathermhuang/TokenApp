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
- **Last updated**: 2026-04-17
- **What shipped this session**: full Keyring stack merged to main and deployed to prod in 3 deploys.
  - [#1](https://github.com/heathermhuang/TokenApp/pull/1) `feat(keyring): registry + client SDK v0` → `ef8013b`
  - [#5](https://github.com/heathermhuang/TokenApp/pull/5) `feat(keyring): native seeds for Groq/Together/Fireworks` → `0dfb234` (replaced auto-closed #2/#4)
  - [#6](https://github.com/heathermhuang/TokenApp/pull/6) `feat(keyring): capabilities + publishable package + /keyring demo` → `a8baac9` (replaced #3)
- **Live in prod**:
  - `https://token.app/registry.json` (200, ~188 KB, 11 providers, 521 models)
  - `https://token.app/keyring` (200, BYOK demo page)
- **Repo hygiene gotcha this session**: local `main` was 14 commits ahead of `origin/main` but all 14 were already in PR #1's squash — the "unpushed work" was a duplicate ghost. Resolved with `git reset --hard origin/main`. Side-effect: `--delete-branch` on PR #1 merge auto-closed the stacked PRs #2 and #3 because their base branches vanished. Had to cherry-pick their unique commits onto fresh branches (#5, #6) and reopen. If stacking again, don't `--delete-branch` until the whole stack lands, or retarget stacked PRs to `main` first.
- **Local state**: on `main` at `a8baac9`, clean (apart from untracked `.claude/`). Replacement branches `feat/keyring-native-seeds-v2` and `feat/keyring-capabilities-package-demo-v2` already deleted by squash-merge. Stale local `feat/keyring-native-seeds` and `feat/keyring-capabilities-package-demo` branches can be pruned.
- **Next steps (prioritized)**:
  1. **P0 — publish `keyring-client` to npm**: check name availability, fall back to scoped `@tokenapp/keyring-client`, publish v0.1.0 from `packages/keyring/`.
  2. **P1 — homepage entry for `/keyring`**: hero or nav link so the demo gets discovered.
  3. **P1 — resume `/usage` roadmap** (interrupted by keyring work):
     - cross-linking: byModel rows → `/models/{provider}/{slug}`; subBreakeven rows → `/subscriptions`; "Load my usage" button on `/models` reading localStorage
     - forecasting: month-end projection + "switch model X → Y" slider
     - landing: "Best coding agent by cost" (Cursor / Claude Code / Codex / Aider)
  4. **P2 — keyring v0.2**: expand native seeds (Mistral, DeepSeek direct, xAI), add `validateKey` coverage for more providers, CI check that `/registry.json` schema doesn't regress.
  5. **P2 — `/usage` polish**: calendar heatmap, per-provider export guides with screenshots.
  6. **P3 — keyring protocol phase**: wallet-style approval flow where apps request capabilities and the user approves a key scoped to that app. Only worth starting once the registry + SDK have real adoption.
- **Skip**: benchmark overlays (needs server submission — breaks no-accounts posture), image/receipt import for `/usage` (prompt flow covers it).
