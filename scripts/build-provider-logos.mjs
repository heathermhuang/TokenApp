#!/usr/bin/env node
/**
 * Generates `src/logos.ts` — the self-hosted provider logo assets.
 *
 * Why this exists: every provider mark on the site used to be an <img> pointed at
 * `google.com/s2/favicons?domain=…`. That handed Google the visitor's IP, the
 * `token.app` referrer and the set of AI providers they were browsing — 41 distinct
 * requests per visit — and made basic branding depend on a third party staying up.
 *
 * Source is `@lobehub/icons-static-svg` (MIT): a curated collection of AI/LLM brand
 * marks. Scraping each provider's own `/favicon.ico` was tried first and rejected —
 * it is not verifiable at scale. Four unrelated domains returned byte-identical
 * responses, `microsoft.com/apple-touch-icon.png` served a JPEG, and
 * `anthropic.com/favicon.ico` served 167 bytes of HTML under an `image/*`
 * content-type. A curated set can be eyeballed once; a scrape cannot.
 *
 * The map below is EXPLICIT-ONLY. Do not add fuzzy or prefix matching: stapling one
 * company's logo onto another is worse than showing no logo, and the icon set holds
 * near-miss names (`kling` vs `ling`, `ai2` vs `ai21`) that a substring match gets
 * wrong. Providers absent from the map fall back to a generated initial tile, which
 * is honest rather than wrong. Run `npm run logos` after editing.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** `--check` verifies the committed file matches this generator instead of writing. */
const CHECK_ONLY = process.argv.includes('--check');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICON_DIR = join(ROOT, 'node_modules/@lobehub/icons-static-svg/icons');
const OUT = join(ROOT, 'src/logos.ts');

/**
 * OpenRouter author slug → icon basename in @lobehub/icons-static-svg.
 *
 * `-color` is preferred where the brand publishes a colour mark. The rest resolve to
 * a monochrome glyph drawn in `currentColor`, which is baked to black here and
 * flipped for the dark theme in CSS — `currentColor` does not inherit into an SVG
 * loaded through <img>, so it cannot be left to resolve at render time.
 *
 * `~`-prefixed authors (`~anthropic`, `~openai`, …) are OpenRouter variant namespaces
 * for the same company; the lookup strips the prefix rather than duplicating rows.
 * Those six currently render no logo at all, because the old domain map had no entry.
 *
 * `null` means "deliberately unmapped" — a nearby-looking icon exists but is a
 * different brand. Recorded rather than dropped so a later pass does not redo the
 * analysis, the same convention `MODEL_MAP` uses in benchmarks.ts.
 */
