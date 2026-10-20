/**
 * Regression tests for the model page's Product JSON-LD (src/pages.ts).
 *
 * WHY THIS FILE EXISTS: on 2026-10-20 Search Console reported 7 structured-data
 * issues across all 469 `/model/{slug}` pages, 1 of them critical. The diagnosis
 * is the interesting part, and it is the thing a later "just silence the warnings"
 * pass would undo:
 *
 *   - Google: "Only pages where a shopper can purchase a product are eligible for
 *     merchant listing experiences." We sell nothing and link out, so these pages
 *     can NEVER qualify. The critical `image` error was raised against a feature we
 *     cannot have, because a plain `Offer` tells Google the page owner is the seller.
 *   - An `AggregateOffer` is both the honest shape (one model, many hosts, prices
 *     differing by multiples) and what moves these pages into the Product-snippets
 *     report, where `name` + any offer is already the whole requirement.
 *   - `aggregateRating` and `review` are the two fields we must NEVER satisfy: we
 *     hold no ratings and no reviews, and inventing them breaches Google's policy.
 *
 * So the assertions below pin a DECISION, not just a shape. The load-bearing one is
 * the price-basis test: `ModelEndpoints.endpoints` is sorted by BLENDED price, so
 * `endpoints[0]` is not the cheapest INPUT price. The fixture is built so that the
 * two bases disagree — a `endpoints[0].inputPer1M` implementation passes every other
 * assertion in this file and fails only that one.
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

const dir = mkdtempSync(join(tmpdir(), 'jsonld-test-'));
const out = await build({
  entryPoints: ['src/pages.ts'],
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const p = join(dir, 'pages.mjs');
writeFileSync(p, out.outputFiles[0].text);
const { getModelHtml } = await import(pathToFileURL(p).href);

const MODEL = {
  id: 'openai/gpt-4o', slug: 'gpt-4o', name: 'GPT-4o',
  provider: 'OpenAI', providerId: 'openai',
  inputPer1M: 2.5, outputPer1M: 10, imagePricePer: null,
  contextWindow: 128000, maxOutput: 16384,
  inputModalities: ['text'], outputModalities: ['text'],
  isFree: false, isVision: false, isReasoning: false, isOpenSource: false,
  hasToolUse: true, isDeprecated: false, createdAt: null,
};

const endpoint = (over) => ({
  provider: 'X', label: 'X', tag: '',
  inputPer1M: null, outputPer1M: null, blendedPer1M: null, cacheReadPer1M: null,
  contextLength: 128000, maxOutput: null, quantization: null, uptimeDay: null,
  implicitCaching: false, longContext: null,
  ...over,
});

/** The `Product` node, parsed out of the rendered page. */
function productLd(endpoints) {
  const html = getModelHtml({
    model: MODEL, all: [MODEL], benchmarks: null, subscriptions: [], endpoints,
  });
  const blocks = [...html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )].map((mm) => JSON.parse(mm[1].replace(/\\u003c/g, '<')));
  const prod = blocks.filter((b) => b['@type'] === 'Product');
  assert.equal(prod.length, 1, 'expected exactly one Product node');
  return prod[0];
}

// ── The basis trap ───────────────────────────────────────────────────────────

test('price bounds come from input prices, not the blended sort order', () => {
  // Ascending by BLENDED (3:1), which is how ModelEndpoints is documented to arrive.
  // Input prices deliberately disagree with that order: the cheapest blended host is
  // the DEAREST on input, so reading endpoints[0]/endpoints.at(-1) yields 9 and 1 —
  // a range that is both wrong and inverted.
  const eps = {
    modelId: MODEL.id, fetchedAt: '2026-10-20T00:00:00Z',
    endpoints: [
      endpoint({ inputPer1M: 9, outputPer1M: 1, blendedPer1M: 7 }),
      endpoint({ inputPer1M: 1, outputPer1M: 40, blendedPer1M: 10.75 }),
      endpoint({ inputPer1M: 4, outputPer1M: 60, blendedPer1M: 18 }),
    ],
  };
  const o = productLd(eps).offers;
  assert.equal(o.lowPrice, '1', 'lowPrice must be the min INPUT price');
  assert.equal(o.highPrice, '9', 'highPrice must be the max INPUT price');
  assert.equal(o.offerCount, 3);
});

