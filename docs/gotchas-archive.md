# Gotchas archive

Settled gotchas moved out of `CLAUDE.md`, which auto-loads in full at every session
start and is capped at ~30KB. Nothing here is wrong or obsolete — each is a rule
that is now enforced by code, tests, or shipped markup, so it no longer needs to sit
in every session's context. This file does NOT auto-load; read it when working near
the area it describes.

Moved 2026-08-17.

- **Empty-overwrite guard**: `refreshAllData` refuses to record a snapshot when scraping yields 0 models AND 0 apps. Stops silent cache poisoning if OpenRouter's UI changes again — keeps last-good D1 data and surfaces `rankingsError` instead.

- **`[]` is truthy in JS**: `appsData.week || appsData.day` returns the empty `.week` array, not `.day`. The rankings UI fallback checks `byPeriod.length > 0` instead. Worth remembering for any future period-keyed shape.

- **Model token-usage chart source = `model-rankings-chart`, NOT `/models`** (verified 2026-06-28): the year-long per-MODEL chart is built from `model-rankings-chart` (52 weekly points; each week = its top-9 + an "Others" bucket). `/rankings/models?view=week` is the LEADERBOARD feed and only carries the last ~6 days — it CANNOT drive a year chart. "Others" is genuinely ~40%/week and that MATCHES OpenRouter (confirmed against their own hover tooltip: Others is the big PINK base band, ~47%). `modelShareSeries` displays the UNION of every week's top-9 (canonicalized keys, for cross-week continuity) and keeps "Others" as `entities[0]` → the BOTTOM band. The old bug projected TODAY's top-9 backward → historical weeks rendered empty/grey (was mislabelled a "D1 depth" caveat).

- **A page that exists is not a page you can reach** (2026-08-06): 339 `/model/{slug}` pages shipped in the sitemap — crawlers found all of them, humans could reach **4** (the superlative cards). Every table row's model name linked *off-site* (`getModelUrl()` → Hugging Face / OpenAI docs / OpenRouter), so the pages had no front door for a week. The name now links to `/model/{slug}` and the vendor link is a hover-revealed icon (`@media (hover: none)` keeps it visible on touch). When you ship programmatic pages, wire the internal entry point in the same PR as the sitemap.

- **The Pareto chart must sit ABOVE the models table**: measured — below it, `#pareto-section` lands at offsetTop ~28,000px behind 338 rows. Also: `.market-share` carries **no layout** (the rankings tab supplies its own container), so the panel uses `.table-wrap` + `.leaderboard` instead. Free models are excluded from the plot deliberately (log(0) has no axis home); several provider brand colours are near-white so every dot needs a stroke to survive the light theme.

- **`safeUrl()` is not HTML escaping**: it only checks the `https://` prefix, so a poisoned `huggingFaceId` carrying a double-quote plus a tag passes it and breaks out of the `href`. Every caller must **also** `escape()` at the attribute boundary. (`getProviderUrl` is safe — it reads a static map.)

Moved 2026-08-17 (subscription re-verification pass).

- **`isOpenSource` = `Boolean(raw.hugging_face_id)`, never a name/provider heuristic** (fixed 2026-08-05): the old list treated whole authors as open (`'google'`, `'qwen'`), so every proprietary Gemini and Qwen-Max read as open-weight while GLM-5.2, Kimi K3 and gpt-oss-120b (public weights) read as proprietary. **125 models reclassified**, 125→152 open. Wrong for every user of the homepage "Open Source" filter until then. Caught only because the superlative strip surfaced "best open weights → Gemini 3.6 Flash".

Moved 2026-08-17 (second session) — enforced by `parseCsv()` and pinned by `npm test`.

- **Epoch's CSV needs a real RFC-4180 parser**: it embeds newlines AND commas inside quoted fields ("Training compute notes" runs to paragraphs) — a naive `split('\n')` yields **6541 fragments for 1107 records**. `parseCsv()` in `benchmarks.ts` is hand-rolled for this. Parse cost ~55ms CPU for 2.5MB — fine against the Worker budget.

Moved 2026-10-20 — the working copy left iCloud (`~/Code/TokenApp`), so the cause is
gone and the diagnosis is settled in Current Work. `npm run deploy` still preflights;
the value here is the falsification list, so nobody re-derives it.

