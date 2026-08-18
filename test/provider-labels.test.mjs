/**
 * Regression tests for the CLIENT-SIDE provider labels (src/template.ts).
 *
 * WHY THIS FILE EXISTS: `template.ts` is one giant template literal that the rest of the
 * suite never bundles, so until now `tsc` was the only gate on it — and `tsc` cannot see
 * inside the literal. Two distinct bug classes live in that blind spot, and both shipped:
 *
 *  1. WRONG LABELS. Five renderers printed a provider name without consulting
 *     `PROVIDERS`. The table chip, the filter pills and the pareto tooltip printed the
 *     KV-baked `m.provider`, which goes stale for up to 4h after a vendor rename because
 *     `/api/models` is edge-cached and un-busted. The rankings leaderboard and the
 *     task-spend list printed a RAW model-id prefix (`slug.split('/')[0]`), so they read
 *     "by x-ai" / "by meta-llama" / "by z-ai" for every provider, and always had.
 *
 *  2. SILENTLY EATEN ESCAPES. Inside a template literal a lone `\s` is an unknown escape
 *     and the backslash is DROPPED, so source reading `/\s+/g` ships as `/s+/g` — a regex
 *     matching the letter "s". That is the same mechanism as the `\'` gotcha in
 *     CLAUDE.md, and it is invisible to `tsc`, invisible in review, and produced
 *     " ome new vendor" from "some-new-vendor". The escape assertion below is the part
 *     that catches it, because it inspects the SHIPPED string rather than the source.
 *
 * These assertions run against the rendered HTML and evaluate the real shipped function,
 * so they fail if either the wiring or the escaping regresses.
 *
 * Uses node:test — built in, no new dependency. Run: npm test
 * The module is bundled with esbuild because it is TypeScript. No network is touched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'label-test-'));
const out = await build({
  entryPoints: ['src/template.ts'],
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const p = join(dir, 'template.mjs');
writeFileSync(p, out.outputFiles[0].text);
const { getHtml } = await import(pathToFileURL(p).href);

const html = getHtml({ initialModels: '[]' });

/** The name map the page actually ships. */
const NAMES = JSON.parse(html.match(/var PROVIDER_NAMES = (\{.*?\});/s)[1]);

/** The label function the page actually ships, evaluated against that map. */
const src = html.match(/function providerLabel\(id, fallbackName\) \{[\s\S]*?\n\}/)[0];
const providerLabel = new Function('PROVIDER_NAMES', src + '; return providerLabel;')(NAMES);

test('the name map is derived from PROVIDERS, not hand-written', () => {
  assert.equal(NAMES.spacexai, 'SpaceXAI');
  assert.equal(NAMES.qwen, 'Alibaba');
  assert.equal(NAMES['meta-llama'], 'Meta');
  assert.ok(Object.keys(NAMES).length > 40, 'expected the full provider table');
});

test('a RETIRED slug is folded in and resolves to the CURRENT name', () => {
  // KV holds the old providerId for up to 4h after a rename. Without this the
  // leaderboard prints the retired slug verbatim.
  assert.equal(NAMES['x-ai'], 'SpaceXAI');
  assert.equal(providerLabel('x-ai'), 'SpaceXAI');
});

test('the compiled map BEATS a stale baked name', () => {
  // The chip passes m.provider as a fallback; the fresh map must win over it.
  assert.equal(providerLabel('x-ai', 'xAI'), 'SpaceXAI');
});

test('a raw model-id prefix renders a display name, not the prefix', () => {
  assert.equal(providerLabel('meta-llama'), 'Meta');
  assert.equal(providerLabel('z-ai'), 'Zhipu AI');
  assert.equal(providerLabel('perplexityai'), 'Perplexity');
});

test('an unknown provider falls back to the baked name when there is one', () => {
  assert.equal(providerLabel('nonesuch', 'Baked Name'), 'Baked Name');
});

test('an unknown provider with no baked name is prettified like getProvider()', () => {
  // Guards the eaten-backslash bug: a broken /s+/g ate the leading "s" here.
  assert.equal(providerLabel('some-new-vendor'), 'Some new vendor');
  assert.equal(providerLabel('stepfun-oddity'), 'Stepfun oddity');
});

