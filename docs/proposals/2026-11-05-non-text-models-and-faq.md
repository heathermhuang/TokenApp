# Non-text models (video, image, audio, embeddings) + data-driven FAQ

Status: **implemented** in #58, #59, #60 and PR 3 (2026-11-05). Two corrections found while
building PR 3, which supersede the table below:
- **Image prices come from `/api/v1/images/models/{id}/endpoints`**, not page JSON-LD: it
  lists per-image, per-megapixel and per-token prices with sizes and input fees. Token- and
  megapixel-priced models get no per-image figure (the `× 4175` shortcut stays rejected).
- **Audio units are per MODEL, not per type**, so the catalogue's `pricing.prompt` cannot be
  converted by type: MAI-Transcribe's is per hour where Whisper's is per second, Fish Audio
  bills UTF-8 bytes, Seed Audio bills minutes. Audio prices come from each page's JSON-LD.
- Rerank (open question below) is listed with "—"; only the free rerankers have a price.

## Problem

1. Seedance, Veo, Kling, Wan, Hailuo, Runway, and every image/speech/transcription/embedding
   model are absent. `fetchers.ts` calls `/api/v1/models`, which **defaults to text-output
   models only** (454). `?output_modalities=all` returns 695.
2. The homepage FAQ leads with GPT-4o (May 2024), compares DeepSeek V3 against GPT-4o, and
   answers the context-window question with "As of 2025 … Gemini 1.5 Pro … Claude 200K …
   GPT-4o 128K" — hardcoded prose. Only the Sonnet question is data-driven.
3. **Live bug, same root cause:** `google/lyria-3-*` (music) is already in our table at
   **$0 / $0 and flagged `isFree`** (`isFree: inputPer1M === 0 && outputPer1M === 0`). Its real
   price is **$0.08 per song**.

## The finding that shapes the design: the unit *is* the type

Every non-text model reports `prompt:"0", completion:"0"` (or a token price that means
something else). Measured 2026-11-05 against the live API and each type's model page
JSON-LD (`offers[].priceSpecification.unitText`):

| Output type | Count | Real unit | Where the number lives | Verified |
|---|---|---|---|---|
| text | 438 | $/1M tokens | `pricing.prompt/completion` | existing |
| video | 31 | **$/second**, per resolution, ± audio | `/api/v1/videos/models` → `pricing_skus` | Veo 3.1 1080p $0.40/s ✓ |
| image | 51 | **$/image** (1K) | page JSON-LD only; API has `image_output` per "token" | 8 of 10 = `image_output × 4175`, **Krea = ×2087.5**, 2 have no per-image price |
| speech (TTS) | 38 | **$/1M characters** | `pricing.prompt` | AssemblyAI TTS $15/M chars ✓ |
| transcription | 30 | **$/second of audio** | `pricing.prompt` | Parakeet ✓ |
| embeddings | 44 | $/1M input tokens | `pricing.prompt` | fits today's table |
| decisions (alpha) | 35 | $/1M input tokens | `pricing.prompt` | classifiers, output free |
| rerank | 12 | **not published** | nowhere public | page has no offer |
| music (Lyria) | 2 | **$/song** | page JSON-LD only | $0.08 ✓ |

Video SKUs come in three unit families that must be normalised:
- `cents_per_video_output_second_{res}` / `cents_per_second_output_*` → cents/sec (÷100)
- `duration_seconds_*` → **dollars**/sec
- `video_tokens*` (all Seedance) → $/token; **$/sec = rate × W×H×24/1024**. Checked:
  480p 854×480 → $0.06725/s vs OpenRouter's page $0.067256/s ✓.

A unit family not in that list must make the model **unpriced**, not guessed.

## Design

### Rule 0 — unpriced is never free
Add `priceUnit` (`'1M tokens' | 'second' | 'image' | '1M chars' | 'audio second' | 'song'`)
and `priced: boolean` to `NormalizedModel`. `isFree` requires `priced && price === 0`.
Unpriced models render "—" with a link to OpenRouter, are excluded from Free, cheapest and
every superlative. This alone fixes the Lyria bug and is the guard for every later type.

### Placement — a type switch on the Models view, not new nav entries
A segmented control above the table: **Text · Image · Video · Audio · Embeddings**
(Text default; `/#video` etc. deep-link, same hash mechanism as `/#rankings`). Same table
chrome, search, provider pills and sort — **only the price columns change**, so a row is
never compared against a row in a different unit:

| Tab | Price columns | Other columns |
|---|---|---|
| Text | today's (input/output $/1M, cache) | unchanged |
| Video | $/sec **720p** · $/sec 1080p · audio ✓ · max duration · **$ per 8s clip @720p** | resolutions |
| Image | $/image (1K) | input modalities (edit vs generate) |
| Audio | sub-pills: **Speech** $/1M chars · **Transcription** $/hour · **Music** $/song | |
| Embeddings | $/1M input tokens (embeddings + rerank + decisions) | rerank shows "—" |

Why not alternatives:
- *Separate homepage views per type* → 5 more nav entries; #56 just consolidated the nav.
- *Mixing into one table* → sorting $/sec against $/1M tokens is meaningless, and the
  existing superlatives (cheapest, best value) would compare across units.
- *A "Video" filter pill* → filter pills narrow rows; they don't change columns. Overloads them.

"$ per 8s clip" is the comparison people actually make (Veo 8s vs Seedance 5s defaults);
it is derived and labelled as such.

### Data sources
- Cron: `/api/v1/models?output_modalities=all` replaces the current call (1 request).
- Cron: `/api/v1/videos/models` (1 request) for video SKUs, joined on `id`.
- Image and music $/image, $/song: **page JSON-LD, scraped once a day** for those ~53
  models only (the `× 4175` shortcut is wrong for Krea and undefined for token-native image
  models, so per the `MODEL_MAP` rule it isn't used). Failure keeps the last good KV copy;
  a model never scraped is unpriced, never $0.
- Model pages (`/model/:id`) get the type's unit; the per-host panel stays text-only.

### FAQ — every model named in it comes from data
Same pattern the Sonnet question already uses (newest non-deprecated, priced, by `createdAt`):
- GPT-4o question → **newest OpenAI flagship** (excludes mini/nano/image/audio/batch).
- DeepSeek comparison → newest DeepSeek vs that OpenAI flagship.
- Context-window answer → the actual top 3 by `contextWindow`, no year in the prose.
- New: "How much does AI video generation cost?" → cheapest and median $/sec at 720p.
- Applied to both the visible `<details>` and the FAQPage JSON-LD (they're duplicated).

## Delivery — three PRs, smallest-risk first
1. **FAQ + Rule 0** (fixes Lyria-as-free). Small, no new fetch.
2. **Video** — fetch, SKU normaliser, type switch with Text + Video tabs, video FAQ.
   `npm test` pins the three unit families, the Seedance formula, and "unknown SKU → unpriced".
3. **Image, Audio, Embeddings** — daily JSON-LD scrape + remaining tabs.

## Open questions
- Reference resolution for video headline: 720p proposed (every model supports it; 480p
  is missing from Veo/Runway, 1080p from Hailuo 3 / Seedance mini).
- Rerank has no public price — list it as "—", or omit until it has one?
