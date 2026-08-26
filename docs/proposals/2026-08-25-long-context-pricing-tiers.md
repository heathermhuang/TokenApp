# Long-context pricing tiers are parsed, typed, rendered, and still invisible on the models that need them most

**Status**: proposal, not started
**Filed**: 2026-08-25
**Origin**: user reported GPT-5.6 Sol / Terra pricing "looked weird". Pricing turned out to be correct (OpenRouter runs a 50% promo on Sol). The real gap surfaced while verifying it.

## Context

OpenRouter publishes context-dependent pricing in `pricing.overrides`: above a prompt-token threshold, a model re-prices. Grok 4.6 doubles above 200K. Qwen3.7 Flash goes to 3.3x above 32K, a threshold ordinary requests cross.

We already parse this. `endpoints.ts` reads it, `types.ts` types it, `pages.ts` renders it. But it reaches the user only through the hosts panel, and that panel is suppressed on single-host models. The models most likely to have one host are the cheap ones with the lowest thresholds, which is where a 3.3x jump hurts most.

Nothing on the comparison table or in `/api/models` carries any long-context signal at all.

## Current State (verified 2026-08-25 against the live site and OpenRouter's 419-model feed)

### The pipeline, end to end

| Stage | File | Handles overrides? |
|---|---|---|
| Catalogue normalization | `src/fetchers.ts:72-73` | No. Reads `pricing.prompt` / `pricing.completion` only |
| Per-host endpoint parse | `src/endpoints.ts:78-86` | Yes. Lowest threshold only |
| Type | `src/types.ts:287` | Yes, on the endpoint type |
| Render | `src/pages.ts:580-581` | Yes, as a warning line |
| Render gate | `src/pages.ts:563` | `endpoints.length < 2` returns `''` |

`fetchers.ts:72-73` is the whole catalogue path:

```ts
const inputPer1M = toMillion(raw.pricing?.prompt ?? '0');
const outputPer1M = toMillion(raw.pricing?.completion ?? '0');
```

`pricing.overrides` is never read, so `/api/models` has no field for it and the comparison table cannot show it.

### Observed on production

| Model | Endpoints | Long-context line rendered? |
|---|---|---|
| `x-ai/grok-4.6` | 4 | Yes: "re-prices above 200K prompt tokens ($4.00/$12.00)" |
| `openai/gpt-5.6-sol` | 7 | Yes: "re-prices above 272K prompt tokens ($2.00/$7.50)" |
| `qwen/qwen3.7-flash` | **1** | **No. Panel suppressed at `pages.ts:563`** |

Qwen3.7 Flash is the failure case in full: base $0.03/$0.13, re-prices to $0.10/$0.40 above 32K tokens, and the page says nothing.

### Data shape across the catalogue

60 of 419 models carry `pricing.overrides`. These counts are live data and will drift, same rule as the Epoch benchmark counts. Reproduce with:

```bash
curl -s https://openrouter.ai/api/v1/models | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(sum(1 for x in d if x['pricing'].get('overrides')), 'of', len(d))"
```

| Property | Count | Note |
|---|---|---|
| Re-price upward | 59 | The common case |
| Re-price **downward** | 1 | `deepseek/deepseek-v4-flash-vision-exp` gets cheaper above threshold |
| Multi-tier overrides | 6 | Only the lowest threshold is surfaced today |
| Override missing `min_prompt_tokens` | 1 | Filtered out at `endpoints.ts:79`, silently |

Threshold distribution: 272K (22), 200K (18), 256K (8), 128K (6), 32K (5), absent (1).

Both edge cases land on the same model, `deepseek-v4-flash-vision-exp`: it is the only one that gets cheaper and the only one whose override lacks `min_prompt_tokens`.

## Gaps, in priority order

**G1 (High). Single-host models render nothing.** `pages.ts:563` suppresses the hosts panel below 2 endpoints, taking the long-context warning with it. Correct for a host *comparison*, wrong for a pricing *fact* about the model.

**G2 (High). Comparison table and `/api/models` have no long-context signal.** A user sorting by price sees $0.03 for Qwen3.7 Flash with nothing indicating that number expires at 32K.

**G3 (Medium). Multi-tier overrides collapse to the lowest.** `endpoints.ts:80` sorts ascending and takes `[0]`. 6 models have more tiers that never appear.

**G4 (Low). Overrides without `min_prompt_tokens` are dropped silently.** `endpoints.ts:79` filters on the field being a number. One model hits this, and it is the only downward re-pricer, so the one case we drop is the one that would surprise a user pleasantly.

**G5 (Low). Warning rides on a lazy fetch.** `endpoints.ts` is read-through KV, 6h TTL, 4s timeout, failures return null. When it times out the panel is omitted and the pricing fact goes with it, even on multi-host models.

## Proposed Change

