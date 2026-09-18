# Pricing verify — 2026-09

**Run date**: 2026-09-18 (supervised, inline session). **Branch**: `pricing-verify/2026-09`, based on `8b7187d`.
Follows `docs/proposals/pricing-verify-prompt.md`. Every figure below was read today from the vendor's own page,
help centre or docs. Nothing was taken from an aggregator. Nothing sits behind a sign-in or a solved bot check.

## Why this run exists: the scheduled 09-01 run produced nothing

The `tokenapp-pricing-verify` task fired on 2026-09-01 and reports "succeeded". Its transcript ends after 22
messages, ten minutes in, partway through the setup reads. It left no branch, no report and no stamps.
The likely cause is the one CLAUDE.md records for this repo: `~/Documents` is iCloud-managed. On 2026-09-18,
**521 files under `.git` and 11 files in `src/`/`test/` were `dataless`**, and `git fetch` / `git branch -vv`
hung for over two minutes until they were killed. This run used a fresh clone outside iCloud instead.
**The durable fix is still the user's**: turn off *Optimize Mac Storage*, or move the repo. Until then the
monthly task will keep stalling.

## Counts

| | |
|---|---|
| Entries in file | 28 |
| Prices re-read on a vendor page today | **22**: 19 in full, plus 3 partial or ambiguous (grok, v0, chatgpt) |
| `lastVerified` stamped `2026-09-18` | **19** (exactly the 19 read in full) |
| Left at their old date, with a reason | **9**: chatgpt, grok, v0, hailuo-ai, and the five free-only entries |
| Price numbers changed | **9** (4 entries) |
| Tiers added | **5**: M365 Pro, Grok Business, Kimi Business, Z.ai Team Standard and Team Premium |
| Tiers renamed | **4** (Kimi) |
| URLs updated | **3**: kimi, claude-code, runway |
| Truncation | none. Every entry has a verdict below |

Perplexity counts as read in full, although `/pro` shows only annual equivalents. Its monthly Pro and Max
prices come from the help centre and the page's own copy (see its row).

## CHANGED: prices (9 numbers). Each has a source quote

