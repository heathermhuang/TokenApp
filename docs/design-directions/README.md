# Design directions, 2026-11-04

Three looks for token.app, mocked with stageshow from live data. They use one shared page component (`page.tsx`, `page.css`), so they differ only in identity. **Ticker** was chosen and shipped. The other two are kept for reference.

| Direction | Look | References |
|---|---|---|
| `ticker` (shipped) | Dark first. Geist for text, Geist Mono for figures, one amber accent, rules instead of cards | Vercel, ClickHouse |
| `sheet` | Light paper. Instrument Serif headline and figures over Inter, a vermilion accent, printed-table rules | WIRED, Claude |
| `frontier` | Cool graphite. IBM Plex Sans and Plex Mono, the value-frontier green as the brand colour, soft cards | IBM Carbon, Linear |

All three share these structural choices, and the site now has them:
- a one-line hero;
- the stat row folded into the sentence under it;
- the picks as one ruled strip, each led by its one number;
- the filters in one toolbar;
- the view tabs promoted to the nav;
- the provider shown under the model name instead of in a column of its own.
