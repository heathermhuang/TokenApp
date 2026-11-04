# /og.png social card — rehearsal notes

Source for the 1200 × 630 image inlined as `OG_PNG_B64` in `src/index.ts`. Built with the stageshow kit, which lives outside this repo (`~/.claude/skills/stageshow`), so these files are not compiled here.

## Re-film

1. Copy `index.tsx` and `og.css` to `~/.claude/skills/stageshow/examples/tokenapp-og/`.
2. Start the playground (`node_modules/vite/bin/vite.js playground --config playground/vite.config.ts --port 5199` in that folder; restart it after adding the folder).
3. `node scripts/film.mjs "http://127.0.0.1:5199/?capture=tokenapp-og" --select '#example' --still --zoom 0,0,600,315 --scale 2 --out og.png` gives exactly 1200 × 630.
4. Base64 it into `OG_PNG_B64` and bump the `?v=` on every `og:image` / `twitter:image` meta. `/og.png` is cached for 30 days, and social crawlers cache by URL.

## What it shows, and when it goes stale

- The scatter is token.app's **live** Price vs Quality chart (GPQA Diamond, 85 models) as rendered on **2026-11-03**: real dot positions, colors and frontier, in the chart's own 880 × 420 coordinates.
- The readout is that day's "Best value": DeepSeek V4 Flash 0731, $0.119 / 1M blended, 91.0%. When the site's best-value pick changes, the card is out of date. It is an illustration, but re-film it before it misleads.
- The copy names no counts on purpose ("450+ models" would drift).

## Composition

Opposite corners (stageshow gold `opposite-corners`): wordmark top-left, headline bottom-left at a 28px gutter, and the product's chart card hung off the top and right edges. One big number ($0.119). A hairline leader ties the readout to its dot. The `◈` mark is the site's own glyph, not a drawn logo.

## Not checked

- No compact layout: a social card is a fixed 1200 × 630.
- The stageshow fresh-eye review was done in-session, not by a separate reviewer.
- I haven't checked how X, Slack or LinkedIn render it until it's live; their crops differ slightly (X uses 1.91:1, which this is).
