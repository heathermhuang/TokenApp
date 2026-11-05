/**
 * Image, audio and embedding models, each priced in its own unit.
 *
 * OpenRouter's default catalogue (`/api/v1/models`) is text-output only; these come
 * from `?output_modalities=all`. What `pricing.prompt` means differs by type and,
 * for audio, by MODEL, with nothing in the API to say which. Measured 2026-11-05
 * against every model page's JSON-LD `unitText`:
 *
 *   transcription  Whisper "per second", MAI-Transcribe "per hour", gpt-4o-transcribe
 *                  "per 1M tokens" — the same field, three units
 *   speech         "per M characters", Fish Audio "per M UTF-8 bytes", Seed Audio
 *                  "per minute", Gemini TTS no offer at all (token-priced)
 *   music          token prices 0; "per song" on the page only
 *
 * So AUDIO prices come from the page, unit and all, and a unit we have not mapped
 * is listed in `unparsed`, never guessed. The pages are ~650 KB each, so the full
 * pass runs at most once a day, in the cron; in between, only models we have never
 * priced are fetched (see `fetchMediaModels`).
 *
 *   embedding,     `pricing.prompt` = USD per token (gpt-6-luna-decisions' page:
 *   classifier     "0.1 per 1M tokens"; text-embedding-3-small = $0.02/1M)
 *   rerank         no price published anywhere
 *   image          `/api/v1/images/models/{id}/endpoints`, per image, per megapixel
 *                  or per token depending on the model
 *
 * Zero is a price only on a `:free` variant; anywhere else it means "not priced
 * in this unit" and becomes null, the same rule as the main table (Rule 0).
 * `test/media.test.mjs` pins all of this.
 */
import type { Env, ImageModel, MediaKind, MediaModel, MediaPayload, MediaRate } from './types';
import { KV_KEYS } from './types';
import { modelIdentity } from './videos';

const MODELS_API = 'https://openrouter.ai/api/v1/models?output_modalities=all';
const IMAGES_API = 'https://openrouter.ai/api/v1/images/models';
const SITE = 'https://openrouter.ai';
const HEADERS = { 'User-Agent': 'token.app/1.0 (+https://token.app)' };
const DAY_MS = 24 * 60 * 60 * 1000;

// The unit each kind's headline `price` is in. Rendered beside every price.
export const MEDIA_UNITS: Record<MediaKind, string | null> = {
  speech: '1M characters',
  transcription: 'hour of audio',
  music: 'song',
  embedding: '1M tokens',
  classifier: '1M tokens',
  rerank: null,
};

const KIND_BY_OUTPUT: Record<string, MediaKind> = {
  speech: 'speech',
  transcription: 'transcription',
  embeddings: 'embedding',
  rerank: 'rerank',
  decisions: 'classifier',
};
const AUDIO_KINDS = new Set<MediaKind>(['speech', 'transcription', 'music']);

// Page `unitText` → multiplier into the kind's headline unit.
const HEADLINE_SCALE: Partial<Record<MediaKind, Record<string, number>>> = {
  speech: { 'per M characters': 1 },
  transcription: { 'per second': 3600, 'per minute': 60, 'per hour': 1 },
  music: { 'per song': 1 },
};
// Page `unitText` → how it is shown when it is not the headline unit.
const OTHER_UNIT: Record<string, string> = {
  'per M characters': '1M characters',
  'per M UTF-8 bytes': '1M UTF-8 bytes',
  'per 1M tokens': '1M tokens',
  'per second': 'second',
  'per minute': 'minute',
  'per hour': 'hour',
  'per song': 'song',
};

const round = (n: number) => Number(n.toFixed(8));

interface RawModel {
  id: string;
  name: string;
  created?: number;
  context_length?: number | null;
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
  pricing?: Record<string, string>;
}

export interface PageOffer {
  name: string;
  price: number;
  unitText: string;
}

export function mediaKind(raw: RawModel): MediaKind | null {
  const out = raw.architecture?.output_modalities ?? [];
  if (out.length === 1 && KIND_BY_OUTPUT[out[0]]) return KIND_BY_OUTPUT[out[0]];
  // Music (Lyria): audio out, no token price. gpt-audio also outputs audio but
  // is token-priced, so it stays in the language table.
  const unpriced = Number(raw.pricing?.prompt ?? 0) === 0 && Number(raw.pricing?.completion ?? 0) === 0;
  return out.includes('audio') && unpriced && !raw.id.endsWith(':free') ? 'music' : null;
}

