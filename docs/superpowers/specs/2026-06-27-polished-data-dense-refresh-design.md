# Polished Data-Dense Refresh — Design Spec

**Date:** 2026-06-27
**Branch:** `design/polished-data-dense`
**Direction:** Stripe / Supabase "polished data-dense" — keep the information density, impose discipline. Near-monochrome UI, one accent (`#6366f1`), color reserved for charts, tabular figures everywhere.

## Problem

The Rankings "Token Share Over Time" chart reads as color soup:
- `tencent: #1eff7a` is a toxic neon lime.
- `anthropic` and `xiaomi` are the **same** orange (`#f97316`) — indistinguishable bands.
- `deepseek / google / z-ai / minimax / openrouter` are five near-identical blues/indigos that blur.
- Root cause: chart bands use raw brand colors (`PROVIDER_STYLE_*`) + random `genHue()` for unknowns. Nothing is chosen to sit *together*.

The base UI tokens (near-black bg, indigo accent) are fine and stay. This is a chart-palette + numeric-typography + table-polish pass, not a re-theme.

## Decisions

### 1. Decouple chart palette from brand chips
`getProviderStyle().color` is consumed in two roles:
- **Brand chips / filter buttons / sub chips** (pricing + subscriptions tabs) — isolated, tinted bg. Raw brand color is good here. **Leave unchanged.**
- **Chart bands + legend + hover tint** (`entityColor`, `modelTint`) — clash. **Switch to a dedicated harmonized chart palette.**

### 2. Harmonized categorical chart palette (entity-stable)
Fixed palette, one saturation/lightness band so it reads as a family. Color follows the **entity** (stable per slug), never rank — toggling periods must not repaint.

| Slot | Dark | Light |
|---|---|---|
| blue | `#3987e5` | `#2a78d6` |
| aqua | `#1fa97e` | `#14906a` |
| violet | `#9085e9` | `#6257c8` |
| amber | `#d3982f` | `#b3791a` |
| magenta | `#d55181` | `#be3f6c` |
| orange | `#e0703a` | `#c5551f` |
| red | `#e06666` | `#cf4444` |
| green | `#46b06a` | `#2f8a4f` |
| slate | `#7d8ba6` | `#5d6b8a` |
| Others / neutral | `#4a5568` | `#94a3b8` |

- Curated brand-sympathetic map for the common providers (openai→aqua, anthropic→orange, deepseek→blue, google→violet, tencent→**controlled** green, …); hashed fallback **into the palette** (not random HSL) for the long tail; `others` → neutral.
- `modelTint` keeps its sibling-nudge logic but derives from the new palette base.
- `genHue()` + `brandColor()` become dead once `entityColor`/`modelTint` are rewired → remove.
- Band treatment: crisp 1px surface-color separators, recessive gridlines.

### 3. Tabular figures everywhere
`font-variant-numeric: tabular-nums` site-wide (body-level) so every %, price, token count, and Δ aligns — the "real data product" signal. Right-align numeric columns where they aren't already.

### 4. Calmer leaderboards
- Sparkline (`sparklineSvg`) → single muted hue (`var(--text2)`), drop the green/red. Direction already lives in the ▲/▼ delta chip.
- Even row rhythm, hairline dividers, aligned rank + number columns.

### 5. Typography & spacing
- Micro-caps eyebrows for stat labels; slight negative tracking on the big headings; mid-weight section titles.
- One 8px spacing rhythm; consistent hairline borders. Keep density.

### 6. Scope
Shared tokens + chart/legend/table treatment carry across **Rankings, API Pricing, Subscriptions**. Both dark and light themes preserved.

## Acceptance criteria
- Chart: no neon; anthropic ≠ xiaomi; the five-blues wall is broken; palette reads as one family in both themes.
- Brand chips in pricing/subscriptions tabs visually unchanged.
- All numeric readouts use tabular figures.
- Sparklines are a single muted hue.
- `getHtml()` renders without JS syntax errors (scratchpad `verify.mjs`); both `preview-dark.html` and `preview-light.html` look coherent.
- No behavior change to data, periods, hover, or routing.

## Out of scope
Base color tokens, data pipeline, layout restructure, new components.