| Entry · tier | Field | Was → Now | Source (verbatim) |
|---|---|---|---|
| microsoft-copilot · M365 Premium | annual | 19.99 → **16.67** | microsoft.com/en-us/microsoft-365-copilot/pricing/individuals: "Microsoft 365 Premium $199.99 /year" (monthly "$19.99 /month" unchanged). 199.99/12 |
| microsoft-copilot · Copilot Business | annual | 18 → **21** | …/microsoft-365-copilot/pricing: "Originally starting from $21.00 now starting from $18.00 … user/month, paid yearly". $18 is a promo, and this routine records list prices |
| perplexity · Enterprise Pro | annual | 40 → **33.33** | FAQ answer on perplexity.ai/enterprise (read from the page's own bundle, see traps): "Perplexity Enterprise Pro seats are $40 per user per month or $400 per user per year." Corroborated by help article 11187416: "starts at $40/month or $400/year/seat" |
| zhipu-ai · Coding Lite / Pro / Max | annual | 18 / 80 / 168 → **12.6 / 56 / 117.6** | z.ai/subscribe: toggle "Monthly · Quarterly · 20% off · Yearly · 30% off". Yearly shows "$12.6/month $18/month", "$56/month $80/month", "$117.6/month $168/month". Monthly shows $18 / $80 / $168 undiscounted |
| replit · Core | monthly / annual | 25 / 20 → **20 / 18** | replit.com/pricing, Monthly toggle "Core $20 / month"; Yearly toggle "Core $20 $18 / month, billed annually" ("Up to 10% off") |
| replit · Pro | annual | 95 → **90** | same page: "Pro $100 $90 / month, billed annually" (monthly "$100 / month" unchanged) |

Annual-price convention, unchanged: when a vendor displays its own per-month annual figure, that figure is
stored (Claude Pro $17 for $200/yr, Perplexity Max $167 for $2,000/yr, settled 2026-08-17). Otherwise the annual
total ÷ 12 is stored (16.67, 33.33, 50).

Two of these reverse earlier calls, so the reasoning is recorded:

- **Z.ai.** The 2026-08-17 pass kept list prices and called the ~30% discount "a standing promo". It is now a
  formal billing-cadence toggle (Monthly / Quarterly / Yearly), so it is an annual price like every other
  vendor's. The description is updated to say so.
- **Microsoft.** The same two corrections were made on 2026-08-18 on the local branch `pricing-verify/2026-08`,
  which was never pushed. They were re-derived here from today's pages, not cherry-picked. The watch-list
  entry "$18 promo expires Sep 2026" was **wrong**. The page says *"This discount offer is available between
  July 1, 2026, and December 31, 2026"* and *"promotional pricing applies to the first year only"*. The feature
  string now reads `List $21; $18 first-year promo through Dec 2026`.

## CHANGED: tiers added (5) and renamed (4)

| Entry | Change | Source |
|---|---|---|
| microsoft-copilot | **+ M365 Pro** 99.99 / 99.99 | pricing/individuals: "Highest usage limits Microsoft 365 Pro $99.99 /month Monthly billing only." |
| grok | **+ Business** 30 / 30 per seat | x.ai/grok/business: "Business … Perfect for small-to-medium teams … $30 / month per user". No annual figure is published anywhere |
| kimi | **+ Business** 50 / 50 per seat | kimi.com/membership/pricing, Business tab: "$600 / year / seat Billed annually … Minimum order of 2 seats"; FAQ "The Business plan is currently billed annually". Stored like M365 Copilot's annual-only seat price |
| zhipu-ai | **+ Team Standard** 88 / 79.2 · **+ Team Premium** 188 / 169.2, per seat | z.ai/subscribe, Team tab: "Standard Seat $88 per seat/month … Save 10% annually · From $79.2/month"; "Premium Seat $188 … From $169.2/month" |
| kimi | Moderato → **Plus**, Allegretto → **Pro**, Allegro → **Max**, Vivace → **Ultra**. **Prices unchanged** | see the headline finding below |

## HEADLINE: Kimi's pricing page is back, at a new URL

The prompt lists `kimi` as a dead end: *"www.kimi.com/pricing redirects to root — the USD ladder cannot be
re-read"*. That is still true of `/pricing`. The ladder now lives at **`www.kimi.com/membership/pricing`**,
titled "Kimi Pricing | Membership plans and subscription options", which says *"The new membership plan is now
available."*

| Stored tier | Page tier | Monthly | Annual | Quote |
|---|---|---|---|---|
| Adagio | Adagio | 0 | 0 | comparison table "Adagio $0" |
| Moderato | Plus | 19 | 15 | "$15 / month $19 Billed annually $180" · "$19 / month Billed monthly" |
| Allegretto | Pro | 39 | 31 | "$31 / month $39 Billed annually $372" · "$39 / month" |
| Allegro | Max | 99 | 79 | "$79 / month $99 Billed annually $948" · "$99 / month" |
| Vivace | Ultra | 199 | 159 | "$159 / month $199 Billed annually $1,908" · "$199 / month" |

All ten prices matched. The `url` now points at the new page and the entry is stamped. Tier features were
rewritten from the page's own cards and comparison table (concurrent agent tasks 1/2/2/2/4, scheduled tasks
2/10/15/20/25, projects 2/20/20/100/100, and so on). The stale "Kimi K2.6" strings are dropped. The page names
no per-tier model beyond "K3 Extra" long context (Max/Ultra), so the version is dropped rather than swapped.
The old "Entry paid tier (was $39)" is dropped too. The China ¥ ladder in the description was not re-verified.

## CHANGED: model names and URLs, each from a vendor page

