# Pricing verify — 2026-08 (SUPERVISED DRY RUN)

**Committed here, not in `scratchpad/`**, per the F5 finding below — which this file's own
relocation is the first application of.

**Run date**: 2026-08-18. **Branch**: `pricing-verify/2026-08`. **Base**: `cb597ca`.
**Executed by**: inline session, not the scheduled task — `tokenapp-pricing-verify`
has no programmatic "Run now"; the MCP server exposes only list/create/update/delete.

This is the supervised dry run required before the 2026-09-01 fire. It follows
`docs/proposals/pricing-verify-prompt.md`. Hard stops honoured: **no push, no PR, no
deploy, no `/api/refresh`.** Ends with a local branch + this report.

## Counts

| | |
|---|---|
| Entries in file | 28 |
| Prices re-read against a live vendor page | **5** (kling, manus, cursor, microsoft-copilot, hailuo-ai) |
| Reachability-probed only | 9 |
| Numbers changed | **2** |
| `lastVerified` bumped | **0** — see "Stamping" below |
| Left stale, with reason | 9 |

**Truncation**: deliberate. The 19 entries stamped `2026-08-17` were verified *the day
before this run* and were not re-read. This run targeted the traps and the stale tail.

---

## CHANGED — 2 numbers, both sourced with a quote

### 1. `microsoft-copilot` → M365 Premium: `annualMonthlyPrice` 19.99 → **16.67**

Source: `microsoft.com/en-us/microsoft-365-copilot/pricing/individuals`, both toggle states
read on the same page:

> "Microsoft 365 Premium | **$199.99** | /year"

> "Microsoft 365 Premium | **$19.99** | /month"

$199.99 ÷ 12 = **$16.666** → 16.67. The file asserted `19.99` for both fields, i.e. *no
annual discount*, which the vendor's own page contradicts. Monthly `19.99` confirmed
correct and unchanged. Division-to-monthly is the convention already used for Kling
($79.20/yr → 6.6), which is why this is a correction and not a new convention.

Sibling SKUs corroborate the ~17% annual pattern: Personal $9.99/mo vs $99.99/yr,
Family $12.99/mo vs $129.99/yr.

### 2. `microsoft-copilot` → Copilot Business: `annualMonthlyPrice` 18 → **21**

Source: `microsoft.com/en-us/microsoft-365-copilot/pricing`, Business plans tab:

> "Microsoft 365 Copilot Business | **Originally starting from $21.00 now starting from
> $18.00** | $21.00 | $18.00 | user/month, paid yearly"

**$18.00 is a promotion; $21.00 is list.** The pinned prompt's rule is explicit — *"Record
LIST prices, not promotions. A standing discount goes in the report, not the file."* The
file was storing the promo.

The file was also **internally incoherent** about it, which is the strongest evidence the
old value was wrong: stored monthly `25.2` = 21 × 1.2, i.e. derived from the **$21 list**,
not from $18 (18 × 1.2 = 21.6). With annual = 21 both fields now come from the same
price basis. The entry's own feature string already conceded the point — `'$18 promo
through Sep 2026'` — so this was a known-promo value sitting in a list-price field.

Feature string updated to `'List $21/user/mo; $18 promo through Sep 2026'` so the promo
stays visible to users without occupying the price field.

**Time bomb for the next run**: that promo expires **Sep 2026** — the same month the
scheduled task first fires. Whoever reviews the 09-01 output should check whether $18
lapsed back to $21.

---

## Stamping — 0 bumps, deliberately

`lastVerified` means *prices verified*. `microsoft-copilot` was improved but only
**partially** re-read: M365 Premium (both cadences) and Copilot Business annual were
confirmed; **Copilot Business monthly and the Enterprise-tab "M365 Copilot" $30/seat were
not**. Per the rule, a partial read does not earn a stamp, so it stays **2026-07-11** —
the same call the 08-17 pass made on this entry, for the same reason.

kling / manus / cursor were fully re-read and matched, but they are already stamped
`2026-08-17`; re-stamping to 08-18 would be one-day churn conveying nothing. Recorded here
instead. **Flagged as a genuine ambiguity in the routine** — see finding F6.

