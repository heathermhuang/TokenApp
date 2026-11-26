# Pricing verify — 2026-11-25 (partial, targeted)

Run by hand in an interactive session, not by the scheduled task. The Oct 1 and Nov 1 scheduled
runs both died on their first command ("OAuth token revoked") while reporting "succeeded", so
nothing had been re-checked since 2026-09-18.

**Scope.** This pass was aimed at open item 12 (an explicit `annualBilling` field). That needs a
**sourced** answer for every paid tier whose annual price was stored equal to its monthly price,
because that convention cannot tell "annual exists at the same price" from "no annual plan". So
this pass covered the 9 vendors holding those tiers, plus the 3 entries item 12 leans on
(github-copilot, v0, claude-code). **The other 16 entries were not re-read** and keep their dates.

## Counts

| | |
|---|---|
| Entries touched | **12** of 28 |
| Prices re-read in full, `lastVerified` bumped | **6**: gemini, grok, mistral-lechat, github-copilot, windsurf, microsoft-copilot |
| Re-read in part, date left alone | **5**: chatgpt (Go unpriced), claude-ai (USD from help center; Team not re-read), kimi (Business tab only), v0 (docs only), claude-code (wording only) |
| Unverifiable, unchanged | **1**: hailuo-ai (auth wall holds) |
| Not re-read this pass | 16 |
| Tiers | 128 → **129** |
| `scratchpad/dump.mjs` | **Missing again.** Replaced by a direct diff of `main`'s compiled array against this branch: 28 → 28 entries, every change below and nothing else |

## HEADLINES

1. **Grok was restructured.** x.ai/pricing: *"One subscription. Access to everything."* The X Premium /
   SuperGrok split is gone. Compare table: *"Free $0/month · Plus $8/month · Premium $30/month · Super
   $100/month · Ultra $200/month · Teams $30+/user/month · Enterprise Custom"*, usage *"Basic · 4x Plus ·
   15x Plus · 50x Plus · 4-50x Plus"*. X Premium+ ($40), SuperGrok Lite ($10) and SuperGrok Heavy ($300)
   are no longer offered. The page title now reads **"SpaceXSI"** (we use "SpaceXAI"): not changed, flagged.
2. **claude.com/pricing now serves Singapore pricing** to this location: *"Prices include 9% GST"*,
   Pro *"$25 … ($300 billed up front). $30 if billed monthly"*, Max *"$149.99"*, Ultra *"$300"*. These are SGD
   ($20 × 1.09 × ~1.37 ≈ S$30). **Not recorded.** There is no currency switch. USD came from the help center instead.
3. **Claude's Max 5× / Max 20× became Max / Ultra.** Help center: *"The Max plan is available for $100 per month"*,
   *"The Ultra plan is available for $200 per month"*.
4. **ChatGPT Pro is three plans and one is new.** help.openai.com/articles/9793128 (updated 2026-11-24):
   *"Choose from three monthly Pro plans: Pro 100 $100 · Pro 200 $200 · Pro 500 $500"*.
5. **Gemini moved to Gemini 4** (Carbon / Neon / Hydrogen). Every stored model name was stale.
6. **The Windsurf "through Oct 10, 2026" string had lapsed.** The page now reads *"Free use of SWE-2"*.

## Annual availability — the input to item 12

Every paid tier whose stored annual equalled its monthly, plus the annual-only ones. "Unavailable" means
the vendor sells no annual plan. "Unpublished" means it may, but no annual price is published anywhere found.