| Entry | Change | Source |
|---|---|---|
| chatgpt | + GPT-6 Astra (description, `underlyingModels`); + "GPT-6 Pro (powered by GPT-6 Astra)" on Pro 5×, Pro 20×, Business, Enterprise; + "GPT-6 Astra in Work & Codex" on Plus | help.openai.com/articles/20001354 *"GPT-5.6 and GPT-6 Pro in ChatGPT"* (updated 2026-09-17): "GPT‑6 Pro, powered by GPT‑6 Astra, is available in ChatGPT for Pro $100, Pro $200, Business and Enterprise plans." · "Plus plans include GPT‑6 Astra in ChatGPT Work and Codex." GPT-5.6 Luna/Sol/Sol Pro strings stay: the same article confirms each |
| claude-ai | Lineup "Fable 5" → **Fable 5.1**; `claude-fable-5` → `claude-fable-5.1`; tier bullets "Fable 5 via usage credits" → "Fable via usage credits" / "Fable (50% of weekly limits)" | claude.com/pricing lists "Fable 5.1 — Next generation intelligence for long-running agents" and puts "Fable 5" under **Legacy models**. The plan grid names "Fable" with no version, so tier bullets drop it |
| claude-code | "Opus 5, Sonnet 5 & Fable 5" → "…Fable 5.1"; `claude-fable-5.1`; url → `claude.com/product/claude-code` | same, plus `www.anthropic.com/claude-code` now **301**s to claude.com |
| perplexity | Model mix → Sonar 2, GPT-5.6 Terra, Claude Sonnet 5, **Gemini 3.8 Flash**, Kimi K3, **GLM 5.3**, **Grok 4.6**; `underlyingModels` likewise (Sonar 2 still excluded, no catalogue id) | perplexity.ai/pro model cards: "Gemini 3.8 Flash New", "GLM 5.3 New", "Grok 4.6 New" |
| suno | v5.5 / v4.5 → **v6, v6-wild, v6-mini**; Premier "Custom-tuned v5.5" → "Create custom models" | suno.com/pricing comparison table: "Best free model (v6-mini)" · "Advanced models (v6 and v6-wild)"; Premier "Create custom models" |
| windsurf | "SWE-1.7 & open-source models free" → "Free SWE-2 use through Oct 10, 2026"; + SpaceXAI in provider list | devin.ai/pricing: "SWE-2, our latest model, is now available" · "Free use of SWE-2 Free in Devin Desktop and CLI through October 10, 2026" · "models from OpenAI, Claude, Gemini, and SpaceXAI" |
| midjourney | "currently on V8.1" → **V8.2** | docs.midjourney.com Version article: "V8.2 released as the default version on July 24, 2026." (The 08-17 pass missed this.) |
| manus | "announced Aug 2026 that it will resume operating as an independent company" → "has now resumed operating as an independent company" | manus.im banner: "Manus has resumed independent operations. Our next chapter starts now." |
| kling | Pro "As low as $1.09 per 100 credits" → "As low as $0.81 per 100 credits (annual)" | Pro yearly card: "100 Credits = $0.81" |
| runway | url → `runway.com/pricing` | `runwayml.com/pricing` now **308**s to runway.com |

Every id written to `underlyingModels` was checked against the live catalogue (445 ids) first:
`openai/gpt-6-astra`, `anthropic/claude-fable-5.1`, `google/gemini-3.8-flash`, `z-ai/glm-5.3`, `x-ai/grok-4.6`.

## VERIFIED, no price change (stamped)

| Entry | What was read |
|---|---|
| claude-ai | "$17 Per month with annual subscription discount ($200 billed up front). $20 if billed monthly." · "From $100" (Max; 5×/20× monthly-only per compare table; $200 on claude.com/product/claude-code) · Team "Standard seat … $20 … if billed annually. $25 if billed monthly." · "Premium seat … $100 … $125 if billed monthly." |
| gemini | $0 / $4.99 / $19.99 / $99.99 / $199.99. The page has no annual toggle and no "annual/yearly/billed" text. "Access to 3.6 Flash" + "Varying access to 3.1 Pro" still match |
| perplexity | Pro "US$17 /month or equivalent, when billed annually" plus the page's own copy "First month free, then $20/month". Max: help article 11680686 (modified Sep 14) "Perplexity Max costs $200/monthly or $2000/annually". /pro shows "US$167" (2000/12, vendor-rounded as before). Enterprise Max "$325 per user per month or $3,250 per user per year" → 270.83 |
| mistral-lechat | $5.99 student / $14.99 Pro / $24.99 Team. **The long-unsourced annual 11.99 / 19.99 is now sourced**: help.mistral.ai 455205 "Annual billing includes a 20% discount compared with monthly billing." 14.99 × 0.8 = 11.99 and 24.99 × 0.8 = 19.99. The rate is quoted; the dollar figures are computed from it |
| manus | Rollers read from the transform, twice, and cross-checked by a settled screenshot: $20/$40/$200 monthly, $17/$34/$167 "/ month, billed yearly". Team (manus.im/team): "US$20 Per seat / month" · "US$200 Per seat / year" |
| cursor | All 10 cells, each radio's `checked` asserted: Pro 20/16, Pro+ 60/48, Ultra 200/160, Teams Standard 40/32, Teams Premium 120/96 |
| github-copilot | Plans page Free $0, Pro $10, Pro+ $39, Max $100; docs: "Copilot Business $19 USD per granted seat per month", "Copilot Enterprise $39 USD …". Annual billing is still discontinued (legacy docs page still present) |
| windsurf | Free $0, Pro $20, Max $200, Teams "$80 /month for team plan + $40/mo per full dev seat". No annual option |
| claude-code | Still "included in your Pro plan" / "Max plan". No price of its own |
| replit | see CHANGED |
| lovable | Pro $25 / "$21 … /month, billed annually"; Business $50 / $42, with both toggle states read |
| midjourney | "$10 … $96 ($8 / month)", "$30 … $288 ($24 / month)", "$60 … $576 ($48 / month)", "$120 … $1,152 ($96 / month)" |
| suno | Page defaults to **Annual** (`aria-checked="true"`, trap reproduced): $8 / $24; after the Monthly switch: $10 / $30 |
| elevenlabs | $6 / $22 / $99 / $299 / $990 monthly; the FAQ states annual equivalents $5 / $18.33 / $82.50 / $249.17 / $825. Creator's "$11" is a first-month promo and was not recorded |
| kling | Top Yearly/Monthly pair clicked (the duplicate pair lower down stays on Monthly, trap reproduced). Monthly list $10/$37/$92/$180 ($6.99 etc. are first-month promos). Yearly $79.2/$293.04/$728.64/$1429.99 per year. **Team re-read for the first time**: "$79 /Seat/Month $99" (list 99) · Yearly "$59 /Seat/Month … $708 per seat / 12 months" |
| runway | $15/$12, $35/$28, $95/$76 ("Save $36/$84/$228/year") |
| microsoft-copilot | see CHANGED. Now fully re-read: Business monthly "$25.20 user/month" and Enterprise "Microsoft 365 Copilot $30.00 user/month, paid yearly" were read for the first time. No monthly price is published for M365 Copilot, so 30 stays |
| kimi, zhipu-ai | see CHANGED |

