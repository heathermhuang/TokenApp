/**
 * OpenRouter's pricing.overrides carries two unrelated things, told apart only by
 * which key is present:
 *   min_prompt_tokens       a long-context re-pricing tier (84 models, 2026-11-26)
 *   utc_days / utc_start…   a time-of-day price window (4 models)
 * Neither reached the catalogue, so the table showed one headline price for both.
 * DeepSeek V4.1 Flash 1017's headline $0.30 is its PEAK: it costs $0.15 all
 * weekend and 17 of 24 weekday hours. A window is not a discount by definition,
 * so direction is always read from the numbers. Fixtures are trimmed live entries.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'price-overrides-'));
async function load(entry, name) {
  const out = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  writeFileSync(join(dir, name), out.outputFiles[0].text);
  return import(pathToFileURL(join(dir, name)).href);
}
const { normalizeModel } = await load('src/fetchers.ts', 'fetchers.mjs');
const { getModelHtml } = await load('src/pages.ts', 'pages.mjs');
const { getHtml } = await load('src/template.ts', 'tpl.mjs');

const raw = (id, prompt, completion, overrides) => ({
  id, name: 'X: ' + id.split('/')[1], created: 1, context_length: 1_000_000, description: '',
  architecture: { modality: 'text->text' }, pricing: { prompt, completion, ...(overrides ? { overrides } : {}) },
  top_provider: { context_length: 1_000_000, max_completion_tokens: null, is_moderated: false },
});
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const deepseek = raw('deepseek/deepseek-v4.1-flash-1017', '0.0000003', '0.0000012', [
  { utc_days: ['saturday', 'sunday'], prompt: '0.00000015', completion: '0.0000006' },
  { utc_days: WEEKDAYS, utc_start: 0, utc_end: 100, prompt: '0.00000015', completion: '0.0000006' },
  { utc_days: WEEKDAYS, utc_start: 100, utc_end: 400, prompt: '0.0000003', completion: '0.0000012' },
  { utc_days: WEEKDAYS, utc_start: 400, utc_end: 600, prompt: '0.00000015', completion: '0.0000006' },
  { utc_days: WEEKDAYS, utc_start: 600, utc_end: 1000, prompt: '0.0000003', completion: '0.0000012' },
  { utc_days: WEEKDAYS, utc_start: 1000, utc_end: 0, prompt: '0.00000015', completion: '0.0000006' },
]);
const minimax = raw('minimax/minimax-m3.1-flash', '0.00000015', '0.0000006', [
  { utc_start: 1500, utc_end: 100, prompt: '0.000000075', completion: '0.0000003' },
  { utc_start: 100, utc_end: 1500, prompt: '0.00000015', completion: '0.0000006' },
]);
const qwen = raw('qwen/qwen3.7-flash', '0.00000003', '0.00000012', [
  { min_prompt_tokens: 256000, prompt: '0.0000002', completion: '0.0000008' },
  { min_prompt_tokens: 32000, prompt: '0.0000001', completion: '0.0000004' },
]);
const plain = raw('acme/plain', '0.000001', '0.000002');
const ds = normalizeModel(deepseek), mm = normalizeModel(minimax), qw = normalizeModel(qwen), pl = normalizeModel(plain);

test('long-context tiers are carried, every tier, lowest threshold first', () => {
  assert.deepEqual(qw.longContext, [
    { minPromptTokens: 32000, inputPer1M: 0.1, outputPer1M: 0.4 },
    { minPromptTokens: 256000, inputPer1M: 0.2, outputPer1M: 0.8 },
  ]);
  assert.equal(qw.timeWindows, null);
});

test('time windows keep only the hours that differ from the headline', () => {
  // DeepSeek's two weekday windows AT the headline $0.30 say nothing new.
  assert.deepEqual(ds.timeWindows, [
    { days: ['saturday', 'sunday'], startUtc: null, endUtc: null, inputPer1M: 0.15, outputPer1M: 0.6 },
    { days: WEEKDAYS, startUtc: 0, endUtc: 100, inputPer1M: 0.15, outputPer1M: 0.6 },
    { days: WEEKDAYS, startUtc: 400, endUtc: 600, inputPer1M: 0.15, outputPer1M: 0.6 },
    { days: WEEKDAYS, startUtc: 1000, endUtc: 0, inputPer1M: 0.15, outputPer1M: 0.6 },
  ]);
  assert.deepEqual(mm.timeWindows, [{ days: null, startUtc: 1500, endUtc: 100, inputPer1M: 0.075, outputPer1M: 0.3 }]);
  assert.equal(ds.longContext, null);
});

test('a model without overrides carries nulls, not empty arrays', () => {
  assert.equal(pl.longContext, null);
  assert.equal(pl.timeWindows, null);
});

const page = (m) => getModelHtml({ model: m, all: [m], benchmarks: null, subscriptions: [], endpoints: null });

test('model page lists the schedule and the tiers, even with no hosts panel', () => {
  const d = page(ds);
  assert.match(d, /Sat–Sun all day/);
  assert.match(d, /Mon–Fri 00:00–01:00, 04:00–06:00, 10:00–24:00 UTC/);
  assert.match(d, /\$0\.150 \/ \$0\.600/);
  assert.match(page(mm), /Daily 15:00–01:00 UTC/, 'a window that wraps midnight reads as one span');
  const q = page(qw);
  assert.match(q, /Above 32K prompt tokens[\s\S]*?\$0\.100 \/ \$0\.400/);
  assert.match(q, /Above 256K prompt tokens[\s\S]*?\$0\.200 \/ \$0\.800/);
  assert.doesNotMatch(page(pl), /prompt tokens<|UTC</);
});

// The table marks the price cell; the tooltip states direction from the numbers.
const html = getHtml({ initialModels: '[]' });
const fnSrc = (name) => {
  const m = html.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
  assert.ok(m, name + ' not found in the shipped page');
  return m[0];
};
const fmtPrice = fnSrc('fmtPrice'), fmtCtx = fnSrc('fmtCtx');
const priceVariation = new Function(fmtPrice + fmtCtx + fnSrc('priceVariation') + '; return priceVariation;')();

test('table tooltip: a peak headline says "as low as", a re-price names its threshold', () => {
  assert.match(priceVariation(ds), /time of day/i);
  assert.match(priceVariation(ds), /as low as \$0\.150/);
  assert.doesNotMatch(priceVariation(ds), /up to/, 'no window is dearer than the headline');
  assert.match(priceVariation(mm), /as low as \$0\.075/);
  assert.match(priceVariation({ ...mm, timeWindows: [{ ...mm.timeWindows[0], inputPer1M: 0.3 }] }), /up to \$0\.300/);
  assert.match(priceVariation(qw), /above 32K prompt tokens/);
  assert.equal(priceVariation(pl), '');
});

test('the FAQ qualifies a headline price that changes by time of day', () => {
  const oa = normalizeModel(raw('openai/gpt-9', '0.000002', '0.000008'));
  const faq = getHtml({ initialModels: JSON.stringify([ds, oa]) });
  assert.match(faq, /V4\.1-flash-1017's price changes by time of day, from \$0\.150 to \$0\.300 per 1M input tokens/i);
  const plainFaq = getHtml({ initialModels: JSON.stringify([normalizeModel(raw('deepseek/deepseek-v9', '0.0000003', '0.0000012')), oa]) });
  assert.doesNotMatch(plainFaq, /'s price changes by time of day/);
});