| Entry · tier | Answer | Source |
|---|---|---|
| chatgpt · Go, Plus | **unavailable** | help.openai.com/articles/11989085: *"we do not support annual billing or the option to pay for multiple months in advance for ChatGPT Go, Plus, or Pro subscriptions"*; 6950777 same for Plus |
| chatgpt · Pro 100 / 200 / 500 | **unavailable** | 9793128: *"Does Pro offer annual billing? Pro is billed monthly. Annual billing and payment for multiple months in advance are not available."* |
| claude-ai · Max, Ultra | **unavailable** | support.claude.com/articles/11049741 *"The Max plan is currently available as a monthly subscription only"*; 17728952 *"The Ultra plan is currently available as a monthly subscription only"* |
| gemini · AI Pro | **discounted** 19.99 → 16.67 | support.google.com/googleone/answer/16476811 *"You can choose between monthly or annual subscriptions for the Google AI Pro plan"*; one.google.com/about/plans, Annual toggle: *"Google AI Pro · 5 TB · Usually $199.99, now $99.99 for 12 months, then $199.99/year"*. List price recorded (199.99 / 12); the $99.99 is a 12-month intro promo |
| gemini · AI Plus | **unpublished** | answer/16548195 *"You can choose between a monthly or annual membership plan for Google AI Plus"*, but no price on any page found |
| gemini · AI Ultra (5×), (20×) | **unavailable** (by absence) | answer/16476748 has no annual section where its Pro and Plus siblings each have one, and the Google One Annual toggle lists only AI Pro |
| grok · Plus, Premium, Super, Ultra, Teams | **unpublished** → see Pass B: Plus/Premium/Super/Ultra are `discounted` | x.ai/pricing shows monthly only. help.x.com/en/using-x/x-premium (US) still lists *"Premium 8.00 USD / 84.00 USD"* and *"Premium+ 40.00 USD / 395.00 USD"* annual, but under the **old** names, and it conflicts with x.ai: the Premium+ perks now sit in x.ai's $30 Premium. Which annual price belongs to which new plan cannot be determined. Flagged, not applied |
| mistral-lechat · Education (was Student) | **unpublished** | help.mistral.ai/articles/455205: *"For Pro and Team plans, you can choose between monthly or annual billing"*. 698530 (Education plan) says nothing about annual |
| kimi · Business | **annual only** | kimi.com/membership/pricing, Business: *"$ 600 / year / seat · Billed annually"*; FAQ *"The Business plan is currently billed annually"* |
| github-copilot · Pro, Pro+, Max, Business, Enterprise | **unavailable** | docs.github.com still carries *"Model multipliers for annual plans (legacy)"*. Annual closed 2026-06-01 (08-17 finding), still legacy |
| windsurf · Pro, Max, Teams | **unavailable** | devin.ai/pricing: every price is "/month" or "PER MONTH", with no annual text or toggle anywhere. Same as 09-18 |
| v0 · Plus, Business | **unavailable** | v0.app/docs/pricing lists monthly prices only, with no annual option. Our description already says "No annual billing" |
| hailuo-ai · Max | **unpublished** | auth wall, see below |
| microsoft-copilot · M365 Pro | **unavailable** | pricing/individuals: *"Microsoft 365 Pro $99.99"* in both Monthly and Yearly toggle states; *"Monthly billing only."* |
| microsoft-copilot · M365 Copilot | **annual only (monthly unpublished)** | pricing/enterprise: *"$30.00 user/month, paid yearly (Annual subscription–auto renews)"*. A "Pay monthly" checkout link exists but **no monthly price is shown** |

## CHANGED (each with its source)

