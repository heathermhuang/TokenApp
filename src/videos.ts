/**
 * Video generation models and their per-second prices.
 *
 * OpenRouter's main catalogue (`/api/v1/models`) lists video models at prompt and
 * completion "0" — not free, just not priced in tokens. The real prices are in
 * `/api/v1/videos/models` under `pricing_skus`, in three unit families:
 *
 *   cents_per_video_output_second_{res}, cents_per_second_output[_{res}]  → cents/s
 *   [text_to_video_]duration_seconds[_with_audio|_without_audio][_{res}]  → dollars/s
 *   video_tokens[_{res}][_without_audio]  → dollars per token (Seedance)
 *
 * Every conversion was checked against the model's own OpenRouter page (its JSON-LD
 * offers) on 2026-11-05; `test/videos.test.mjs` pins those numbers.
 *
 * Two rules carry the honesty of the table:
 *  - An UNSUFFIXED per-second SKU means "the default resolution", which the API
 *    never names (Veo 3.1's is 1080p, per its page). It is attributed to a
 *    resolution only when the model supports exactly one; otherwise it stays
 *    "default". Token families differ: a token rate is per token and the
 *    resolution is in the token count, so their unsuffixed rate applies to every
 *    resolution without its own key — but only one with NO key of its own in
 *    either family (see the token loop below).
 *  - A SKU key we do not recognise is listed in `unparsedSkus`, never guessed.
 *    Recognised keys for other modes (image-to-video, reference, continuation,
 *    long clips, video input) are skipped on purpose: the table compares plain
 *    generation.
 *
 * Known gap, left visible: a model page can show a lower, promotional price than
 * the API (HeyGen Video 480p: $0.01 on the page, $0.02 in the API on 2026-11-05).
 * We publish the API's figure and link every row to the OpenRouter page.
 */
import type { Env, VideoModel, VideoPayload } from './types';
import { KV_KEYS } from './types';
import { PROVIDERS, canonicalProviderId } from './providers';

const VIDEOS_API = 'https://openrouter.ai/api/v1/videos/models';

// Frame size per resolution for token-priced models. Seedance bills
// ceil(W × H × 24fps / 1024) tokens per second: 480p (854×480) gives 9,608, which
// reproduces OpenRouter's $0.067256/s for Seedance 2.0 at $7/M tokens exactly.
const FRAME: Record<string, [number, number]> = {
  '480p': [854, 480],
  '720p': [1280, 720],
  '1080p': [1920, 1080],
  '4K': [3840, 2160],
};
const tokensPerSecond = (res: string) => Math.ceil((FRAME[res][0] * FRAME[res][1] * 24) / 1024);

const RES = '(480p|720p|768p|1080p|2k|4k)';
const canonRes = (r: string) => (r === '2k' ? '2K' : r === '4k' ? '4K' : r);
const round = (n: number) => Number(n.toFixed(8));

// Keys for modes the table does not compare. Recognised, so not "unparsed".
const OTHER_MODE = /^(image_to_video_|long_duration_|reference_|cents_per_second_video_continuation_)|^(cents_per_image_input|minimum_cents_per_generation|reference_images|reference_input_images)$|_with_video_input$/;

interface RawVideoModel {
  id: string;
  name: string;
  created?: number;
  supported_resolutions?: string[] | null;
  supported_durations?: number[] | null;
  generate_audio?: boolean | null;
  pricing_skus?: Record<string, string> | null;
}

