/**
 * Regression tests for video model pricing (src/videos.ts).
 *
 * WHY THIS FILE EXISTS: OpenRouter's main catalogue lists every video model at
 * prompt/completion "0". The real prices live in `/api/v1/videos/models` under
 * `pricing_skus`, in three unit families that must each be converted to dollars
 * per second of output, and one of them (Seedance's `video_tokens`) depends on
 * the resolution. Every expected number below was read off the model's OpenRouter
 * page JSON-LD on 2026-11-05, so a pass means "matches what OpenRouter shows".
 *
 * The rule most worth pinning: an UNSUFFIXED per-second price on a model that
 * supports several resolutions belongs to a resolution the API never names
 * (Veo 3.1's is 1080p per its page). It must never land in the 720p column.
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

const dir = mkdtempSync(join(tmpdir(), 'videos-test-'));
const out = await build({
  entryPoints: ['src/videos.ts'],
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const p = join(dir, 'videos.mjs');
writeFileSync(p, out.outputFiles[0].text);
const { normalizeVideoModel } = await import(pathToFileURL(p).href);

// Verbatim from https://openrouter.ai/api/v1/videos/models, 2026-11-05.
const RAW = Object.fromEntries([
  {"id":"tbc/mischief-1","name":"TBC: mischief 1","created":1793319378,"supported_resolutions":["480p","720p"],"supported_durations":[3,5],"generate_audio":false,"pricing_skus":{"cents_per_video_output_second_480p":"0.5","cents_per_video_output_second_720p":"1"}},
  {"id":"x-ai/grok-imagine-video-1.5-lite","name":"SpaceXAI: Grok Imagine Video 1.5 Lite","created":1791309778,"supported_resolutions":["480p","720p","1080p"],"supported_durations":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],"generate_audio":null,"pricing_skus":{"cents_per_image_input":"1","cents_per_video_output_second_480p":"2","cents_per_video_output_second_720p":"3","cents_per_video_output_second_1080p":"14"}},
  {"id":"minimax/hailuo-3-max","name":"MiniMax: H3 Max","created":1788313310,"supported_resolutions":["768p","480p"],"supported_durations":[5,6,7,8,9,10,11,12,13,14,15],"generate_audio":false,"pricing_skus":{"duration_seconds":"0.08","duration_seconds_480p":"0.05","duration_seconds_768p":"0.08"}},
  {"id":"black-forest-labs/flux-video-upscale","name":"Black Forest Labs: FLUX Video Upscale","created":1787173919,"supported_resolutions":null,"supported_durations":null,"generate_audio":false,"pricing_skus":{"cents_per_megapixel_second_precise":"3.5","cents_per_megapixel_second_creative":"5"}},
  {"id":"runway/aleph-2","name":"Runway: Aleph 2.0","created":1785339484,"supported_resolutions":null,"supported_durations":null,"generate_audio":false,"pricing_skus":{"cents_per_second_output":"28","minimum_cents_per_generation":"56"}},
  {"id":"runway/gen-4.5","name":"Runway: Gen-4.5","created":1785339483,"supported_resolutions":["720p"],"supported_durations":[2,3,4,5,6,7,8,9,10],"generate_audio":false,"pricing_skus":{"cents_per_second_output":"12"}},
  {"id":"kwaivgi/kling-v3.0-std","name":"Kling: Video v3.0 Standard","created":1777496205,"supported_resolutions":["720p"],"supported_durations":[3,4,5,6,7,8,9,10,11,12,13,14,15],"generate_audio":true,"pricing_skus":{"duration_seconds":"0.084","duration_seconds_with_audio":"0.126","text_to_video_duration_seconds_480p":"0.084","text_to_video_duration_seconds_720p":"0.084","image_to_video_duration_seconds_720p":"0.084","text_to_video_duration_seconds_1080p":"0.084","image_to_video_duration_seconds_1080p":"0.084"}},
  {"id":"google/veo-3.1-fast","name":"Google: Veo 3.1 Fast","created":1776994666,"supported_resolutions":["720p","1080p","4K"],"supported_durations":[4,6,8],"generate_audio":true,"pricing_skus":{"duration_seconds_with_audio":"0.12","duration_seconds_with_audio_4k":"0.30","duration_seconds_without_audio":"0.10","duration_seconds_with_audio_720p":"0.10","duration_seconds_without_audio_4k":"0.25","duration_seconds_without_audio_720p":"0.08"}},
  {"id":"bytedance/seedance-2.0","name":"ByteDance: Seedance 2.0","created":1776211362,"supported_resolutions":["480p","720p","1080p","4K"],"supported_durations":[4,5,6,7,8,9,10,11,12,13,14,15],"generate_audio":true,"pricing_skus":{"video_tokens":"0.000007","video_tokens_4k":"0.000004","video_tokens_1080p":"0.0000077","video_tokens_without_audio":"0.000007","video_tokens_with_video_input":"0.0000043","video_tokens_4k_with_video_input":"0.0000024","video_tokens_1080p_with_video_input":"0.0000047"}},
  {"id":"alibaba/wan-2.6","name":"Alibaba: Wan 2.6","created":1774659190,"supported_resolutions":["720p","1080p"],"supported_durations":[5,10],"generate_audio":true,"pricing_skus":{"text_to_video_duration_seconds_480p":"0.04","text_to_video_duration_seconds_720p":"0.08","image_to_video_duration_seconds_720p":"0.10","text_to_video_duration_seconds_1080p":"0.12","image_to_video_duration_seconds_1080p":"0.15"}},
  {"id":"bytedance/seedance-1-5-pro","name":"ByteDance: Seedance 1.5 Pro","created":1774277608,"supported_resolutions":["480p","720p","1080p"],"supported_durations":[4,5,6,7,8,9,10,11,12],"generate_audio":true,"pricing_skus":{"video_tokens":"0.0000024","video_tokens_without_audio":"0.0000012"}},
  {"id":"google/veo-3.1","name":"Google: Veo 3.1","created":1774277148,"supported_resolutions":["720p","1080p","4K"],"supported_durations":[4,6,8],"generate_audio":true,"pricing_skus":{"duration_seconds_with_audio":"0.40","duration_seconds_with_audio_4k":"0.60","duration_seconds_without_audio":"0.20","duration_seconds_without_audio_4k":"0.40"}},
].map((m) => [m.id, m]));

const v = (id) => normalizeVideoModel(RAW[id]);
const near = (actual, expected, msg) =>
  assert.ok(actual != null && Math.abs(actual - expected) < 1e-7, `${msg}: got ${actual}, want ${expected}`);

// ── The three unit families ──────────────────────────────────────────────────

test('cents-per-second SKUs convert to dollars, one entry per resolution', () => {
  const m = v('x-ai/grok-imagine-video-1.5-lite');
  near(m.perSecond['480p'], 0.02, '480p');   // page: Video Output (480p) 0.02
  near(m.perSecond['720p'], 0.03, '720p');
  near(m.perSecond['1080p'], 0.14, '1080p');
});

test('duration_seconds SKUs are already dollars', () => {
  const m = v('minimax/hailuo-3-max');
  near(m.perSecond['480p'], 0.05, '480p');    // page: Video Output (480p) 0.05
  near(m.perSecond['768p'], 0.08, '768p');
});

test('video_tokens convert per second as rate × ceil(W×H×24/1024)', () => {
  const s2 = v('bytedance/seedance-2.0');
  near(s2.perSecond['480p'], 0.067256, '480p');  // page: Video (no audio) (480p) 0.067256
  near(s2.perSecond['720p'], 0.000007 * 21600, '720p');
  near(s2.perSecond['4K'], 0.000004 * 194400, '4K uses video_tokens_4k');
  const s15 = v('bytedance/seedance-1-5-pro');
  near(s15.perSecond['480p'], 0.0115296, 'no-audio base');  // page: Video (no audio) (480p)
  near(s15.audioPerSecond['720p'], (0.0000024 - 0.0000012) * 21600, 'audio extra at 720p');
});

test('a resolution with its own token rate is never priced from the silent default', () => {
  // Seedance 2.0 has 1080p and 4K rates but a silent rate only as the default.
  // Filling 4K from that default gave "4K without audio" $1.36/s against $0.78/s
  // WITH audio — a silent clip dearer than a loud one. The resolution's own rate
  // wins; the silent default only covers resolutions that have none.
  const s2 = v('bytedance/seedance-2.0');
  near(s2.perSecond['1080p'], 0.0000077 * 48600, '1080p uses video_tokens_1080p');
  near(s2.perSecond['4K'], 0.000004 * 194400, '4K uses video_tokens_4k');
  near(s2.perSecond['720p'], 0.000007 * 21600, '720p has no own rate: defaults apply');
});

// ── Resolution attribution ───────────────────────────────────────────────────

test('an unsuffixed price on a multi-resolution model is NOT given a resolution', () => {
  // Veo 3.1's unsuffixed SKUs are its 1080p price (per its page), but the API
  // never says so. Putting them under 720p would state a 720p price OpenRouter
  // never published; they go to "default" instead.
  const m = v('google/veo-3.1');
  assert.equal(m.perSecond['720p'], undefined);
  assert.equal(m.perSecond['1080p'], undefined);
  near(m.perSecond.default, 0.20, 'default (no audio)');
  near(m.perSecond['4K'], 0.40, '4K');
});

test('an unsuffixed price on a single-resolution model takes that resolution', () => {
  near(v('runway/gen-4.5').perSecond['720p'], 0.12, 'Runway Gen-4.5 is 720p only');
  near(v('kwaivgi/kling-v3.0-std').perSecond['720p'], 0.084, 'Kling is 720p only');
});

test('a model that states no resolutions keeps its price as "default"', () => {
  const m = v('runway/aleph-2');
  near(m.perSecond.default, 0.28, 'Aleph');
  assert.deepEqual(Object.keys(m.perSecond), ['default']);
});

test('prices for resolutions the model does not list are dropped', () => {
  // Kling carries text_to_video 480p/1080p SKUs but supports only 720p.
  assert.deepEqual(Object.keys(v('kwaivgi/kling-v3.0-std').perSecond), ['720p']);
  assert.equal(v('alibaba/wan-2.6').perSecond['480p'], undefined);
  near(v('alibaba/wan-2.6').perSecond['720p'], 0.08, 'Wan 2.6 text-to-video 720p');
});

// ── Audio ────────────────────────────────────────────────────────────────────

test('the headline is the no-audio price; audio is the extra on top', () => {
  const veo = v('google/veo-3.1-fast');
  near(veo.perSecond['720p'], 0.08, '720p no audio');   // page: Video (no audio) (720p) 0.08
  near(veo.audioPerSecond['720p'], 0.02, 'audio extra');  // page: with audio 0.10
  const kling = v('kwaivgi/kling-v3.0-std');
  near(kling.audioPerSecond['720p'], 0.042, 'Kling audio extra');
});

test('the audio extra is kept per resolution, not collapsed to one figure', () => {
  // Codex, #60: Veo 3.1 Fast adds $0.02/s at 720p but $0.05/s at 4K. One number
  // beside the 4K rate made 4K-with-audio read $0.27/s when it is $0.30/s.
  const veo = v('google/veo-3.1-fast');
  near(veo.audioPerSecond['4K'], 0.05, '4K audio extra');
  near(veo.audioPerSecond['720p'], 0.02, '720p audio extra');
});

test('audio priced the same as silent reads as included (0), not as missing', () => {
  assert.equal(v('bytedance/seedance-2.0').audioPerSecond['720p'], 0);
  assert.deepEqual(v('runway/gen-4.5').audioPerSecond, {});
  assert.equal(v('runway/gen-4.5').generatesAudio, false);
});

test('supported durations are kept, so "can it make 8 seconds" is a lookup, not max >= 8', () => {
  // Codex, #60: Wan 2.6 offers 5s or 10s. Its max is 10, but an 8s clip is not
  // something you can order.
  assert.deepEqual(v('alibaba/wan-2.6').durations, [5, 10]);
  assert.equal(v('alibaba/wan-2.6').durations.includes(8), false);
  assert.deepEqual(v('google/veo-3.1').durations, [4, 6, 8]);
  assert.deepEqual(v('runway/aleph-2').durations, []);
});

// ── Everything else ──────────────────────────────────────────────────────────

test('a non-per-second unit is carried as otherUnit, never as a per-second price', () => {
  const m = v('black-forest-labs/flux-video-upscale');
  assert.deepEqual(m.perSecond, {});
  assert.deepEqual(m.otherUnit, { price: 0.035, unit: 'megapixel-second' });
});

test('an unknown SKU key is reported, not guessed at', () => {
  const m = normalizeVideoModel({ ...RAW['runway/gen-4.5'], pricing_skus: { cents_per_second_output: '12', cents_per_frame: '1' } });
  assert.deepEqual(m.unparsedSkus, ['cents_per_frame']);
  near(m.perSecond['720p'], 0.12, 'known key still parsed');
});

test('identity fields: canonical provider, OpenRouter label for unknown vendors, max length', () => {
  const grok = v('x-ai/grok-imagine-video-1.5-lite');
  assert.equal(grok.providerId, 'spacexai');
  assert.equal(grok.provider, 'SpaceXAI');
  assert.equal(grok.name, 'Grok Imagine Video 1.5 Lite');
  // kwaivgi is not in PROVIDERS; "Kwaivgi" would be our invention, "Kling" is theirs.
  assert.equal(v('kwaivgi/kling-v3.0-std').provider, 'Kling');
  assert.equal(v('tbc/mischief-1').maxDuration, 5);
  assert.equal(v('runway/aleph-2').maxDuration, null);
});
