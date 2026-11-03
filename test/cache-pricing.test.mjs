/**
 * Regression tests for CACHED-INPUT pricing (src/fetchers.ts + src/template.ts).
 *
 * WHY THIS FILE EXISTS: OpenRouter publishes a cached-input price for only ~310 of
 * 451 models, and the sibling fields right next to it (`prompt`, `completion`) are
 * normalized with `?? '0'` because every model has them. Reusing that idiom for
 * cache would turn "this vendor publishes no cache price" into "cached input is
 * free" — and because the table sort sends nulls to Infinity but compares 0 as a
 * real number, every unpriced model would then sort ahead of every priced one as
 * the cheapest thing in the catalogue. That is the fake-7D bug's exact shape: an
 * absent measurement rendered as a confident figure.
 *
 * The second class guarded here is the opposite error — presenting cache as a pure
 * discount. Anthropic charges MORE to write Opus 5.5's cache ($5.00/1M) than to
 * send the prompt uncached ($4.00/1M), so a prefix written once and read once
 * loses money. The dagger assertions pin that the UI flags it.
 *
 * Uses node:test — built in, no new dependency. Run: npm test
 * The modules are bundled with esbuild because they are TypeScript. No network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'cache-price-test-'));

async function load(entry, name) {
  const out = await build({
    entryPoints: [entry],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  });
  const p = join(dir, name);
  writeFileSync(p, out.outputFiles[0].text);
  return import(pathToFileURL(p).href);
}

const { normalizeModel } = await load('src/fetchers.ts', 'fetchers.mjs');
const { getHtml } = await load('src/template.ts', 'template.mjs');

/** Minimal upstream model; `pricing` is spread in per-case. */
const raw = (pricing) => ({
  id: 'vendor/some-model',
  name: 'Some Model',
  context_length: 128000,
  architecture: { modality: 'text->text', tokenizer: 'X', instruct_type: null },
  pricing: { prompt: '0.000004', completion: '0.00002', ...pricing },
  top_provider: { context_length: 128000, max_completion_tokens: 4096, is_moderated: false },
  per_request_limits: null,
});

// ── Normalization ────────────────────────────────────────────────────────────

test('an ABSENT cache price normalizes to null, never 0', () => {
  const m = normalizeModel(raw({}));
  // The whole point. 0 would read as "free" on the page and would beat every
  // real price in an ascending sort.
  assert.equal(m.cacheReadPer1M, null);
  assert.equal(m.cacheWritePer1M, null);
  assert.equal(m.cacheWrite1hPer1M, null);
  assert.notEqual(m.cacheReadPer1M, 0);
});

test('a published cache price is carried through as USD per 1M', () => {
  const m = normalizeModel(raw({
    input_cache_read: '0.0000002',
    input_cache_write: '0.000005',
    input_cache_write_1h: '0.000008',
  }));
  assert.equal(m.cacheReadPer1M, 0.2);
  assert.equal(m.cacheWritePer1M, 5);
  assert.equal(m.cacheWrite1hPer1M, 8);
});

test('an explicitly ZERO cache price stays 0 and stays distinct from absent', () => {
  // No model publishes this today, but "free" and "unpublished" are different
  // claims and the normalizer must not collapse them.
  const free = normalizeModel(raw({ input_cache_read: '0' }));
  const absent = normalizeModel(raw({}));
  assert.equal(free.cacheReadPer1M, 0);
  assert.equal(absent.cacheReadPer1M, null);
});

test('adding cache fields does not disturb the uncached prices', () => {
  const m = normalizeModel(raw({ input_cache_read: '0.0000002' }));
  assert.equal(m.inputPer1M, 4);
  assert.equal(m.outputPer1M, 20);
});

// ── The shipped client cell ──────────────────────────────────────────────────

const html = getHtml({ initialModels: '[]' });

