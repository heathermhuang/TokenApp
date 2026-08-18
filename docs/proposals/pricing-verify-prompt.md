# Pinned run prompt — monthly subscription pricing verify

This file IS the routine. The scheduled task (`tokenapp-pricing-verify`) is a thin
launcher that reads this file and follows it, so the guardrails stay version-controlled,
reviewable and diffable instead of living in a task definition nobody sees.

Approved 2026-08-17 as Option B of `2026-07-11-monthly-pricing-verify.md`.

---

## Mission

Re-verify every entry in `src/subscriptions.ts` against the vendor's own live pricing
page, and leave **three things for human review**:

1. a **findings report** at `docs/reviews/pricing-verify-YYYY-MM.md`, **committed on the
   branch** — a per-entry verdict table (CURRENT / STALE→value / UNVERIFIABLE) with source
   URLs and quotes. **Not `scratchpad/`**: that directory is gitignored, so the branch would
   carry the price change and none of the evidence for it — exactly the unsourced-number
   state this routine exists to prevent. It is not hypothetical: `scratchpad/dump.mjs` was
   lost that way and step 7 below silently no-opped on 2026-08-18 as a result,
2. a **branch** `pricing-verify/YYYY-MM` containing only the confirmed fixes,
3. **`lastVerified` bumps** on the entries whose prices were actually re-read.

## Prerequisite — browser tools must already be approved

This run **cannot complete** without the browser tools, and a scheduled run has nobody at
the keyboard to approve them. Measured 2026-08-18: neither `.claude/settings.local.json`
nor `~/.claude/settings.json` contained any `mcp__Claude_Browser__*` entry, so an
unattended run would stall on the first gated vendor page — and the pages it stalls on
(kling, manus, cursor, microsoft) are the four that carried every correction in the last
two passes.

Tools this run needs: `preview_start`, `resize_window`, `navigate`, `get_page_text`,
`read_page`, `find`, `computer` (screenshot / left_click / scroll / wait), `javascript_tool`.

Approve them once via a supervised **Run now**, or add them to settings, before relying on
the scheduled run.

## Hard stops — these are not negotiable

- **No `git push`. No PR. No `npm run deploy`. No `POST /api/refresh`.** The run ends with
  a local branch and a report. A human ships it.
- **Never change a price without a quote from the vendor's own page** in the report. Not an
  SEO aggregator, not a blog, not a cached summary. `CLAUDE.md` records that the
  aggregators contradict each other outright.
- **Flag, don't change, anything ambiguous.** A price you cannot source is a price you do
  not touch. Write down the proof of absence instead — that is a successful outcome, not a
  failure.
- **Record LIST prices, not promotions.** A standing discount goes in the report, not the
  file.
- **Never invent a model id.** Every id written to `underlyingModels` must be checked
  against `curl -s https://token.app/api/models | jq -r '.models[].id'` first. The
  catalogue is live and changes weekly in both directions.
- **Do not bypass Cloudflare interstitials or CAPTCHAs.** If a page is gated, that is an
  UNVERIFIABLE with a reason. Loading a public page in a real browser is fine; working
  around a bot check is not.

## What `lastVerified` means

It means **the tier PRICES were checked** on that date. Nothing else.

Only bump it for entries whose prices you actually re-read on the vendor page. If you
corrected a model name but could not reach the prices, **leave the date alone** — that
keeps the staleness visible instead of papering over it.

## Sweep `features[]`, not just `description`

PR #28 existed solely because stamped entries still carried superseded model names inside
per-tier `features[]`. A grep of the rendered page only finds names you already suspect, so
read every tier's `features[]` for version strings and check each against the live
catalogue.

If a named version is likely stale but the tier has **no published source**, **drop the
version rather than swapping it** — `'Claude Opus 4.7 & Fable 5'` → `'Claude Opus & Fable
models'`. Asserting an invented new number is worse than asserting nothing.

## Do not conclude UNVERIFIABLE from the pricing page alone

The single highest-value find of the 2026-08-17 pass was missed by the pass before it,
which had checked the right page and stopped there. GitHub publishes no annual Copilot
price on `github.com/features/copilot/plans`, and the earlier conclusion was
"unsourceable". The answer was one **docs sidebar link** away — a page titled *"Model
multipliers for annual plans (legacy)"* — which establishes that annual plans closed
2026-06-01, are legacy, and terminate into Free. That turned an unsourceable guess into a
sourced fact.

