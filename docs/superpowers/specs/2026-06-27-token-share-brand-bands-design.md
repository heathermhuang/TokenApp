# Token Share chart redesign + agent-icon fallback

**Date:** 2026-06-27
**Scope:** `src/template.ts` only (SSR single-file SPA). No data-layer / `/api/market-share` / D1 changes.
**Status:** approved design → ready for implementation plan.

## Problem

1. **Token Share chart colors are bad, worst in "By model".** Root cause is bigger than the
   `CLAUDE.md` note ("Others + unknowns go grey"). The dominant cause: `entityColor()`
   colors a model band by its **provider segment only** (`anthropic/claude-x` → `anthropic`),
   so *every model from one provider gets the identical hue* — two Anthropic models are the
   same orange, two OpenAI models the same green, and adjacent bands fuse into a slab.
   Secondary: `authorColor`/`entityColor` return the same grey `#94a3b8` for **both** "Others"
   and any author missing from the provider palette, so distinct unknowns also collapse together.

2. **Agent/app icons go blank.** The apps board renders `faviconUrl` with
   `onerror="this.hidden=true"`, so a missing or broken favicon just disappears, leaving an
   empty gap.

## Goals

- A Token Share chart that is legible and distinct in both themes, with no muddy collapse.
- Model-level detail still available, on demand.
- Every app/agent row shows *something* — never a blank icon.
- Consistent with the rest of the app (reuse the existing brand palette); theme-aware.

## Non-goals / guardrails

- No changes to the data layer, `/api/market-share`, fetchers, or D1. Both the `author` and
  `model` series already ship in the `/api/market-share` payload.
- Model-table provider logos (`providerLogoImg`) are untouched.
- **Color follows the entity, never its rank** — filtering / re-sorting / window changes must
  never repaint a band a different color.
- No deploy from this work. Verify with `tsc --noEmit` + the esbuild-render harness
  (`scratchpad/render.mjs`), both light and dark. User runs `wrangler deploy`.

## Design

### 1. One brand-stacked chart (toggle removed)

The chart **always stacks by brand/author**. The "By author / By model" toggle is deleted;
the muddy By-model stacked view goes with it. The `30D / 90D / 1Y` window toggle stays.

Removed:
- SSR markup for `#ms-view-toggle` (the button group).
- `state.msView` initialization.
- The `#ms-view-toggle` click listener (currently ~`template.ts:2918`).

`renderMarketShare()` changes:
- Always read `state.shareSeries.author` for the bands + legend (empty-guard on it).
- Also `windowSlice` the `state.shareSeries.model` series to the **same window** so week
  indices align with the author series (both come from the same payload `weeks`, same dates).
- Pass the sliced `model` series to the hover layer:
  `attachShareHover(slicedAuthor, slicedModel)`.

### 2. Model detail on hover (whole week, all models)

`attachShareHover(author, model)`:
- Snap to the nearest week using the author-series geometry (unchanged crosshair).
- Build the tooltip from the **model** series at the snapped week — match the author week's
  `date` against the model points' dates, falling back to index when they line up 1:1.
- If the `model` series is absent or empty (the payload only guarantees `author`), the tooltip
  falls back to the author-level breakdown — i.e. current behavior, never an empty tooltip.
- Keep the existing `pct ≥ 0.05` filter, sort desc, and **cap at ~12 rows** so the tooltip
  can never overflow its container. (The server already bounds the model series to top-N +
  Others, so this is a safety cap.)
- Each tooltip row swatch uses the **model tint** (below). The crosshair behavior is unchanged.

Update `shareChartAria()` copy to reflect "brand share over time; hover for model breakdown."

### 3. Color system (replaces `authorColor` / `entityColor`)

All band, legend, and tooltip swatches go through one set of functions so they stay in sync.
Theme is read live from `document.documentElement[data-theme]` (same mechanism
`getProviderStyle` already uses), so colors adapt on theme toggle with no extra wiring.

- **`brandColor(slug)`** — the canonical hue for an author/provider:
  - `others` (case-insensitive) → `othersColor()`.
  - known provider → `getProviderStyle(slug).color` (the existing curated, theme-aware brand
    palette — OpenAI green, Anthropic orange, Google blue, DeepSeek sky, Meta indigo, xAI
    slate, …). Reused so the chart matches the model table.
  - unknown provider → `genHue(slug)`: a **stable** generated hue, `hash(slug) % 360` at a
    fixed S/L per theme (`hsl(h,58%,62%)` dark / `hsl(h,62%,40%)` light). Two distinct
    unknowns never collapse to the same grey.
