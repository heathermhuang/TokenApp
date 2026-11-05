/**
 * Regression tests for routers' price sentinel on rendered pages.
 *
 * WHY THIS FILE EXISTS: OpenRouter prices its routers (openrouter/auto, /fusion,
 * /pareto-code, nvidia/switchyard, typesafe/jev-router …) at -1 per token, meaning
 * "depends on what this routes to"; normalized, that is -1000000 per 1M, and it is
 * kept deliberately (see toMillionOrNull in fetchers.ts). Every price formatter had
 * a `n < 0.01 → "<$0.01"` branch that the sentinel fell into, so /model/auto said it
 * was "available from OpenRouter at <$0.01 per million input tokens" — a real-looking
 * price for a model that has none. blended() and offersJsonLd already guarded it;
 * the text did not.
 *
 * Uses node:test — built in, no new dependency. Run: npm test
 * The modules are bundled with esbuild because they are TypeScript. No network is touched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'router-test-'));

async function load(entry, name) {
  const out = await build({
    entryPoints: [entry],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  });
  const p = join(dir, name);
  writeFileSync(p, out.outputFiles[0].text);
  return import(pathToFileURL(p).href);
}

const { getModelHtml } = await load('src/pages.ts', 'pages.mjs');
const { getHtml, getProviderHtml } = await load('src/template.ts', 'template.mjs');

const model = (over) => ({
  id: 'openrouter/auto', slug: 'auto', name: 'Auto Router',
  provider: 'OpenRouter', providerId: 'openrouter',
  inputPer1M: -1000000, outputPer1M: -1000000, imagePricePer: null,
  contextWindow: 2000000, maxOutput: null, description: null,
  inputModalities: ['text'], outputModalities: ['text'],
  isFree: false, isVision: false, isReasoning: false, isOpenSource: false,
  hasToolUse: true, isDeprecated: false, createdAt: null,
  ...over,
});

const page = (m) => getModelHtml({ model: m, all: [m], benchmarks: null, subscriptions: [], endpoints: null });

// ── Model page ───────────────────────────────────────────────────────────────

test('a router model page never prints the sentinel as a price', () => {
  const html = page(model());
  assert.doesNotMatch(html, /&lt;\$0\.01|<\$0\.01/, 'no "<$0.01" anywhere on the page');
  assert.doesNotMatch(html, /-1000000|\$-/, 'the raw sentinel never leaks');
});

test('lede, FAQ answer and meta description say the price depends on the routed model', () => {
  const html = page(model());
  const lede = html.match(/<p class="lede">([\s\S]*?)<\/p>/)[1];
  assert.match(lede, /depends on the model it routes/);
  const meta = html.match(/<meta name="description" content="([^"]*)"/)[1];
  assert.match(meta, /depends on the model it routes/);
  const faq = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((mm) => JSON.parse(mm[1].replace(/\\u003c/g, '<')))
    .find((b) => b['@type'] === 'FAQPage');
  const cost = faq.mainEntity.find((q) => /cost/.test(q.name));
  assert.match(cost.acceptedAnswer.text, /depends on the model it routes/);
});

test('a genuinely sub-cent price still renders as "<$0.01"', () => {
  // Control: the fix must not widen into the real floor.
  const html = page(model({ id: 'x/tiny', slug: 'tiny', name: 'Tiny', providerId: 'x', provider: 'X', inputPer1M: 0.005, outputPer1M: 0.008 }));
  assert.match(html, /&lt;\$0\.01 per million input tokens/);
  assert.doesNotMatch(html, /depends on the model it routes/);
});

// ── Provider page ────────────────────────────────────────────────────────────

test('a provider page row for a router does not show "<$0.01"', () => {
  const sw = model({ id: 'nvidia/switchyard', slug: 'switchyard', name: 'NVIDIA: Switchyard', provider: 'NVIDIA', providerId: 'nvidia' });
  const html = getProviderHtml({ providerId: 'nvidia', models: [sw] });
  const at = html.indexOf('<span class="model-name">Switchyard</span>');
  assert.ok(at > 0, 'the router row is rendered');
  const row = html.slice(at, html.indexOf('</tr>', at));
  assert.doesNotMatch(row, /&lt;\$0\.01|<\$0\.01/);
  assert.doesNotMatch(row, /price-(free|cheap|mid)/, 'and is not coloured as a price tier');
});

// ── Homepage client formatter ────────────────────────────────────────────────

test('the homepage client fmtPrice does not format the sentinel as "<$0.01"', () => {
  // fmtPrice runs in the browser, so it is pulled out of the shipped page and run here.
  const html = getHtml({ initialModels: '[]' });
  const src = html.match(/function fmtPrice\(n\) \{[\s\S]*?\n\}/)[0];
  const fmtPrice = new Function(src + '; return fmtPrice;')();
  assert.notEqual(fmtPrice(-1000000), '<$0.01');
  assert.doesNotMatch(fmtPrice(-1000000), /\$/);
  assert.equal(fmtPrice(0.005), '<$0.01');
});
