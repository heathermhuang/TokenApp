/**
 * Regression tests for the provider-rename alias layer (src/providers.ts + fetchers.ts).
 *
 * WHY THIS FILE EXISTS: `providerId` is NOT an owned string — it is
 * `raw.id.split('/')[0]`, so every model under `x-ai/grok-*` arrives labelled `x-ai`
 * regardless of what the company calls itself. Renaming the display identity to
 * "SpaceXAI" therefore means reconciling a foreign key with a label, and every failure
 * mode in that job is SILENT:
 *
 *   • forget the alias at lookup time  → all six Grok models fall through getProvider()
 *     to the grey "X ai" fallback chip. No error, just a wrong-looking page.
 *   • forget it on the provider page   → `/spacexai` renders with zero models.
 *   • forget the logo slug             → logoSvg() never 404s, it silently substitutes a
 *     generated initial tile, so the real mark is replaced by an "S" square.
 *   • forget the hasToolUse list       → a whole vendor quietly loses a filter facet.
 *
 * The alias has to work in BOTH directions, and that is the part worth pinning: KV holds
 * normalized models written by the previous deploy, and /api/models is edge-cached up to
 * 4h, so the RETIRED spelling keeps arriving for hours after the rename ships.
 *
 * Uses node:test — built in, no new dependency. Run: npm test
 * Modules are bundled with esbuild because they are TypeScript. No network is touched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'prov-test-'));

async function load(entry, file) {
  const out = await build({
    entryPoints: [entry],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  });
  const p = join(dir, file);
  writeFileSync(p, out.outputFiles[0].text);
  return import(pathToFileURL(p).href);
}

const providers = await load('src/providers.ts', 'providers.mjs');
const fetchers = await load('src/fetchers.ts', 'fetchers.mjs');
const logos = await load('src/logos.ts', 'logos.mjs');

const {
  canonicalProviderId, getProvider, PROVIDER_PAGE_SET, PROVIDER_SLUG_REDIRECTS,
} = providers;

test('the retired slug resolves to the current one', () => {
  assert.equal(canonicalProviderId('x-ai'), 'spacexai');
});

test('the current slug is stable under canonicalization', () => {
  assert.equal(canonicalProviderId('spacexai'), 'spacexai');
});

test('canonicalization still normalizes case, tildes and spaces', () => {
  assert.equal(canonicalProviderId('X-AI'), 'spacexai');
  assert.equal(canonicalProviderId('~x-ai'), 'spacexai');
  assert.equal(canonicalProviderId('Meta Llama'), 'meta-llama');
  assert.equal(canonicalProviderId(''), '');
});

test('an unrelated provider is untouched by the alias table', () => {
  assert.equal(canonicalProviderId('anthropic'), 'anthropic');
  assert.equal(getProvider('anthropic').displayName, 'Anthropic');
});

test('getProvider resolves the RETIRED slug — the stale-KV path', () => {
  // Between the deploy and the next refresh, KV still holds providerId 'x-ai'. Without
  // alias resolution here every Grok model renders a grey "X ai" chip and nothing errors.
  const stale = getProvider('x-ai');
  assert.equal(stale.displayName, 'SpaceXAI');
  assert.equal(stale.color, '#e2e8f0');            // brand colour, not the grey fallback
  assert.notEqual(stale.color, '#94a3b8');
});

test('getProvider resolves the CURRENT slug identically', () => {
  assert.deepEqual(getProvider('spacexai'), getProvider('x-ai'));
});

test('an unknown provider still gets the generated fallback, not a crash', () => {
  const unknown = getProvider('totally-new-lab');
  assert.equal(unknown.color, '#94a3b8');
  assert.match(unknown.displayName, /Totally/);
});

test('normalizeModel canonicalizes providerId but NEVER the model id', () => {
  // The id is the join key for benchmarks, D1 rankings and underlyingModels.
  const m = fetchers.normalizeModel({
    id: 'x-ai/grok-4.6', name: 'SpaceXAI: Grok 4.6',
    pricing: { prompt: '0.000003', completion: '0.000015' },
    architecture: { modality: 'text->text' },
  });
  assert.equal(m.providerId, 'spacexai');
  assert.equal(m.id, 'x-ai/grok-4.6');
  assert.equal(m.provider, 'SpaceXAI');
});

test('the hasToolUse list follows the rename', () => {
  // Keyed on the canonical id, so a stale 'x-ai' entry would silently drop the facet
  // for every Grok model whose name contains "instruct".
  const m = fetchers.normalizeModel({
    id: 'x-ai/grok-4.6-instruct', name: 'SpaceXAI: Grok 4.6 Instruct',
    pricing: { prompt: '0.000003', completion: '0.000015' },
    architecture: { modality: 'text->text' },
  });
  assert.equal(m.providerId, 'spacexai');
  assert.equal(m.hasToolUse, true);
});

test('the provider page set carries the current slug only', () => {
  assert.equal(PROVIDER_PAGE_SET.has('spacexai'), true);
  assert.equal(PROVIDER_PAGE_SET.has('x-ai'), false);
});

test('a redirect source is never also a live page — that would shadow the redirect', () => {
  // Hono matches the first registered route, so a slug in both collections would serve
  // the page and the 301 would be dead code.
  for (const from of Object.keys(PROVIDER_SLUG_REDIRECTS)) {
    assert.equal(PROVIDER_PAGE_SET.has(from), false, `${from} is both a page and a redirect`);
  }
});

test('every redirect target IS a live page', () => {
  for (const to of Object.values(PROVIDER_SLUG_REDIRECTS)) {
    assert.equal(PROVIDER_PAGE_SET.has(to), true, `${to} is a redirect target with no page`);
  }
});

test('BOTH logo slugs serve the real brand mark, not a generated initial tile', () => {
  // logoSvg() never returns null for a valid slug — it falls back to a letter tile — so
  // dropping the retired key would swap the Grok mark for an "S" square with nothing
  // failing. Browsers cache /logo/x-ai.svg for a year under an immutable TTL.
  const current = logos.logoSvg('spacexai');
  const retired = logos.logoSvg('x-ai');
  for (const [label, svg] of [['spacexai', current], ['x-ai', retired]]) {
    assert.ok(svg, `${label} produced no svg`);
    assert.match(svg, /<title>Grok<\/title>/, `${label} fell back to an initial tile`);
  }
  assert.equal(current, retired);
});
