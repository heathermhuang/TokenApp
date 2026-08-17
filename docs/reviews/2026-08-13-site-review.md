# token.app — end-to-end site review

**Date**: 2026-08-13 · **Prod version**: `056d1cff` · Measured against live production, not local builds.

Every number below was measured. Where something is a judgement call rather than a
measurement, it says so.

---

## What's good

**The data discipline is the product, and it holds up.** Three separate honesty gates
are live and working, and I verified each against production rather than reading the
code:

- The superlative strip refuses to name a winner below 2σ, computed on the *combined*
  error of both scores. SWE-bench sits at 1.65σ and is correctly excluded; SimpleQA at
  2.93σ is what the card shows.
- The usage panel is gated on membership in the newest board snapshot, so a model that
  dropped off renders nothing rather than a stale rank. `gpt-4o` (never charted) and
  `claude-opus-4.7` (off the board) both correctly show no panel.
- The benchmark join drops ambiguous version collisions instead of merging them.
  `ambiguous` is **0** with 106 models scored.

That "show nothing rather than a number we can't stand behind" posture is rare and it is
the thing worth protecting.

**Coverage and reach are real.** 414 models, 59 providers, 28 subscriptions, 1,296
sitemap URLs (413 model pages, 871 compares, provider pages). Model rows link internally,
so the programmatic pages have a front door.

**Fast where it counts.** Compare pages 0.14s TTFB, provider pages 0.08s, sitemap 0.14s.
Model pages 1.0s (the lazy per-host endpoint fetch).

**Accessibility fundamentals are mostly right**: one `h1`, clean heading order, `lang="en"`,
477 images all carrying `alt`, 443 SVGs with only 2 missing a role, no empty links. Mobile
has no horizontal page overflow — the wide table correctly scrolls inside its own wrapper.

---

## What's bad, ranked by impact

### 1. The subscription data is uniformly stale, and it shows on screen

Every one of the 28 entries: **6 stamped 2026-07-07 (37 days), 22 stamped 2026-07-11 (33
days)**. There is no fresh half to lean on.

This is not abstract. **Three of the 28 descriptions name superseded models**, and they are
the three flagship consumer plans:

| Plan | Says | Reality |
|---|---|---|
| ChatGPT | "GPT-5.5" | GPT-5.6 Luna is #3 on the usage board |
| Claude.ai | "Opus 4.8, Sonnet 5, Fable 5" | Opus 5 shipped and is #10 |
| Google AI | "Gemini 3.1 Pro & 3.5 Flash" | Gemini 3.6 Flash is #9 |

Hand-verified, dated subscription pricing is the half of this site that competitors
structurally cannot copy. It is currently the weakest half. **Manual re-verification fixes
today and decays again in a month** — the durable answer is the automation proposal in
`docs/proposals/2026-07-11-monthly-pricing-verify.md`, unapproved since 07-11.

### 2. 473 of 477 images are fetched from Google

Provider logos come from `google.com/s2/favicons?domain=…`. Every visitor's browser
therefore makes hundreds of requests to Google, leaking referrer data on a site that
otherwise ships a content-signals `robots.txt` and a cookie banner. It is also a hard
external dependency for basic branding, and an availability risk.

Self-hosting the ~59 provider logos would remove the leak, the dependency, and most of the
image requests at once.

### 3. The homepage ships 638KB and renders 414 rows immediately

- 638KB over the wire, **561KB of it a single inline script**
- **14,231 DOM nodes**, 414 table rows built on load
- On mobile the document is **33,998px tall**
- 0.85s TTFB — the slowest of any page type

The SSR-embedded payload is what makes the table instant and the boards fresh, so this is a
real trade rather than a mistake. But virtualising the table, or paginating below ~100
rows, would cut the DOM by an order of magnitude without giving that up.

### 4. Three-quarters of the model pages are thin

**307 of 413 live model pages (74%) carry no benchmark score** — price, spec and
description only. Only ~15 (4%) get a usage panel, since D1 holds just the top-15 board.

Additionally, **79 variant models** (61 `:batch`, 17 `:free`, 1 `:thinking`) get their own
page, and **71 of those have a base-model page too** — near-duplicate content differing
mainly in price, each self-canonical. Sitemap and canonical URLs *do* agree on encoding
(`%3A`), so that part is fine.

Thin, near-duplicate programmatic pages are exactly what search engines discount. Worth
deciding deliberately: either enrich them, or canonical the variants to their base.

### 5. Small accessibility gaps in the data table

- The 8 sortable `th` elements carry **no `scope` and no `aria-sort`** — sort state is
  invisible to screen readers on a site that is fundamentally a sortable table.
- **7 unlabelled buttons** (the treemap tiles — they contain only a favicon `<img>`).
- **No skip link**, with 1,392 interactive elements on the page.
- **837 of 1,392 tap targets are under 32px** on mobile. Partly inherent to a dense table,
  but worth a pass on the non-table controls.

---

## Suggested order

1. **Decide the subscription automation** (#1) — the only item with active user-visible decay.
2. **Self-host provider logos** (#2) — contained, removes a privacy leak and 473 requests.
3. **Table `scope` + `aria-sort` + skip link** (#5) — an afternoon, and the table is the product.
4. **Variant canonicalisation** (#4) — a decision first, then a small change.
5. **Homepage weight** (#3) — the largest job; do it when the trade is worth re-opening.