| Entry · tier | Field | Old → new | Quote |
|---|---|---|---|
| chatgpt · Pro 5× | name | → **Pro 100** | 9793128 table *"Pro 100 · $100"*; the "5×" multiplier is no longer stated anywhere, so dropped from features |
| chatgpt · Pro 20× | name | → **Pro 200** | *"Pro 200 · $200"*; *"Pro 200 includes more usage than Pro 100"* |
| chatgpt | tier | **+ Pro 500** 500 / 500 | *"Pro 500, a new $500/month plan that includes GPT-6 Astra Ultrafast and GPT-6.1 Sol Ultrafast"*; *"Pro 500 offers the highest included usage of the three plans"* |
| chatgpt | tier | **+ Business Premium seat** 125 / 100, per seat | help 8792828: *"Premium seat Monthly plan: $125 per user per month Annual plan: $100 per user per month, billed annually"* |
| claude-ai · Max 5× | name, features | → **Max** 100 | help 11049741 *"$100 per month"*; card: *"5x Pro usage every 5 hours and every week · Fable included, up to half your weekly limit · $100 a month in API credits"* |
| claude-ai · Max 20× | name, features | → **Ultra** 200 | help 17728952 *"$200 per month"*; card: *"No 5-hour limit · 10x Pro usage every week · $200 a month in API credits"* |
| claude-code | feature | "Pro ($20) & Max" → "Pro ($20), Max & Ultra" | support.claude.com/articles/11145838 is titled *"Use Claude Code with your Pro, Max, or Ultra plan"* |
| gemini · AI Pro | annual | 19.99 → **16.67** | see the annual table |
| gemini | description, underlyingModels, features | 3.1 Pro / 3.6 Flash → **Gemini 4 Carbon / Neon / Hydrogen** | Plus *"Access to Gemini 4 Hydrogen"*; Pro *"Access to Gemini 4 Neon"*, *"Access to Gemini 4 Hydrogen"*; Ultra *"Highest access to Gemini 4 Carbon"*; Free *"Auto model selection"*. Ids checked: `google/gemini-4-carbon`, `-neon`, `-hydrogen` are in the catalogue |
| gemini · AI Pro | feature | "Jules & Antigravity coding agents" → "Google Antigravity (entry rate limits)" | *"Entry rate limits to agent model in Google Antigravity"*; Jules is no longer listed |
| grok | all tiers | restructure, see headline | x.ai/pricing compare table quoted above. Teams: *"Premium · Super · Ultra · $30 /month … Mix and match seat types"*; Enterprise *"Custom"* |
| grok | description, features | version numbers dropped | the page says only *"Latest Grok models"*. Per the routine, a version that can't be sourced is dropped, not swapped |
| mistral-lechat · Student | name | → **Education** | mistral.ai/pricing *"Pro · Education plan"*; help 698530 *"The Education plan is the Pro plan with a discount"*. Price unchanged: *"Verified students can get Mistral Pro for $5.99 / month (normally $14.99)"* |
| windsurf · Teams | price, perSeat, features | $40/seat + $80 base → **$80 flat, up to 100 users** | devin.ai/pricing *"Teams · $80 · PER MONTH · … Up to 100 users"*; compare table *"Team $80/month"*, *"Members … Up to 100 users"*. No per-seat price appears anywhere on the page |
| windsurf · Pro | feature | "Free SWE-2 use through Oct 10, 2026" → "Free use of SWE-2" | *"Free use of SWE-2"* (date gone) |
| github-copilot · Max | feature | $100 → **$200**/mo AI credits | plans page *"$200 monthly total credits for Max"* |
| v0 · Free | feature | "$5 monthly credits" → "$5 one-time credits (new users)" | v0.app/docs/pricing *"New users who sign up under the one-time Free credit offer receive $5 once per user … Existing Free users keep their $5 monthly allowance."* |

## CURRENT (re-read, unchanged)

- **chatgpt**: Plus *"$20/month (billed monthly)"* (help 6950777, the first USD price sourced for this entry since July); Business *"$25 per user per month if billed monthly and $20 per user per month if billed annually"*.
- **claude-ai**: Pro *"$20 per month (US)"*, annual *"billed once yearly at a discounted rate"* (help 8325606). The stored 17 was **not** re-read in USD this pass.
- **gemini**: *"$0 · $4.99 · $19.99 · $99.99 · $199.99"* per month (US).
- **mistral-lechat**: *"$14.99 /mo"*, Team *"$24.99 /user/mo"*; *"Annual billing includes a 20% discount"* → 11.99 / 19.99. The *"$50 /mo"* on the Team card is its 2-seat minimum, not a tier.
- **kimi · Business**: $600 / year / seat.
- **github-copilot**: *"$10 / $39 / $100 per month"*; docs *"Copilot Business at $19 USD per user per month"*, *"Copilot Enterprise at $39 USD per user per month"*.
- **windsurf**: Free $0, Pro $20, Max $200.
- **microsoft-copilot**: Premium $19.99 monthly / *"$199.99"* yearly (16.67); Pro $99.99; Copilot Business *"$25.20"* monthly, yearly *"Originally starting from $21.00 now starting from $18.00"* (list 21; the $18 promo is unchanged); M365 Copilot $30.00 paid yearly. Personal and Family are on the page but not in our entry.