const ICON_MAP = {
  // ── Frontier labs ────────────────────────────────────────────────────────────
  openai:        'openai',
  anthropic:     'anthropic',
  google:        'google-color',
  'meta-llama':  'meta-color',
  meta:          'meta-color',
  mistralai:     'mistral-color',
  deepseek:      'deepseek-color',
  'x-ai':        'xai',               // the company mark, not the `grok` product mark
  qwen:          'qwen-color',        // Alibaba's model brand, which is how the catalogue labels it
  cohere:        'cohere-color',
  perplexity:    'perplexity-color',
  perplexityai:  'perplexity-color',
  nvidia:        'nvidia-color',
  amazon:        'aws-color',         // Nova ships through Bedrock; AWS is the mark Amazon uses for it
  microsoft:     'microsoft-color',
  ai21:          'ai21',              // NOT `ai2` — that is the Allen Institute, a different org
  '01-ai':       'yi-color',          // 01.AI's model family is Yi

  // ── Chinese labs ─────────────────────────────────────────────────────────────
  'z-ai':            'zhipu-color',
  zhipuai:           'zhipu-color',
  moonshotai:        'moonshot',
  minimax:           'minimax-color',
  stepfun:           'stepfun-color',
  baidu:             'baidu-color',
  tencent:           'tencent-color',
  bytedance:         'bytedance-color',
  'bytedance-seed':  'bytedance-color',
  xiaomi:            null,            // the only Xiaomi mark in the set is the two-line `xiaomimimo`
                                      // wordmark. Rasterised at the 13px these render at it is an
                                      // illegible smear, so the initial tile reads better. Checked,
                                      // not assumed — see the pixel-level render in the PR.
  kwaipilot:         'kwaipilot',
  meituan:           'longcat-color', // Meituan ships its models as LongCat
  inclusionai:       null,            // Ant Group's open-source arm. `antgroup-*` exists, but the
                                      // parent-company mark is a different brand — left unmapped.

  // ── Research labs & infra ────────────────────────────────────────────────────
  allenai:                'ai2-color', // the Allen Institute for AI trades as AI2
  'ibm-granite':          'ibm',
  nousresearch:           'nousresearch',
  'arcee-ai':             'arcee-color',
  upstage:                'upstage-color',
  openrouter:             'openrouter-color',
  liquid:                 'liquid',
  inception:              'inception',
  poolside:               'poolside',
  'aion-labs':            'aionlabs-color',
  cognitivecomputations:  'dolphin',  // their own model family's mark
  relace:                 'relace',
  morph:                  'morph',
  deepcogito:             'deepcogito',
  midjourney:             'midjourney',

  // ── Tools & app builders (subscription rows, not model authors) ──────────────
  cursor:      'cursor',
  windsurf:    'windsurf',
  codeium:     'windsurf',            // Codeium renamed to Windsurf
  replit:      'replit-color',
  lovable:     'lovable-color',
  vercel:      'vercel',
  v0:          'v0',
  manus:       'manus',
  suno:        'suno',
  elevenlabs:  'elevenlabs',
  runway:      'runway',
  kling:       'kling-color',
  ollama:      'ollama',

  // ── Deliberately unmapped: no mark in the set ────────────────────────────────
  // Community fine-tuners and small labs. An initial tile is the correct answer —
  // these had no logo before this change either, since they had no domain entry.
  writer:            null,
  inflection:        null,
  thedrummer:        null,
  thinkingmachines:  null,
  sao10k:            null,
  sakana:            null,
  'nex-agi':         null,
  rekaai:            null,
  perceptron:        null,
  'anthracite-org':  null,
  mancer:            null,
  undi95:            null,
  gryphe:            null,
  'dots-studio':     null,
};

// ── Build ─────────────────────────────────────────────────────────────────────

if (!existsSync(ICON_DIR)) {
  console.error(`Icon source missing: ${ICON_DIR}\nRun \`npm install\` first.`);
  process.exit(1);
}

const available = new Set(readdirSync(ICON_DIR).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4)));

/**
 * Ink for the `currentColor` parts of an icon that ALSO carries fixed brand paint.
 *
 * Such an icon cannot be flipped wholesale for the dark theme — inverting the image
 * would take AWS orange to blue — so its `currentColor` half is baked to one neutral
 * that reads on both backgrounds instead, leaving the brand colour untouched. Slate
 * rather than pure grey so it sits with the UI's palette.
 */
const MIXED_INK = '#8a8f98';

/** Fixed paint that is effectively black, i.e. the tone we are already baking to. */
const BLACKISH = /^#(0{3}|0{6}|0{8})$/i;

/**
 * Normalise one icon for standalone <img> use.
 *
 * lobehub ships `width="1em" height="1em"`, which resolves against the SVG document's
 * own font-size when loaded through <img> rather than against ours. Pinning explicit
 * pixels keeps the intrinsic size predictable. `currentColor` gets baked for the same
 * reason — nothing inherits into that document.
 *
 * Whether the result is `mono` decides whether CSS inverts the WHOLE image on the dark
 * theme, so it must mean "every visible stroke is the baked ink", not merely "the file
 * mentions currentColor". Three mapped marks (Yi, AWS, LongCat) mix `currentColor` with
 * a fixed brand colour; treating those as mono inverted the brand colour too.
 */
