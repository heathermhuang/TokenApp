/**
 * The worker's wiring for image, audio and embedding models (src/index.ts):
 * `/api/media` serves what the cron stored, and the homepage embeds the same
 * payload so the Image / Audio / Embeddings tabs render without a fetch.
 *
 * The app is bundled with esbuild and driven through Hono's app.fetch against a
 * KV stub that answers from its own Map. No network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'media-routes-'));
const out = await build({
  entryPoints: ['src/index.ts'],
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  external: ['cloudflare:*'],
});
const p = join(dir, 'index.mjs');
writeFileSync(p, out.outputFiles[0].text);
const warn = console.warn; console.warn = () => {}; // hono's "caches is not defined" notice
const { default: worker } = await import(pathToFileURL(p).href);
console.warn = warn;

const MEDIA = {
  images: [{ id: 'recraft/recraft-v4', name: 'Recraft V4', provider: 'Recraft', providerId: 'recraft', createdAt: 1, edits: false, perImage: 0.04, otherRates: [], unparsed: [] }],
  audio: [{ id: 'microsoft/mai-transcribe-2', name: 'MAI-Transcribe 2', provider: 'Microsoft', providerId: 'microsoft', createdAt: 1, kind: 'transcription', price: 0.1, otherRates: [], unparsed: [], contextLength: null }],
  embeddings: [],
  // This wiring fixture must be fresh; stale-price policy has separate tests.
  fetchedAt: new Date().toISOString(),
  audioPricedAt: new Date().toISOString(),
};

const stmt = { bind: () => stmt, all: async () => ({ results: [] }), first: async () => null, run: async () => ({}), raw: async () => [] };
function env(kv) {
  return {
    TOKEN_APP_KV: { get: async (k) => kv.get(k) ?? null, put: async () => {} },
    // Rankings history: an empty D1, so the page renders with no snapshots.
    RANKINGS_DB: { prepare: () => stmt },
  };
}
const call = (path, kv) => worker.fetch(new Request(`https://token.app${path}`), env(kv), { waitUntil() {}, passThroughOnException() {} });

test('/api/media serves the stored payload, and 404s before the first refresh', async () => {
  const stored = new Map([['media:all', JSON.stringify(MEDIA)]]);
  const ok = await call('/api/media', stored);
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), MEDIA);
  const none = await call('/api/media', new Map());
  assert.equal(none.status, 404);
});

test('the homepage embeds the stored media models, or null when there are none', async () => {
  const html = await (await call('/', new Map([['media:all', JSON.stringify(MEDIA)]]))).text();
  const embedded = html.match(/var initialMedia = (.*);\n/);
  assert.ok(embedded, 'initialMedia assignment not found — this test needs rewiring');
  const media = JSON.parse(embedded[1]);
  assert.equal(media.audio[0].price, 0.1);
  assert.equal(media.images[0].perImage, 0.04);
  assert.equal(media.fetchedAt, undefined, 'only the model lists are embedded');
  const empty = await (await call('/', new Map())).text();
  assert.match(empty, /var initialMedia = null;\n/);
});