## Unverifiable / flagged, deliberately left alone

- **hailuo-ai**: `/subscribe` still redirects to the site root; only a "$9.99" promo is public. Unchanged.
- **chatgpt · Go $8**: no USD price in the Go help article. Unchanged, date not bumped.
- **chatgpt model naming conflict**: the same article says *"GPT-6.1 Sol Ultrafast"* in prose and *"GPT-6.2 Sol in Codex only"* in its table. Pro 200 now reads "Ultrafast Sol in Codex" with **no** version.
- **grok**: annual for the new plans (see table). `underlyingModels` still names 4.6 / 4.5 while the catalogue now has `x-ai/grok-4.7`, and the page names no version. Left as is.
- **SpaceXSI**: x.ai's page title. A rename touches `providers.ts` and the logo map, so that's a product decision, not this pass.
- **claude-ai SGD**: see headline. Watch for this on the next run: the USD help articles are the reliable source.

## Not re-read this pass (16)

perplexity, ernie-bot, doubao, zhipu-ai, deepseek, qwen-chat, meta-ai, manus, cursor, replit, lovable,
midjourney, suno, elevenlabs, kling, runway. Their `lastVerified` dates are unchanged.

---

# Pass B — the remaining 16 entries (same day)

**Supersedes the "Not re-read this pass (16)" list above, and the Grok annual verdict.**

| | |
|---|---|
| Re-read in full, `lastVerified` bumped | **8**: zhipu-ai, cursor, replit, lovable, midjourney, suno, elevenlabs, runway |
| Re-read in part, date left alone | **2**: manus (Pro 4K annual not re-read), kling (Team not re-read) |
| Unverifiable, unchanged | **1**: perplexity |
| Free-only, probed for change only | **5**: reachability identical (ernie-bot → wenxin.baidu.com 200, doubao 200, qwen-chat 200, deepseek 403, meta-ai 403 to curl). No escalation |
| Tiers | 129 → **130** |
| Data check | compiled `main` vs branch, tier by tier: every change below and nothing else |

## HEADLINES

1. **Cursor is now sold as the same subscription as Grok.** cursor.com/pricing lists exactly x.ai's ladder:
   *"Free $0/month · Plus $8/month · Premium $30/month · Super $100/month · Ultra $200/month · Teams $30+/user/month ·
   Enterprise Custom"*. Plus carries *"\*Only Grok models are available on this plan"*. Every stored Cursor tier
   (Hobby / Pro $20 / Pro+ $60 / Ultra / Teams $40 & $120) was stale.
2. **That settles Grok's annual prices.** cursor.com/docs/models-and-pricing: *"Annual billing is available at $80/yr
   for Plus, $300/yr for Premium, $1,000/yr for Super, and $2,000/yr for Ultra"*. These are the same plans, under the same
   names and monthly prices, on x.ai/pricing. So Grok's Plus / Premium / Super / Ultra go from `unpublished` to
   `discounted` (6.67 / 25 / 83.33 / 166.67). Teams stays `unpublished`: *"Teams $30, $100, or $200 per seat/mo"*, no annual figure.
3. **Perplexity is fully gated.** perplexity.ai/pro **and** its help-center articles return Cloudflare's "Just a moment…"
   even in a real browser after waiting. Not bypassed; the entry is unchanged.
4. **Promotions are everywhere (Black Friday).** Manus "Up to 33% off", Kling "Limited-Time 50% / 35% Off", ElevenLabs
   "Save up to 55%", Suno "Extra 30% off". **Only list and renewal prices were recorded.** Re-check nothing in December
   on the strength of a promo.

## CHANGED

