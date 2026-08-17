# Open items 9, 3, 4 — follow-up pass, 2026-08-17

Second pass on the same day as `2026-08-17-subscription-reverification.md`. That
document closed site-review items 1 and 2; this one closes **9** (Copilot annual),
extends **3** (`underlyingModels`) and **4** (`MODEL_MAP`).

Same posture throughout: a figure that cannot be sourced is not changed, and the
proof of absence is recorded instead of guessed.

---

## Item 9 — Copilot annual: CLOSED, and it turned out to be sourceable after all

The previous pass left `annualMonthlyPrice` 8.33 (Pro) / 32.5 (Pro+) as **"unsourced
but left unchanged"**, reasoning that absence from a marketing page is not proof
annual billing does not exist in the billing UI. That reasoning was sound but it
stopped one link too early. GitHub's own docs settle it.

The tell was in the docs sidebar the previous pass had already fetched: a page titled
**"Model multipliers for annual plans (legacy)"**. Following it:

> "On June 1, 2026, GitHub moved to usage-based billing. The model multipliers in this
> article apply only to Copilot Pro and Copilot Pro+ subscribers on an existing annual
> plan who remained on the legacy premium request-based billing model after June 1, 2026."

> "Users on legacy annual Copilot plans will not receive access to new models and features."

And from `.../request-based-billing-legacy/what-changed-with-billing`:

> "When your annual plan ends, you'll be automatically downgraded to Copilot Free."

> "Upgrade to a monthly paid plan and receive prorated credits for the remaining value
> of the annual plan."

So annual Copilot plans are **closed to new subscribers**, are described only in the
legacy/past tense, do not renew, and are actively degraded (no new models). Meanwhile
`docs.github.com/en/copilot/concepts/billing/individual-plans` publishes a table headed
**"Price per month"** — Pro $10, Pro+ $39, Max $100 — with **no annual column at all**,
and Business is "$19 USD per user per month (billed monthly)".

**Changed**: Pro `annualMonthlyPrice` 8.33 → **10**, Pro+ 32.5 → **39**. Max, Business
and Enterprise already equalled their monthly price.

This is not the "set them equal as a fallback" outcome — it is a *sourced* claim. There
is no annual commitment a new subscriber can buy, therefore there is no annual discount,
therefore annual equals monthly. The old 8.33/32.5 asserted a discount that is
unobtainable, which is worse than a missing number.

Prices otherwise re-confirmed against the docs table today ($10 / $39 / $100), so the
existing `lastVerified: 2026-08-17` stamp remains honest.

---

## Item 3 — `underlyingModels`: 7/28 → 9/28

### What claim this field actually makes

Settled before adding anything, because it decides what is admissible.
`underlyingModels` is consumed in exactly two places, both in `src/pages.ts`:

- model page panel — title **"Subscriptions that include {model}"**, subtitle
  **"Consumer plans whose published model list names this model"**;
- compare-page FAQ — *"What models power A and B?"*, falling back to
  **"not publicly itemised"**.

So the assertion is *"this plan's own published list names this model"* — routes-to,
sourced from the vendor. Not "models this vendor makes". The `not publicly itemised`
fallback means **omitting is a supported, honest state**, which is what makes it correct
to leave 19 entries empty rather than fill them from inference.

### Added

**perplexity** — `perplexity.ai/pro` renders six model cards, each with its own
descriptor. Read live today (the page 403s curl and WebFetch; rendered in a browser):

| Page says | Descriptor on the card | Mapped to |
|---|---|---|
| Sonar 2 | "Perplexity's latest in-house model" | **nothing — see below** |
| GPT-5.6 Terra | "OpenAI's versatile model" | `openai/gpt-5.6-terra` |
| Gemini 3.7 Flash | *New* · "Google's latest model" | `google/gemini-3.7-flash` |
| Claude Sonnet 5 | "Anthropic's fast model" | `anthropic/claude-sonnet-5` |
| Kimi K3 | "Moonshot AI's latest model" | `moonshotai/kimi-k3` |
| GLM 5.2 | "Z.ai's most advanced model" | `z-ai/glm-5.2` |

**kimi** — `['moonshotai/kimi-k3']`. Source: `kimi.com` titles itself *"Kimi AI with
K3"*. The entry's description already carried that claim in prose, so this is the
structured form of a claim already made and sourced, not a new one. Per-tier `features[]`
still read K2.6 and are left alone: the pricing page redirects to root, so which tier
gets which model is unsourceable.

### The trap inverted — read this before trusting the previous doc's note