/** Evaluate the real shipped cachedCell against stub helpers it closes over. */
function shippedCachedCell() {
  const src = html.match(/function cachedCell\(m\) \{[\s\S]*?\n\}/)[0];
  const fmt = html.match(/function fmtPrice\(n\) \{[\s\S]*?\n\}/)[0];
  // cachedCell formats through fmtPriceFine, not fmtPrice: the shared formatter
  // floors at "<$0.01" and real cache reads run $0.0020-$0.0069, which would
  // collapse 21 models to one string in a sortable column.
  const fine = html.match(/function fmtPriceFine\(n\) \{[\s\S]*?\n\}/)[0];
  const cls = html.match(/function priceClass\(n, field\) \{[\s\S]*?\n\}/)[0];
  const esc = 'function escape(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}';
  return new Function(`${fmt}\n${fine}\n${cls}\n${esc}\n${src}\n; return cachedCell;`)();
}
const cachedCell = shippedCachedCell();

test('a model with no cache price renders an em dash, not $0.00', () => {
  const out = cachedCell({ inputPer1M: 4, outputPer1M: 20, cacheReadPer1M: null, cacheWritePer1M: null });
  assert.match(out, /—/);
  assert.doesNotMatch(out, /\$0\.00/);
  assert.doesNotMatch(out, /†/);
});

test('a write DEARER than the uncached prompt is flagged with a dagger', () => {
  // The real Opus 5.5 shape: $4.00 prompt, $0.20 cache read, $5.00 cache write.
  const out = cachedCell({ inputPer1M: 4, outputPer1M: 20, cacheReadPer1M: 0.2, cacheWritePer1M: 5 });
  assert.match(out, /†/);
  assert.match(out, /WRITE COSTS MORE/);
});

test('a write CHEAPER than the prompt carries no dagger', () => {
  const out = cachedCell({ inputPer1M: 4, outputPer1M: 20, cacheReadPer1M: 0.2, cacheWritePer1M: 3 });
  assert.doesNotMatch(out, /†/);
  assert.doesNotMatch(out, /WRITE COSTS MORE/);
});

test('an unknown write price is not treated as cheap OR dear', () => {
  // null must not quietly compare as 0 and clear the dagger by accident.
  const out = cachedCell({ inputPer1M: 4, outputPer1M: 20, cacheReadPer1M: 0.2, cacheWritePer1M: null });
  assert.doesNotMatch(out, /†/);
  assert.match(out, /Cached read/);
});

test('no dagger when there is no prompt price to compare the write against', () => {
  // Found by mutation testing: dropping the null guards leaves `write > prompt`,
  // and JS coerces `5 > null` to `5 > 0` — true. That paints a dagger claiming the
  // write beats an uncached price the model never published. Sentinel rows
  // (openrouter/auto) and unpriced hosts both arrive in this shape.
  const out = cachedCell({ inputPer1M: null, outputPer1M: null, cacheReadPer1M: 0.2, cacheWritePer1M: 5 });
  assert.doesNotMatch(out, /†/);
  assert.doesNotMatch(out, /WRITE COSTS MORE/);
  assert.doesNotMatch(out, /cheaper than/);
});

test('the cheaper-than-prompt multiple is stated, not left to the reader', () => {
  const out = cachedCell({ inputPer1M: 4, outputPer1M: 20, cacheReadPer1M: 0.2, cacheWritePer1M: 5 });
  assert.match(out, /20\.0x cheaper/);
});

// ── The column is wired into the table ───────────────────────────────────────

test('the Cached column is sortable and the empty-state colspan matches it', () => {
  assert.match(html, /data-sort="cacheReadPer1M"/);
  // A colspan left at 9 after adding a tenth column misaligns every empty state.
  const headerCount = (html.match(/<th scope="col"/g) || []).length;
  assert.equal(headerCount, 10);
  assert.doesNotMatch(html, /colspan="9"/);
});

test('a sub-cent cache read keeps enough precision to be worth sorting', () => {
  // Real range across the catalogue is $0.0020-$0.0069. fmtPrice would render
  // every one of those 21 models as "<$0.01" — identical strings in a column
  // whose whole purpose is comparison.
  const a = cachedCell({ inputPer1M: 0.027, outputPer1M: 0.1, cacheReadPer1M: 0.002, cacheWritePer1M: null });
  const b = cachedCell({ inputPer1M: 0.03, outputPer1M: 0.1, cacheReadPer1M: 0.0028, cacheWritePer1M: null });
  assert.match(a, /\$0\.0020/);
  assert.match(b, /\$0\.0028/);
  assert.doesNotMatch(a, /<\$0\.01/);
  assert.notEqual(a, b);
});
