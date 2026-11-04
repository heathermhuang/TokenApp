# About page figure — rehearsal notes

Source for `assets/img/about-dark.png` and `about-light.png`, which `npm run assets` embeds in `src/assets.ts` and the Worker serves from `/img/`. Built with the stageshow kit (`~/.claude/skills/stageshow`), which lives outside this repo, so these files are not compiled here.

## Re-film

1. Copy `about.tsx` and `about.css` to `~/.claude/skills/stageshow/examples/tokenapp-about/`. Add `tokenapp-about/index.tsx` and `tokenapp-about-light/index.tsx`, each rendering `<TokenAppAbout theme="dark" | "light" />`. Then restart the playground.
2. `node scripts/film.mjs "http://127.0.0.1:5199/?capture=tokenapp-about" --select '#example' --still --zoom 0,0,720,300 --scale 2 --out about-dark.png`. Do the same for `tokenapp-about-light`.
3. Copy both files into `assets/img/` and run `npm run assets`. The `?v=` on the page follows automatically.

## What it shows

- One model's real figures on 2026-11-04: DeepSeek V4 Flash 0731, with OpenRouter's raw per-token strings and Epoch AI's GPQA Diamond score and error bar. It illustrates the method, so it doesn't go stale the way the social card does, but the numbers are real.
- One leader per fact, from the source card's edge into the row it fills. Blended has no leader, because nobody publishes it; token.app computes it.
- It is drawn on the page's own ground in each theme, so it sits in the page with no frame.

## Not done

- No compact design. Below 600px the images are hidden and the caption carries the story, because the type would shrink below reading size.
- The film run flags "uneven gutters" for the two-column layout. That's deliberate: both columns keep a 32px gutter to the stage edge.