Move long-context pricing off the endpoint path and onto the model, so it does not depend on host count or a lazy fetch.

### 1. Carry overrides through catalogue normalization

Extend `fetchers.ts` alongside `inputPer1M` / `outputPer1M`, reusing the parse already proven in `endpoints.ts:78-86`:

```ts
longContext: {
  minPromptTokens: number;
  inputPer1M: number;
  outputPer1M: number;
} | null;
```

Two deliberate differences from the endpoint version:

- Do **not** filter on `min_prompt_tokens` being present (fixes G4). When absent, fall back to the model's `contextLength`, or carry `minPromptTokens: null` and render "above the standard context window".
- Keep the full tier array, not just `[0]` (fixes G3). Render the lowest; keep the rest for the detail page.

This is a data-only change to the KV-backed catalogue. `refreshAllData` rewrites the models key on every cron, so the field populates on the next run with no migration.

### 2. Surface it where the price is shown

- **Model detail page**: render from the model, not from `eps`. Unconditional, so single-host models get it (fixes G1 and G5).
- **Comparison table**: a marker on the price cell for the 60 affected models, with the threshold and re-priced rate on hover. Not a new column. The table is already dense and 359 of 419 models would have an empty one.

Wording must not assume direction. One model gets cheaper, so "long-context surcharge" is wrong. Use "re-prices above N tokens", matching the existing string at `pages.ts:581`.

### 3. Leave the hosts panel alone

`pages.ts:563-581` keeps working as-is for multi-host models. Per-endpoint overrides genuinely differ per host (Sol's flex endpoint re-prices to $2.00/$7.50 while its standard endpoint re-prices to $4.00/$15.00), so that panel stays the place where per-host detail lives.

## Acceptance Criteria

1. `/api/models` returns a `longContext` field for every model whose OpenRouter entry has `pricing.overrides`, and `null` for those without.
2. `/model/qwen3.7-flash` renders the re-pricing line despite having 1 endpoint.
3. `/model/grok-4.6` and `/model/gpt-5.6-sol` still render their existing hosts-panel line, unchanged.
4. `deepseek-v4-flash-vision-exp` renders its **downward** re-pricing without the word "surcharge" or any upward-implying language.
5. A model with multi-tier overrides shows every tier on its detail page.
6. The comparison table marks affected rows and leaves the other 359 visually unchanged.
7. A model whose override lacks `min_prompt_tokens` renders rather than being dropped.
8. `npm test` passes. `tsc` clean.
9. No degradation: existing hosts-panel output byte-identical for multi-host models.

## Testing Plan

| Layer | What | Count |
|---|---|---|
| Unit | Override parse: upward, downward, multi-tier, missing `min_prompt_tokens`, absent | +5 |
| Unit | `longContext` null when `pricing.overrides` absent | +1 |
| Integration | Normalization over a fixture feed carrying all 4 shapes | +2 |
| Render | Single-host model renders the line; multi-host output unchanged | +2 |

Fixtures must derive from the SQL/JSON they are given rather than returning a fixed answer. The D1 stub lesson in CLAUDE.md applies: a stub that ignores its input can only confirm what you already believe.

## Rollback Plan

Revert the PR. The field is additive and read from KV, so a revert plus one cron cycle restores the prior payload. No migration, no schema change, no D1 write.

## Effort Estimate

- Normalization + types: ~1h
- Detail page render: ~1h
- Comparison table marker: ~2h (dense layout, needs a design pass)
- Tests: ~2h

~6h total. The parse logic already exists and is proven, so most of the cost is render and test.

## Files Reference

| File | Change |
|---|---|
| `src/fetchers.ts:72-73` | Parse `pricing.overrides` into `longContext` |
| `src/types.ts:17-18` | Add `longContext` to the model type |
| `src/types.ts:287` | Existing endpoint type, unchanged |
| `src/endpoints.ts:78-86` | Reference implementation. Consider extracting shared helper |
| `src/pages.ts:563` | Move the model-level line outside this gate |
| `src/pages.ts:580-581` | Existing wording to match |
| `src/template.ts` | Comparison table price cell marker |
| `test/` | New fixtures per the testing plan |

## Out of Scope

- Cache read/write pricing (`input_cache_read`, `input_cache_write`). Same class, separate issue.
- Per-endpoint tier spread on the comparison table. The hosts panel covers it.
- Labelling promotional pricing. OpenRouter exposes no promo field, no expiry, `expiration_date` is null. The "50% off" on Sol appears only in their page HTML, so it would need scraping. Worth its own decision, not this issue.
- Batch / flex / priority tier selection. We mirror OpenRouter's default and that is correct.

## Related

- `CLAUDE.md` gotcha on per-host endpoints being fetched lazily (`src/endpoints.ts`, 2026-08-05)
- `docs/proposals/pricing-verify-prompt.md` for the monthly subscription verification routine