| Entry · tier | Old → new | Quote |
|---|---|---|
| cursor | all tiers → Free / Plus 8 (6.67) / Premium 30 (25) / Super 100 (83.33) / Ultra 200 (166.67) / Teams 30/seat / Enterprise | headline 1 and 2; docs *"Premium $30/mo 4x Plus API list price, from prepaid credit · Super $100/mo 15x Plus · Ultra $200/mo 50x Plus"* |
| grok · Plus / Premium / Super / Ultra | annual null → 6.67 / 25 / 83.33 / 166.67, `discounted` | headline 2 |
| manus · Pro 8–20K | name → **Pro 8K** | Monthly, 8,000 credits *"$40 / month"*; 20,000 credits is now *"First month only, then $100/month"*, so "$40 for 8–20K" was wrong. Annual 8K *"$34 / month, billed yearly"* |
| manus · Pro 40K | name → **Max** | *"Max … 40,000 credits / month … then $200/month"*; annual *"then $2,000/year"* (= 166.67, stored 167) |
| manus | description: Manus 1.6 → **2.0**, ladder wording | *"Access to Manus 2.0 and 2.0 Max"*, Free *"Manus 2.0 Lite"*; Pro 4,000 credits *"$20 / month"* |
| suno | **+ Platinum** 120 / 100 | *"Platinum · Top Tier · Our most powerful plan, with visuals for your songs plus the most credits and downloads"*; Monthly *"$120"*; Annual *"then $1,200/yr"* |
| kling · Ultra | → **Ultra+** 619 / 408.58, 57,000 credits | Monthly *"Ultra+ … $619"*; Yearly *"Then $4902.99/year"*; *"57000 Credits/month"*. The 26,000-credit Ultra is gone |
| kling | description 3.0 → **4.0** series | *"Kling 4.0 – HDR"*, *"Kling Image 4.0 - 8K"* |

## CURRENT (re-read, unchanged)

- **zhipu-ai**: Yearly default *"$12.6/month $18/month · $56/month $80/month · $117.6/month $168/month"*; Team *"$88per seat/month From $79.2/month · $188per seat/month From $169.2/month"*. The title now names GLM-5.4: an SEO title per the traps table, so not changed. CNY prices not re-read.
- **replit**: *"$20 $18 / month, billed annually"*, *"$100 $90 / month, billed annually"*.
- **lovable**: Monthly *$25 / $50*; Yearly *"$21 … Originally $25"*, *"$42 … Originally $50"*.
- **midjourney**: docs table *"Monthly Price $10 | $30 | $60 | $120"*, *"Annual Price $96 ($8 / month) | $288 ($24) | $576 ($48) | $1,152 ($96)"*.
- **suno**: Monthly *$10 / $30*; Annual list *"then $96/yr"*, *"then $288/yr"*.
- **elevenlabs**: *$6 / $22 / $99 / $299 / $990* with yearly *$5 / $18.33 / $82.50 / $249.17 / $825* (*"Billed yearly, $9,900 a year"* etc.).
- **runway**: Yearly *$12 / $28 / $76* (*"Billed annually. Save $36/year."*), monthly *$15 / $35 / $95*.
- **kling**: Standard $10 / $79.2/yr, Pro $37 / $293.04/yr, Premier **at 8K** $92 / $728.64/yr. The page's Premier card **defaults to 18K ($207)**, and a synthetic click on its 8K option does nothing: there are two copies of each option, the duplicate-control trap again. A real click on the visible one works, and the yearly toggle resets the selector.
- **manus · Team**: *"starts from US$20 per seat per month or US$200 per seat per year"*.


---

# Pass C — the 14 entries still unstamped (2026-11-26)

| | |
|---|---|
| Re-read in full, `lastVerified` bumped | **9**: chatgpt, claude-code, kimi, manus, kling, v0, deepseek, qwen-chat, ernie-bot |
| Re-read in part, date left alone | **1**: claude-ai (every USD price except Pro annual) |
| Unverifiable, unchanged | **4**: perplexity (Cloudflare), hailuo-ai (redirects to the site root), doubao (paid CNY tiers need sign-in), meta-ai (*"Meta AI isn't available yet in your country"*) |
| Tiers | 130 → 130 |
| Data check | compiled `main` vs branch, tier by tier: every change below and nothing else |

## HEADLINES

1. **`chatgpt.com/pricing` loads again** in a real browser (no interstitial). It confirms Go **$8**, the one ChatGPT price
   the Help Center never published, so chatgpt is fully stamped for the first time since July.