test('normalization matches canonicalProviderId (case, tilde, whitespace)', () => {
  assert.equal(providerLabel('X-AI'), 'SpaceXAI');
  assert.equal(providerLabel('~x-ai'), 'SpaceXAI');
  assert.equal(providerLabel('meta llama'), 'Meta');
});

test('an empty or nullish id renders nothing rather than "Undefined"', () => {
  assert.equal(providerLabel(''), '');
  assert.equal(providerLabel(null), '');
  assert.equal(providerLabel(undefined), '');
});

test('the whitespace regex survives the template literal with its backslash intact', () => {
  // THE point of this file. Source says /\s+/g; a dropped backslash ships /s+/g, which
  // matches the letter "s" and silently corrupts every prettified label.
  assert.match(html, /replace\(\/\\s\+\/g, '-'\)/,
    'providerLabel shipped without its backslash — see the header');
  assert.doesNotMatch(html, /replace\(\/s\+\/g, '-'\)/,
    'shipped a regex matching the LETTER s');
});

test('all five renderers go through providerLabel', () => {
  const sites = [
    [/escape\(providerLabel\(m\.providerId, m\.provider\)\)/, 'table provider chip'],
    [/escape\(providerLabel\(pid, info\.name\)\)/, 'provider filter pills'],
    [/escape\(providerLabel\(p\.m\.providerId, p\.m\.provider\)\)/, 'pareto tooltip'],
    [/' by ' \+ escape\(providerLabel\(provider\)\)/, 'rankings leaderboard'],
    [/' by ' \+ escape\(providerLabel\(m\.provider\)\)/, 'task-spend model list'],
  ];
  for (const [re, name] of sites) assert.match(html, re, name + ' is not wired');
});

test('no renderer prints a raw provider string any more', () => {
  assert.doesNotMatch(html, /' by ' \+ escape\(provider\)/, 'leaderboard prints a raw slug');
  assert.doesNotMatch(html, /escape\(p\.m\.provider\)/, 'pareto prints a baked name');
  assert.doesNotMatch(html, /escape\(info\.name\)/, 'filter pills print a baked name');
});

/**
 * Whole-file guard for the eaten-escape class, not just the one line this PR fixed.
 *
 * `chartSlot` was the first victim: it shipped /\s+/g as /s+/g and mangled
 * "deepseek" into "deep-eek". Its comment has documented the trap ever since, and
 * providerLabel walked straight into it anyway. So rather than fix instances one at
 * a time, this asserts the invariant: NO unknown escape sequence may appear inside
 * the page template literal, because every one of them silently loses its backslash
 * on the way to the browser and neither tsc nor a code review can see it happen.
 *
 * If this fails, you wrote a single backslash inside src/template.ts where you meant
 * a real one. Double it (\\s ships as \s), or avoid the class entirely the way
 * chartSlot does with a literal-space regex.
 */
test('no unknown backslash escape survives inside the page template literal', async () => {
  const { readFileSync } = await import('node:fs');
  const lines = readFileSync('src/template.ts', 'utf8').split('\n');
  // Escapes JS actually recognises. Anything else silently loses its backslash.
  const VALID = new Set(['n', 't', 'r', '\\', "'", '"', '`', '$', 'b', 'f', 'v', '0', 'x', 'u']);
  const LITERAL_STARTS_AT = 75; // the getHtml() page literal opens here
  const offenders = [];
  for (let i = LITERAL_STARTS_AT - 1; i < lines.length; i++) {
    const ln = lines[i];
    for (let j = 0; j < ln.length; j++) {
      if (ln[j] !== '\\') continue;
      const nxt = ln[j + 1];
      if (nxt === undefined) continue;
      if (nxt === '\\') { j++; continue; }
      if (VALID.has(nxt)) continue;
      offenders.push(`L${i + 1}  \\${nxt}   ${ln.trim().slice(0, 100)}`);
    }
  }
  assert.deepEqual(offenders, [],
    'unknown escape(s) inside the template literal — the backslash will be dropped:\n' +
    offenders.join('\n'));
});
