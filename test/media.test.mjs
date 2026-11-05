/**
 * Regression tests for image, audio and embedding model pricing (src/media.ts).
 *
 * WHY THIS FILE EXISTS: these models list prompt/completion in OpenRouter's
 * catalogue, but the number means a different thing per type and, for audio,
 * per MODEL: `prompt: "0.0001"` is per second for Whisper and `prompt: "0.1"` is
 * per HOUR for MAI-Transcribe 2. Converting by type alone priced MAI-Transcribe at
 * $360/hour (true: $0.10). So audio prices come from each model page's JSON-LD,
 * where the unit is stated. Every fixture below is verbatim from OpenRouter on
 * 2026-11-05 and every expected number was read off the model's own page.
 *
 * Uses node:test — built in, no new dependency. Run: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'media-test-'));
const out = await build({
  entryPoints: ['src/media.ts'],
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const p = join(dir, 'media.mjs');
writeFileSync(p, out.outputFiles[0].text);
const {
  mediaKind, normalizeMediaModel, normalizeAudioOffers, offersFromHtml,
  catalogueTokenRates, normalizeImagePricing, fetchMediaModels,
} = await import(pathToFileURL(p).href);

const near = (actual, expected, msg) =>
  assert.ok(actual != null && Math.abs(actual - expected) < 1e-6, `${msg}: got ${actual}, want ${expected}`);

// Verbatim from https://openrouter.ai/api/v1/models?output_modalities=all, 2026-11-05.
const CATALOGUE = [
  {"id":"openai/whisper-1","name":"OpenAI: Whisper 1","created":1777332905,"context_length":0,"architecture":{"input_modalities":["audio"],"output_modalities":["transcription"]},"pricing":{"prompt":"0.0001","completion":"0"}},
  {"id":"microsoft/mai-transcribe-2","name":"Microsoft AI: MAI-Transcribe 2","created":1788396586,"context_length":0,"architecture":{"input_modalities":["audio"],"output_modalities":["transcription"]},"pricing":{"prompt":"0.1","completion":"0"}},
  {"id":"assemblyai/universal-3-6-pro","name":"AssemblyAI: Universal-3.6 Pro","created":1792013919,"context_length":0,"architecture":{"input_modalities":["audio"],"output_modalities":["transcription"]},"pricing":{"prompt":"0.0000833333","completion":"0"}},
  {"id":"fish-audio/s2-pro","name":"Fish Audio: S2 Pro","created":1785353734,"context_length":0,"architecture":{"input_modalities":["text"],"output_modalities":["speech"]},"pricing":{"prompt":"0.000015","completion":"0"}},
  {"id":"bytedance-seed/seed-audio-1-0","name":"ByteDance Seed: Seed Audio 1.0","created":1790372476,"context_length":0,"architecture":{"input_modalities":["text"],"output_modalities":["speech"]},"pricing":{"prompt":"0","completion":"0.0025"}},
  {"id":"openai/gpt-4o-transcribe","name":"OpenAI: GPT-4o Transcribe","created":1777332895,"context_length":128000,"architecture":{"input_modalities":["audio"],"output_modalities":["transcription"]},"pricing":{"prompt":"0.0000025","completion":"0.00001"}},
  {"id":"google/gemini-3.8-flash-tts","name":"Google: Gemini 3.8 Flash TTS","created":1790200266,"context_length":32768,"architecture":{"input_modalities":["text"],"output_modalities":["speech"]},"pricing":{"prompt":"0.0000005","completion":"0.000009"}},
  {"id":"assemblyai/assemblyai-tts-1","name":"AssemblyAI: TTS 1","created":1793217672,"context_length":0,"architecture":{"input_modalities":["text"],"output_modalities":["speech"]},"pricing":{"prompt":"0.000015","completion":"0"}},
  {"id":"heygen/heygen-voice-1-turbo:free","name":"HeyGen: HeyGen Voice Turbo (free)","created":1793030422,"context_length":0,"architecture":{"input_modalities":["text"],"output_modalities":["speech"]},"pricing":{"prompt":"0","completion":"0"}},
  {"id":"google/lyria-3-pro-preview","name":"Google: Lyria 3 Pro Preview","created":1774907286,"context_length":1048576,"architecture":{"input_modalities":["text","image"],"output_modalities":["text","audio"]},"pricing":{"prompt":"0","completion":"0"}},
  {"id":"openai/gpt-audio","name":"OpenAI: GPT Audio","created":1768862569,"context_length":128000,"architecture":{"input_modalities":["text","audio"],"output_modalities":["text","audio"]},"pricing":{"prompt":"0.0000025","completion":"0.00001","audio":"0.000032","audio_output":"0.000064"}},
  {"id":"openai/text-embedding-3-small","name":"OpenAI: Text Embedding 3 Small","created":1761857455,"context_length":8192,"architecture":{"input_modalities":["text"],"output_modalities":["embeddings"]},"pricing":{"prompt":"0.00000002","completion":"0"}},
  {"id":"cohere/rerank-5-pro","name":"Cohere: Rerank 5 Pro","created":1793738320,"context_length":32768,"architecture":{"input_modalities":["text"],"output_modalities":["rerank"]},"pricing":{"prompt":"0","completion":"0"}},
  {"id":"respan/span-01-lite","name":"Respan: Span-01 Lite","created":1790387542,"context_length":0,"architecture":{"input_modalities":["text"],"output_modalities":["decisions"]},"pricing":{"prompt":"0","completion":"0"}},
  {"id":"openai/gpt-6-luna-decisions","name":"OpenAI: GPT-6 Luna Decisions","created":1791321558,"context_length":1050000,"architecture":{"input_modalities":["text","image"],"output_modalities":["decisions"]},"pricing":{"prompt":"0.0000001","completion":"0","web_search":"0.01","input_cache_read":"0","input_cache_write":"0"}},
];
const RAW = Object.fromEntries(CATALOGUE.map((m) => [m.id, m]));

// Each model page's JSON-LD offers, verbatim (name, price, unitText), 2026-11-05.
const PAGE = {
  'openai/whisper-1': [['Audio Seconds', 0.0001, 'per second']],
  'microsoft/mai-transcribe-2': [['Audio Hours', 0.1, 'per hour']],
  'assemblyai/universal-3-6-pro': [['Audio Seconds', 8.33333e-05, 'per second'], ['Audio Seconds (Prompted)', 9.72222e-05, 'per second']],
  'fish-audio/s2-pro': [['UTF-8 Bytes', 15, 'per M UTF-8 bytes']],
  'bytedance-seed/seed-audio-1-0': [['Audio Output', 0.15, 'per minute']],
  'openai/gpt-4o-transcribe': [['Input Price', 2.5, 'per 1M tokens'], ['Output Price', 10, 'per 1M tokens']],
  'google/gemini-3.8-flash-tts': [],
  'assemblyai/assemblyai-tts-1': [['Characters', 15, 'per M characters']],
  'google/lyria-3-pro-preview': [['Song Generation', 0.08, 'per song']],
};
const offers = (id) => PAGE[id].map(([name, price, unitText]) => ({ name, price, unitText }));
// The page as served: several JSON-LD blocks, only one carrying offers.
const pageHtml = (id) =>
  '<html><script type="application/ld+json">{"@type":"Organization","name":"OpenRouter"}</script>' +
  `<script type="application/ld+json">${JSON.stringify({ '@type': 'SoftwareApplication', offers: offers(id).map((o) => ({ '@type': 'Offer', priceSpecification: { '@type': 'UnitPriceSpecification', ...o } })) })}</script></html>`;
const audio = (id) => ({ ...normalizeMediaModel(RAW[id], mediaKind(RAW[id])), ...normalizeAudioOffers(mediaKind(RAW[id]), offers(id)) });

// ── Which models land where ──────────────────────────────────────────────────

test('kind follows the output modality; music is audio-out with no token price', () => {
  assert.equal(mediaKind(RAW['openai/whisper-1']), 'transcription');
  assert.equal(mediaKind(RAW['assemblyai/assemblyai-tts-1']), 'speech');
  assert.equal(mediaKind(RAW['openai/text-embedding-3-small']), 'embedding');
  assert.equal(mediaKind(RAW['cohere/rerank-5-pro']), 'rerank');
  assert.equal(mediaKind(RAW['openai/gpt-6-luna-decisions']), 'classifier');
  assert.equal(mediaKind(RAW['google/lyria-3-pro-preview']), 'music');
  // Also outputs audio, but token-priced: a language model, not a music one.
  assert.equal(mediaKind(RAW['openai/gpt-audio']), null);
});

// ── Audio: the unit comes from the page ──────────────────────────────────────

test('the same catalogue field is per second for one model and per hour for another', () => {
  // The bug this file exists for: prompt × 3600 gave MAI-Transcribe 2 $360/hour.
  near(audio('microsoft/mai-transcribe-2').price, 0.1, 'MAI-Transcribe 2 $/hour');
  near(audio('openai/whisper-1').price, 0.36, 'Whisper 1 $/hour (= $0.006/min)');
});

test('a second rate in the headline unit is a labelled variant, not the headline', () => {
  const m = audio('assemblyai/universal-3-6-pro');
  near(m.price, 0.3, 'Universal-3.6 Pro $/hour');
  assert.equal(m.otherRates.length, 1);
  assert.equal(m.otherRates[0].label, 'Prompted');
  near(m.otherRates[0].price, 0.35, 'Prompted $/hour');
  assert.equal(m.otherRates[0].unit, 'hour of audio');
});

test('UTF-8 bytes are not characters: listed, never put in the per-character column', () => {
  const m = audio('fish-audio/s2-pro');
  assert.equal(m.price, null);
  assert.deepEqual(m.otherRates, [{ label: '', price: 15, unit: '1M UTF-8 bytes' }]);
  near(audio('assemblyai/assemblyai-tts-1').price, 15, 'AssemblyAI TTS $/1M chars');
});

test('per-minute speech and token-priced transcription keep their own units', () => {
  const seed = audio('bytedance-seed/seed-audio-1-0');
  assert.equal(seed.price, null);
  assert.deepEqual(seed.otherRates, [{ label: 'audio output', price: 0.15, unit: 'minute' }]);
  const gpt = audio('openai/gpt-4o-transcribe');
  assert.equal(gpt.price, null);
  assert.deepEqual(gpt.otherRates.map((r) => [r.label, r.price, r.unit]), [['input', 2.5, '1M tokens'], ['output', 10, '1M tokens']]);
});

test('an unmapped page unit is reported, never guessed at', () => {
  const m = normalizeAudioOffers('transcription', [{ name: 'Audio Seconds', price: 0.001, unitText: 'per fortnight' }]);
  assert.equal(m.price, null);
  assert.deepEqual(m.otherRates, []);
  assert.deepEqual(m.unparsed, ['Audio Seconds per fortnight']);
});

test('offers are read from the page JSON-LD, skipping blocks without them', () => {
  assert.deepEqual(offersFromHtml(pageHtml('assemblyai/universal-3-6-pro')), offers('assemblyai/universal-3-6-pro'));
  assert.deepEqual(offersFromHtml('<script type="application/ld+json">{not json</script>'), []);
});

test('no offer on the page: token rates only when prompt AND completion are set', () => {
  // Gemini TTS: no page offer; the shape gpt-4o-transcribe's page confirms is tokens.
  assert.deepEqual(catalogueTokenRates(RAW['google/gemini-3.8-flash-tts']).map((r) => [r.label, r.price]), [['input', 0.5], ['output', 9]]);
  // Seed Audio: completion alone is per MINUTE per its page — not tokens.
  assert.deepEqual(catalogueTokenRates(RAW['bytedance-seed/seed-audio-1-0']), []);
});

test('the catalogue price of an audio model is never used as its headline', () => {
  // Without a page, a transcription model is unpriced — not prompt × 3600.
  assert.equal(normalizeMediaModel(RAW['microsoft/mai-transcribe-2'], 'transcription').price, null);
});

// ── Embeddings and friends: the catalogue is enough ───────────────────────────

test('embedding and classifier prices are per 1M tokens; rerank publishes none', () => {
  near(normalizeMediaModel(RAW['openai/text-embedding-3-small'], 'embedding').price, 0.02, 'text-embedding-3-small');
  near(normalizeMediaModel(RAW['openai/gpt-6-luna-decisions'], 'classifier').price, 0.1, 'Luna Decisions');
  assert.equal(normalizeMediaModel(RAW['cohere/rerank-5-pro'], 'rerank').price, null);
});

test('zero is free only on a :free variant; elsewhere it is unpriced', () => {
  assert.equal(normalizeMediaModel(RAW['heygen/heygen-voice-1-turbo:free'], 'speech').price, 0);
  assert.equal(normalizeMediaModel(RAW['respan/span-01-lite'], 'classifier').price, null);
});

// ── Images ───────────────────────────────────────────────────────────────────

// Verbatim from /api/v1/images/models/{id}/endpoints, 2026-11-05.
const EPS = {
  'sourceful/riverflow-v2-pro': [{"pricing":[{"billable":"output_image","unit":"image","cost_usd":0.15},{"billable":"output_image","unit":"image","cost_usd":0.15,"variant":"2k"},{"billable":"output_image","unit":"image","cost_usd":0.33,"variant":"4k"},{"billable":"input_font","unit":"image","cost_usd":0.03},{"billable":"input_reference","unit":"image","cost_usd":0.2}]}],
  'black-forest-labs/flux-3-image': [{"pricing":[{"billable":"output_image","unit":"image","cost_usd":0.041,"variant":"768"},{"billable":"output_image","unit":"image","cost_usd":0.048,"variant":"1k"},{"billable":"output_image","unit":"image","cost_usd":0.07,"variant":"1.5k"},{"billable":"output_image","unit":"image","cost_usd":0.1,"variant":"2k"},{"billable":"output_image","unit":"image","cost_usd":0.607,"variant":"4k"}]}],
  'krea/k3-edit': [{"pricing":[{"billable":"output_image","unit":"image","cost_usd":0.03},{"billable":"output_image","unit":"image","cost_usd":0.06,"variant":"2k"},{"billable":"input_image","unit":"image","cost_usd":0.02},{"billable":"input_image","unit":"image","cost_usd":0.07,"variant":"2k"},{"billable":"output_image","unit":"request","cost_usd":0.02,"variant":"high_thinking_surcharge"}]}],
  'black-forest-labs/flux.2-flex': [{"pricing":[{"billable":"input_image","unit":"megapixel","cost_usd":0.06},{"billable":"output_image","unit":"megapixel","cost_usd":0.06}]}],
  'google/gemini-3-pro-image-preview': [{"pricing":[{"billable":"input_image","unit":"token","cost_usd":0.000001},{"billable":"output_image","unit":"token","cost_usd":0.00006}]},{"pricing":[{"billable":"input_image","unit":"token","cost_usd":0.000002},{"billable":"output_image","unit":"token","cost_usd":0.00012}]}],
  'x-ai/grok-imagine-image-2.0': [{"pricing":[{"billable":"input_image","unit":"image","cost_usd":0.01},{"billable":"output_image","unit":"image","cost_usd":0.04,"variant":"low_1k"},{"billable":"output_image","unit":"image","cost_usd":0.06,"variant":"low_2k"},{"billable":"output_image","unit":"image","cost_usd":0.06,"variant":"medium_1k"},{"billable":"output_image","unit":"image","cost_usd":0.08,"variant":"medium_2k"}]}],
  'meta/muse-image': [],
};
const rates = (m) => m.otherRates.map((r) => `${r.label}|${r.price}|${r.unit}`);

test('the headline is the plain per-image price; sizes and fees are listed beside it', () => {
  const m = normalizeImagePricing(EPS['sourceful/riverflow-v2-pro']);
  assert.equal(m.perImage, 0.15);
  assert.deepEqual(rates(m), ['2K|0.15|image', '4K|0.33|image', 'font|0.03|image', 'reference|0.2|image']);
});

test('a model that names its standard size "1k" gets that as the headline, not the cheapest size', () => {
  // FLUX 3 Image's 768px is cheaper, but it is a smaller image, not the standard one.
  const m = normalizeImagePricing(EPS['black-forest-labs/flux-3-image']);
  assert.equal(m.perImage, 0.048);
  assert.deepEqual(rates(m), ['768px|0.041|image', '1.5K|0.07|image', '2K|0.1|image', '4K|0.607|image']);
});

test('input fees, surcharges and quality tiers never become the headline', () => {
  const krea = normalizeImagePricing(EPS['krea/k3-edit']);
  assert.equal(krea.perImage, 0.03);
  assert.deepEqual(rates(krea), ['2K|0.06|image', 'input image|0.02|image', 'input image 2K|0.07|image', 'high thinking surcharge|0.02|request']);
  // Grok: every output price names a quality tier, so there is no plain price.
  const grok = normalizeImagePricing(EPS['x-ai/grok-imagine-image-2.0']);
  assert.equal(grok.perImage, null);
  assert.ok(rates(grok).includes('low 1K|0.04|image'));
});

test('megapixel and token prices are listed, never converted to a per-image price', () => {
  const flux = normalizeImagePricing(EPS['black-forest-labs/flux.2-flex']);
  assert.equal(flux.perImage, null);
  assert.deepEqual(rates(flux), ['input image|0.06|megapixel', '|0.06|megapixel']);
  // Two endpoints disagree (the flex tier is half price); the catalogue's
  // image_output is the figure the language table shows, so it wins.
  const gem = normalizeImagePricing(EPS['google/gemini-3-pro-image-preview'], 0.00012);
  assert.equal(gem.perImage, null);
  assert.deepEqual(rates(gem), ['|120|1M image tokens']);
});

test('no endpoints means unpriced; an unknown unit or billable is reported', () => {
  assert.deepEqual(normalizeImagePricing(EPS['meta/muse-image']), { perImage: null, otherRates: [], unparsed: [] });
  const m = normalizeImagePricing([{ pricing: [{ billable: 'output_image', unit: 'pixel', cost_usd: 1 }, { billable: 'output_video', unit: 'image', cost_usd: 1 }] }]);
  assert.deepEqual(m.unparsed, ['output_image|pixel|', 'output_video|image|']);
  assert.equal(m.perImage, null);
});

// ── The fetch: daily audio pass, carry-forward ───────────────────────────────

// A fetch stub that DERIVES every answer from the URL it is given (a stub that
// ignored its input once let a real bug through; see CLAUDE.md). `down` lists
// model ids whose page fails; `reads` records every page read.
function stubFetch({ down = [] } = {}) {
  const reads = [];
  globalThis.fetch = async (url) => {
    const u = String(url);
    const json = (body) => ({ ok: true, json: async () => body });
    if (u.endsWith('/api/v1/models?output_modalities=all')) return json({ data: CATALOGUE });
    if (u.endsWith('/api/v1/images/models')) return json({ data: [{ id: 'krea/k3-edit', name: 'Krea: K3 Edit', architecture: { input_modalities: ['text', 'image'] } }] });
    const ep = u.match(/\/api\/v1\/images\/models\/(.+)\/endpoints$/);
    if (ep) return json({ endpoints: EPS[ep[1]] });
    const id = u.replace('https://openrouter.ai/', '');
    if (PAGE[id]) {
      reads.push(id);
      if (down.includes(id)) return { ok: false, status: 503 };
      return { ok: true, text: async () => pageHtml(id) };
    }
    throw new Error(`unexpected fetch ${u}`);
  };
  return reads;
}
const PAGED = Object.keys(PAGE).filter((id) => RAW[id]); // every audio model with a page
const byId = (list) => Object.fromEntries(list.map((m) => [m.id, m]));

test('first run reads every audio page once; :free models need none', async () => {
  const reads = stubFetch();
  const { payload } = await fetchMediaModels(null);
  assert.deepEqual(reads.sort(), [...PAGED].sort());
  const a = byId(payload.audio);
  near(a['microsoft/mai-transcribe-2'].price, 0.1, 'MAI via fetch');
  near(a['google/lyria-3-pro-preview'].price, 0.08, 'Lyria $/song');
  assert.equal(a['heygen/heygen-voice-1-turbo:free'].price, 0);
  assert.deepEqual(a['google/gemini-3.8-flash-tts'].otherRates.map((r) => r.price), [0.5, 9]);
  assert.equal(payload.images[0].perImage, 0.03);
  assert.ok(payload.audioPricedAt);
});

test('within a day, known audio prices are reused and no page is read', async () => {
  stubFetch();
  const first = (await fetchMediaModels(null)).payload;
  const reads = stubFetch();
  const second = await fetchMediaModels(first, { fullAudioPass: true });
  assert.deepEqual(reads, []);
  assert.deepEqual(byId(second.payload.audio)['microsoft/mai-transcribe-2'].price, 0.1);
  assert.equal(second.payload.audioPricedAt, first.audioPricedAt);
});

test('after a day, only the cron (fullAudioPass) re-reads every page', async () => {
  stubFetch();
  const first = (await fetchMediaModels(null)).payload;
  const old = { ...first, audioPricedAt: new Date(Date.now() - 25 * 3600e3).toISOString() };
  const http = stubFetch();
  await fetchMediaModels(old);
  assert.deepEqual(http, [], 'the HTTP refresh must not do the full pass');
  const cron = stubFetch();
  const { payload } = await fetchMediaModels(old, { fullAudioPass: true });
  assert.deepEqual(cron.sort(), [...PAGED].sort());
  assert.notEqual(payload.audioPricedAt, old.audioPricedAt);
});

test('a failed page keeps the last good price; a model never priced is retried', async () => {
  stubFetch();
  const first = (await fetchMediaModels(null)).payload;
  const old = { ...first, audioPricedAt: new Date(Date.now() - 25 * 3600e3).toISOString() };
  stubFetch({ down: ['microsoft/mai-transcribe-2'] });
  const r = await fetchMediaModels(old, { fullAudioPass: true });
  assert.deepEqual(r.failed, ['microsoft/mai-transcribe-2']);
  near(byId(r.payload.audio)['microsoft/mai-transcribe-2'].price, 0.1, 'carried forward');

  // Failed on its first ever read: stored empty, so retried next hour.
  stubFetch({ down: ['openai/whisper-1'] });
  const fresh = (await fetchMediaModels(null)).payload;
  assert.equal(byId(fresh.audio)['openai/whisper-1'].price, null);
  const reads = stubFetch();
  const next = (await fetchMediaModels(fresh)).payload;
  assert.deepEqual(reads, ['openai/whisper-1']);
  near(byId(next.audio)['openai/whisper-1'].price, 0.36, 'retried');
});

// ── The shipped table ────────────────────────────────────────────────────────

const tpl = await build({
  entryPoints: ['src/template.ts'],
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const tp = join(dir, 'template.mjs');
writeFileSync(tp, tpl.outputFiles[0].text);
const { getHtml } = await import(pathToFileURL(tp).href);

/**
 * Run the real client renderer (MEDIA_VIEWS … renderMediaTable) against a stub
 * DOM that only records innerHTML/textContent by element id.
 */
