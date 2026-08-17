# Subscription re-verification — 2026-08-17

Closes open item 2 (whole-file staleness) and open item 1 (two unverified flags).
Every figure below was read off the vendor's own live page today. Where a price could
not be sourced, the file is **unchanged** and the reason is recorded here rather than
guessed — the same posture as the OMITTED chase list.

## Staleness, re-measured (not inherited from the 2026-08-07 note)

Sorted on `lastVerified` before touching anything:

| Date | Count | Age at 2026-08-17 |
|---|---|---|
| 2026-07-07 | 6 | 41 days |
| 2026-07-11 | 22 | 37 days |

Newest anywhere was **2026-07-11**. The 08-07 measurement held exactly.

**After this pass**: 19 at 2026-08-17, 5 at 2026-07-11, 4 at 2026-07-07.

`lastVerified` is only advanced where the **tier prices** were confirmed against the
vendor's live page. Confirming a model name is not confirming a price, so entries whose
descriptions were corrected but whose prices could not be re-read keep their old date.
That keeps the staleness visible instead of papering over it.

---

## Open item 1 — the two flags, both resolved

### (a) Cursor Pro+ annual — the $48 was right, and now it has a source

The 07-11 note put Pro+ annual "near $48" with **no source**, and the 2026-08-12 browser
attempt failed. It failed on a real obstacle, but a surmountable one:

- `resize_window` with a **preset** (`desktop`) does **not** clear the 0×0 viewport.
  Passing explicit `width`/`height` (1440×900) does. Without a real viewport the
  accessibility tree is empty and coordinate clicks are refused.
- The page renders **two** copies of every pricing radio — a hidden mobile set (0×0) and
  the visible desktop set. Synthetic `.click()` lands on the hidden one and changes
  nothing, which is why the yearly prices looked unreachable.

With a real viewport and real clicks on the visible controls:

| Cursor tier | Monthly | Yearly |
|---|---|---|
| Hobby | $0 | $0 |
| Pro | $20 | $16 |
| **Pro+** | $60 | **$48** |
| **Ultra** | $200 | **$160** |
| Teams Standard | $40 /user | $32 /user |
| **Teams Premium** | **$120 /user** | **$96 /user** |

Uniform 20% annual discount. The file had Pro+ and Ultra annual **equal to monthly**
(60 and 200) — both corrected. **Teams Premium was missing entirely** and was added;
"Teams" is renamed "Teams Standard" to match the vendor's own segmented control.

`__NEXT_DATA__` is still absent and yearly prices still live in React state — the
07-11 note was accurate about the mechanism, just not about it being a dead end.

### (b) Copilot "Max" — the note was right; the 08-12 confirmation was wrong

The 07-11 note claimed a **Max** tier. The 08-12 check "confirmed" tiers as
Free/Pro/Pro+/Business/Enterprise and treated Max as a ghost. **Max is real.**
Two independent official sources:

- `github.com/features/copilot/plans` raw HTML — `>Max<` appears 38× in the comparison
  table alongside Free/Pro/Pro+, with: *"GitHub Copilot Max is built for heavy Copilot
  usage, including sustained agent-driven workflows, and includes $100/month in GitHub
  AI Credits."*
- `docs.github.com/en/copilot/get-started/plans` pricing table — "Copilot Max: $100 USD
  per month".

Added at $100/mo. Full ladder confirmed: Free $0, Pro $10, Pro+ $39, **Max $100**,
Business $19/seat, Enterprise $39/seat.

The lesson is the one already in CLAUDE.md about `MODEL_MAP`: a check that enumerates
what it expects to find will confirm exactly that and miss the rest. The 08-12 pass
listed five tiers and stopped.

---

## Changed — price and tier corrections

