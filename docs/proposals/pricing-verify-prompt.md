# Pinned run prompt — monthly subscription pricing verify

This file IS the routine. The scheduled task (`tokenapp-pricing-verify`) is a thin
launcher that reads this file and follows it, so the guardrails stay version-controlled,
reviewable and diffable instead of living in a task definition nobody sees.

Approved 2026-08-17 as Option B of `2026-07-11-monthly-pricing-verify.md`.

---

## Mission

Re-verify every entry in `src/subscriptions.ts` against the vendor's own live pricing
page, and leave **three things for human review**:

1. a **findings report** at `scratchpad/pricing-verify-YYYY-MM.md` — a per-entry verdict
   table (CURRENT / STALE→value / UNVERIFIABLE) with source URLs and quotes,
2. a **branch** `pricing-verify/YYYY-MM` containing only the confirmed fixes,
3. **`lastVerified` bumps** on the entries whose prices were actually re-read.

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

## Known traps — each of these has produced a wrong number before

| Vendor | Trap |
|---|---|
| **Kling** | The `$6.99` shown against Standard is a **first-month promo on the MONTHLY plan**, not the annual price. Real annual is $79.20/yr → $6.60/mo. |
| **Manus** | Prices render as **animated digit rollers**. Screenshotting before they settle reads `$209` for a tier priced `$167`. Wait for them to stop. |
| **Cursor** | `resize_window` with a **preset** does not clear a 0×0 viewport — pass explicit `width`/`height`. The page also renders a **hidden mobile duplicate of every pricing radio**; a synthetic click lands on the invisible one and changes nothing. Click the visible desktop control. |
| **Suno** | The page defaults to the **annual** toggle. Read which toggle is active before recording a "monthly" price. |
| **ChatGPT** | `openai.com/chatgpt/pricing` geolocates to **SGD**. Tier names, structure and model names are readable; the **USD figures are not sourceable from it**. `chatgpt.com/pricing` sits behind a Cloudflare interstitial — do not work around it. |
| **z.ai** | The GLM model list appears only in `<title>`/`<meta keywords>` — the keywords tag is SEO stuffing. The rendered tiers say only "latest flagship models". Do not treat an SEO tag as a published per-plan model list. |

## Pages that need a real browser (fetch-only will fail)

`perplexity.ai/pro` returns **403 to both curl and WebFetch**. `x.ai` and `meta.ai`
return 403 to curl. Also JS-rendered: `hailuoai.video`, `kimi.com`, `kling.ai`,
`manus.im`, `suno.com`, `gemini.google/subscriptions`.

Use the browser tools for these. `~/.browser-use-env/bin/python` has Playwright if needed.

## The nine that defeat verification — check, but expect these outcomes

Do not burn the budget rediscovering these. Confirm quickly, then move on.

| Entry | Expected outcome |
|---|---|
| `chatgpt` | SGD geolocation; USD not sourceable from the pricing page |
| `github-copilot` | Annual is **discontinued** (legacy since 2026-06-01) — annual == monthly is correct and sourced |
| `mistral-lechat` | Page shows monthly only; annual 11.99/19.99 unsourced |
| `microsoft-copilot` | Page covers business bundles; "M365 Premium" and "M365 Copilot" not on it |
| `kimi` | `www.kimi.com/pricing` **redirects to root** — the USD ladder cannot be re-read |
| `hailuo-ai` | `hailuoai.video/subscribe` requires **sign-in**; only a $9.99 promo banner is public |
| `ernie-bot`, `doubao`, `deepseek`, `qwen-chat`, `meta-ai` | Free-tier-only entries with no USD price that can drift |

If any of these **changes** — a pricing page comes back, an auth wall drops — that is a
headline finding. Say so loudly in the report.

## Procedure

1. `git checkout main && git pull` then `git checkout -b pricing-verify/YYYY-MM`.
2. Read `docs/reviews/2026-08-17-subscription-reverification.md` and
   `2026-08-17-open-items-followup.md` first. They record what is already settled and why.
3. Sort entries by `lastVerified` ascending and work oldest first, so a truncated run still
   improves the worst data.
4. For each entry: open the vendor page, read monthly AND annual for every tier, compare
   against the file, and record a verdict with a quote.
5. Apply only confirmed fixes. Bump `lastVerified` only where prices were re-read.
6. Run `npm test` and `./node_modules/.bin/tsc --noEmit`. Both must pass.
7. Diff the data before/after with `node scratchpad/dump.mjs` if it exists.
8. Commit to the branch. Write the report. **Stop and notify.**

## Reporting rules

- Every changed number gets a source URL and a quoted string.
- Every unchanged-but-suspicious number gets a recorded reason.
- State the counts plainly: how many verified, how many stamped, how many left stale.
- If the run was truncated, say exactly where it stopped.

## Remember

Editing `src/subscriptions.ts` does **not** change the live site. `getSubscriptions` reads
KV and prod KV is seeded, so the order is **deploy → propagate → refresh → verify**, and
that is a human's job after reviewing this branch.