// Every JSON-LD offer with a priceSpecification, in page order.
export function offersFromHtml(html: string): PageOffer[] {
  const out: PageOffer[] = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let doc: { offers?: { priceSpecification?: { name?: string; price?: number; unitText?: string } }[] };
    try { doc = JSON.parse(m[1]); } catch { continue; }
    for (const o of Array.isArray(doc.offers) ? doc.offers : []) {
      const ps = o.priceSpecification;
      if (ps && typeof ps.price === 'number' && typeof ps.unitText === 'string') {
        out.push({ name: ps.name ?? '', price: ps.price, unitText: ps.unitText });
      }
    }
  }
  return out;
}

// "Audio Seconds (Prompted)" → "Prompted"; "Input Price" → "input"; else "" (the unit says it).
function offerLabel(name: string): string {
  const paren = name.match(/\(([^)]+)\)/);
  if (paren) return paren[1];
  const priced = name.match(/^(\w+) Price$/);
  if (priced) return priced[1].toLowerCase();
  return name === 'Audio Output' ? 'audio output' : '';
}

/**
 * An audio model's page offers → its headline price and the rest. The first
 * offer in the kind's own unit is the headline; later ones in that unit are
 * variants ("Prompted", "Multilingual"). Offers in any other known unit are listed
 * as they are, never converted: UTF-8 bytes are not characters, and a minute of
 * output audio has no fixed character count.
 */
export function normalizeAudioOffers(kind: MediaKind, offers: PageOffer[]): Pick<MediaModel, 'price' | 'otherRates' | 'unparsed'> {
  const scales = HEADLINE_SCALE[kind] ?? {};
  let price: number | null = null;
  const otherRates: MediaRate[] = [];
  const unparsed: string[] = [];
  for (const o of offers) {
    const scale = scales[o.unitText];
    if (scale !== undefined) {
      const v = round(o.price * scale);
      if (price === null && offerLabel(o.name) === '') price = v;
      else otherRates.push({ label: offerLabel(o.name), price: v, unit: MEDIA_UNITS[kind]! });
    } else if (OTHER_UNIT[o.unitText]) {
      otherRates.push({ label: offerLabel(o.name), price: round(o.price), unit: OTHER_UNIT[o.unitText] });
    } else {
      unparsed.push(`${o.name} ${o.unitText}`);
    }
  }
  return { price, otherRates, unparsed };
}

// A page with no offer at all (Gemini TTS) falls back to the catalogue, but only
// in the shape the transcription pages confirmed means tokens: prompt AND
// completion both set (gpt-4o-transcribe: "2.5 per 1M tokens" in, "10" out).
export function catalogueTokenRates(raw: RawModel): MediaRate[] {
  const prompt = Number(raw.pricing?.prompt ?? 0);
  const completion = Number(raw.pricing?.completion ?? 0);
  if (!(prompt > 0 && completion > 0)) return [];
  return [
    { label: 'input', price: round(prompt * 1e6), unit: '1M tokens' },
    { label: 'output', price: round(completion * 1e6), unit: '1M tokens' },
  ];
}

// Embeddings, classifiers and rerank: priced (or not) from the catalogue alone.
// Audio models get their price fields from normalizeAudioOffers instead.
export function normalizeMediaModel(raw: RawModel, kind: MediaKind): MediaModel {
  const prompt = Number(raw.pricing?.prompt ?? 0);
  const free = raw.id.endsWith(':free');
  let price: number | null = null;
  if (free) price = 0;
  else if (kind !== 'rerank' && !AUDIO_KINDS.has(kind) && prompt > 0) price = round(prompt * 1e6);

  const ctx = raw.context_length;
  return {
    ...modelIdentity(raw.id, raw.name),
    createdAt: raw.created ?? null,
    kind,
    price,
    otherRates: [],
    unparsed: [],
    contextLength: typeof ctx === 'number' && ctx > 0 ? ctx : null,
  };
}

// ── Images ────────────────────────────────────────────────────────────────────

interface RawImageModel {
  id: string;
  name: string;
  created?: number;
  architecture?: { input_modalities?: string[] };
}

interface RawImagePrice {
  billable: string;
  unit: string;
  cost_usd: number;
  variant?: string;
}