// ── Merchant-listing avoidance: the point of the change ──────────────────────

test('offers is an AggregateOffer, never a bare Offer', () => {
  // A bare `Offer` is what puts the page back into merchant-listing validation,
  // which it can never pass. This is the assertion that guards the diagnosis.
  for (const eps of [null, { modelId: MODEL.id, fetchedAt: '', endpoints: [] }]) {
    assert.equal(productLd(eps).offers['@type'], 'AggregateOffer');
  }
});

test('never fabricates aggregateRating or review', () => {
  // Search Console asks for both. We have neither. Satisfying them would mean
  // inventing ratings — a Google policy breach, and the same class of unfounded
  // claim leadingBenchmark() exists to gate.
  const prod = productLd(null);
  assert.ok(!('aggregateRating' in prod), 'aggregateRating must stay absent');
  assert.ok(!('review' in prod), 'review must stay absent');
  assert.ok(!('hasMerchantReturnPolicy' in prod.offers), 'nothing is returned');
  assert.ok(!('shippingDetails' in prod.offers), 'nothing ships');
});

test('carries the critical image field and an availability', () => {
  const prod = productLd(null);
  assert.ok(Array.isArray(prod.image) && prod.image.length >= 1);
  assert.equal(prod.image[0], 'https://token.app/og.png');
  assert.match(prod.image[1], /^https:\/\/token\.app\/logo\/openai\.svg\?v=\w+$/);
  assert.equal(prod.offers.availability, 'https://schema.org/InStock');
  assert.equal(prod.offers.priceCurrency, 'USD');
});

// ── The >=2 gate, matching what hostsPanel renders ───────────────────────────

test('a range needs 2 priced hosts; otherwise the catalogue price stands alone', () => {
  const one = {
    modelId: MODEL.id, fetchedAt: '',
    endpoints: [endpoint({ inputPer1M: 7, outputPer1M: 7, blendedPer1M: 7 })],
  };
  for (const eps of [null, one]) {
    const o = productLd(eps).offers;
    assert.equal(o.lowPrice, '2.5', 'falls back to the price the page header shows');
    assert.ok(!('highPrice' in o), 'no spread may be claimed from one host');
    assert.ok(!('offerCount' in o), 'no count may be claimed from one host');
  }
});

test('unpriced hosts do not count toward the gate or the bounds', () => {
  const eps = {
    modelId: MODEL.id, fetchedAt: '',
    endpoints: [
      endpoint({ inputPer1M: null, blendedPer1M: null }),
      endpoint({ inputPer1M: 3, outputPer1M: 3, blendedPer1M: 3 }),
    ],
  };
  const o = productLd(eps).offers;
  assert.equal(o.lowPrice, '2.5', 'one priced host is not a range');
  assert.ok(!('offerCount' in o));
});

// ── Degenerate prices ────────────────────────────────────────────────────────

test('omits offers entirely when there is no price at all', () => {
  const free = { ...MODEL, inputPer1M: null, outputPer1M: null };
  const html = getModelHtml({
    model: free, all: [free], benchmarks: null, subscriptions: [], endpoints: null,
  });
  const prod = [...html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )].map((mm) => JSON.parse(mm[1].replace(/\\u003c/g, '<')))
    .find((b) => b['@type'] === 'Product');
  assert.ok(!('offers' in prod), 'a blank offer is worse than none');
});

test('trims the per-1M float noise out of the markup', () => {
  // $0.00000007/token x 1e6 lands as 0.07000000000000001 in IEEE754.
  const eps = {
    modelId: MODEL.id, fetchedAt: '',
    endpoints: [
      endpoint({ inputPer1M: 0.00000007 * 1e6, outputPer1M: 1, blendedPer1M: 1 }),
      endpoint({ inputPer1M: 0.29 * 3, outputPer1M: 2, blendedPer1M: 2 }),
    ],
  };
  const o = productLd(eps).offers;
  assert.equal(o.lowPrice, '0.07');
  assert.equal(o.highPrice, '0.87');
});
