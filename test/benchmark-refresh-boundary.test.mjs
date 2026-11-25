/**
 * Open item 7 (accepted Codex P2 from 2026-08-06): two behaviours at the
 * deployment boundary that the Epoch join tests in benchmarks.test.mjs cannot
 * see, because they live in the worker rather than in fetchBenchmarks():
 *
 *  1. refreshAllData keeps the last good `benchmarks:all` when the Epoch fetch
 *     THROWS or comes back EMPTY. The join throws on a missing id_model_version
 *     column by design, relying on this to keep KV intact; without it one bad
 *     export blanks the Quality column site-wide until the next good one.
 *  2. A payload written before `versions[]` existed (legacy KV) still renders.
 *     KV has no TTL on this key, so an old blob can be served indefinitely.
 *
 * The worker is bundled with esbuild and driven through Hono's app.fetch, with
 * a KV stub that records every put and a fetch stub. No network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'bench-boundary-'));
const out = await build({
  entryPoints: ['src/index.ts'],
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  external: ['cloudflare:*'],
});
const p = join(dir, 'index.mjs');
writeFileSync(p, out.outputFiles[0].text);
const warn = console.warn; console.warn = () => {};
const { default: worker } = await import(pathToFileURL(p).href);
console.warn = warn;

const MODEL = {
  id: 'anthropic/claude-3-haiku', canonical_slug: 'anthropic/claude-3-haiku', name: 'Anthropic: Claude 3 Haiku',
  created: 1710288000, description: 'Fast model.', context_length: 200000,
  architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'], tokenizer: 'Claude', instruct_type: null },
  pricing: { prompt: '0.00000025', completion: '0.00000125' },
  top_provider: { context_length: 200000, max_completion_tokens: 4096, is_moderated: true },
  per_request_limits: null, supported_parameters: [],
};

// A payload in the shape written before `versions[]` was added: no `versions`.
const LEGACY = {
  models: [{
    modelId: 'anthropic/claude-3-haiku', epochModel: 'Claude 3 Haiku',
    scores: [{ benchmark: 'GPQA Diamond', benchmarkId: 'gpqa_diamond', score: 0.363, stderr: 0.024, isSelfReported: false, variant: null, recordedAt: '2025-01-27', source: 'Epoch AI', sourceUrl: 'https://epoch.ai/benchmarks' }],
  }],
  benchmarks: [{ id: 'gpqa_diamond', label: 'GPQA Diamond', blurb: 'Graduate-level science reasoning' }],
  unmapped: [], ambiguous: [],
  attribution: { text: "Epoch AI, 'AI Benchmarking Hub'", url: 'https://epoch.ai/benchmarks', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' },
  fetchedAt: '2026-08-01T00:00:00.000Z',
};
const LAST_GOOD = JSON.stringify(LEGACY);

const stmt = { bind: () => stmt, all: async () => ({ results: [] }), first: async () => null, run: async () => ({}), raw: async () => [] };
function env(store) {
  return {
    REFRESH_SECRET: 's',
    TOKEN_APP_KV: {
      get: async (k) => store.get(k) ?? null,
      put: async (k, v) => { store.set(k, v); },
    },
    RANKINGS_DB: { prepare: () => stmt, batch: async () => [] },
  };
}
const call = (path, store, init) =>
  worker.fetch(new Request(`https://token.app${path}`, init), env(store), { waitUntil() {}, passThroughOnException() {} });

/** OpenRouter's model list answers; Epoch answers with `epoch`; everything else is offline. */
function stubFetch(epoch) {
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('https://epoch.ai/')) return epoch();
    if (/^https:\/\/openrouter\.ai\/api\/v1\/models(\?|$)/.test(url)) {
      return new Response(JSON.stringify({ data: [MODEL] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error('offline: ' + url);
  };
}

async function refresh(epoch) {
  stubFetch(epoch);
  const store = new Map([['benchmarks:all', LAST_GOOD]]);
  const errors = console.error; console.error = () => {};
  try {
    const res = await call('/api/refresh', store, { method: 'POST', headers: { Authorization: 'Bearer s' } });
    return { status: res.status, body: await res.json(), store };
  } finally {
    console.error = errors;
  }
}

test('an Epoch fetch that THROWS leaves the last good benchmarks in KV', async () => {
  const { body, store } = await refresh(() => { throw new Error('epoch.ai unreachable'); });
  assert.ok(store.has('models:all'), 'the refresh itself must still run');
  assert.match(String(body.benchmarksError), /epoch\.ai unreachable/);
  assert.equal(store.get('benchmarks:all'), LAST_GOOD);
});

test('an Epoch export missing id_model_version (the join throws) leaves KV alone', async () => {
  // A valid export with ONLY id_model_version removed, so the throw is that guard's.
  const csv = 'original_task_name,Model,Unique display name,best_score,mean_score,stderr,started_at\n'
    + 'GPQA diamond,Claude 3 Haiku,,0.4,0.4,0.01,2026-01-01\n';
  const { body, store } = await refresh(() => new Response(csv, { status: 200 }));
  assert.match(String(body.benchmarksError), /missing id_model_version/);
  assert.equal(store.get('benchmarks:all'), LAST_GOOD);
});

test('a valid Epoch export that maps NO models leaves KV alone', async () => {
  // Well-formed (the join does not throw), but its only model is not in MODEL_MAP,
  // so this exercises the empty guard rather than the catch.
  const csv = 'original_task_name,Model,id_model_version,Unique display name,best_score,mean_score,stderr,started_at\n'
    + 'GPQA diamond,Not A Mapped Model,not-a-mapped-model,,0.5,0.5,0.01,2026-01-01\n';
  const { body, store } = await refresh(() => new Response(csv, { status: 200 }));
  assert.equal(body.benchmarksError, undefined, 'a well-formed export must not take the error path');
  assert.match(String(body.benchmarks), /unchanged/);
  assert.equal(store.get('benchmarks:all'), LAST_GOOD);
});

test('a legacy payload without versions[] still serves and renders', async () => {
  const { store } = await refresh(() => { throw new Error('offline'); });
  assert.equal(store.get('benchmarks:all'), LAST_GOOD);

  const api = await call('/api/benchmarks', store);
  assert.equal(api.status, 200);
  assert.equal((await api.json()).models[0].scores[0].score, 0.363);

  const page = await call('/model/' + JSON.parse(store.get('models:all'))[0].slug, store);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /GPQA Diamond/);

  const home = await call('/', store);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /"modelId":"anthropic\/claude-3-haiku"/);
});