## NOT stamped: proof of absence or ambiguity

- **chatgpt**: prices unverifiable. `chatgpt.com/pricing` returns 403. **New:** `openai.com/chatgpt/pricing` now
  shows a Cloudflare "Just a moment…" page **in a real browser too**, so on 08-17 it served SGD and today
  nothing. It was not worked around. Model names *were* updated, from the help centre (above). The article's
  plan names "Pro $100" and "Pro $200" do corroborate those two prices.
- **grok**: Free $0, SuperGrok $30 and SuperGrok Plus $100 are confirmed. **SuperGrok annual (25), SuperGrok Lite
  and SuperGrok Heavy are unpriced on x.ai.** The only page that prices them, `grok.com/supergrok`, sits behind a
  Cloudflare security check. x.ai's FAQ and docs pages publish no annual figure. X Premium / Premium+ are still
  absent from x.ai (X products) and left in place, as on 08-17.
- **v0**: $30 Plus and $100 Business match what is charged. But Plus now shows **"$30" beside a struck-through
  "$90" /user/month**, with no promo label or end date, while the FAQ offers no discounts. Whether $90 is list
  price (making $30 a promotion) is ambiguous, so it is flagged and left unstamped. Note the struck $90 is
  client-rendered: a plain curl of the page does not contain it.
- **hailuo-ai**: the auth wall holds. `/subscribe` redirects to the site root in a browser, and only a "$9.99"
  banner is public. curl returns 200 / 678 KB (the recorded SSR mirage), which was not used.
- **ernie-bot, doubao, deepseek, qwen-chat, meta-ai**: free-only. Probed: yiyan.baidu.com 302 →
  wenxin.baidu.com (unchanged), doubao 302 → /chat/, deepseek 202, qwen 200, meta.ai 403 (sign-in wall in a
  browser).

## Looked wrong, deliberately left alone

