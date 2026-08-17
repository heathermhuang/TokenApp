# Decision memo — open items 8, 10, 6

**Status: DECISION PENDING. Nothing here is implemented.** Written 2026-08-17 after
closing items 9, 3 and 4 (PR #29). Each section ends with the options as posed and a
recommendation; the call is the user's.

---

# Item 8 — thin / duplicate programmatic pages

## The premise needs correcting first

The site review recorded *"307 of 413 model pages have no benchmark; 71 `:batch`/`:free`
variants duplicate a base page."* Re-measured against the live catalogue today, the first
half holds and **the second half does not**.

| Measured 2026-08-17 | Count |
|---|---|
| Model pages total | **414** |
| …with ≥1 benchmark | 108 |
| …with **no** benchmark | **306 (74%)** |
| Variant ids (`:batch` / `:free` / `:thinking`) | 79 — 61 batch, 17 free, 1 thinking |
| …whose base id is also in the catalogue | 71 |
| …**with pricing different from their base** | **66** |
| …with pricing *identical* to base (true duplicates) | **5** |
| …**with no base page at all** | **8** |
| Variants that have a benchmark | **0** |

The decisive number is **66**. A `:batch` page is not a duplicate — it answers a different
question with a different number. Claude Opus 5 is `$5 / $25` per 1M; Opus 5 batch is
`$2.50 / $12.50`. Gemini 3.7 Flash is `0.375 / 1.875`; batch is `0.1875 / 0.9375`. Telling
a crawler those are the same page discards the only page on the site that answers "what
does Opus 5 cost on the Batch API" — a real, high-intent, low-competition query.

Only **5** variants are genuine duplicates, all OpenAI ids where batch price happens to
equal standard (`gpt-5.6-luna`, `-luna-pro`, `-terra-pro`, …).

And **8 variants have no base page**, so any blanket canonical-to-base rule points them at
a URL that does not exist: `openai/gpt-5-codex:batch`, plus 7 `:free` models
(`dots-studio/dots-3-note-preview`, `liquid/lfm-2.5-2.6b`, `cohere/north-mini-code`, and
4 NVIDIA Nemotron ids). For those, the variant page *is* the model's only page.

So item 8 is **two different problems** that happen to have been counted together:

- **A. 306 pages with no benchmark.** Thin-ish, but each carries unique data: its own
  prices, context length, modalities, provider, host endpoints, compare links, and FAQ
  answers built from its real numbers. These are not duplicates of anything.
- **B. 79 variant pages.** 5 true duplicates, 66 legitimately distinct SKUs, 8 that must
  be kept as-is.

## The three options as posed

### Enrich
Add content to thin pages. Worth asking what is actually available to add, because the
answer constrains this hard: benchmarks (Epoch has none for these — that *is* the
condition), usage history (**only 31 of 414** models have any D1 rows), subscription
mentions (only 9 of 28 subscriptions itemise models at all), endpoints (already rendered,
lazily), compare links (already rendered).

For a long-tail model there is no further *real* data to add. Enrichment at 306-page scale
therefore means generated prose — restating the price in sentences. That is precisely what
thin-content penalties target, so it risks making the problem worse while adding a
maintenance surface that must be regenerated as prices move.
**Verdict: not viable at scale.** Viable for a hand-picked head (the ~20 most-trafficked).

### Canonical-to-base
Correct for the **5** identical-price duplicates — cheap, too: `pages.ts:186` already emits
`<link rel="canonical">` and every page currently self-canonicalises, so this is a one-line
change to compute the target. Actively harmful for the **66** priced differently, and
impossible for the **8** orphans.
**Verdict: right tool, but for 5 pages, not 71.**

### Noindex
The question is *what* to noindex. Applied to the 306 no-benchmark pages it deindexes 74%
of the catalogue, including every legitimate "what does model X cost" page — the site's
core purpose. Applied to the 5 duplicates, canonical is strictly better (it consolidates
signal instead of discarding it).
**Verdict: no target where it beats the alternatives.**

## Recommendation — targeted fix, and measure before anything broad

1. **Canonical the 5 identical-price variants to their base.** One-line change, no
   downside, uses infrastructure already present.
2. **Leave the 66 distinct-price variants indexed.** They are the answer to a query
   nobody else answers. If anything they are *under*-served: consider making the batch
   discount explicit on the page ("50% of standard") — an enrichment that is real data,
   not padding.
3. **Leave the 8 orphans alone.** Note them in code so no future blanket rule catches them.
4. **Do nothing broad about the 306 until there is traffic data.** This is the honest
   part: we are currently deciding blind. Nobody has looked at Search Console, so we do
   not know whether these pages are ignored (harmless), indexed and converting (leave
   them), or indexed and dragging sitewide quality (act). One look reframes the decision,
   and it costs nothing.

**Cost:** step 1–3 ≈ 20 minutes. Step 4 is a login, not code.

---

# Item 10 — xAI → "SpaceXAI"

## Is the rename real?

Two independent sources, both checked today:

- **OpenRouter / our own catalogue** — all **6** `x-ai/*` models are now named
  `SpaceXAI: …` (verified by direct query, not inference).
- **x.ai itself** — the homepage `<title>` is literally `SpaceXAI` (the site 403s curl;
  read in a browser).

One caveat worth carrying: the page's own hero copy still reads "Grok" and "Frontier AI
models" with no SpaceXAI branding in the visible prose. The rename shows up in the title
and in OpenRouter's labels, so it looks **partial / in progress** rather than complete.

## Blast radius — all 11 touchpoints, and they are not the same kind of thing

The critical structural fact: **`providerId` is not ours to name.** It is derived from the
OpenRouter model-id prefix (`x-ai/grok-4.6` → `x-ai`). It is a foreign key, not a label.

### MUST NOT change — foreign keys into OpenRouter's namespace
| Where | What |
|---|---|
| `benchmarks.ts:151,155,156` | `MODEL_MAP` targets `x-ai/grok-4.5 / 4.20 / 4.6` |
| `fetchers.ts:37` | `'x-ai/grok-3': 11` |
| `subscriptions.ts:214` | `underlyingModels: ['x-ai/grok-4.6', 'x-ai/grok-4.5']` |
| `subscriptions.ts:209` | `providerId: 'x-ai'` — keys the `/logo/{slug}.svg` route, the `/x-ai` provider page, and the model→provider join |
| `providers.ts:68` | `'x-ai'` in the provider-page set — controls whether `/x-ai` exists |
| `build-provider-logos.mjs:60` | `'x-ai': 'xai'` slug→icon map (regenerates `logos.ts`) |
| `template.ts:2198,2239,3285,4456` | colour maps (light/dark) and two further keyed maps |

Renaming any of these breaks the logo route, the provider page URL, and the model-page
joins — exactly as the review predicted. There is no upside; users never see these strings.

### SHOULD change — display strings we own
| Where | Now | Proposed |
|---|---|---|
| `providers.ts:15` | `displayName: 'xAI'` | `'SpaceXAI'` |
| `subscriptions.ts:208` | `provider: 'xAI'` | `'SpaceXAI'` |
| `template.ts:4790` | hardcoded `xAI / Grok` pill label | `SpaceXAI / Grok` |

`providers.ts:15` is the single source for what users read as the provider name, so this is
a genuinely small change — three display strings, zero identifiers.

### Judgement call — the `/x-ai` URL
Keep it. It is in the sitemap, it is what inbound links point at, and the slug is
OpenRouter's namespace anyway. Optionally add a `/spacexai` → `/x-ai` redirect so the new
name resolves; that is additive and breaks nothing.

## Recommendation

Change the **three display strings only**; touch no identifier, no route, no map key.
Because the rebrand looks partial, a defensible softer variant is
`displayName: 'SpaceXAI (xAI)'` for a transition period — it keeps the familiar name
findable for users who have never heard "SpaceXAI". My preference is the plain
`'SpaceXAI'`, matching what both sources now publish, with the parenthetical held in
reserve if it reads as confusing.

**Cost:** ~10 minutes plus a deploy. Low risk, fully reversible.

---

# Item 6 — Phase-4 pricing automation, re-costed

The proposal (`2026-07-11-monthly-pricing-verify.md`) recommends **Option B**: a local
monthly `claude -p` run behind launchd, producing a branch + findings report, no deploy.
Build estimate "1 short session". It has sat unapproved for 37 days. Re-costed below
against what the 08-17 pass actually cost and actually hit.

## What the evidence now says

**In favour, and stronger than in July:**

- The pass cost **~2 hours of browser work for 19 of 28 entries** and produced 7 real price
  corrections plus a missing tier (Copilot Max) and a missing plan (Cursor Teams Premium).
  That decays again in about a month. The recurring cost is real and the proposal's core
  claim — this is a routine, not a project — holds.
- The proposal's architectural call was **right**, and today's session confirms it
  independently. Option A (cloud, fetch-only) was rejected because Cloudflare-gated sites
  block cloud IPs. Today: `perplexity.ai/pro` returned **403 to both curl and WebFetch**
  and needed a real browser; `x.ai` returned **403 to curl**; `meta.ai` returned **403** (a
  data point the proposal did not have). Fetch-only verification would have failed on
  precisely the pages that carried the corrections.
- Several of the actual corrections came from browser-only pages — Cursor's annual matrix
  (hidden behind a viewport bug *and* duplicate mobile radios), Perplexity's annual prices,
  Grok's tier structure. A local browser run is the only shape that reaches them.

**Against, and this is the part that changed:**

- **The single highest-value find of today's pass could not have been automated.** Item 9
  had been recorded as UNVERIFIABLE: GitHub publishes no annual price. The answer came from
  noticing a *docs sidebar link* titled "Model multipliers for annual plans (legacy)",
  following it, and reasoning about what "legacy" implies for a price we display. A routine
  that asks "does the pricing page state an annual price?" returns UNVERIFIABLE — correctly,
  forever. Automation would have re-confirmed the wrong conclusion every month.
- Same shape in #28: Perplexity's stale tier `features[]` was caught by **Codex reasoning**,
  not by the page grep, because a grep only finds names you already suspect.
- The 9 entries that defeat verification defeat it for reasons automation cannot fix:
  SGD geolocation (ChatGPT USD not obtainable), a **dead** pricing URL (Kimi redirects to
  root), an **auth wall** (Hailuo), prices that are genuinely unpublished (Copilot annual,
  Mistral annual), and free-tier-only entries with no number to drift.
- Two active misread traps needing judgement, not scraping: Kling's "$6.99" is a
  first-month promo on the *monthly* plan, not the annual price; Manus renders prices as
  animated digit rollers that read "$209" for a tier priced $167.

## Verdict — yes, but build a third of it

Build a **drift detector, not a verifier**. The proposal's full Option B tries to automate
both halves of the job; only one half is automatable, and it is the cheaper half.

- **In scope:** for the subset a plain fetch can read (GitHub docs, z.ai, kimi.com titles,
  ElevenLabs, Runway, Replit, Suno, Midjourney, Lovable, Windsurf — most of the catalogue),
  compare published numbers against `src/subscriptions.ts` and **open an issue when they
  differ**. No branch, no patch, no `lastVerified` bump, no judgement.
- **Out of scope:** deciding anything. It must never edit a price. Every hit becomes a
  human browser check — which is where the value was today anyway.
- **Why this split:** the timeliness value is in *knowing something moved*, which is
  automatable and cheap. The correctness value is in *deciding what it moved to*, which is
  where every bug in this file's history came from. Automating the second half would
  manufacture confident wrong numbers — the failure mode CLAUDE.md is mostly a list of.

Estimated build: well under the proposal's "1 short session", since the report/patch/branch
machinery and the guardrail prompt all drop out. Keep the manual browser pass, but let the
detector tell you *when* to run it instead of running it on a calendar.

If you would rather not build even that: the fallback is unchanged and cheap — the
`lastVerified` footer already makes staleness visible to users, so doing nothing is honest,
just slower to notice movement.
