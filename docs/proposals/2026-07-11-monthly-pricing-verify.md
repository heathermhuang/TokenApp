# Proposal: monthly scheduled pricing-verify routine

**Status: PROPOSAL ONLY — nothing scheduled or built. Awaiting approval.**
Written 2026-07-11 after the July backlog pass (commits `6abe2e8`, `42fce43`, `8d0375f`), which is the manual prototype of exactly this routine.

## Goal

Once a month, re-verify every entry in `src/subscriptions.ts` against live provider pages and produce, **without deploying anything**:

1. a **findings report** (per-entry verdict table: CURRENT / STALE→value / UNVERIFIABLE, with source URLs + quotes),
2. a **patch** on a branch (`pricing-verify/YYYY-MM`) applying only the confirmed fixes,
3. **`lastVerified` bumps** on every entry actually checked,

all left for human review. Deploy stays manual (`npx wrangler deploy` + `/api/refresh`) after you approve the branch.

## Hard requirement that decides the architecture

This month's pass proved that **fetch-only verification is not enough**:

| Needs a real rendering browser | Why |
|---|---|
| hailuoai.video/subscribe | SPA; plans grid + Yearly/Monthly toggles render client-side |
| kimi.com (zh + intl) | JS shell; pricing only in rendered help-center/app |
| kling.ai membership | React app, odometer-animated prices |
| manus.im/pricing, suno.com/pricing | JS-rendered; Suno defaults to the *annual* toggle (misquote trap) |
| gemini.google/subscriptions | JS-rendered |
| x.ai / grok.com / perplexity.ai | Cloudflare-gated even for headless; needed help.x.com + docs.x.ai + Wayback fallbacks |

Roughly a third of the catalog needs headless Chromium (locally: `~/.browser-use-env/bin/python` + Playwright), and a few need CN-friendly network egress.

## Option A — `/schedule` cloud agent (claude.ai scheduled routine)

Runs in Anthropic's cloud on a cron, works on a GitHub clone of the repo, can open a PR.

- **Pros:** no dependency on the Mac being awake; managed retries/logs; PR-based review flow is natural.
- **Cons (disqualifying today):**
  - No local Playwright venv; JS-rendered pages fall back to WebFetch → exactly the pages that matter most go UNVERIFIABLE.
  - US-cloud egress: CN-adjacent pages (Kimi, Doubao, Kling geo quirks) behave differently than from your machine.
  - No access to `.dev.vars` (fine — refresh isn't part of the routine, but it also can't do the optional post-approval steps).
  - Cloudflare-gated sites (x.ai, perplexity) block cloud IPs *more* aggressively than residential.
- **Verdict:** good for a fetch-only "drift smoke test", not for the full verify.

## Option B — local scheduled run invoking `claude -p` (recommended)

A local scheduler runs Claude Code headlessly once a month with a pinned prompt file.

- **Scheduler choice:** prefer **Claude Code's own scheduled tasks** (the app's Scheduled Tasks feature / `launchd` fallback). `launchd` plist > cron on macOS (survives sleep via `StartCalendarInterval` + runs on next wake).
- **Invocation sketch (not built):**
  `claude -p "$(cat docs/proposals/pricing-verify-prompt.md)" --permission-mode acceptEdits` from the repo root, with the prompt hard-scoped to: research → edit → branch commit → report file. **No push, no deploy, no `/api/refresh`.**
- **Pros:** full parity with this month's successful pass — Playwright venv for JS pages, your network egress, App Store storefront checks, git identity; agents pattern reusable (cap at ~4 Sonnet research agents to control cost).
- **Cons:** Mac must be on that day (launchd mitigates); token cost each run (~1 focused session; the July pass used 9 agents because it was a backlog catch-up — steady-state monthly needs fewer).
- **Guardrails to encode in the prompt:**
  - never touch prices without an official-page quote; flag-don't-change on anything ambiguous;
  - no-fake-data: omission + documented reason beats a secondary-source number;
  - record LIST prices, not limited-time promos (Hailuo/Kling lesson);
  - work on `pricing-verify/YYYY-MM` branch; end by writing `scratchpad/pricing-verify-YYYY-MM.md` report; notify and STOP.

## Recommendation

**Option B**, monthly on the 1st at 10:00 (machine usually awake), with **Option A as a lightweight mid-month drift ping** (optional, later): a cloud routine that only checks the fetchable pages and files an issue if it sees drift — zero risk, catches fast movers like the GPT-5.3→5.5 month.

## What I'd build once approved (1 short session)

1. `docs/proposals/pricing-verify-prompt.md` — the pinned run prompt (guardrails above).
2. The scheduled-task definition (Claude Code scheduled task, or `~/Library/LaunchAgents/app.token.pricing-verify.plist`).
3. A dry run supervised by you, then hands-off.

## Open questions for you

- Cadence: monthly enough, or 1st + 15th? (`lastVerified` footer makes staleness visible either way.)
- Should the run also chase the standing OMITTED list (Dola premium, Kimi annual ¥, Manus free-tier numbers) each time, or only on request?
- Branch + report, or branch + report + GitHub PR (needs `gh` auth in the run)?