2. **Kling Team's list price moved**: *"$98 /Seat/Month $122 20% Off"* and *"$61 … First Year: $732/Seat per 12 months.
   From Year 2: $876/Seat per 12 months"*. The $98 and $61 are the Black Friday offer (*"Get up to 50% off Team Plan"*), so
   the file records the $122 list and the $876 renewal ($73/mo). It stored $99 and $59.
3. **Black Friday is still everywhere** (Manus *"Up to 33% off"*, Kling *"Up to 50% off"*). Only list and renewal prices
   were recorded. Kling's individual cards also say *"then $9.8/month"* (Standard) and *"then $32.56/month"* (Pro) after the
   promo, which match neither the struck list ($10 / $37) nor any discount stated on the page. Not recorded; re-check in
   December.

## CHANGED

| Entry · tier | Old → new | Quote |
|---|---|---|
| kling · Team | 99 / 59 → **122 / 73** | headline 2 |
| manus · Max | annual 167 → **166.67** | Yearly *"then $2,000/year"* (the 167 was rounded) |
| kimi · Adagio | name → **Free** | the comparison table heads the column *"Free $0"* |
| chatgpt · Free / Plus / Enterprise | GPT-5.6 → **GPT-6** / **GPT-6.2** / no version | *"Unlimited text chats with GPT-6"*, *"Advanced reasoning models with GPT-6.2"*; the Enterprise card names no model |
| claude-ai · Pro, claude-code | Opus 5 / Sonnet 5 / Fable 5.1 → **no version** | the pricing card says *"More Claude models"*; versions dropped, not swapped |
| claude-code | `underlyingModels` + `anthropic/claude-opus-5.5` | *"Fast mode is a high-speed configuration for Opus 5.5 … In research preview on Claude Code"* |
| qwen-chat | Omni-Flash dropped | the logged-out picker lists only *"Qwen3.7-Plus"* and *"Qwen3.8-Max"* |
| deepseek, ernie-bot | V4 / ERNIE 5.1 / 5.0 → **no version** | neither page says which model the chat runs; deepseek.com leads with *"DeepSeek V4.1 Flash has been updated to version V4.1-Flash-1017"* |

## CURRENT (re-read, unchanged)

- **chatgpt**: *"$0 / $8 / $20 / From $100"*; Help Center Plus *"$20/month (billed monthly)"*, Pro *"Pro 100 $100 … Pro 200 $200 … Pro 500 $500"*, *"Annual billing and payment for multiple months in advance are not available"*; Business *"$20/month if billed annually. $25/month if billed monthly"*, Premium *"$100/month if billed annually. $125/month if billed monthly"*.
- **claude-ai**: support.claude.com Pro *"$20 per month (US)"*, Max *"$100 per month"*, Ultra *"$200 per month"*, Team *"Standard seats $25 per member per month, billed monthly $20 per member per month, billed annually Premium seats $125 … $100"*. **Pro annual ($17) has no USD source**: the help center only says *"Save on your Pro plan subscription by switching from monthly to annual billing"*, and claude.com/pricing serves SGD (*"$25 Per month with annual subscription discount ($300 billed up front). $30 if billed monthly"*, *"Prices include 9% GST"*).
- **kimi**: Annually *"$15 … $19 Billed annually $180"*, *"$31 … $372"*, *"$79 … $948"*, *"$159 … $1,908"*; Monthly *$19 / $39 / $99 / $199*; Business *"$600 / year / seat Billed annually"*.
- **manus**: Monthly Pro 4K *$20*, 8K *$40*, Max *"$200"* list; Annually Pro 4K *"$17 / month, billed yearly"*, 8K *"$34"*; Team *"US$20 per seat per month or US$200 per seat per year"*.
- **kling**: Yearly *"Then $79.2/year"*, *"Then $293.04/year"*, Premier 8K *"Then $728.64/year"* (struck *$1104* = 12 × $92), Ultra+ *"Then $4902.99/year"*; Monthly struck *$10 / $37 / $207 (18K)*.
- **v0**: docs *"Free $0/month · Premium $20/month · Plus $30/user/month · Business $100/user/month"*; no annual text on the docs or pricing page.
- **ernie-bot**: yiyan.baidu.com → wenxin.baidu.com (百度文心助手), free, no paid plan shown.