- **`entityColor(e)`** (bands + legend): take `e.key`; `others` → neutral; else color by the
  provider segment via `brandColor`. (Author entities are plain slugs; the split-on-`/` keeps
  it correct if ever handed a model key.)
- **`othersColor()`** — dedicated neutral, never shared with a real entity:
  `#475569` (dark) / `#94a3b8` (light).
- **`modelTint(modelKey)`** (tooltip rows): base = `brandColor(provider-of-key)`, then a cheap
  deterministic **±lightness nudge** bucketed by `hash(modelKey)` so siblings differ slightly
  (Sonnet vs Haiku) while staying in the brand family. RGB mix toward white/black (no HSL);
  generated `hsl()` colors are returned unnudged. `others` → `othersColor()`.

Supporting helpers (new, module-scope in the template JS):
- `isLightTheme()` → `data-theme === 'light'`.
- `hashCode(str)` → stable 32-bit int.
- `genHue(slug)`, `mix(hex, target, t)`, `nudge(hex, key)`.

**Small DRY refactor:** lift the `dark` / `light` provider-color object literals out of
`getProviderStyle()` to module scope (`PROVIDER_STYLE_DARK` / `PROVIDER_STYLE_LIGHT`) and add
`isKnownProvider(slug)` (membership test). `getProviderStyle` references the same constants —
no behavior change to the table, but the chart can now distinguish known vs unknown cleanly
instead of guessing from the grey fallback.

### 4. Agent/app icon fallback (`renderRankings`, apps board)

Replace the `faviconUrl ? <img onerror=hidden> : ''` line with `appIconHtml(a)`:

1. primary src = `safeUrl(a.faviconUrl)` || `s2Favicon(a.originUrl)`.
2. Render a **letter-tile** (the title's initial on `var(--surface2)` / `var(--text2)`,
   theme-aware) *behind* the `<img>`. The img sits on top and covers the tile when it loads;
   `onerror="this.remove()"` drops a broken img and reveals the tile. No chained onerror.
3. If there is no usable primary src at all, render just the tile.

New helpers: `hostOf(url)` (hostname via `new URL`, null on failure), `s2Favicon(url)`
(`https://www.google.com/s2/favicons?domain=<host>&sz=64`, null if no host — reuses the s2
pattern already at `getProviderLogo`). New CSS: `.lb-icon-wrap` (relative, sized),
`.lb-icon-tile` (absolute, centered, flex). Existing `.lb-icon` sizing is kept for the img.

## Files / sites touched (all in `src/template.ts`)

- `getProviderStyle` (~1742) — lift color maps to module scope; add `isKnownProvider`.
- New color block replacing `authorColor` / `entityColor` (~2329–2344): `brandColor`,
  `entityColor`, `othersColor`, `modelTint`, `genHue`, `mix`, `nudge`, `hashCode`,
  `isLightTheme`.
- `shareChartSvg` (~2362) — no logic change (still uses `entityColor`); confirm band stroke
  separation reads well.
- `marketShareLegend` (~2401) — unchanged (uses `entityColor`).
- `attachShareHover` (~2418) — new `(author, model)` signature; tooltip from model series.
- `renderMarketShare` (~2882) — slice both series; always author bands; pass model to hover.
- Remove `#ms-view-toggle` markup, `state.msView`, and its listener (~2918).
- `renderRankings` apps branch (~2504) — `appIconHtml`; add `hostOf`, `s2Favicon`.
- CSS — `.lb-icon-wrap`, `.lb-icon-tile`.

## Verification

- `npx tsc --noEmit` clean.
- Render via `scratchpad/render.mjs` (esbuild → static HTML + fetch monkeypatch); open in both
  themes. Check: brand bands distinct, Others neutral, legend swatches match bands, hover
  tooltip lists models with brand-family tints, no console errors. Confirm an app row with a
  missing/broken favicon shows a letter-tile.
- No `wrangler` (broken in this env) and **no deploy** — user deploys after approving the look.