- **`wrangler deploy` dies inside undici — LIKELY EXPLAINED 2026-08-18 as iCloud eviction of `node_modules` (see Current Work); the notes below are the pre-diagnosis record** (hit twice, 2026-08-12/13): `TypeError: mixinBody is not a function` from `undici/lib/web/fetch/response.js`, and a variant from `lib/dispatcher/h2c-client.js` — a stack that never names the fix, which is `npm ci`. **Falsified 2026-08-13, don't re-derive**: git hooks (none; `core.hooksPath` unset), `npm test`, esbuild previews, `tsc`, and npm run from the worktree via a symlinked `node_modules` all leave `node_modules/undici` byte-identical. One undici only (7.24.4, wrangler → miniflare); `npm ci` idempotent on a healthy tree. **Not reproducible on demand.** Mitigated, not fixed: `npm run deploy` preflights (`scripts/preflight-deploy.mjs`) — imports **miniflare** (wrangler's real path to undici, not whichever copy npm hoisted), **runs** `workerd --version` (the `.bin` shim exists whether or not the platform binary works), checks `wrangler.toml`, blocks with the remedy, and writes `preflight-failure.json`. The guard is inside the `deploy` script, not a `predeploy` hook — npm skips pre/post hooks under `ignore-scripts`, which would silently un-guard it. The `npm ci` reflex destroys the evidence, which is why two occurrences yielded no diagnosis — **keep that file before running `npm ci`**.

Moved 2026-10-21 — the fix (`withBust()` in `template.ts`) has been shipped since
2026-06-30 and the policy block still sits atop the API routes in `index.ts`. Full
design: `docs/superpowers/specs/2026-06-30-caching-freshness-policy-design.md`.

- **The cached `/api/*` GETs lag the cron by hours; the SSR page does not** (2026-06-29, settled 2026-06-30): Cloudflare serves those GETs with `max-age` up to 14400 (zone override beats the routes' 3600) + `cf-cache-status: HIT`, so after the hourly cron writes KV the client keeps a stale snapshot — this hid the Spend/Tokens toggle for hours, since its visibility flips on `data.tokens` being present. Measured: the page `/` itself is **not** edge-cached (no `cf-cache-status`, re-rendered per request from KV/D1), so anything SSR-embedded is already fresh to ≤1 cron cycle. Fix is `withBust(url)` (`template.ts`, **top-level** script scope so `init()` and the DOMContentLoaded handler both reach it; appends a 10-min bucket as `?b=`/`&b=`), applied to the three **live** fetches — `/api/rankings`, `/api/market-share`, `/api/task-spend`. **Slow** endpoints (`/api/models`, `/api/subscriptions`, `/api/benchmarks`, `/api/rankings/categories`) stay un-busted; a 4h edge cache is fine when the data changes rarely. (`/api/refresh` is a POST and never cached.) To tell KV-stale from edge-stale, compare a cache-busted URL against the plain one. Same policy block sits atop the API routes in `index.ts`. Spec: `docs/superpowers/specs/2026-06-30-caching-freshness-policy-design.md`.

Moved 2026-11-03 — #43 shipped, #45 fixed its sentinel hole and #46 recorded
Google's own verdict on it (Rich Results: 1 valid item, Product snippets, no
Merchant listings section). The permanent refusals it established are kept in
`CLAUDE.md`; the rest is history. The dependency bullets below are superseded by
the versions actually in `package.json`.