- **meta-ai** "Muse Spark 1.1" and **qwen-chat** "Qwen3.7": the catalogue now has `meta/muse-spark-1.2` (Aug 6)
  and `-1.3` (Sep 2), and `qwen/qwen3.8-*` (Sep 2–4), so both strings are probably stale. Neither vendor page
  names a version (meta.ai is behind sign-in; Qwen Studio's page carries none). Both entries are unstamped, and
  the 08-17 precedent for unstamped entries is to flag, not guess.
- **runway**: plan bullets headline "Seedance 2.5", but the page's own compare table still lists "Seedance 2.0
  Pro/Fast", and **"Veo" appears nowhere** on the pricing page. The description's "Seedance 2.0 & Veo 3.1" may
  be stale, but the page contradicts itself. Left for a human.
- **perplexity**: the page's model cards (used) disagree with its own FAQ ("Gemini 3.1 Pro Thinking, Grok 4.1")
  and with help article 10352901 (an older roster). "Education Pro" ($10/mo) is not tracked.
- **replit**: the free **Starter** card is gone from the pricing page, and "Free Mode" appears only as a usage
  mode inside Core and Pro. The plan itself still exists: docs.replit.com/billing/plans/starter-plan describes
  what "you can build for Free… all at no cost". The tier is kept, and the stamp rests on that page.
- **gemini**: the "Cut from $7.99 in June 2026" and "Cut from $249.99 at I/O 2026" feature notes no longer
  appear on the page. They are historical and not wrong, so they were kept.
- **cursor**: feature wording drifted (Hobby "Access to Composer", Pro adds "Grok Bot access"). This is not a
  version claim, so it was left. **The 6 hidden 0×0 mobile radios recorded on 08-18 are gone**: today there are
  7 radios, all visible.
- **manus**: "Manus 1.6" is not named anywhere on manus.im today. It is unverified, but there is no evidence it
  is stale.
- **zhipu-ai**: the page `<title>` and body name a new **GLM-5.3-Flash** ("GLM-5.3 and GLM-5.3-Flash (OX
  Alpha)"). That is plan-level evidence only: the tier cards say just "latest flagship models", and the
  routine's own z.ai trap forbids reading the title as a per-tier list. So Coding Lite's model string was
  **not** extended (Codex review, P2).
- **src/template.ts** `PROVIDER_URLS.runway` is still `https://runwayml.com/`. It works via the permanent
  redirect and is outside this data-only change.

## Verification

- `npm test`: **87/87 pass**. `./node_modules/.bin/tsc --noEmit`: clean. `npm run logos:check`: up to date.
- Before/after data diff (procedure step 7): `scratchpad/dump.mjs` was missing again, so an equivalent
  (esbuild-bundle `src/subscriptions.ts`, emit JSON) was used. Diffed field by field against both `main` and the
  live `/api/subscriptions`, which were **identical** before the change (prod KV == main). The diff contains
  exactly the changes listed above and nothing else.
- Before this change, prod's automated feeds were all fresh (`/api/models`, `/rankings`, `/market-share`,
  `/task-spend` and `/benchmarks` all fetched 2026-09-18 06:00 UTC). Model prices matched OpenRouter on 436/445,
  with 3 at 4-decimal rounding and 6 moved on OpenRouter after that hour's cron.

## Follow-ups resolved the same day

The four items flagged above were chased to vendor sources on 2026-09-18.

- **v0: `$30` is the list price.** v0.app/docs/pricing: "Plus : $30/user/month. For fast moving teams and
  collaboration. Business : $100/user/month." Its plan table reads "Price $0/month $20/month $30/user/month
  $100/user/month Custom". "$90" appears nowhere in the docs, so the struck-through $90 on `/pricing` is a
  marketing anchor. Nothing changed, and v0 is now **stamped** (20 stamped in total). The $20 "Premium" plan
  "is in the process of being sunsetted and is no longer available to new users", so it stays absent.
- **qwen-chat: the model picker is the source.** Qwen Studio's own picker (chat.qwen.ai, visible logged out)
  lists "Qwen3.7-Plus" (default), "Qwen3.8-Max — The flagship of Qwen3.8 model…" and "Qwen3.8-Omni-Flash".
  The description and feature now name them. `underlyingModels` is unchanged: the catalogue has only the dated
  `qwen3.8-max-0902` and the open-weights `qwen3.8-2.4t-a95b`, and picking one would be a guess (a code comment
  says so). Not stamped: free-only.
- **meta-ai: version dropped, not swapped.** developer.meta.com/ai/models/muse-spark/ is titled "Muse Spark 1.3
  | Meta" and lists 1.2 and 1.1 as older, so "1.1" was stale. No Meta page says which version the Meta AI app
  runs (meta.ai is behind sign-in), so the entry now says "Muse Spark models". A search-engine summary claimed
  1.3 powers the app's Thinking mode; the page it cited does not say that, so it was not used. Not stamped.
- **runway: Veo 3.1 is still offered.** It is absent from the visible pricing text, but runway.com's own page
  copy reads "third-party models like Nano Banana Pro 2, GPT Image 2, Kling 3.0, Kling O3, Veo 3.1, Seedance 2.5
  and more". A live "Veo 3.1 on Runway" model page exists, and the plan label is "All AI images and video models
  (Gen-4.5, Nano Banana Pro, Aleph, Veo 3.1, and more)". The description changes only Seedance 2.0 → **2.5**.
- `src/template.ts` `PROVIDER_URLS.runway` now points at `https://runway.com/`, since runwayml.com redirects there.
