# Rankings Spike Findings — Categories & Market Share

- **Date:** 2026-06-22
- **Status:** Complete — **GO** on both sources
- **Branch:** `feature/rankings-time-series`
- **Phase:** B / Task B1 (feasibility spike — investigation only, no production code)
- **Feeds:** Plan 2 (`docs/superpowers/plans/2026-06-22-rankings-categories-marketshare.md`)
- **Parent spec/plan:** `2026-06-22-rankings-time-series-and-categories-design.md`, `2026-06-22-rankings-time-series.md`

## TL;DR — Go/No-Go per source

| Source | Verdict | Cleanest extraction | Pages / day | Fragility |
|--------|---------|---------------------|-------------|-----------|
| **Category list (enumeration)** | ✅ GO | `curl https://openrouter.ai/sitemap.xml` → grep `/apps/category/{group}/{slug}` (no JS, no browser) | 0 browser pages | Very low |
| **Category app boards** | ✅ GO | Browser-render each leaf page; reuse existing apps extractor (ranked list + breadcrumb `<h1>`) | 15 | Low (same DOM family the current scraper already handles) |
| **Market share by author** | ✅ GO | Browser-render `/rankings`, extract the `#market-share` legend (`<button>` rows: author link + token total + share %) | 0 extra (piggyback on existing hourly `/rankings` render) | Low |

**Net:** daily scrape = **~15 browser page loads in one reused puppeteer session, ≈2–3 min of Browser Rendering time**. Affordable at daily cadence; no hard cap needed (15 is small and fixed; a soft cap of 20 is a cheap safety net). Both new sources extract from rendered DOM via the **same proven pattern** as `fetchRankingsFromOpenRouter` — no new infrastructure.