- **Model-page `Product` markup is an `AggregateOffer` now** (#43), answering 7 Search Console structured-data issues across all 469 `/model/{slug}` pages. **The critical "Missing field image" was raised against a feature the site can never qualify for**: Google grants merchant listings only to pages where a shopper can *purchase*, and we link out, so a plain `Offer` — which asserts the page owner is the seller — invited validation we cannot pass. An `AggregateOffer` is both honest (one model, many hosts, prices differing by multiples) and the exit from that report; our real lane is **Product snippets**, whose docs name "aggregator sites" and whose whole requirement, `name` + any offer, was already met. **`aggregateRating`/`review` are refused permanently** (no ratings, no reviews; fabricating breaches Google policy) as are `shippingDetails`/`hasMerchantReturnPolicy` (nothing ships or returns) — tests pin their absence so a later "silence the warnings" pass cannot add them. **Same threshold is not the same gate**: the range filtered on a non-null *input* price while `hostsPanel` filters on a non-null *blended* one, and `blend()` is null if either side is, so a host quoting input but no output published a 1–9 spread on a page with no hosts table (Codex round 1; now one gate, with a test asserting HTML and JSON-LD agree). `/og.png` is not a product image — it is the site banner — and `availability` is derived from `isDeprecated`, never hard-coded. `npm test` 108/108, six mutants each killing exactly one test. **No `/api/refresh`**: the markup is compiled into the SSR page, no KV data changed. Verified live on 3 pages; **Search Console clearing still needs a re-crawl** — the docs state the `Offer` requirement, not the consequence.

- **The deps upgrade is settled**: the category scrape ran normally under `@cloudflare/puppeteer` 1.4 on 09-19/20/21 (11 categories, 142-143 rows/day, the pre-upgrade baseline), read from D1 by hand after the check task stalled.

- **Dependencies are all at latest** (#39): wrangler 4.134, TypeScript **7.0.2** (native compiler; tsconfig needed no change), workers-types 5, hono 4.13.8, `@cloudflare/puppeteer` 1.4, esbuild 0.28, icons 1.95 (none of our marks changed). **Unverified until the 2026-09-19 00:00 UTC cron**: the daily category scrape, the only puppeteer caller. One-time task `tokenapp-check-category-scrape-deps` (08:30 SGT) checks D1 against the baseline of 11–12 categories and ~140 rows/day, and on failure reports the rollback command without running it.

- **Sweep every page before believing a structured-data change** (#45): three spot-checked pages said clean; sweeping all **467** found **7 publishing `lowPrice:"-1000000"`** — OpenRouter encodes "price depends on whatever this routes to" as **-1/token** (`openrouter/auto`, `/auto-beta`, `/fusion`, `/pareto-code`, `/bodybuilder`, `nvidia/switchyard`, `typesafe/jev-router`), and `!== null` let it through. Those now publish **no `offers`**; endpoint prices never needed the guard (`usdPerM` nulls negatives). Codex had flagged the helper's tolerance of negatives and it was waved off as pre-existing — it was pre-existing *and* live. Post-fix sweep: **0 violations, 196 ranges = 196 hosts tables**. **Still open: `fmtP(-1000000)` hits the `n < 0.01` branch, so those 7 pages DISPLAY "<$0.01" for an unknown price** — older than #43, affects every `fmtP` surface, wants its own pass. The `Discontinued` branch has no prod coverage (0 deprecated models in the sitemap); only `npm test` exercises it.

- **Subscriptions** (#36, #38): 20/28 stamped `2026-09-18`. #36 made 9 price fixes and added 5 tiers; Kimi moved to `/membership/pricing`. #38 resolved every flagged follow-up from vendor pages: v0 `$30` confirmed by its docs; Qwen Studio's picker adds Qwen3.8-Max; Meta names no Muse Spark version; Runway still offers Veo 3.1 and moved to Seedance 2.5. Evidence: `docs/reviews/pricing-verify-2026-09.md`.

Moved 2026-11-03 — the eviction diagnosis is complete and the repair is done;
`CLAUDE.md` keeps the operational line (work in `~/Code/TokenApp`) and a memory
note redirects sessions that open in the stale `~/Documents` copy.

- **Eviction, the settled diagnosis**: macOS leaves `dataless` files in `~/Documents`, and reads of them block on a download. Detect with `ls -lO`, or `find -flags +dataless`. **Without the `+`, `-flags dataless` is an EXACT match that misses `compressed,dataless` and reports 0.** This explains the undici `mixinBody` deploy failures and the preflight ETIMEDOUT (both archived; `docs/gotchas-archive.md`). `npm ci` repairs only `node_modules`. The old copy still holds the superseded local branch `pricing-verify/2026-08` and a packfile the August repair moved aside (kept).

Moved 2026-11-03 — #41 shipped in September and `test/category-history.test.mjs`
pins it with a positional D1 stub; the one rule worth keeping in view is left in
`CLAUDE.md` as a pointer.

- **Category 7D/30D boards work now** (#41). `countAppDaysInRange` listed `category = ?` before `snapshot_at >= ?` while binding `[cutoff, category]`, so D1 filled the placeholders positionally and counted 0 days: every category week/month board was gated from `3fd59c3` (2026-06-22) until now. The clause moved after the window, matching `aggregateRange`; the file's other three dynamic category clauses were audited and are correct. Live: cli-agent 7D went 0 apps → 20 (7 of 7 days), 30D reads 30 of 30, 11 of 13 categories populate, the short two stay gated, the global board is unchanged. `test/category-history.test.mjs` pins it with a D1 stub that maps each `?` by position, mutation-tested five ways.