function shippedMediaTable(media) {
  const html = getHtml({ initialModels: '[]' });
  const src = html.slice(html.indexOf('var MEDIA_VIEWS = {'), html.indexOf('function bindMediaTable('));
  assert.ok(src.length > 100, 'media renderer not found — this test needs rewiring');
  const els = {};
  const document = { getElementById: (id) => (els[id] ??= { id, innerHTML: '', textContent: '', hidden: false, href: '' }) };
  const state = { media, modelType: 'image', mediaKind: { audio: 'speech', embeddings: 'embedding' }, mSortKey: 'price', mSortDir: 1, search: '' };
  const helpers = {
    escape: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    fmtCtx: (n) => `${n}`, fmtDate: () => 'date', providerLogoImg: () => '', providerLabel: (_, name) => name,
  };
  const render = new Function('document', 'state', ...Object.keys(helpers), `${src}\nreturn renderMediaTable;`)(document, state, ...Object.values(helpers));
  return (type, kind) => {
    state.modelType = type;
    if (kind) state.mediaKind[type] = kind;
    render();
    return { thead: els['media-thead'].innerHTML, tbody: els['media-tbody'].innerHTML, sub: els['media-subtabs'] };
  };
}

test('every media view: one header per cell, one kind per view, unpriced rows last', async () => {
  stubFetch();
  const { payload } = await fetchMediaModels(null);
  const show = shippedMediaTable(payload);
  const views = [['image'], ['audio', 'speech'], ['audio', 'transcription'], ['audio', 'music'], ['embeddings', 'embedding'], ['embeddings', 'classifier'], ['embeddings', 'rerank']];
  for (const [type, kind] of views) {
    const { thead, tbody } = show(type, kind);
    const heads = (thead.match(/<th /g) || []).length;
    const rows = tbody.split('<tr class="model-row">').slice(1);
    assert.ok(rows.length > 0, `${type}/${kind} rendered no rows`);
    for (const r of rows) assert.equal((r.match(/<td/g) || []).length, heads, `${type}/${kind} row cells vs headers`);
    // Only rows of this kind: no per-hour price sorted against a per-character one.
    const expected = type === 'image' ? payload.images : payload[type].filter((m) => m.kind === kind);
    assert.equal(rows.length, expected.length, `${type}/${kind} row count`);
    const prices = rows.map((r) => r.match(/<span class="price">([^<]*)<\/span>/)[1]);
    const firstDash = prices.indexOf('—');
    if (firstDash >= 0) assert.ok(prices.slice(firstDash).every((x) => x === '—'), `${type}/${kind}: an unpriced row sorted above a priced one`);
  }
  const t = show('audio', 'transcription');
  assert.match(t.thead, /Per hour/);
  const row = (tbody, name) => tbody.split('<tr class="model-row">').find((r) => r.includes(`>${name}<`));
  assert.match(row(t.tbody, 'MAI-Transcribe 2'), /<span class="price">\$0\.10<\/span>/);
  assert.match(row(show('audio', 'speech').tbody, 'S2 Pro'), /<span class="price">—<\/span>[\s\S]*\$15\.00\/1M UTF-8 bytes/);
  assert.equal(show('image').sub.hidden, true);
});