The previous doc and the session brief both warn that **Gemini 3.7 Flash is not in our
catalogue** and must stay a display string. **That is no longer true.**
`google/gemini-3.7-flash` ("Google: Gemini 3.7 Flash") is in the live catalogue with
`createdAt` **2026-08-13** — four days old when checked. The note was accurate when
written and went stale almost immediately, which is the standing hazard with live
catalogue data.

The trap did not disappear, it **moved**: the unmappable name on that page is now
**"Sonar 2"**. The catalogue carries `sonar`, `sonar-pro`, `sonar-reasoning-pro`,
`sonar-pro-search` and `sonar-deep-research` — and no "Sonar 2". Pointing Sonar 2 at any
of them is precisely the fuzzy match the `MODEL_MAP` rule forbids, so it stays a display
string. The rule that held here was the process one — *check every id against the live
catalogue* — not the specific instance recorded last time.

### Considered and deliberately NOT added

Recorded so the next pass does not redo the analysis:

| Entry | Why not |
|---|---|
| **zhipu-ai** | The rendered `z.ai/subscribe` tiers say only "Rolling / Priority / First access to the latest flagship models" — **no per-plan model list**. The GLM-5.3/5.2/5-Turbo enumeration exists only in `<title>` and `<meta keywords>`, and the keywords tag is SEO stuffing (it also lists 4.6V, 5.1, 5, 4.7). Worse, the page *headlines* **GLM-5.3**, which is **not in the catalogue** — so the mappable subset would omit the plan's flagship and assert two lesser models. Over-claiming from an SEO tag. |
| **mistral-lechat** | The model names on the Vibe page come from Mistral's **site-wide nav** ("Latest models: Mistral OCR 4, Mistral Medium 3.5, Mistral Small 4, Voxtral TTS"), not a Vibe model list. "Mistral Small 4" and "OCR 4" are not in the catalogue; "Voxtral TTS" ≠ `voxtral-small-24b-2507`. The tiers say "All models incl. Mistral Large", and Large has three candidate ids (`-2407`, `-2512`, moving alias) the page does not disambiguate. |
| **meta-ai** | `meta/muse-spark-1.1` **does** exist and matches the entry's stated model exactly — but `meta/muse-spark-1.2` also exists (2026-08-05, newer) and `meta.ai` returns 403, so the version cannot be confirmed. Promoting an unverifiable version claim from prose into a structured join is the opposite of the "drop, don't swap" rule applied in #28. |
| **hailuo-ai** | Our entry says "MiniMax H3". The catalogue has **no** model named H3; `minimax/minimax-m3` is "MiniMax **M**3" — an H-vs-M near miss, and text-LLM vs video product besides. Same class as `ai2`/`ai21`. |
| **ernie-bot** | Claims ERNIE 5.1; catalogue's only Baidu entry is `baidu/ernie-4.5-vl-424b-a47b`. |
| **doubao** | Claims Doubao Seed 2.1; catalogue's only ByteDance entry is `bytedance/ui-tars-1.5-7b`. |
| **github-copilot** | GitHub *does* publish a supported-models reference, but it is long, changes fast, and is gated per plan, while `underlyingModels` is per-subscription. Asserting ~20 ids at the wrong tier is a real correctness risk for modest gain. Deliberately deferred, not overlooked. |
| **cursor, windsurf, replit, lovable, v0** | Same shape as Copilot: they route to large third-party model menus that shift frequently. Worth a deliberate pass of its own — it would also thicken the model pages that open item 8 is about — but not worth 20 assertions that rot in a month. |
| media entries (midjourney, suno, elevenlabs, kling, runway) | Their models are image/video/audio and are not in an OpenRouter text-model catalogue. |

**Verification**: all 24 ids across all 9 entries were checked against the live
`/api/models` (414 ids) — 0 missing. `tsc --noEmit` clean.

---

## Item 4 — `MODEL_MAP`: 106 → 108 models, 63 → 61 unmapped, ambiguous stays 0

Every one of the 63 unmapped Epoch names was put through the same three checks the file
already demands: distinct `id_model_version` bases, Epoch's **Version release date**
against the catalogue's `createdAt`, and an explicit candidate in the catalogue.

The honest headline: **the unmapped list is dominated by models OpenRouter no longer
lists** — Claude 2/2.1/3 Opus/3.5/3.7, GPT-4 (Mar/Jun 2023), GPT-4.5, o1-mini,
o1-preview, Gemini 1.0–2.0, Grok 2/3, Llama 2 and 3, Mixtral 8x7B, Mistral 7B, the
Qwen1.5/2 line, Yi, DBRX, phi-3, Tulu 3. There is nothing to join those to, and no
amount of mapping effort changes that. Only two names were genuinely mappable.

