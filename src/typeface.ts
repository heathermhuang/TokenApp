import { FONT_ASSET_VERSION } from './assets';

// The site's type: Geist for text, Geist Mono for figures. Every page template
// shares these two strings so the faces and the preload never drift apart.

const url = (file: string) => `/font/${file}?v=${FONT_ASSET_VERSION}`;

/** <link rel="preload"> for both faces, so the first paint doesn't swap fonts mid-read. */
export const FONT_PRELOAD =
  `<link rel="preload" href="${url('Geist-Variable.woff2')}" as="font" type="font/woff2" crossorigin />\n` +
  `  <link rel="preload" href="${url('GeistMono-Variable.woff2')}" as="font" type="font/woff2" crossorigin />`;

/** @font-face rules plus the two family tokens every page reads. */
export const FONT_FACE_CSS = `
    @font-face { font-family: 'Geist'; src: url('${url('Geist-Variable.woff2')}') format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; }
    @font-face { font-family: 'Geist Mono'; src: url('${url('GeistMono-Variable.woff2')}') format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; }
    :root {
      --font: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      --mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    }`;
