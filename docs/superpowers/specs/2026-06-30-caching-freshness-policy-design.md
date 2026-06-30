# Caching freshness policy pass — design

**Date:** 2026-06-30
**Status:** approved (design), pending implementation
**Scope:** close the one real `/api/*` freshness gap and make the repo the source of truth for the caching policy. Pull-based; no new infrastructure.

## Problem

A prior session cache-busted `/api/task-spend` and `/api/market-share` (the chart/treemap client fetches) because Cloudflare's edge holds `/api/*` far longer than the hourly cron cadence. The open question was whether the **leaderboard + apps board** (and the rest of `/api/*`) also go stale, and whether to revisit caching holistically (purge-on-cron vs. the client time-bucket pattern).

### Live measurement (token.app, 2026-06-30 ~00:16 UTC)

| Surface | Code sets | Edge actually serves | Real freshness |
|---|---|---|---|
| SSR page `/` (leaderboard, apps board, models table, initial chart/treemap) | `max-age=60, swr=300` | **Not edge-cached** — no `cf-cache-status`, re-rendered per request | **~15 min old** (embedded ts `00:00:56` vs `00:16`) → ≤ 1 cron cycle |
| `/api/task-spend` | `max-age=3600` | `max-age=14400` HIT (zone override) | client `?b=` bust → ≤ 10 min |
| `/api/market-share` | `max-age=3600` | `max-age=14400` HIT | client `?b=` bust → ≤ 10 min |
| **`/api/rankings`** (period/category toggle) | `max-age=3600` | `max-age=14400` HIT | **NOT busted → up to 4h stale** |
| `/api/models`, `/api/subscriptions`, `/api/rankings/categories` | `max-age=3600` | `max-age=14400` HIT | not busted; slow-changing → 4h acceptable |

### Two findings that shaped scope

1. **The SSR boards are already fresh.** The page `/` is *not* edge-cached (no `cf-cache-status` across requests; embedded data reflects the last hourly cron). The "SSR-embedded → governed by page HTML cache → lags by hours" premise does **not** hold in the live config. No action needed there — but it must be **documented** so a future session doesn't try to "fix" a non-problem.
2. **The real gap is narrow.** A Cloudflare **zone** Cache Rule silently overrides `/api/*` edge TTL to `14400` (4h), contradicting the code's `3600`. Of the client-side fetches, only `/api/rankings` (the 24H/7D/30D + category toggle) is both freshness-sensitive **and** un-busted — up to 4h stale on a toggle.

## Goals

- Close the `/api/rankings` freshness gap with the same proven client time-bucket pattern.
- Consolidate the cache-bust into one helper so the policy lives in a single place.
- Make the repo honest about the zone override (code currently says `3600`; edge serves `14400`).
- Write the caching policy down (which endpoints are live / slow / fresh) so it's no longer tribal knowledge.

## Non-goals (explicitly out of scope)

- **Purge-on-cron** (push model / Cloudflare cache-purge API). Considered and rejected for now: adds a CF API-token secret + purge-by-URL enumeration (no wildcard/tag purge on Workers Paid) for marginal benefit at this traffic.
- Changing the Cloudflare zone Cache Rule (dashboard, out-of-repo).
- Touching the SSR boards — already fresh.
- Re-classifying the slow endpoints — `/api/models`, `/api/subscriptions`, `/api/rankings/categories` change rarely; the 4h edge cache is fine.

## Caching policy (the written-down outcome)

| Class | Endpoints | Mechanism |
|---|---|---|
| **Live** — busted, ≤ 10 min | `/api/rankings`, `/api/market-share`, `/api/task-spend` | client `withBust(url)` appends a 10-min time-bucket key |
| **Slow** — 4h edge cache OK | `/api/models`, `/api/subscriptions`, `/api/rankings/categories` | no bust; data changes rarely |
| **Fresh** — not edge-cached | SSR `/` | re-rendered per request from KV/D1, ≤ 1 cron cycle; no action |

## Changes

### 1. `withBust(url)` helper — `src/template.ts` (client script scope)

```js
function withBust(url) {
  return url + (url.includes('?') ? '&' : '?') + 'b=' + Math.floor(Date.now() / 600000);
}
```

Single source of the 10-min bucket. Correctly emits `?b=` for bare paths and `&b=` for paths that already carry a query string (e.g. `/api/rankings?period=week`).

### 2. Apply / migrate the busts — `src/template.ts`

- **New (closes the gap):**
  - `loadRankingsPeriod` fetch (`fetch(buildRankingsUrl(period))`, ~line 3129) → `fetch(withBust(buildRankingsUrl(period)))`. `buildRankingsUrl` stays pure (returns the logical URL); the bust is applied uniformly at the fetch site.
  - SSR-fallback fetch (`fetch('/api/rankings')`, ~line 3008) → `fetch(withBust('/api/rankings'))`. The sibling `/api/models` and `/api/subscriptions` fetches in the same `Promise.all` stay un-busted (they're "slow").
- **Migrate existing (policy in one place):**
  - `loadMarketShare` (~line 3194): `fetch('/api/market-share?b=' + Math.floor(Date.now() / 600000))` → `fetch(withBust('/api/market-share'))`.
  - `loadTaskSpend` (~line 3486): `fetch('/api/task-spend?b=' + Math.floor(Date.now() / 600000))` → `fetch(withBust('/api/task-spend'))`.

### 3. Document the zone override — `src/index.ts`

A comment block by the `── API Routes ──` section / the `/api/*` `cache()` calls: code sets `max-age=3600` (intended, ~cron cadence) but a Cloudflare zone Cache Rule overrides edge TTL to `14400` (4h); freshness-sensitive fetches are client-busted via `withBust` in `template.ts`. No functional change — the value stays `3600` (the policy we'd serve absent the zone rule); the comment stops the code from silently contradicting the edge.

### 4. Write down the policy — `CLAUDE.md`

Extend the existing "`/api/*` edge cache lags the cron by HOURS" gotcha with: (a) the SSR `/` is **not** edge-cached → boards already fresh (kill the "lags by hours" worry for SSR); (b) the live/slow/fresh table above; (c) the `withBust` helper reference.

## Verification

Per project rules (render + screenshot before deploy; behavioral proof after):

1. **Local (no regression):** render `getHtml()` via `scratchpad/verify.mjs`; grep the rendered output to confirm `withBust` is defined and the three live fetches are wrapped in it (`fetch(withBust(...))`), and that the script still parses (verify.mjs stubs `/api/*`, so a clean render proves no JS breakage). The bucket is computed at runtime in the browser, so the static render shows the *call sites*, not a literal busted URL — the proof is render-integrity + call-site presence.
2. **Post-deploy (behavioral):** `curl` `/api/rankings?period=week&b=<bucket>` vs the plain `/api/rankings?period=week` and show the `cf-cache-status` / freshness difference — the same header technique used to diagnose. Then a live token.app toggle to 7D confirming the network request carries `&b=`.

## Risk

Low. One real behavior change (an extra query param on `/api/rankings` fetches) plus a two-line migration of already-working busts and docs. No schema, binding, cron, or secret changes. Rollback is a revert.