| Entry | Change | Source |
|---|---|---|
| cursor | Pro+ annual 60 → **48**; Ultra annual 200 → **160** | cursor.com/pricing, Yearly toggle |
| cursor | **+ Teams Premium** $120 / $96; "Teams" → "Teams Standard" | same |
| github-copilot | **+ Max** $100/mo | plans page + docs.github.com |
| grok | **+ SuperGrok Plus** $100/mo | x.ai/pricing |
| perplexity | Pro annual 16.67 → **17**; Max annual 166.67 → **167** | perplexity.ai/pro |
| zhipu-ai | Coding Pro 72 → **80**; Coding Max 160 → **168** (list prices) | z.ai/subscribe |
| v0 | tier "Team" → **"Plus"** | v0.app/pricing |

Perplexity: the file carried $200/12 = 16.67; the vendor now displays a flat **$17**
("/month or equivalent, when billed annually"). Matching the vendor's own figure is
consistent with how Claude Pro's $17 is already stored.

Zhipu: list prices recorded, per the existing convention used for Kling. A standing
promo runs ~30% lower ($12.60 / $56 / $117.60).

## Changed — descriptions naming superseded models

All three flagged by the site review, plus four more found in passing:

| Entry | Was | Now | Source |
|---|---|---|---|
| chatgpt | GPT-5.5 | **GPT-5.6** (Luna / Sol / Sol Pro) | openai.com/chatgpt/pricing |
| claude-ai | Opus 4.8 | **Opus 5** | anthropic.com/claude-code |
| gemini | 3.5 Flash | **3.6 Flash** | gemini.google/subscriptions |
| grok | Grok 4.3 & 4.5 | **Grok 4.6** | x.ai/pricing |
| kimi | Kimi K2.6 | **Kimi K3** | kimi.com title |
| zhipu-ai | GLM-5.2 | **GLM-5.3** | z.ai title |
| hailuo-ai | Hailuo 2.3 | **MiniMax H3** | hailuoai.video |
| manus | "operating under Meta" | resuming independence | manus.im site banner |

## Open item 3 — `underlyingModels`

Was 7/28 with none listing `claude-opus-5`. Every id below was checked against the live
`/api/models` catalogue (414 ids) before being written — no id was invented:

- **chatgpt** → `gpt-chat-latest`, `gpt-5.6-sol`, `gpt-5.6-sol-pro`, `gpt-5.6-luna`
- **claude-ai** / **claude-code** → `claude-opus-5`, `claude-sonnet-5`, `claude-fable-5`
- **gemini** → `gemini-3.1-pro-preview`, `gemini-3.6-flash`
- **grok** → `grok-4.6`, `grok-4.5`

Still 7/28 by count — this pass corrected the existing entries rather than extending
coverage. Perplexity publishes its model mix (Sonar 2, GPT-5.6 Terra, Gemini 3.7 Flash,
Claude Sonnet 5, Kimi K3, GLM 5.2) and is the obvious next candidate, but "models this
subscription routes to" is a different claim from "models this vendor makes", so it is
left for a deliberate pass. Note **Gemini 3.7 Flash** is named by Perplexity but is
**not in our catalogue** — do not add it on that basis alone.

---

## Verified, no change needed

Prices read off the vendor page and matched the file exactly:

- **elevenlabs** — page states annual equivalents verbatim: $5 / $18.33 / $82.50 / $249.17.
- **runway** — $15→$12, $35→$28, $95→$76 (page states the $36/$84/$228 yearly savings).
- **replit** — Core $25→$20 (Save 20%), Pro $100→$95 (Save 5%).
- **suno** — Pro $10→$8, Premier $30→$24 (saves $24 / $72 yearly).
- **midjourney** — $10/$8, $30/$24, $60/$48, $120/$96; 20% annual, paid upfront.
- **gemini** — $0 / $4.99 / $19.99 / $99.99 / $199.99.
- **manus** — $20/$40/$200 monthly; $17/$34/$167 annual ("Save 17%").
- **lovable** — Free $0, Pro $25, Business $50; yearly "2 months free".
- **windsurf (Devin)** — Free $0, Pro $20, Max $200, Teams $40/seat.

