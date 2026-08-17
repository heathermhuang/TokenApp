/**
 * Regression tests for canonicalModelUrl (src/pages.ts).
 *
 * WHY THIS FILE EXISTS: the function's only job is to decide when two model pages are
 * the same page. Getting that wrong is silent in both directions — a missed duplicate
 * quietly splits ranking signal, and a WRONG collapse quietly tells crawlers to drop a
 * page that answers a question no other page on the site answers. Neither shows up as
 * a failure anywhere.
 *
 * The first draft compared only input/output price and duly collapsed
 * `qwen/qwen-plus-2025-07-28:thinking`, which is priced identically to its base but
 * carries `isReasoning: true`. A Codex review caught it. These tests pin the truth
 * table so the next edit cannot quietly reintroduce that class of bug.
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

const dir = mkdtempSync(join(tmpdir(), 'canon-test-'));
const out = await build({
  entryPoints: ['src/pages.ts'],
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const bundlePath = join(dir, 'pages.mjs');
writeFileSync(bundlePath, out.outputFiles[0].text);
const { canonicalModelUrl } = await import(pathToFileURL(bundlePath).href);

const selfUrl = (m) => `https://token.app/model/${encodeURIComponent(m.slug)}`;

/** A base model with every field populated; override what a case is about. */
function base(over = {}) {
  return {
    id: 'acme/model-1', slug: 'model-1', name: 'Acme Model 1',
    provider: 'Acme', providerId: 'acme',
    inputPer1M: 1, outputPer1M: 2, imagePricePer: null,
    contextWindow: 100_000, maxOutput: 8_000,
    inputModalities: ['text'], outputModalities: ['text'],
    isFree: false, isVision: false, isReasoning: false, isOpenSource: false,
    hasToolUse: false, isDeprecated: false, createdAt: 1_700_000_000,
    ...over,
  };
}

/** The `:batch` sibling of `base()`, identical unless overridden. */
function variant(over = {}) {
  return base({ id: 'acme/model-1:batch', slug: 'model-1-batch', ...over });
}

/** Does the variant canonicalise away from itself? */
function collapses(v, catalogue) {
  return canonicalModelUrl(v, catalogue, selfUrl(v)) !== selfUrl(v);
}

test('a suffixed page identical to its base on every rendered field collapses', () => {
  const b = base(), v = variant();
  assert.equal(collapses(v, [b, v]), true);
  assert.equal(canonicalModelUrl(v, [b, v], selfUrl(v)), 'https://token.app/model/model-1');
});

test('an unsuffixed page is always its own canonical', () => {
  const b = base();
  assert.equal(collapses(b, [b]), false);
});

test('a suffixed page with no base in the catalogue keeps its own canonical', () => {
  // openai/gpt-5-codex:batch and seven `:free` ids are the only page for their model.
  const v = variant();
  assert.equal(collapses(v, [v]), false);
});

test('a cheaper batch rate is a different offer, not a duplicate', () => {
  // The common case: 66 of 79 suffixed ids are priced differently from their base.
  const b = base(), v = variant({ inputPer1M: 0.5, outputPer1M: 1 });
  assert.equal(collapses(v, [b, v]), false);
});

test('a matching price is NOT a matching product — isReasoning still separates them', () => {
  // qwen/qwen-plus-2025-07-28:thinking, priced identically, isReasoning: true.
  // This is the exact bug the first draft shipped.
  const b = base({ isReasoning: false });
  const v = variant({ isReasoning: true });
  assert.equal(b.inputPer1M, v.inputPer1M);   // prices really are equal
  assert.equal(b.outputPer1M, v.outputPer1M);
  assert.equal(collapses(v, [b, v]), false);
});

test('two unpriced models are not the same model — null === null proves nothing', () => {
  const nulls = { inputPer1M: null, outputPer1M: null };
  const b = base(nulls), v = variant(nulls);
  assert.equal(collapses(v, [b, v]), false);
});

test('a deprecated base is never a canonical target', () => {
  // Must be rejected HERE, not in the callers: the sitemap filters deprecated models
  // out before calling while the model page does not, so leaving it to callers makes
  // the two disagree — the contradiction this function exists to remove.
  const b = base({ isDeprecated: true }), v = variant();
  assert.equal(collapses(v, [b, v]), false);
});

test('every other page-visible field also separates a variant from its base', () => {
  const cases = {
    contextWindow: 50_000,
    maxOutput: 4_000,
    imagePricePer: 0.01,
    isVision: true,
    hasToolUse: true,
  };
  for (const [field, value] of Object.entries(cases)) {
    const b = base(), v = variant({ [field]: value });
    assert.equal(collapses(v, [b, v]), false, `${field} should prevent collapsing`);
  }
  for (const field of ['inputModalities', 'outputModalities']) {
    const b = base(), v = variant({ [field]: ['text', 'image'] });
    assert.equal(collapses(v, [b, v]), false, `${field} should prevent collapsing`);
  }
});

test('modality comparison is order- and length-sensitive, not just length', () => {
  const b = base({ inputModalities: ['text', 'image'] });
  const v = variant({ inputModalities: ['image', 'text'] });
  assert.equal(collapses(v, [b, v]), false);
});