function normalise(raw, name) {
  const viewBox = /viewBox="([^"]+)"/.exec(raw);
  if (!viewBox) throw new Error(`${name}: no viewBox — cannot size it safely`);

  const usesCurrentColor = raw.includes('currentColor');
  const fixedPaint = [...new Set(raw.match(/#[0-9A-Fa-f]{3,8}/g) || [])].filter(c => !BLACKISH.test(c));
  const mixed = usesCurrentColor && fixedPaint.length > 0;
  const mono = usesCurrentColor && !mixed;
  const ink = mixed ? MIXED_INK : '#000';
  // Rewrite the ROOT <svg> tag only. A global style/width strip would also hit inner
  // elements, and several colour marks carry their fills in an inline style there.
  const rootEnd = raw.indexOf('>');
  if (rootEnd < 0) throw new Error(`${name}: unterminated <svg> tag`);
  const root = raw.slice(0, rootEnd)
    .replace(/\s(width|height)="1em"/g, '')
    .replace(/\sstyle="[^"]*"/g, '')
    .replace(/<svg\b/, '<svg width="24" height="24" role="img"');

  let svg = (root + raw.slice(rootEnd)).replace(/currentColor/g, ink).trim();

  // Collapse the inter-tag whitespace some icons carry; these are served on every
  // page view, so the bytes are worth reclaiming.
  svg = svg.replace(/>\s+</g, '><');

  if (!/^<svg[\s>]/.test(svg)) throw new Error(`${name}: does not start with <svg`);
  if (/<script/i.test(svg)) throw new Error(`${name}: contains <script>`);
  return { svg, mono, mixed, fixedPaint };
}

/**
 * A few entries in the set are detailed illustrations rather than marks — the
 * `dolphin` glyph is 99KB. At the 13px these render at, none of that detail is
 * visible, so past this ceiling the initial tile is the better trade. Enforced as a
 * rule rather than by hand-dropping names, so a future icon-set bump cannot quietly
 * reintroduce a 99KB download for one table row.
 */
const MAX_ICON_BYTES = 20 * 1024;

const assets = {};
const monoSlugs = [];
const unmapped = [];
const missing = [];
const oversized = [];
const mixedInk = [];

for (const [slug, icon] of Object.entries(ICON_MAP)) {
  if (icon === null) { unmapped.push(slug); continue; }
  if (!available.has(icon)) { missing.push(`${slug} → ${icon}`); continue; }
  const raw = readFileSync(join(ICON_DIR, `${icon}.svg`), 'utf8');
  const { svg, mono, mixed, fixedPaint } = normalise(raw, icon);
  if (svg.length > MAX_ICON_BYTES) {
    oversized.push(`${slug} (${icon}, ${(svg.length / 1024).toFixed(0)}KB)`);
    continue;
  }
  assets[slug] = { svg, mono, icon };
  if (mono) monoSlugs.push(slug);
  if (mixed) mixedInk.push(`${slug} (${icon}, keeps ${fixedPaint.join(' ')})`);
}

if (missing.length) {
  console.error('Mapped to icons that do not exist in the package:');
  missing.forEach(m => console.error('  ' + m));
  process.exit(1);
}

const slugs = Object.keys(assets).sort();
const body = slugs.map(s => {
  const a = assets[s];
  return `  ${JSON.stringify(s)}: { mono: ${a.mono}, svg: ${JSON.stringify(a.svg)} },`;
}).join('\n');

/**
 * Cache-busting token for the asset URLs.
 *
 * `/logo/{slug}.svg` is addressed by provider, not by content, so an `immutable`
 * year-long TTL would otherwise pin a returning visitor to the old mark for a year
 * after a logo changes — or after an initial tile is upgraded to a real logo. The
 * token turns the provider-addressed URL into a content-addressed one, which is what
 * makes `immutable` honest. `providers.ts` is folded in because the initial tiles are
 * generated from its display names and colours at request time.
 */
const version = createHash('sha256')
  .update(body)
  .update(readFileSync(join(ROOT, 'src/providers.ts')))
  .digest('hex')
  .slice(0, 10);

const out = `/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with \`npm run logos\` (scripts/build-provider-logos.mjs).
 *
 * Self-hosted provider brand marks, served from /logo/{slug}.svg so that no visitor
 * request goes to google.com/s2/favicons. Providers absent from this map render a
 * generated initial tile instead — see logoSvg() below.
 *
 * Brand marks are from Lobe Icons, MIT licensed:
 *
 *   Copyright (c) 2023 LobeHub
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *   SOFTWARE.
 *
 * Company names and logos are trademarks of their respective owners, shown to
 * identify whose pricing each row reports.
 */
import { getProvider } from './providers';

export interface LogoAsset {
  /** Glyph is drawn in flat black and must be inverted for the dark theme. */
  mono: boolean;
  svg: string;
}

export const PROVIDER_LOGOS: Record<string, LogoAsset> = {
${body}
};

/**
 * Slugs whose glyph is ENTIRELY flat black and can therefore be flipped wholesale
 * with \`filter: invert(1)\` on the dark theme. Interpolated into the client bundle so
 * the renderer can tag them.
 *
 * A mark that mixes \`currentColor\` with fixed brand paint is deliberately NOT here:
 * inverting the image would take AWS orange to blue. Those have their
 * \`currentColor\` half baked to a neutral that reads on either background instead.
 */
export const MONO_LOGO_SLUGS: readonly string[] = ${JSON.stringify(monoSlugs.sort())};

/**
 * Cache-busting token, changing whenever any mark or provider colour changes. The
 * asset URLs are keyed by provider rather than by content, so this is what lets them
 * be served \`immutable\` without pinning returning visitors to a stale logo.
 */
export const LOGO_ASSET_VERSION = ${JSON.stringify(version)};

/** OpenRouter namespaces some authors as \`~openai\`; the mark is the same. */
export function canonicalLogoSlug(providerId: string): string {
  return providerId.toLowerCase().replace(/^~/, '').replace(/\\s+/g, '-');
}

export function hasProviderLogo(providerId: string): boolean {
  return Object.prototype.hasOwnProperty.call(PROVIDER_LOGOS, canonicalLogoSlug(providerId));
}

/** Slug shapes we will look up. Anything else 404s rather than minting a tile. */
const SLUG_RE = /^[a-z0-9][a-z0-9._~-]{0,63}$/;

/**
 * The SVG for a provider: the vendored brand mark, or a generated initial tile.
 *
 * The tile is why this returns a string rather than null — a provider we have no
 * mark for still gets a stable, themed square instead of a broken-image icon, and
 * new providers appear correctly without a deploy.
 */
export function logoSvg(providerId: string): string | null {
  const slug = canonicalLogoSlug(providerId);
  if (!SLUG_RE.test(slug)) return null;

  const asset = PROVIDER_LOGOS[slug];
  if (asset) return asset.svg;

  const meta = getProvider(slug);
  const letter = (meta.displayName.trim()[0] || '?').toUpperCase();
  const ch = letter === '<' || letter === '&' || letter === '"' ? '?' : letter;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" role="img">' +
    \`<title>\${meta.displayName.replace(/[<>&"]/g, '')}</title>\` +
    \`<rect width="24" height="24" rx="5" fill="\${meta.color}" fill-opacity="0.18"/>\` +
    \`<text x="12" y="12" fill="\${meta.color}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" \` +
    \`font-size="13" font-weight="700" text-anchor="middle" dominant-baseline="central">\${ch}</text>\` +
    '</svg>';
}
`;

// `--check` is the drift guard: nothing in the build regenerates src/logos.ts, so an
// ICON_MAP edit or an icon-package bump could otherwise ship a stale MONO_LOGO_SLUGS
// literal and stale assets with nothing to notice. Wired into the deploy preflight.
if (CHECK_ONLY) {
  const committed = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;
  if (committed === out) {
    console.log(`src/logos.ts is up to date (${slugs.length} marks, version ${version}).`);
    process.exit(0);
  }
  console.error('src/logos.ts is STALE — it does not match scripts/build-provider-logos.mjs.');
  console.error(committed === null ? '  (file is missing entirely)' : '  Run `npm run logos` and commit the result.');
  process.exit(1);
}

writeFileSync(OUT, out);

console.log(`Wrote ${OUT}`);
console.log(`  ${slugs.length} brand marks (${monoSlugs.length} monochrome, ${slugs.length - monoSlugs.length} colour)`);
console.log(`  ${unmapped.length} deliberately unmapped → initial tile: ${unmapped.join(', ')}`);
if (oversized.length) console.log(`  ${oversized.length} over ${MAX_ICON_BYTES / 1024}KB → initial tile: ${oversized.join(', ')}`);
if (mixedInk.length) console.log(`  ${mixedInk.length} mixed currentColor+brand paint → neutral ink ${MIXED_INK}, never inverted: ${mixedInk.join(', ')}`);
console.log(`  asset version ${version}`);
console.log(`  ${(out.length / 1024).toFixed(1)} KB generated`);