So before writing UNVERIFIABLE: check the vendor's **docs/billing/help** pages, not only
marketing. Search their docs for "annual", "yearly", "per year", "billing cycle".

**And exhaust the page you are already on.** This has now failed three times the same way —
GitHub's annual price (one docs sidebar link), Perplexity's stale tier `features[]` (found by
reasoning, not the grep), and on 2026-08-18 **Microsoft**: the 08-17 pass recorded M365 Premium
and M365 Copilot as *"not on this page"*. They were on that page, behind the **Individual
plans** / **Enterprise plans** tabs. One click yielded $199.99/yr and $19.99/mo, which produced
a real correction. Before UNVERIFIABLE, enumerate every **tab, toggle and segmented control**
and read each state. A price you cannot see may be one click away on the same URL.

## Known traps — each of these has produced a wrong number before

| Vendor | Trap |
|---|---|
| **Kling** | The `$6.99` shown against Standard is a **first-month promo on the MONTHLY plan**, not the annual price. Real annual is $79.20/yr → $6.60/mo. |
| **Manus** | Prices render as **animated digit rollers**. Two failure modes, and the fix differs. **Screenshot**: capture before they settle and you read `$209` for a tier priced `$167` — wait, then re-capture. **Text extraction**: `get_page_text` returns `$ 0 1 2 3 4 5 6 7 8 9 0 1 …` — every digit lives in the DOM permanently and a CSS transform picks the visible one, so **waiting never helps** and a naive `\$(\d+)` reads **`$0`**, i.e. every tier free. Never text-extract Manus prices; read the rendered value. |
| **Cursor** | `resize_window` with a **preset** does not clear a 0×0 viewport — pass explicit `width`/`height`. The page also renders a **hidden mobile duplicate of every pricing radio** (measured: 6 hidden at 0×0 shadowing 6 visible); a synthetic click lands on the invisible one and changes nothing. Click the visible desktop control. Tiers are now **nested segmented controls** (Individual → Pro/Pro+/Ultra, Teams → Standard/Premium), so there are three toggle levels, not one. |
| **Duplicate controls — ALL vendors** | Cursor's decoys are 0×0, so filtering on size finds them. **Kling's are not**: it renders two Yearly/Monthly pairs (y≈132 and y≈1534) and **both report non-zero dimensions**, so the size filter silently fails and only position discriminates. Therefore: **enumerate every matching control and assert how many exist**, then click the topmost visible one. Never `querySelector` the first match. |
| **Suno** | The page defaults to the **annual** toggle. Read which toggle is active before recording a "monthly" price. |
| **ChatGPT** | `openai.com/chatgpt/pricing` geolocates to **SGD**. Tier names, structure and model names are readable; the **USD figures are not sourceable from it**. `chatgpt.com/pricing` sits behind a Cloudflare interstitial — do not work around it. |
| **z.ai** | The GLM model list appears only in `<title>`/`<meta keywords>` — the keywords tag is SEO stuffing. The rendered tiers say only "latest flagship models". Do not treat an SEO tag as a published per-plan model list. |

## Pages that need a real browser (fetch-only will fail)

`perplexity.ai/pro` returns **403 to both curl and WebFetch**. `x.ai` and `meta.ai`
return 403 to curl. Also JS-rendered: `hailuoai.video`, `kimi.com`, `kling.ai`,
`manus.im`, `suno.com`, `gemini.google/subscriptions`.

Use the browser tools for these. `~/.browser-use-env/bin/python` has Playwright if needed.

## The entries that defeat verification — check, but expect these outcomes

(Ten entries across six rows — the last row groups five. Count entries, not rows.)

Do not burn the budget rediscovering these. Confirm quickly, then move on.

| Entry | Expected outcome |
|---|---|
| `chatgpt` | SGD geolocation; USD not sourceable from the pricing page |
| `github-copilot` | Annual is **discontinued** (legacy since 2026-06-01) — annual == monthly is correct and sourced |
| `mistral-lechat` | Page shows monthly only; annual 11.99/19.99 unsourced |
| `microsoft-copilot` | **NO LONGER a dead end — it is the one member of this table with real USD prices that move.** The 08-17 "not on this page" was wrong: M365 Premium and M365 Copilot sit behind the **Individual** / **Enterprise** tabs. Read every tab. |
| `kimi` | `www.kimi.com/pricing` **redirects to root** — the USD ladder cannot be re-read |
| `hailuo-ai` | `hailuoai.video/subscribe` requires **sign-in**; only a $9.99 promo banner is public. **`curl` returns HTTP 200 — that is a MIRAGE.** The 625KB SSR shell ships before a client-side redirect to root, and the prices inside it are a stale help-article blob that **contradicts itself** (one section calls `$54.99` Pro monthly, another calls it `$34.99`) and describes `$63.99` as a *monthly promo* — the exact value the file stores as Master's *annual*. Confirm in a real browser; never price this entry from curl output. |
| `ernie-bot`, `doubao`, `deepseek`, `qwen-chat`, `meta-ai` | Free-tier-only entries with no USD price that can drift |