export function normalizeVideoModel(raw: RawVideoModel): VideoModel {
  const resolutions = (raw.supported_resolutions ?? []).map(canonRes);
  const single = resolutions.length === 1 ? resolutions[0] : null;
  // Per-second families. "default" = unsuffixed; resolved below.
  const base: Record<string, number> = {};      // no audio, or audio not priced apart
  const t2v: Record<string, number> = {};       // text_to_video_*, used only to fill gaps
  const withAudio: Record<string, number> = {};
  // Token families: dollars per token.
  const tok: Record<string, number> = {};
  const tokSilent: Record<string, number> = {};
  const megapixel: number[] = [];
  const unparsedSkus: string[] = [];

  for (const [key, value] of Object.entries(raw.pricing_skus ?? {})) {
    const n = Number(value);
    let m: RegExpMatchArray | null;
    if (!Number.isFinite(n)) {
      unparsedSkus.push(key);
    } else if ((m = key.match(new RegExp(`^cents_per_(?:video_output_second|second_output)(?:_${RES})?$`)))) {
      base[m[1] ? canonRes(m[1]) : 'default'] = n / 100;
    } else if ((m = key.match(new RegExp(`^(text_to_video_)?duration_seconds(?:_(with_audio|without_audio))?(?:_${RES})?$`)))) {
      const res = m[3] ? canonRes(m[3]) : 'default';
      if (m[2] === 'with_audio') withAudio[res] = n;
      else (m[1] ? t2v : base)[res] = n;
    } else if ((m = key.match(/^video_tokens(?:_(1080p|4k))?(_without_audio)?$/))) {
      (m[2] ? tokSilent : tok)[m[1] ? canonRes(m[1]) : 'default'] = n;
    } else if ((m = key.match(/^cents_per_megapixel_second_\w+$/))) {
      megapixel.push(n / 100);
    } else if (!OTHER_MODE.test(key)) {
      unparsedSkus.push(key);
    }
  }

  for (const [res, n] of Object.entries(t2v)) if (base[res] === undefined) base[res] = n;

  // A single-resolution model's unsuffixed price is that resolution's price.
  if (single) {
    for (const map of [base, withAudio]) {
      if (map.default !== undefined) {
        if (map[single] === undefined) map[single] = map.default;
        delete map.default;
      }
    }
  }

  // Token families → per second, for each listed resolution we know the frame of.
  // A resolution's own rate wins over BOTH defaults: Seedance 2.0 has a 4K rate but
  // a silent rate only as the default, and mixing them priced a silent 4K clip at
  // $1.36/s against $0.78/s with audio.
  for (const res of resolutions) {
    if (!FRAME[res]) continue;
    const rate = tok[res] ?? tok.default;
    const silentRate = tokSilent[res] ?? (tok[res] === undefined ? tokSilent.default : undefined);
    if (rate !== undefined) withAudio[res] = rate * tokensPerSecond(res);
    if (silentRate !== undefined) base[res] = silentRate * tokensPerSecond(res);
    else if (rate !== undefined) base[res] = rate * tokensPerSecond(res);
  }

  // A price for a resolution the model doesn't list is not one you can buy.
  const allowed = (res: string) => res === 'default' ? !single : resolutions.length === 0 || resolutions.includes(res);
  const perSecond: Record<string, number> = {};
  for (const [res, n] of Object.entries(base)) if (allowed(res)) perSecond[res] = round(n);
  for (const [res, n] of Object.entries(withAudio)) {
    if (allowed(res) && perSecond[res] === undefined) perSecond[res] = round(n); // audio-only price
  }

  // Audio extra per resolution: it varies (Veo 3.1 Fast: +$0.02/s at 720p,
  // +$0.05/s at 4K), so one figure beside every rate in the row would misprice
  // all but one of them.
  const audioPerSecond: Record<string, number> = {};
  for (const [res, n] of Object.entries(withAudio)) {
    if (base[res] !== undefined && allowed(res)) audioPerSecond[res] = round(Math.max(0, n - base[res]));
  }

  const [vendorId] = raw.id.split('/');
  const providerId = canonicalProviderId(vendorId ?? '');
  const prefix = raw.name.includes(': ') ? raw.name.slice(0, raw.name.indexOf(': ')) : null;
  const durations = raw.supported_durations ?? [];

  return {
    id: raw.id,
    name: prefix ? raw.name.slice(prefix.length + 2) : raw.name,
    // Our label for vendors we know; OpenRouter's ("Kling") for ones we don't,
    // rather than a capitalised slug ("Kwaivgi").
    provider: PROVIDERS[providerId]?.displayName ?? prefix ?? providerId,
    providerId,
    createdAt: raw.created ?? null,
    resolutions,
    durations,
    maxDuration: durations.length ? Math.max(...durations) : null,
    generatesAudio: raw.generate_audio ?? null,
    perSecond,
    audioPerSecond,
    otherUnit: megapixel.length ? { price: round(Math.min(...megapixel)), unit: 'megapixel-second' } : null,
    unparsedSkus,
  };
}

export async function fetchVideoModels(): Promise<VideoPayload> {
  const res = await fetch(VIDEOS_API, {
    headers: { 'User-Agent': 'token.app/1.0 (+https://token.app)' },
  });
  if (!res.ok) throw new Error(`OpenRouter videos ${res.status}`);
  const json = (await res.json()) as { data?: RawVideoModel[] };
  return {
    models: (json.data ?? []).map(normalizeVideoModel),
    fetchedAt: new Date().toISOString(),
  };
}

export async function readVideos(env: Env): Promise<VideoPayload | null> {
  const raw = await env.TOKEN_APP_KV.get(KV_KEYS.VIDEOS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VideoPayload;
  } catch {
    return null;
  }
}