Two near-misses worth recording, because both would have written a wrong number:

- **Kling** — the $6.99 shown against Standard is a **first-month promo on the monthly
  plan** (list $10, renewals $8.80), not the annual price. The real yearly figures are
  $79.20/yr → **$6.60/mo** and $293.04/yr → **$24.42/mo**, which match the file exactly.
  The file was already right; reading the promo would have broken it.
- **Manus** — prices render as animated digit rollers. Screenshotting before they settle
  reads "$209" for a tier whose annual price is **$167**. Let the rollers settle.

---

## PROOF OF ABSENCE — not changed, could not be sourced

### chatgpt — prices geolocated to SGD (kept 2026-07-07)
`openai.com/chatgpt/pricing` serves **SGD** (SGD 0 / 11 / 30 / 138), not USD. The tier
names, structure ("5x or 20x more usage") and model names are readable and were used;
the USD figures are **not sourceable from this page** and were left untouched.
`chatgpt.com/pricing` sits behind a Cloudflare interstitial that is not to be worked around.

### github-copilot annual — GitHub publishes monthly only
Both the plans page and `docs.github.com` show monthly prices with **zero** "per year" /
"annually" / "yearly" price strings. The file's `annualMonthlyPrice` 8.33 (Pro) and 32.5
(Pro+) are therefore **unsourced but left unchanged** — absence from a marketing page is
not proof annual billing does not exist in the billing UI. Only SEO aggregators assert
$100/yr, and CLAUDE.md already records those as mutually contradictory. **Flagged, not fixed.**

### mistral annual — monthly only on the page
Monthly confirmed ($5.99 student / $14.99 Pro / $24.99 Team). Annual 11.99 / 19.99 not
shown; left unchanged. Stamped because every published price matched.

### microsoft-copilot — partially verified, so NOT stamped (kept 2026-07-11)
Only Copilot Business was confirmed: **$18.00/user/mo paid yearly** (down from $21.00),
**$25.20/user/mo** monthly. The file stored 21 as the *monthly* price — that is the
pre-promo **annual** rate, so monthly was corrected to 25.2 and the annual 18 kept.
"M365 Premium" ($19.99) and "M365 Copilot" ($30/seat) are **not on this page** and were
not verified; the date stays stale to reflect that.

### kimi — pricing page is gone (kept 2026-07-07)
`www.kimi.com/pricing` now **redirects to the site root**. The USD Adagio→Vivace ladder
could not be re-read and is unchanged. The `url` field is stale but no replacement was
found, so it is left rather than pointed somewhere invented. Model name (K3) updated —
confirmed twice (kimi.com title, and Perplexity's published model list).

### hailuo-ai — subscribe page requires sign-in (kept 2026-07-11)
`hailuoai.video/subscribe` redirects to root; plan prices sit behind auth. Only a
"$9.99/mo" promo banner is public, which does not map to a named tier. Prices unchanged.
Model name (MiniMax H3) updated from the public page.

### ernie-bot, doubao, deepseek, qwen-chat, meta-ai — not re-checked
All five are free-tier-only entries (`doubao` additionally carries three null-priced China
tiers). They were **not** re-verified this pass and keep their old dates. They carry no
USD price that can drift, so they are the lowest-value half of the backlog — but the dates
are left honest rather than stamped on a "probably still free" assumption.

---

## Note, not acted on

`x.ai` now titles its pages **"SpaceXAI"**. The entry still reads `provider: 'xAI'` /
`providerId: 'x-ai'`. Renaming `providerId` would break the logo route and the model-page
joins, so it is recorded here rather than changed on the strength of a page title.

Also: X Premium ($8) and X Premium+ ($40) remain in the Grok entry but no longer appear on
`x.ai/pricing` — they are X/Twitter subscriptions, a separate product. Left in place
because their removal is a product judgement, not something the page proves.