---

## VERIFIED, no change — the three named traps all reproduced

### Kling — promo-vs-annual trap: LIVE, and the file is right

Monthly toggle active by default. Standard shows **$6.99**, under *"30% Off 1st … Then
$8.8/month … Monthly subscription can be canceled anytime"*, list **$10**. Reading $6.99
as annual is exactly the recorded error.

Yearly toggle clicked; real annual figures:

| Tier | Yearly total | ÷12 | File | |
|---|---|---|---|---|
| Standard | $79.20 (list $120) | 6.60 | 6.6 | ✅ |
| Pro | $293.04 (list $444) | 24.42 | 24.42 | ✅ |
| Premier | $728.64 (list $1104) | 60.72 | 60.72 | ✅ |
| Ultra | $1429.99 (list $2160) | 119.17 | 119.17 | ✅ |

Monthly list $10 / $37 / $92 / $180 all match. **Team tier not re-read** (Business tab).

### Manus — animated digit rollers: LIVE, and worse than documented (see F1)

Monthly settled: **$20 / $40 / $200** ✅. Annual settled: **$17 / $34 / $167** ✅ — all
match the file. Mid-animation capture reproduced the failure exactly: tiers rendered as
`$2ᴑ`, `$4ọ`, `$2ᴑ7`, which is where the recorded "$209" came from.

Banner confirms the 08-17 description change: *"Manus will soon resume operating as an
independent company."*

### Cursor — hidden mobile radios: LIVE, exactly 6 hidden vs 6 visible

Enumerated: **6 controls at 0×0** (`monthly`/`yearly`/`pro`/`pro_plus`/`ultra` + labels)
shadowing 6 visible ones. Confirmed with an explicit 1440×900 viewport — the recorded
`resize_window` preset bug was avoided by passing width/height, as instructed.

Full matrix, every cell read with a real click on the *visible* control and each radio's
`checked` state asserted before reading the price:

| Tier | Monthly | Yearly | File |
|---|---|---|---|
| Hobby | Free | Free | 0 / 0 ✅ |
| Pro | $20 | $16 | 20 / 16 ✅ |
| Pro+ | $60 | $48 | 60 / 48 ✅ |
| Ultra | $200 | $160 | 200 / 160 ✅ |
| Teams Standard | $40 | $32 | 40 / 32 ✅ |
| Teams Premium | $120 | $96 | 120 / 96 ✅ |

**Page was restructured since 08-17**: flat tier cards are now nested segmented controls
(Individual → Pro/Pro+/Ultra, Teams → Standard/Premium). Prices unchanged; the *navigation*
changed. The trap note in the pinned prompt should say there are now three toggle levels.

---

## PROOF OF ABSENCE — checked, unchanged

### hailuo-ai — auth wall HOLDS. The curl 200 is a mirage. (headline near-miss)

`curl https://hailuoai.video/subscribe` now returns **200 with a 625 KB body containing
prices** — which reads like the recorded auth wall has dropped. It has not.

In a real browser `/subscribe`, `/pricing` and `/membership` **all client-side redirect to
the site root**, unauthenticated, exactly as recorded. The only public price signal is the
`From $9.99/mo` banner. The 200 is the Next.js SSR shell served before the client bounce.

Worse, the prices inside that shell are a **stale embedded help-article blob that
contradicts itself**: one section reads *"Pro Plan • Price: $54.99/month, limited-time
offer at $24.99"* while a referral section in the same document reads *"$34.99 is the Pro
Monthly Plan price"*. It also describes a "Master Plan • $94.99/month, limited-time offer
at **$63.99**" — and **$63.99 is what our file stores as Master's annual price**. So the
blob would simultaneously (a) look authoritative, (b) contradict itself, and (c) recast one
of our annual prices as a monthly promo. Nothing changed. Entry stays **2026-07-11**.

### ernie-bot — stored URL now redirects to a rebranded product