How this was investigated: raw `curl` of `/apps`, `/rankings`, `/data`, `/sitemap.xml` (to prove what is/isn't in the static payload), then a live Chrome session (network capture + DOM inspection) on `/rankings`, `/apps`, and four category pages. WebFetch is useless here (JS-rendered turbopack app) — confirmed.

---

## Q1 — Category URLs (enumeration + labels)

### Enumeration method: the sitemap (no browser needed)

`https://openrouter.ai/sitemap.xml` (HTTP 200, ~694 KB, plain XML) lists **every** category page as a static `<loc>`. Grepping it:

```
grep -oE '/apps/category/[a-z0-9-]+(/[a-z0-9-]+)?' sitemap.xml | sort -u
```

…returns the complete, authoritative set: **4 group pages + 15 leaf categories**. This is the source of truth for Phase C enumeration — cheap, JS-free, and self-updating when OpenRouter adds categories.

> ⚠️ **Do NOT enumerate from the on-page category "chips."** The chip row on each group page is a *subset* (coding shows 4 of its 5 leaves; productivity shows 3 of its 4 — low-volume leaves like `native-app-builder` and `legal` are omitted from chips). The sitemap is complete; the chips are not.

### URL pattern (confirmed)

- Group: `https://openrouter.ai/apps/category/{group}`
- Leaf: `https://openrouter.ai/apps/category/{group}/{slug}` (confirmed example: `entertainment/roleplay`)

### Groups (4)

| group slug | display label | URL |
|------------|---------------|-----|
| `coding` | Coding Agents | `/apps/category/coding` |
| `creative` | Creative | `/apps/category/creative` |
| `entertainment` | Entertainment | `/apps/category/entertainment` |
| `productivity` | Productivity | `/apps/category/productivity` |

### Leaf categories (15)

| group | slug | display label | URL |
|-------|------|---------------|-----|
| coding | `cli-agent` | CLI Agents | `/apps/category/coding/cli-agent` |
| coding | `cloud-agent` | Cloud Agents | `/apps/category/coding/cloud-agent` |
| coding | `ide-extension` | IDE Extensions | `/apps/category/coding/ide-extension` |
| coding | `native-app-builder` | Native App Builders | `/apps/category/coding/native-app-builder` |
| coding | `programming-app` | Programming App | `/apps/category/coding/programming-app` |
| creative | `audio-gen` | Audio Generation † | `/apps/category/creative/audio-gen` |
| creative | `creative-writing` | Creative Writing † | `/apps/category/creative/creative-writing` |
| creative | `image-gen` | Image Generation † | `/apps/category/creative/image-gen` |
| creative | `video-gen` | Video Generation | `/apps/category/creative/video-gen` |
| entertainment | `game` | Game | `/apps/category/entertainment/game` |
| entertainment | `roleplay` | Roleplay | `/apps/category/entertainment/roleplay` |
| productivity | `general-chat` | General Chat | `/apps/category/productivity/general-chat` |
| productivity | `legal` | Legal † | `/apps/category/productivity/legal` |
| productivity | `personal-agent` | Personal Agents | `/apps/category/productivity/personal-agent` |
| productivity | `writing-assistant` | Writing Assistants | `/apps/category/productivity/writing-assistant` |

**Labels:** 11 of 15 directly observed (breadcrumbs, inline app category tags on `/apps`, and group-page chips). The 4 marked **†** (`audio-gen`, `creative-writing`, `image-gen`, `legal`) are inferred from the slug + OpenRouter's naming convention — the creative group page didn't surface their chips and I didn't open all four leaf pages. **This does not block Phase C:** the scraper reads the live label from each leaf page anyway — see below — so hard-coded labels are only a fallback/seed.

### Category-page DOM (the scrape target)

Each leaf page (`/apps/category/entertainment/roleplay` verified) renders, after hydration:

- `<h1>` = **"{Label} Rankings"** → strip `" Rankings"` to get the canonical display label live.
- Breadcrumb **"Apps › {Group} [› {Leaf}]"** → group + leaf labels live.
- A per-category stacked usage chart (ignore for app boards), a **Tokens / Requests** toggle, and a **"Today"** period selector.
- A **ranked app list** identical in shape to the global Top Apps board: `N.` rank, title, description, `<tokens> tokens` (e.g. `Janitor AI … 34.5B tokens`, `SillyTavern … 10.1B tokens`).

**Extraction:** reuse the existing apps extractor (`RANKINGS_EXTRACTOR_SOURCE`'s Top-Apps branch) scoped to the category page; store rows as `kind='app'`, `period='day'`, `category={slug}` (the new column from migration `0002`). Read the label from `<h1>`.

---

## Q2 — Market-share data source

### Where it lives (and where it does NOT)

| Probe | Result |
|-------|--------|
| `https://openrouter.ai/data` | **Editorial prose**, not a dataset. Describes how "OpenRouter-derived market share statistics" are used by third parties. No JSON/CSV download, no structured table. **Not a usable source.** |
| `/rankings` **static HTML** (curl) | The `#market-share` section exists but is an unresolved React **Suspense boundary** (`<!--$?--><template id="B:3">`, fallback `data-testid="rankings-skeleton-chart"`). **Zero** author names, share values, or time-series in the 1.34 MB payload. Data is **not** server-rendered. |
| Public REST / tRPC API | None found. Only `/api/reference` (docs) is referenced in the bundle. No clean JSON endpoint for author share. |
| `/rankings` **runtime network** (Chrome capture) | The data arrives via **`POST https://openrouter.ai/rankings`** — a **Next.js Server Action** returning an RSC flight payload (the same mechanism that hydrates the leaderboard). Not replayable cleanly: requires a `Next-Action: <hash>` header whose hash changes per deploy, and the response is RSC flight format, not JSON. |

**Conclusion:** there is **no structured/downloadable source**. The author-share data is only reachable by rendering `/rankings` and reading the hydrated DOM — exactly the constraint the existing scraper already lives with.

### The extractable shape (rendered DOM)

After hydration, `#market-share` renders a stacked area/bar chart (OpenRouter's own ~1-year weekly history: x-axis `23 Jun 2025` → `8 Jun 2026`) **plus a ranked legend that is plain DOM text** — this is the clean extraction target. Observed legend (2026-06-22):

| # | author | tokens | share |
|---|--------|--------|-------|
| 1 | anthropic | 148B | 18.0% |
| 2 | deepseek | 119B | 14.4% |
| 3 | tencent | 79.4B | 9.6% |
| 4 | minimax | 79.4B | 9.6% |
| 5 | xiaomi | 78.1B | 9.5% |
| 6 | google | 64.7B | 7.9% |
| 7 | openai | 60.2B | 7.3% |
| 8 | openrouter | 58.6B | 7.1% |
| 9 | z-ai | 37.1B | 4.5% |
| 10 | **Others** | 100B | 12.1% |

### Exact selector + per-row structure

Each legend row is a `<button>` (verified via accessibility tree):

```
button "anthropic"
 ├─ a   "anthropic"  href="/anthropic"     ← canonical author slug (strip leading "/")
 ├─ span "148B"                            ← token total  → parseTokens()
 └─ span "18.0%"                           ← share percent → parseFloat
```

- **Selector:** within `#market-share`, the legend rows. Robust recipe (mirrors the existing model-row approach): `document.querySelector('#market-share')` → collect descendant `a[href^="/"]` whose row also contains a `…%` cell. Author = `href.replace(/^\//,'')`; tokens = `parseTokens(<token cell>)`; share = `parseFloat(<percent cell>)`.
- **The `Others` row has no author `href`** (it's an aggregate) — store it as `author='Others'` or skip; it's needed to make the stacked-area sum to ~100%.
- Per snapshot: **9 named authors + `Others`** (10 rows).

### Recommended extraction + storage

1. **Do not parse the SVG.** The chart's historical series is in SVG bar geometry (fragile, pixel-reverse-engineering). Parse the **legend text** instead.
2. **Accumulate our own series** (consistent with how we already handle rankings + the honesty-gating discipline): scrape the legend once/day → one `market_share_snapshots` row per author per day (`author`, `token_total`, `share_pct`, `snapshot_at`, `snapshot_day`, `period`). Our stacked-area chart is built from accumulated snapshots, history-gated like the apps board.
3. **Piggyback on the existing hourly `/rankings` render** — add a market-share branch to `RANKINGS_EXTRACTOR_SOURCE` and persist it under a once-per-day guard. This costs **zero extra page loads** (the hourly scrape already renders `/rankings`).
4. **Note on window semantics:** the legend's token magnitudes (e.g. anthropic 148B) are much smaller than the weekly model board (anthropic ~5.7T/wk), so the legend reflects a shorter/default window, not the weekly total. `share_pct` is internally self-consistent per snapshot regardless — store values as-scraped, stamped with our own `snapshot_at`, and treat `share_pct` as the primary field. Confirm exact window semantics at implementation if we ever display absolute tokens.
5. **Optional, low priority:** backfill OpenRouter's historical series from the SVG on first run. Fragile and not required (we build our own history). Recommend **skip** for v1.

---

## Q3 — Cost (Browser Rendering)

### Page budget (one reused puppeteer session/day)

| Work | Pages |
|------|-------|
| Market share | **0 extra** (extracted during the existing hourly `/rankings` render) |
| Category app boards | **15** (one per leaf category) |
| **Total new page loads/day** | **15** |

If market share is instead scraped in the daily job rather than piggybacked, it's `/rankings` + 15 = **16** — still trivial.

### Time estimate

Observed render-to-content in the live Chrome session was **~5–6 s/page** (full content present in every screenshot after a 5–6 s wait). The production binding uses `waitUntil:'networkidle0'` + `waitForSelector` (+1.5 s scroll settle), so budget a conservative **~8–12 s/page**.

- 15 pages × ~10 s ≈ **~2.5 min** of Browser Rendering time/day, plus one ~1–2 s session launch.
- Comfortably under any single-invocation limit; the daily job is a **marginal** addition on top of the ~24 hourly `/rankings` renders already running.

> The seconds-per-page figure is from Chrome, not the Cloudflare binding — order-of-magnitude only. Phase C should `console.time` the first real run and log total session duration to confirm.

### Does N need a cap?

**No hard cap required.** 15 is small and fixed; the set only grows when OpenRouter adds categories (rare, and surfaced by the sitemap diff). Recommend a **soft cap of 20** leaf categories + a per-page timeout so a UI change can't make the daily job run unbounded. Sequential loads in one session stay well within Browser Rendering concurrency limits (we never launch >1 browser).

---

## Recommended extraction method — summary

| Source | Method | Cadence | Selector / endpoint | Storage |
|--------|--------|---------|---------------------|---------|
| Category enumeration | `curl` sitemap.xml + regex | daily (or on deploy) | `loc` matching `/apps/category/{g}/{s}` | seed/refresh category list |
| Category app boards | puppeteer render + apps extractor | daily, once-per-day guard | `<h1>` label + ranked app list per leaf URL | `rankings_snapshots` rows, `kind='app'`, `period='day'`, `category={slug}` |
| Market share | puppeteer render + legend DOM walk | daily, piggyback on hourly `/rankings` | `#market-share` → `<button>`(`a[href^="/"]` + token cell + `%` cell) | `market_share_snapshots` (author, token_total, share_pct) |

## Decisions this unblocks for Plan 2 (Phases C–D)

1. **Enumerate categories from the sitemap**, not the page chips (chips are incomplete). Optionally hard-code the 15-row table above as a seed; reconcile against the sitemap on each run.
2. **Migration `0002`** as specced: `rankings_snapshots.category TEXT` + index `(kind, category, snapshot_at DESC)`; new `market_share_snapshots(id, snapshot_at, snapshot_day, author, token_total, share_pct, period)` + indexes.
3. **One daily scrape job**, once-per-day guard **inside** the existing `scheduled` handler (NOT a new cron — `wrangler.toml` is gitignored). One reused puppeteer session: market-share legend (or piggyback on hourly) + 15 category pages.
4. **Per-section empty-overwrite guards** mirroring `refreshAllData`: a category that scrapes 0 apps, or a market-share scrape of 0 authors, must not overwrite good D1 data; surface via `rankingsError`.
5. **Reuse the proven DOM patterns** — both new extractors are the same `querySelector` + `parseTokens` family as today's scraper; no new deps, no SVG parsing, no server-action replay.
6. **History-gate the new UI** (stacked-area market-share chart + category tabs) exactly like the apps board (`emptyAppsMessage` / `appsHistoryDays`), since both build series from accumulated daily snapshots.

## Appendix — what was actually checked

- `curl` (raw, no JS): `/apps`, `/rankings`, `/data`, `/sitemap.xml`. Confirmed category links + market-share series are **absent** from static HTML; sitemap **has** the full category set.
- Chrome (rendered + network): `/rankings` (network capture → server-action POST; `#market-share` legend DOM via accessibility tree), `/apps` (group sections + inline category tags), `/apps/category/entertainment/roleplay` (leaf board + breadcrumb), `/apps/category/coding`, `/creative`, `/productivity` (group breadcrumbs + chips).
- Existing scraper reviewed: `src/fetchers.ts` `fetchRankingsFromOpenRouter` + `RANKINGS_EXTRACTOR_SOURCE` (`:194–388`) — the new extractors slot into the same session/pattern.