### Added

- **`'Gemini 3.7 Flash': 'google/gemini-3.7-flash'`** — Epoch date **2026-08-13**,
  catalogue `createdAt` **2026-08-13**. Same date, single base (`gemini-3.7-flash_high`,
  one base once `EFFORT_SUFFIX` strips `_high`), 7 Epoch rows. Unambiguous.
- **`'Inkling-Small': 'thinkingmachines/inkling-small'`** — the interesting one. Epoch
  dates **both** `Inkling` and `Inkling-Small` at 2026-07-15, i.e. a *family* date, not a
  per-version one, so the 15-day gap to our 2026-07-30 listing cannot discriminate in
  either direction. What carries the mapping is that there is exactly **one** candidate
  per side: one Epoch name (single base after `_xhigh`) and one catalogue entry named
  "Inkling Small" — no preview, no second size. This is now the loosest date match in the
  map and is flagged in-file as the first to re-judge if a second release appears.

Both yield 5 of the 6 surfaced benchmarks (no SWE-bench row), with `variant` recording
the effort tier and `versions[]` recording the raw contributing id.

### New rejections recorded in-file

- **`GPT-5.5 Instant`** (Epoch 2026-05-05, base `gpt-5.5-instant`) — the sharpest case.
  There is no `openai/gpt-5.5-instant` in the catalogue, and the tempting target
  `openai/gpt-5.5` is **already mapped from `'GPT-5.5'`**. Two Epoch names on one id is
  not a near miss but a collision, and `best` would keep whichever score was higher per
  benchmark: the chimera bug.
- **`Gemma 2 9B`** — catalogue has only `gemma-2-27b-it`. 27B ≠ 9B.
- **`Gemini 3 Pro`** — re-checked: the catalogue carries **only** the image variants
  (`gemini-3-pro-image`, `-image-preview`). No plain entry exists to map to.

### Consequence checked, not assumed

Gemini 3.7 Flash enters GPQA Diamond at **94.82% ±1.35 — nominal #1**. Separation from
#2 (`gpt-5.4-pro`, 94.60% ±1.60) is **0.11σ**, so `leadingBenchmark()` correctly omits
the card instead of announcing a "#1". The whole top six sit in 93.88–94.82%. This is the
saturation the 2σ gate exists for, behaving as designed — verified rather than presumed.

Scores were spot-checked against the raw CSV to rule out a parse offset. Note that Epoch
genuinely publishes **Inkling-Small ahead of Inkling on FrontierMath** (0.463 vs 0.333 on
T1–3; 0.171 vs 0.049 on T4) while far behind on SimpleQA (0.195 vs 0.402). Counter-
intuitive for a "Small", but it is a coherent reasoning-tuned-small profile, it is
Epoch's own finding, and the mapping direction is confirmed by `versions[]`.

### Incidental fix in the same file

`src/benchmarks.ts` contained a **raw NUL byte (0x00)** at offset 26544 (line 515),
used deliberately as the separator in the composite `best` key joining model id to Epoch
task id — but written as a literal control character instead of the escape sequence
`\u0000`. Runtime behaviour was correct either way and still is; the cost was that one
unprintable byte made the whole file **binary to every text tool**.
`grep -n MODEL_MAP src/benchmarks.ts` returned *nothing at all* — no match, no
"binary file matches" notice, exit code 0 — which is how a source file silently stops
being greppable. Replaced with the `\u0000` escape; `file` now reports UTF-8 text and grep
works. Fixed here because it actively obstructed this task, and the behaviour it touches is
pinned by `npm test`.

---

---

## Codex round 1 — one P2, and it found a real bug in a place nobody was looking

Codex raised: *"Represent unavailable annual billing as `null`, not the monthly price.
GitHub's evidence establishes that new annual plans are unavailable; it does not establish
an annual price of $10/$39… Equalizing replaces an obsolete discount with a different
unsupported claim."*

The **observation is right and the remedy is wrong**, and separating those two mattered.

Why the remedy was rejected — the file already has two conventions and they mean different
things. Measured, not assumed:

| Shape | Count | Means |
|---|---|---|
| `annual == monthly` | **59** of 123 tier pairs | a price exists, there is **no annual discount** |
| `annual == null` | 14 | **no price published at all** — every single one also has `monthlyPrice: null` (Enterprise / contact-sales) |