If any of these **changes** — a pricing page comes back, an auth wall drops — that is a
headline finding. Say so loudly in the report.

## Procedure

1. `git checkout main && git pull` then `git checkout -b pricing-verify/YYYY-MM`.
2. Read `docs/reviews/2026-08-17-subscription-reverification.md` and
   `2026-08-17-open-items-followup.md` first. They record what is already settled and why.
3. Sort entries by `lastVerified` ascending and work oldest first **within the VERIFIABLE
   set** — see the warning immediately below.

   > **The naive sort points the run at its own dead ends.** Measured 2026-08-18: the nine
   > oldest entries were *exactly* the nine in the defeat-verification table below (minus the
   > two since stamped). Oldest-first therefore spends the entire budget on entries that are
   > unverifiable by construction, and a truncated run improves **nothing**. Instead: probe
   > the nine cheaply for **change** (a status-code sweep costs seconds) and escalate one to
   > a browser only if its reachability moved. Work the verifiable entries oldest-first. That
   > ordering is what surfaced the Microsoft corrections on 08-18.
4. For each entry: open the vendor page, read monthly AND annual for every tier, compare
   against the file, and record a verdict with a quote.
5. Apply only confirmed fixes. Bump `lastVerified` only where prices were re-read.
6. Run `npm test` and `./node_modules/.bin/tsc --noEmit`. Both must pass.
7. Diff the data before/after with `node scratchpad/dump.mjs`. **If it does not exist,
   say so in the report** rather than skipping silently — it is gitignored and has gone
   missing once already, and a skipped safety check that reports nothing looks identical
   to a passed one.
8. Commit to the branch. Write the report. **Stop and notify.**

## Reporting rules

- Every changed number gets a source URL and a quoted string.
- Every unchanged-but-suspicious number gets a recorded reason.
- State the counts plainly: how many verified, how many stamped, how many left stale.
- If the run was truncated, say exactly where it stopped.

## Tooling notes — measured, and each one cost a round trip

- `computer` with `coordinate` (`left_click`, `scroll`) **requires a prior `screenshot`**
  in that tab or it errors. Take one first.
- `computer` `zoom` with a `region` is **unsupported** in the Browser pane — it silently
  returns the full screenshot instead of the crop. Do not rely on it to read small print.
- Screenshots come back **scaled** (800×500 for a 1440×900 viewport). Click coordinates are
  in the screenshot frame, not the viewport frame. Locate elements with `javascript_tool`
  (which reports viewport coordinates), then convert.
- Reading a radio's **`checked`** state via `javascript_tool` is far more reliable than
  inferring the active toggle from a screenshot, and it is how the Cursor matrix was
  verified cell by cell.
- The **Browser pane can hang** (30s timeout, "pane is currently hidden"). It happened once
  on microsoft.com and was recovered via `javascript_tool`. An unattended run needs to
  tolerate this rather than die on it.
- `cursor.com` **fires a clipboard write** during a synthetic click, overwriting the user's
  OS clipboard. Harmless, but worth knowing for an unattended monthly run.

## Watch list — dated, check these first

- **Copilot Business `$18` promo expires Sep 2026** — the month this task first fires. The
  file stores the **$21 list** price (corrected 2026-08-18, because $18 is a promotion and
  this routine records list). Confirm whether $18 lapsed, and do **not** "fix" the 21 back
  down to 18 unless Microsoft has made it the standing rate.
- **`ernie-bot`'s stored URL is drifting**: `yiyan.baidu.com` now 302s to
  `wenxin.baidu.com` (百度文心助手). It still resolves, so it was left alone — a rename is a
  product judgement a redirect does not prove. Revisit if the redirect breaks.

## Remember

Editing `src/subscriptions.ts` does **not** change the live site. `getSubscriptions` reads
KV and prod KV is seeded, so the order is **deploy → propagate → refresh → verify**, and
that is a human's job after reviewing this branch.