`yiyan.baidu.com` → 302 → `wenxin.baidu.com/?enter_type=yiyan_site`, which returns 200 and
titles itself **百度文心助手** ("Baidu Wenxin Assistant"). The stored `url` still resolves
via redirect, so it is not broken, but it no longer points at a page named for the product
we list. Free-tier-only, no USD price to drift. **Not changed** — a rename is a product
judgement, not something a redirect proves. Flagged for a human.

### The rest of the stale tail — reachability probed, outcomes unchanged

| Entry | Probe | Recorded expectation |
|---|---|---|
| `chatgpt` | `chatgpt.com/pricing` **403**; `openai.com/chatgpt/pricing` **403 to curl** | holds (Cloudflare; SGD in browser) |
| `kimi` | `www.kimi.com/pricing` **302 → root** | holds (page gone) |
| `meta-ai` | **403** | holds |
| `deepseek` | 202 | free-tier only |
| `qwen-chat` | 200 | free-tier only |
| `doubao` | 302 → `/chat/` | free-tier only |

None re-priced. All keep their existing dates.

---

## FINDINGS — where the routine goes wrong. This is the point of the dry run.

### F1 — Manus: the documented countermeasure does not work for text extraction

The prompt says the rollers *"render as animated digit rollers… Wait for them to stop."*
That is correct **only for screenshots**. `get_page_text` on that page returns:

```
$ 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 / month
```

Every digit 0–9 lives in the DOM permanently; a CSS transform selects the visible one.
**Waiting changes nothing** — text extraction returns all ten digits forever. A naive
`/\$(\d+)/` against that string yields **`$0`**, i.e. it would report every Manus tier as
free. The prompt's guidance would leave an agent waiting for a state that never arrives.

**Fix**: amend the trap row to *"read the rendered value — screenshot after settling, or
compute the visible digit from the transform. Never text-extract Manus prices."*

### F2 — Kling has a Cursor-class duplicate toggle, and it is undetectable by size

Two `Yearly`/`Monthly` pairs exist, at y=132 and y=1534. **Both report non-zero
dimensions**, unlike Cursor's 0×0 decoys. So the "filter out the hidden ones" heuristic —
the only countermeasure the prompt documents — silently fails here. Position is the sole
discriminator.

**Fix**: generalise the Cursor row into a rule for all vendors: *enumerate every matching
control, assert how many exist, and click the topmost visible one; never `querySelector`
the first match.*

### F3 — the "sort by lastVerified ascending" rule points the run at its own dead ends

Procedure step 3 sorts oldest-first *"so a truncated run still improves the worst data."*
Measured today, the 9 oldest entries are:

`chatgpt, doubao, ernie-bot, kimi` (07-07) + `deepseek, hailuo-ai, meta-ai,
microsoft-copilot, qwen-chat` (07-11)

That set is **exactly** the prompt's own "nine that defeat verification" list, minus
`github-copilot` and `mistral-lechat` (both since stamped). The two rules are in direct
conflict: step 3 sends the run to the front of the queue, and the traps table then says
*"Do not burn the budget rediscovering these. Confirm quickly, then move on."* A truncated
run following step 3 improves **nothing** — it spends its entire budget on the entries
that are unverifiable by construction. The one exception found today,
`microsoft-copilot`, is the only member of that nine that carries real USD prices.

**Fix**: sort oldest-first **within the verifiable set**; probe the nine cheaply for
*change* (a status-code sweep costs seconds) and only escalate one to a browser if its
reachability moved. That ordering would have found today's Microsoft corrections first.

### F4 — "UNVERIFIABLE" was reached from one view of a tabbed page, again

The 08-17 record states M365 Premium and M365 Copilot are *"not on this page and were not
verified."* They are on that page — behind the **"Individual plans" / "Enterprise plans"**
tabs. Switching tab yielded both the $199.99/yr and $19.99/mo figures that produced
correction #1.

This is the **third** instance of the same failure: GitHub's annual price (one docs sidebar
link away), Perplexity's stale `features[]` (found by reasoning, not the grep), and now
Microsoft's tabs. The prompt already has a section on it — *"Do not conclude UNVERIFIABLE
from the pricing page alone"* — but it only tells you to check **docs/billing/help pages**.
It does not say **exhaust the tabs, toggles and segmented controls on the page you are
already on**.

