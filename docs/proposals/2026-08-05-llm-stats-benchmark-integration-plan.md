# llm-stats.com review → benchmark integration plan

**Date**: 2026-08-05
**Status**: **Phases 0–2 BUILT** (see §3 for per-phase status). Phases 3–6 still proposed.
**Scope**: What llm-stats.com does, what of it is actually obtainable, and a phased plan
to put a quality axis next to token.app's price axis.

> **Sourcing outcome (supersedes §2's ranking).** The recommended primary path —
> hand-curating from vendor model cards — turned out to be far weaker than it looks:
> vendors publish benchmarks as **chart images**. Anthropic's Claude Opus 5 announcement
> says "more than doubles Opus 4.8" with no transcribable number, and its docs model
> table carries zero benchmark scores. Third-party aggregators contradict each other
> outright. **Epoch AI's `benchmarks.csv` (option C) became the spine instead**: live,
> machine-readable, CC BY, and *independently run* rather than self-reported. Confirmed
> with Epoch's own terms page. This is strictly better than what was planned.

---

## Part 1 — Scrapability review of llm-stats.com

The direct question was "what is scrapable from them". Answered below, with evidence.

### 1.1 Their live data is not legitimately obtainable

| Check | Result |
|---|---|
| `llm-stats.com/robots.txt` | `Allow: /` for pages, but **`Disallow: /api/`** |
| Page rendering | Next.js + turbopack, client-rendered (same class of problem as OpenRouter `/rankings`) |
| `/api`, `/docs` | 404 publicly |
| Commercial posture | `/methodology` advertises a **Data API + MCP offering** (docs.zeroeval.com) and paid custom benchmarking |

Their `/api/` is robots-disallowed and the same data is their paid product. Scraping the
rendered pages to rebuild their dataset would mean lifting a commercial dataset against
the site's own crawl policy. **Recommend against.** It is also fragile — we already learned
this twice with OpenRouter (`/rankings` going JS-rendered, the market-share `<button>`
assumption breaking extraction for two days).

### 1.2 Their open mirror is CC BY 4.0 — but it is dead

llm-stats open-sourced the underlying dataset. Both repos declare **Creative Commons
Attribution 4.0**, which explicitly permits commercial adaptation with attribution:

> Adapt — remix, transform, and build upon the material for any purpose, even commercially

| Repo | Stars | Newest commit touching data | Freshness |
|---|---|---|---|
| `AchilleasDrakou/LLMStats` (current) | 0 | **2025-02-02** | newest OpenAI = `o3`, newest Google = `gemini-2.0-flash` |
| `JonathanChavezTamales/llm-leaderboard` (predecessor) | 359 | **2025-10-22** | README says **DEPRECATED**, no further updates |

The live site shows GPT-5.6 Sol, Claude Opus 5, Gemini 3.6 Flash. The open mirror stops
~18 months short of that. Contributions were explicitly redirected off GitHub and into
llm-stats.com's own community section — i.e. the open dataset was deliberately wound down
as the commercial API came up.

**Verdict: the repo is a schema blueprint and a historical seed, not a feed.**

### 1.3 What IS worth taking from the repo

Their per-model schema is genuinely good and we should copy its *shape*:

```jsonc
"qualitative_metrics": [{
  "dataset_name":     "GPQA",          // required
  "score":            0.876,           // required, normalized 0–1
  "is_self_reported": true,            // required  ← the honest bit
  "analysis_method":  "0-shot CoT",    // required
  "date_recorded":    "2026-07-24",    // required
  "source_link":      "https://..."    // required  ← every number cites its origin
}]
```

`is_self_reported` and `source_link` being **required** is the whole discipline. It is the
same rule this project already runs on subscriptions (`lastVerified` stamps, the Dola
proof-of-absence, the Kimi-annual omission, the week/month history gate). Adopt it verbatim:
**no benchmark number renders without a source link and a self-reported flag.**

---

## Part 2 — Where the benchmark numbers actually come from

Since llm-stats is out, these are the real options. Ranked by fit.

### A. Vendor model cards and launch posts — **primary recommendation**

Anthropic, OpenAI, Google, DeepSeek, Alibaba et al. publish SWE-bench Verified, GPQA
Diamond, AIME, MMMU, Terminal-Bench numbers on release day, with a citable URL. These are
self-reported — flag them as such — but they are the *original* source that llm-stats,
Artificial Analysis and everyone else is themselves aggregating.

- Cost: manual, ~15 min per model launch.
- Fits the existing muscle: this is exactly the workflow already proven across three
  subscription backlog phases, and the Phase-4 automation proposal
  (`docs/proposals/2026-07-11-monthly-pricing-verify.md`) already contemplates a scheduled
  `claude -p` verifier that could cover benchmarks in the same pass.
- Coverage: only the ~40–60 models anyone actually compares, which is the right 40–60.

### B. Artificial Analysis Data API — best structured live option

- `robots.txt` is `Allow: /`; there is a documented Data API with a **free tier**.
- Free tier returns headline indices, median performance, and input/output pricing.
- Pro gates the full eval set, blended pricing, percentiles, context, params, modalities,
  license, and provider detail.
- **Attribution required** (visible byline/footer link). **Redistribution requires their
  Commercial License** — a public site republishing their numbers is redistribution, so
  this needs a licensing conversation before it ships, not after.

### C. Epoch AI Benchmarking Hub — strongest independent evals

Runs its own: FrontierMath, SWE-bench Verified, GPQA Diamond, SimpleQA Verified. These are
*independently run*, not self-reported, which is exactly the credibility gap vendor cards
have. `robots.txt` allows the site (blocks only `/assets/` and the FrontierMath problems).
**Licensing is not stated on the dashboard page — must be confirmed with Epoch before use.**

### D. Official per-benchmark leaderboards

SWE-bench, Aider polyglot, LiveCodeBench, ARC-AGI. Public, mostly GitHub/HF-hosted, each
with its own license. Narrow but authoritative, and good for the coding vertical
specifically.

### E. LMArena

Human-preference Elo. `robots.txt` returned a 301 that did not resolve — needs a separate
check before any use.

**Recommended mix**: (A) as the spine, hand-curated and git-versioned; (C) layered in for
independently-run scores once licensing is confirmed; (B) only if we take the commercial
licence. Attribute all three visibly.

---

## Part 3 — The build plan

### Design decisions taken up front

1. **No token.app composite score.** llm-stats has TrueSkill over a large eval corpus; we
   would not, and a homegrown index inherits their credibility problem without their depth.
   Show individual benchmarks with citations. If one number is ever needed, use an
   attributed third-party index, never an invented one.
2. **Benchmarks live in a git-versioned static file**, `src/benchmarks.ts`, exactly like
   `src/subscriptions.ts`. Slow-changing facts, reviewed in PR, no scraper to break. This is
   the pattern that has already worked here 28 subscriptions deep.
3. **The derived metric is ours, and it is about money.** llm-stats ranks by score.
   We rank by **score per dollar**. That is the whole differentiation.

### Phase 0 — data model and join keys (no UI) — ✅ BUILT

The real engineering risk is not the data, it is the join. OpenRouter slugs
(`anthropic/claude-sonnet-4.5`) do not match benchmark-table model names (`Claude Sonnet 4.5`),
and vendors rename constantly — the July drift pass already burned a full phase on this.

- `src/types.ts`: add `BenchmarkScore` (mirroring §1.3) and `ModelBenchmarks`.
- `src/benchmarks.ts`: keyed by **OpenRouter model id**, so the join is exact by construction
  rather than fuzzy-matched at render time.
- Seed ~40 models: everything currently on our rankings leaderboard plus the frontier set.
- Add a `tsc` + validation script asserting every score has a `source_link` and a
  `date_recorded`, run in the same pass as `verify.mjs`.

**Exit**: `/api/models` can optionally include benchmarks; nothing visible changes yet.

**As built** (`src/benchmarks.ts`, `src/types.ts`, `src/fetchers.ts`, `src/index.ts`):
- Hourly cron pulls Epoch's CSV, normalizes, writes `benchmarks:all` to KV. Non-fatal
  and empty-guarded — identical contract to task-spend, so a benchmark outage can
  neither block the models/rankings refresh nor overwrite good KV with an empty set.
- Hand-rolled RFC-4180 CSV reader: Epoch's export embeds newlines **and** commas inside
  quoted fields, so a naive `split('\n')` yields 6,541 fragments for 1,107 real records.
- `MODEL_MAP` is **explicit only**, no fuzzy matching. Epoch lists "Muse Spark"
  (2026-04-08) while our catalogue carries `meta/muse-spark-1.1` — a *different* model.
  A fuzzy matcher would staple one model's benchmarks onto another. Unmapped names are
  returned in the payload so the table extends in a data-only PR.
- **Live numbers**: 76 models mapped, 287 scores, 78 unmapped (legacy/dated variants).
  GPQA Diamond covers 70 models; SWE-bench Verified 27.
- Several effort variants exist per model ("Claude Opus 5 (max)"); we keep the best and
  record *which* variant produced it rather than silently averaging across configs.

### Phase 1 — price/quality Pareto chart ← the centrepiece — ✅ BUILT

A scatter plot: blended $/1M on a log X axis, benchmark score on Y, Pareto frontier drawn.
Everything above-and-left of the frontier is a bad deal, visibly.

This is the single chart that only token.app can credibly own — llm-stats has the quality
axis but treats price as a table column; we have the deepest price data on the web and would
be the only site framing benchmarks as *value for money*. It also slots into the existing
chart infrastructure (same client-side render pattern as the market-share series).

Ship alongside it a sortable **blended $/1M** column (llm-stats uses 8:1 and 3:1 input:output
ratios; pick one, state it in the header tooltip) — that column is free, we already have both
prices, and it fixes a real usability gap in today's two-column table.

**As built** (`src/template.ts`): log-x scatter, Pareto frontier drawn as a dashed step
line, dots coloured by provider, frontier models labelled (labelling all 70 is unreadable),
hover tooltip with price/score/stderr. Benchmark selector switches which eval drives both
the chart and the Quality column; only benchmarks with ≥5 scored models are offered, so a
sparsely-run eval can't present as an empty chart. Blended column uses **3:1 in:out**
(matching llm-stats' comparison pages), stated in the header tooltip.

Two decisions taken during the build:
- **The chart sits ABOVE the table.** Placed below, it renders ~28,000px down the page
  behind 338 rows — measured, not guessed.
- **Free models are excluded from the plot**, not accidentally dropped: `log(0)` has no
  home on the axis and "free" is a different value proposition. The Free filter still
  finds them, and the caption says models without a score aren't plotted.

### Phase 2 — quality columns and filters on the API Pricing tab — ◑ PARTIAL

Sortable benchmark columns, benchmark-filter chips alongside the existing
Text/Vision/Audio/Reasoning/Free/Open-Source chips. Cite the source in a per-cell tooltip;
render nothing where we have no verified number (never a dash that reads as zero — the
`[]`-is-truthy and fake-7D lessons apply).

**Built**: sortable Quality column with an inline score bar, and a per-cell tooltip
carrying benchmark · score · ±stderr · effort variant · run date · source · whether the
number is self-reported. Unscored models render a muted `—` with an explanatory title
rather than a zero. Derived fields (`blendedPer1M`, `quality`) hang off the model objects
so the existing `m[sortKey]` sort picks them up with no sort-path changes.

**Not built**: benchmark-filter chips ("only models scoring >90% GPQA"). Deferred —
the toggle already re-ranks the table, and chips are worth designing against real usage.

### Phase 3 — model detail pages `/model/{slug}` — ☐ NOT STARTED

We only have provider pages today. Each model page carries:
benchmarks with citations · price incl. cheapest host · context · modalities ·
**its OpenRouter usage rank + D1 sparkline** · **which subscriptions include it**
(`underlyingModels`, currently populated on 7 of 28 entries — worth backfilling).

The last two are things llm-stats structurally cannot show. These pages are also the
link targets Phase 4 needs.

### Phase 4 — compare pages

Copy their SEO mechanics wholesale: auto-generated verdict prose, "Choose X if…",
FAQ JSON-LD, dense related-comparison interlinking.

- `/compare/{model-a}-vs-{model-b}` — price, benchmarks, context, modalities, recency.
- `/compare/{sub-a}-vs-{sub-b}` — **the uncontested one.** "ChatGPT Plus vs Claude Pro",
  "Cursor vs GitHub Copilot" are enormous queries that nobody answers with structured,
  dated, verified data. We have 28 providers with tiers, annual, CN pricing and
  `lastVerified` stamps. llm-stats is API-only and cannot follow us here.

### Phase 5 — multi-provider price spread

Verified live and unauthenticated: `openrouter.ai/api/v1/models/{id}/endpoints` → 200.
For `meta-llama/llama-3.3-70b-instruct` it returns **13 hosts**:

```
DeepInfra   $0.100 in / $0.320 out   ctx 131072   fp8
Novita      $0.135 / $0.400          ctx   6000   bf16
Cloudflare  $0.293 / $2.253          ctx  24000   fp8
SambaNova   $0.450 / $0.900          ctx 131072   bf16
```

**4.5× price spread on one model, and some hosts silently serve a 6k context window
instead of 131k.** The payload also carries cache read/write pricing, quantization, uptime,
and long-context price overrides (Claude Sonnet 4.5 doubles above 200k prompt tokens).
llm-stats prints one "Best provider" line; this is a far better story and it is pure pricing.

Caveat: `latency_last_30m` / `throughput_last_30m` came back **null** on every probe, so
speed is not reliably available from this endpoint. Uptime is.

### Phase 6 — hero superlatives

Their hero strip (cheapest in top 10 / fastest / longest context / best open-weights) is a
cheap, high-payoff pattern. Ours becomes value-framed once Phase 1 lands: *best value at the
frontier · cheapest 1M-context model · biggest price drop this month · cheapest open-weights*.
All computable from data we already hold.

---

## Explicitly not doing

- **Scraping llm-stats.** Robots-disallowed API, commercial dataset, JS-rendered, fragile.
- **A token.app composite score.** Unverifiable without an eval corpus we don't have.
- **News feed** — maintenance sink.
- **Arenas / playground** — real inference cost, out of scope.

## Open questions

1. Artificial Analysis commercial licence — worth the cost, or stay on vendor-card sourcing?
2. Epoch AI data licence — unstated on the dashboard; needs a direct answer before use.
3. Blended-price ratio: 3:1 or 8:1 input:output? (llm-stats uses both in different places.)
4. Does the Phase-4 monthly pricing verifier absorb benchmark re-verification in the same run?