const IMAGE_UNITS: Record<string, { unit: string; scale: number }> = {
  image: { unit: 'image', scale: 1 },
  megapixel: { unit: 'megapixel', scale: 1 },
  request: { unit: 'request', scale: 1 },
  token: { unit: '1M image tokens', scale: 1e6 },
};
const INPUT_LABEL: Record<string, string> = {
  input_image: 'input image',
  input_reference: 'reference',
  input_font: 'font',
  input_text: 'input text',
};

// "2k" → "2K", "low_1k" → "low 1K", "768" → "768px", "high_thinking_surcharge" → "high thinking surcharge"
const prettyVariant = (v: string) => /^\d+$/.test(v) ? `${v}px` : v.replace(/_/g, ' ').replace(/(\d(?:\.\d)?)k\b/g, '$1K');

/**
 * One model's endpoint prices → a headline per-image price and the rest.
 *
 * The headline is the plain per-image output price: the entry with no variant, or
 * the "1k" one (Flux 3 and Qwen Image name their standard size; Recraft and
 * Riverflow leave it unnamed). Anything else is a different product (a size, a
 * quality tier, style references) and goes under other rates, never into the
 * headline. Token- and megapixel-priced models have no per-image price; their rate
 * is listed, not converted, because the count depends on the image.
 *
 * `headlineTokenRate` is the catalogue's `pricing.image_output`: where a model
 * has several endpoints that disagree (Gemini 3 Pro Image Preview's flex tier is
 * half price), the catalogue figure is the one the language table already shows.
 */
export function normalizeImagePricing(
  endpoints: { pricing?: RawImagePrice[] }[],
  headlineTokenRate: number | null = null,
): Pick<ImageModel, 'perImage' | 'otherRates' | 'unparsed'> {
  const best = new Map<string, MediaRate>();
  const unparsed = new Set<string>();
  let plain: number | null = null;
  let oneK: number | null = null;

  for (const ep of endpoints) {
    for (const p of ep.pricing ?? []) {
      const u = IMAGE_UNITS[p.unit];
      const isOutput = p.billable === 'output_image';
      const inputLabel = INPUT_LABEL[p.billable];
      const key = `${p.billable}|${p.unit}|${p.variant ?? ''}`;
      if (!u || (!isOutput && !inputLabel) || !Number.isFinite(p.cost_usd)) {
        unparsed.add(key);
        continue;
      }
      if (p.cost_usd <= 0) continue;
      // Input tokens are billed on the prompt; the output rate already says
      // "priced in tokens", and three token rates crowd the cell.
      if (!isOutput && p.unit === 'token') continue;
      const variant = (p.variant ?? '').toLowerCase();
      if (isOutput && p.unit === 'image' && (variant === '' || variant === '1k')) {
        // Cheapest endpoint; a no-variant price beats "1k" if both appear.
        const v = round(p.cost_usd);
        if (variant === '') plain = plain === null ? v : Math.min(plain, v);
        else oneK = oneK === null ? v : Math.min(oneK, v);
        continue;
      }
      const label = [isOutput ? '' : inputLabel, p.variant ? prettyVariant(p.variant) : ''].filter(Boolean).join(' ');
      const price = round(p.cost_usd * u.scale);
      const prev = best.get(key);
      if (!prev || price < prev.price) best.set(key, { label, unit: u.unit, price });
    }
  }

  const tok = best.get('output_image|token|');
  if (tok && headlineTokenRate !== null && headlineTokenRate > 0) tok.price = round(headlineTokenRate * 1e6);

  return { perImage: plain ?? oneK, otherRates: [...best.values()], unparsed: [...unparsed] };
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return (await res.json()) as T;
}

// Run `fn` over `items`, at most `limit` at a time.
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export interface MediaFetchResult {
  payload: MediaPayload;
  failed: string[];   // models whose price request failed; they keep their last entry
  pagesFetched: number;
}

/**
 * `prev` is the last stored payload. Audio pages are re-read only when `prev` is
 * over a day old AND `fullAudioPass` is set (the cron sets it; the HTTP refresh,
 * with its ~100s budget, does not). Otherwise a model keeps the audio price it
 * had, and only models with no price yet are fetched.
 */
