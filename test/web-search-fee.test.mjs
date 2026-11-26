/**
 * OpenRouter's pricing.web_search is a flat USD fee per web search request (198
 * models, 2026-11-26: $0.0025 to $0.018), charged on top of tokens. It never
 * reached the catalogue. It is NOT a per-token price, so it must not go through
 * the per-1M conversion; it is shown the way vendors quote it, per 1,000 searches.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'web-search-'));
async function load(entry, name) {
  const out = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  writeFileSync(join(dir, name), out.outputFiles[0].text);
  return import(pathToFileURL(join(dir, name)).href);
}
const { normalizeModel } = await load('src/fetchers.ts', 'fetchers.mjs');
const { getModelHtml } = await load('src/pages.ts', 'pages.mjs');

const raw = (id, web_search) => ({
  id, name: 'X: ' + id.split('/')[1], created: 1, context_length: 1_000_000, description: '',
  architecture: { modality: 'text->text' },
  pricing: { prompt: '0.000001', completion: '0.000002', ...(web_search !== undefined ? { web_search } : {}) },
  top_provider: { context_length: 1_000_000, max_completion_tokens: null, is_moderated: false },
});
const page = (m) => getModelHtml({ model: m, all: [m], benchmarks: null, subscriptions: [], endpoints: null });

test('the fee is carried in USD per search, not converted per 1M', () => {
  assert.equal(normalizeModel(raw('google/g', '0.014')).webSearchPerCall, 0.014);
  assert.equal(normalizeModel(raw('a/cheap', '0.0025')).webSearchPerCall, 0.0025);
});

test('absent or zero means no fee published, not a free search', () => {
  assert.equal(normalizeModel(raw('a/none')).webSearchPerCall, null);
  assert.equal(normalizeModel(raw('a/zero', '0')).webSearchPerCall, null);
  assert.equal(normalizeModel(raw('a/bad', 'abc')).webSearchPerCall, null);
});

test('model page quotes it per 1,000 searches, and only when published', () => {
  assert.match(page(normalizeModel(raw('google/g', '0.014'))), /Web search<\/span><span class="stat-v[^"]*">\$14\.00 per 1K searches/);
  assert.match(page(normalizeModel(raw('a/cheap', '0.0025'))), /\$2\.50 per 1K searches/);
  assert.doesNotMatch(page(normalizeModel(raw('a/none'))), /per 1K searches/);
});