There is **no** precedent for "monthly published, annual `null`". Adopting it would invent
a third convention meaning "annual price unknown", when what we actually know is stronger
and more specific: there is no annual plan to price. It would also make the Copilot entry
internally inconsistent — Business ($19) and Enterprise ($39) are "billed monthly" by the
same GitHub docs and already carry equal values, as does Max ($100), so only Pro and Pro+
would have been nulled for a fact all six tiers share.

But Codex was right that something was broken, and it was **not** the data. The two
renderers disagreed:

- `template.ts:3149` (main site) — shows the annual line only when
  `annualMonthlyPrice < monthlyPrice`. Equal values correctly render **nothing**.
- `pages.ts:650` (compare pages) — printed `fmtUsd(annual)` whenever it was non-null, so
  an equal figure appeared under a column headed **"Annual /mo"**, asserting a purchasable
  annual rate.

That misread **all 59** equal-value tiers across every subscription, not just Copilot.
Changing Copilot's data to dodge it would have papered over a display bug affecting 58
other tiers. Fixed at the renderer instead: `hasAnnualDiscount()` in `pages.ts` now applies
the same "must beat monthly" test the main page has always used.

Result, measured against the real data: 50 tiers still show a genuine annual figure and 73
render "—". Every Copilot tier now shows "—" (uniform, and true — GitHub bills all six
monthly), while Cursor's real 20% discounts are untouched ($16 / $48 / $160 / $32 / $96).

## Codex round 2 — reviewed the FIX commit, found two more

Round 2 was run against the fix commit specifically, not the opening diff. It is where
#28's real P2 appeared last time, and it earned its keep again.

### P2 — the predicate was wrong for a shape the types allow (FIXED)

`{monthlyPrice: null, annualMonthlyPrice: 10}` made `null ?? Infinity` yield
`10 < Infinity` → **true**, which would render a row whose monthly cell reads "—" and
whose annual cell reads "$10". Inherited straight from the main page's inline check,
which I had copied on purpose for parity.

No entry is shaped that way today (all 14 null-annual tiers also have null monthly), so
nothing was mis-rendering. But a helper *named* `hasAnnualDiscount` should be correct for
every input its own types permit, and `monthlyPrice: number | null` permits this. Now
requires both values to be finite numbers before comparing.

Verified after hardening: real data unchanged at **50 shown / 73 dashed**, and the edge
cases behave — `{null, 10}` → "—", `{undefined, 10}` → "—", `{0, 0}` → "—",
`{20, 16}` → "$16", `{10, 10}` → "—", `{null, null}` → "—".

Note the main page's inline check at `template.ts:3149` still uses `?? Infinity`. It is
pre-existing, unreachable with current data, and rewriting client-side template JS was out
of scope here — but it is the same latent trap, so fold it in next time that file is open.

### P2 — `/api/subscriptions` still exposes the raw field (NOT fixed — new open item)

Codex: the renderer fix masks equal values in HTML, but the JSON API still returns
`annualMonthlyPrice: 10` for Copilot Pro, and a consumer reasonably reads that named field
as a purchasable annual rate without knowing the renderer-only convention. Correct.

Deliberately **not** fixed here, for two reasons. It is a **schema change** to a public API
plus the data model plus both renderers, affecting all 28 subscriptions — much larger than
this PR. And it is **pre-existing, not a regression**: the ambiguity already applied to all
59 equal-value tiers, and the figures this PR replaced (8.33 / 32.5) were strictly worse,
asserting a discount that never existed at all. So this PR moves the API from "wrong" to
"ambiguous", and the remaining ambiguity deserves its own scoped change.

**Proposed open item**: add an explicit cadence field — e.g.
`annualBilling: 'discounted' | 'same-price' | 'unavailable' | 'unpublished'` — and have
both renderers and the API read it, replacing the inferred equal-vs-null convention with a
stated one. That also retires the `?? Infinity` trap above and the two-renderer divergence
class entirely.

## Verification

- `npm test` — **58/58 pass**, before and after (the suite pins the version-join truth
  table; it does not cover the two new map entries, so the join was additionally exercised
  against the live CSV).
- `tsc --noEmit` — clean.
- Live-CSV join run: 106 → **108** models scored, 63 → **61** unmapped, `ambiguous`
  **0 → 0** (no new ambiguity introduced).
- All 24 `underlyingModels` ids resolved against the live 414-id catalogue, 0 missing.