export async function fetchMediaModels(prev: MediaPayload | null, opts: { fullAudioPass?: boolean } = {}): Promise<MediaFetchResult> {
  const [catalogue, imageList] = await Promise.all([
    fetchJson<{ data?: RawModel[] }>(MODELS_API),
    fetchJson<{ data?: RawImageModel[] }>(IMAGES_API),
  ]);
  const all = catalogue.data ?? [];
  const byId = new Map(all.map((m) => [m.id, m]));
  const failed: string[] = [];

  const stale = !prev?.audioPricedAt || Date.now() - Date.parse(prev.audioPricedAt) > DAY_MS;
  const fullPass = stale && opts.fullAudioPass === true;
  const priorAudio = new Map((prev?.audio ?? []).map((m) => [m.id, m]));

  const audioRaw: [RawModel, MediaKind][] = [];
  const embeddings: MediaModel[] = [];
  for (const raw of all) {
    if (raw.id.startsWith('~')) continue; // "latest" aliases duplicate a dated model
    const kind = mediaKind(raw);
    if (!kind) continue;
    if (AUDIO_KINDS.has(kind)) audioRaw.push([raw, kind]);
    else embeddings.push(normalizeMediaModel(raw, kind));
  }

  let pagesFetched = 0;
  const audio = await pool(audioRaw, 6, async ([raw, kind]): Promise<MediaModel> => {
    const base = normalizeMediaModel(raw, kind);
    const prior = priorAudio.get(raw.id);
    if (raw.id.endsWith(':free')) return base;
    // A prior entry with nothing in it may be a failed fetch, so it is retried
    // (Gemini TTS, with no offer on its page, costs three page reads an hour).
    const known = prior && (prior.price !== null || prior.otherRates.length > 0 || prior.unparsed.length > 0);
    if (known && !fullPass) return { ...base, price: prior.price, otherRates: prior.otherRates, unparsed: prior.unparsed };
    try {
      const res = await fetch(`${SITE}/${raw.id}`, { headers: HEADERS });
      if (!res.ok) throw new Error(String(res.status));
      pagesFetched++;
      const offers = offersFromHtml(await res.text());
      if (offers.length === 0) {
        // No offer on a page that answered 200 is either a token-priced model
        // (Gemini TTS) or a broken page. Only the first has a catalogue fallback,
        // and a model we priced from its page before cannot have become the
        // first: treat it as a failed read so its last good price stands.
        const tokens = catalogueTokenRates(raw);
        if (tokens.length === 0 || (prior && prior.price !== null)) throw new Error('no offers on page');
        return { ...base, otherRates: tokens };
      }
      return { ...base, ...normalizeAudioOffers(kind, offers) };
    } catch {
      failed.push(raw.id);
      return prior ? { ...base, price: prior.price, otherRates: prior.otherRates, unparsed: prior.unparsed } : base;
    }
  });

  const images = await pool(imageList.data ?? [], 8, async (raw): Promise<ImageModel> => {
    const headline = Number(byId.get(raw.id)?.pricing?.image_output ?? 0);
    let pricing: Pick<ImageModel, 'perImage' | 'otherRates' | 'unparsed'>;
    try {
      const eps = await fetchJson<{ endpoints?: { pricing?: RawImagePrice[] }[] }>(`${IMAGES_API}/${raw.id}/endpoints`);
      pricing = normalizeImagePricing(eps.endpoints ?? [], headline > 0 ? headline : null);
    } catch {
      failed.push(raw.id);
      const prior = prev?.images.find((m) => m.id === raw.id);
      pricing = prior ?? { perImage: null, otherRates: [], unparsed: [] };
    }
    return {
      ...modelIdentity(raw.id, raw.name),
      createdAt: raw.created ?? null,
      edits: (raw.architecture?.input_modalities ?? []).includes('image'),
      perImage: pricing.perImage,
      otherRates: pricing.otherRates,
      unparsed: pricing.unparsed,
    };
  });

  const now = new Date().toISOString();
  return {
    payload: {
      images,
      audio,
      embeddings,
      fetchedAt: now,
      // A pass that re-read only new models leaves the clock where it was.
      audioPricedAt: fullPass || !prev?.audioPricedAt ? now : prev.audioPricedAt,
    },
    failed,
    pagesFetched,
  };
}

export async function readMedia(env: Env): Promise<MediaPayload | null> {
  const raw = await env.TOKEN_APP_KV.get(KV_KEYS.MEDIA);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MediaPayload;
  } catch {
    return null;
  }
}
