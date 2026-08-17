/**
 * Regression tests for canonicalModelUrl (src/pages.ts).
 *
 * WHY THIS FILE EXISTS: the function's only job is to decide when two model pages are
 * the same page. Getting that wrong is silent in both directions — a missed duplicate
 * quietly splits ranking signal, and a WRONG collapse quietly tells crawlers to drop a
 * page that answers a question no other page on the site answers. Neither shows up as
 * a failure anywhere.
 *
 * The first draft inferred duplicate-ness from input/output price and duly collapsed
 * `qwen/qwen-plus-2025-07-28:thinking`, which is priced identically to its base but
 * carries `isReasoning: true`. A Codex review caught it, and the deeper reason no field
 * list can carry the decision alone is that the page also renders benchmarks,
 * subscriptions, hosts and usage, all keyed on exact `m.id`. So the criterion is now an
 * explicit `DUPLICATE_OF` allowlist and the field comparison is only a drift guard —
 * which means these tests have to pin BOTH: that an unlisted id fails closed, and that a
 * listed pair stops collapsing once its data diverges.
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
    // A REAL allowlisted pair — DUPLICATE_OF is explicit, so an invented id
    // would fail closed and every "collapses" assertion would pass for the
    // wrong reason.
    id: 'openai/gpt-5.6-luna', slug: 'gpt-5.6-luna', name: 'OpenAI: GPT-5.6 Luna',
    provider: 'OpenAI', providerId: 'openai',
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
  return base({ id: 'openai/gpt-5.6-luna:batch', slug: 'gpt-5.6-luna-batch',
                name: 'OpenAI: GPT-5.6 Luna (batch)', ...over });
}

/** Does the variant canonicalise away from itself? */
function collapses(v, catalogue) {
  return canonicalModelUrl(v, catalogue, selfUrl(v)) !== selfUrl(v);
}

test('a suffixed page identical to its base on every rendered field collapses', () => {
  const b = base(), v = variant();
  assert.equal(collapses(v, [b, v]), true);
  assert.equal(canonicalModelUrl(v, [b, v], selfUrl(v)), 'https://token.app/model/gpt-5.6-luna');
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
  const b = base({ id: 'qwen/qwen-plus-2025-07-28', slug: 'qwen-plus', isReasoning: false });
  const v = base({ id: 'qwen/qwen-plus-2025-07-28:thinking', slug: 'qwen-plus-thinking', isReasoning: true });
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

test('an id absent from DUPLICATE_OF fails closed, however identical it looks', () => {
  // The allowlist is the criterion; the field comparison is only a drift guard. A brand
  // new `:batch` id must keep its own canonical until a human has checked it.
  const b = base({ id: 'acme/model-9', slug: 'model-9', name: 'Acme 9' });
  const v = base({ id: 'acme/model-9:batch', slug: 'model-9-batch', name: 'Acme 9 (batch)' });
  assert.equal(collapses(v, [b, v]), false);
});

test('the drift guard un-collapses an allowlisted pair whose data has diverged', () => {
  // If OpenAI starts discounting this batch tier, the pair stops being a duplicate and
  // stops collapsing with no edit to DUPLICATE_OF.
  const b = base(), v = variant({ inputPer1M: 0.5 });
  assert.equal(collapses(v, [b, v]), false);
});

test('a differing description blocks collapsing (it renders in the lede and JSON-LD)', () => {
  const b = base({ description: 'Fast general model.' });
  const v = variant({ description: 'Batch queue, 24h turnaround.' });
  assert.equal(collapses(v, [b, v]), false);
});

test('the label differing is EXPECTED and must not block collapsing', () => {
  // The variant is legitimately named "(batch)"; comparing `name` would collapse nothing.
  const b = base({ name: 'OpenAI: GPT-5.6 Luna' });
  const v = variant({ name: 'OpenAI: GPT-5.6 Luna (batch)' });
  assert.equal(collapses(v, [b, v]), true);
});