**Fix**: add to that section — *"Before UNVERIFIABLE, enumerate every tab, toggle and
segmented control on the page and read each state. A price you cannot see may be one
click away on the same URL."*

### F5 — the report is written to a gitignored directory

The routine's three deliverables are a report at `scratchpad/…`, a branch, and
`lastVerified` bumps. **`scratchpad/` is in `.gitignore`** (line 10). So the branch carries
the price change and *none* of the evidence for it. A human reviewing
`pricing-verify/2026-08` sees `18 → 21` with no quote, no URL, no reasoning — precisely the
unsourced-number state the whole routine exists to prevent.

This is not hypothetical: **`scratchpad/dump.mjs` no longer exists**, though CLAUDE.md's
Current Work block still advertises it and procedure step 7 calls for it. It was lost to
exactly this. (Step 7 hedges *"if it exists"*, so it degrades to a silent no-op rather than
an error — the diff-before/after safety check simply did not run today.)

**Fix**: write the report to `docs/reviews/pricing-verify-YYYY-MM.md` and commit it on the
branch, matching where every other review record in this repo lives.

### F6 — "bump only what you re-read" has no answer for a same-value re-read

kling, manus and cursor were fully re-read today and matched. They are stamped 08-17. The
rule says bump only where prices were re-read — which argues for 08-18 — but a one-day bump
across three entries is diff churn with no information. The prompt does not say which wins.

**Fix**: state a rule. Suggested: *bump only when the new date is at least 7 days after the
stored one, or when a value changed; otherwise record the confirmation in the report.*
Today's run followed that, and stamped nothing.

### F7 — the traps table is titled "the nine" and lists ten entries

`ernie-bot, doubao, deepseek, qwen-chat, meta-ai` share one row, making the visible row
count six but the entry count ten. Minor, but the routine sorts and counts against this
list, and I initially mis-tallied it.

### F8 — permission pre-approval, confirmed as a real Sep 1 blocker

Neither `.claude/settings.local.json` nor `~/.claude/settings.json` contains any
`mcp__Claude_Browser__*` or `mcp__claude-in-chrome__*` entry. Today's run needed
`preview_start`, `resize_window`, `navigate`, `get_page_text`, `read_page`, `find`,
`computer` (screenshot / left_click / scroll / wait / zoom) and `javascript_tool`. A
headless 09-01 run stalls on the first of these with nobody to approve it — and the pages
it would stall on (kling, manus, cursor, microsoft) are the four that carried every
correction in the last two passes.

### F9 — operational notes from today

- **`computer{action:"scroll"}` and `left_click` with `coordinate` require a prior
  `screenshot`** in the same tab, or they error. Not in the prompt; costs a round trip each
  time. Worth a line.
- **`zoom` with `region` is unsupported** in the Browser pane — it silently returns the
  full screenshot instead of the crop. Do not rely on it to read small print.
- **The Browser pane hung once** (30s timeout, "pane is currently hidden") mid-run on
  microsoft.com. Recovered via `javascript_tool`. An unattended run needs a retry/fallback
  path or it dies here.
- **cursor.com fired a clipboard write** during a synthetic click — the harness warned that
  page content landed on the OS clipboard. Harmless, but an unattended monthly run
  silently overwriting the user's clipboard is worth knowing about.

---

## Not done / left for a human

- `microsoft-copilot`: Copilot Business **monthly** and the Enterprise-tab **M365 Copilot
  $30/seat** were not re-read. Entry deliberately left unstamped at 2026-07-11.
- `kling`: Team tier (Business tab) not re-read.
- The 19 entries stamped 2026-08-17 were not re-read at all.
- `ernie-bot` URL rename (百度文心助手) — flagged, not changed.

## Verification

- `npm test` — **72/72 pass**.
- `./node_modules/.bin/tsc --noEmit` — clean (0.63s).
- `node scratchpad/dump.mjs` — **could not run, file does not exist** (see F5).
- No push, no PR, no deploy, no refresh. Branch is local.
