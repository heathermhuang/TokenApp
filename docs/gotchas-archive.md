# Gotchas archive

Settled gotchas moved out of `CLAUDE.md`, which auto-loads in full at every session
start and is capped at ~30KB. Nothing here is wrong or obsolete — each is a rule
that is now enforced by code, tests, or shipped markup, so it no longer needs to sit
in every session's context. This file does NOT auto-load; read it when working near
the area it describes.

Moved 2026-08-17.

- **Empty-overwrite guard**: `refreshAllData` refuses to record a snapshot when scraping yields 0 models AND 0 apps. Stops silent cache poisoning if OpenRouter's UI changes again — keeps last-good D1 data and surfaces `rankingsError` instead.

- **`[]` is truthy in JS**: `appsData.week || appsData.day` returns the empty `.week` array, not `.day`. The rankings UI fallback checks `byPeriod.length > 0` instead. Worth remembering for any future period-keyed shape.

- **Model token-usage chart source = `model-rankings-chart`, NOT `/models`** (verified 2026-06-28): the year-long per-MODEL chart is built from `model-rankings-chart` (52 weekly points; each week = its top-9 + an "Others" bucket). `/rankings/models?view=week` is the LEADERBOARD feed and only carries the last ~6 days — it CANNOT drive a year chart. "Others" is genuinely ~40%/week and that MATCHES OpenRouter (confirmed against their own hover tooltip: Others is the big PINK base band, ~47%). `modelShareSeries` displays the UNION of every week's top-9 (canonicalized keys, for cross-week continuity) and keeps "Others" as `entities[0]` → the BOTTOM band. The old bug projected TODAY's top-9 backward → historical weeks rendered empty/grey (was mislabelled a "D1 depth" caveat).

- **A page that exists is not a page you can reach** (2026-08-06): 339 `/model/{slug}` pages shipped in the sitemap — crawlers found all of them, humans could reach **4** (the superlative cards). Every table row's model name linked *off-site* (`getModelUrl()` → Hugging Face / OpenAI docs / OpenRouter), so the pages had no front door for a week. The name now links to `/model/{slug}` and the vendor link is a hover-revealed icon (`@media (hover: none)` keeps it visible on touch). When you ship programmatic pages, wire the internal entry point in the same PR as the sitemap.

- **The Pareto chart must sit ABOVE the models table**: measured — below it, `#pareto-section` lands at offsetTop ~28,000px behind 338 rows. Also: `.market-share` carries **no layout** (the rankings tab supplies its own container), so the panel uses `.table-wrap` + `.leaderboard` instead. Free models are excluded from the plot deliberately (log(0) has no axis home); several provider brand colours are near-white so every dot needs a stroke to survive the light theme.

- **`safeUrl()` is not HTML escaping**: it only checks the `https://` prefix, so a poisoned `huggingFaceId` carrying a double-quote plus a tag passes it and breaks out of the `href`. Every caller must **also** `escape()` at the attribute boundary. (`getProviderUrl` is safe — it reads a static map.)

Moved 2026-08-17 (subscription re-verification pass).

- **`isOpenSource` = `Boolean(raw.hugging_face_id)`, never a name/provider heuristic** (fixed 2026-08-05): the old list treated whole authors as open (`'google'`, `'qwen'`), so every proprietary Gemini and Qwen-Max read as open-weight while GLM-5.2, Kimi K3 and gpt-oss-120b (public weights) read as proprietary. **125 models reclassified**, 125→152 open. Wrong for every user of the homepage "Open Source" filter until then. Caught only because the superlative strip surfaced "best open weights → Gemini 3.6 Flash".
