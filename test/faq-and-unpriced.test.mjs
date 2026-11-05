/**
 * Regression tests for the homepage FAQ (src/template.ts) and for models whose
 * price OpenRouter does not express in tokens (src/fetchers.ts).
 *
 * WHY THIS FILE EXISTS — two bugs found live on 2026-11-05:
 *
 * 1. The FAQ named models by hard-coded id. Its first question asked what GPT-4o
 *    (May 2024) costs, the DeepSeek answer compared "DeepSeek V3" against it, and
 *    the context-window answer said "As of 2025 … Gemini 1.5 Pro … Claude 200K".
 *    A hard-coded id never fails: it keeps answering about a model the catalogue
 *    has long moved past. Every model the FAQ names is now picked from the data.
 *
 * 2. Google's Lyria music models were listed at $0 / $0 and flagged Free. Their
 *    real price is $0.08 per song; OpenRouter reports prompt/completion as "0"
 *    because a song is not priced in tokens. A zero there is "not published in
 *    this unit", not "free" — the fake-7D bug's shape again.
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

const dir = mkdtempSync(join(tmpdir(), 'faq-test-'));

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

/** Upstream (OpenRouter) model, the shape normalizeModel takes. */
const raw = (id, name, modality, prompt, completion, extra = {}) => ({
  id, name, created: 1_790_000_000, context_length: 128000,
  architecture: { modality, tokenizer: 'X', instruct_type: null },
  pricing: { prompt, completion },
  top_provider: { context_length: 128000, max_completion_tokens: 4096, is_moderated: false },
  per_request_limits: null,
  ...extra,
});

// ── Unpriced is never free ───────────────────────────────────────────────────

test('a non-text model with no token price is UNPRICED (null), not free', () => {
  // google/lyria-3-pro-preview, verbatim from the live feed.
  const m = normalizeModel(raw('google/lyria-3-pro-preview', 'Google: Lyria 3 Pro Preview',
    'text+image->text+audio', '0', '0'));
  assert.equal(m.inputPer1M, null);
  assert.equal(m.outputPer1M, null);
  assert.equal(m.isFree, false);
});

test('a :free model at $0 stays free, whatever it outputs', () => {
  const t = normalizeModel(raw('google/gemma-4-31b-it:free', 'Google: Gemma 4 31B (free)', 'text+image->text', '0', '0'));
  assert.equal(t.isFree, true);
  assert.equal(t.inputPer1M, 0);
  const i = normalizeModel(raw('vendor/painter:free', 'Vendor: Painter (free)', 'text->image', '0', '0'));
  assert.equal(i.isFree, true);
  assert.equal(i.inputPer1M, 0);
});

test('a text-output model at $0 without the :free suffix stays free', () => {
  // openrouter/free and stealth/crouton-alpha are both genuinely $0 and both
  // lack the suffix. Text out means the token price IS the whole price.
  for (const id of ['openrouter/free', 'stealth/crouton-alpha']) {
    const m = normalizeModel(raw(id, id, 'text->text', '0', '0'));
    assert.equal(m.isFree, true, id);
    assert.equal(m.inputPer1M, 0, id);
  }
});

test('a non-text model WITH a token price keeps it', () => {
  // openai/gpt-audio: audio out, but prompt/completion are real prices.
  const m = normalizeModel(raw('openai/gpt-audio', 'OpenAI: GPT Audio', 'text+audio->text+audio', '0.0000025', '0.00001'));
  assert.equal(m.inputPer1M, 2.5);
  assert.equal(m.outputPer1M, 10);
  assert.equal(m.isFree, false);
});

// ── FAQ ──────────────────────────────────────────────────────────────────────

/** Normalized model, the shape getHtml reads from initialModels. */
const nm = (id, name, over = {}) => ({
  id, name, providerId: id.split('/')[0], provider: id.split('/')[0],
  inputPer1M: 1, outputPer1M: 5, contextWindow: 128000, createdAt: 1_780_000_000,
  outputModalities: ['text'], isDeprecated: false, isFree: false,
  ...over,
});

const CATALOGUE = [
  nm('openai/gpt-4o', 'OpenAI: GPT-4o', { inputPer1M: 2.5, outputPer1M: 10, createdAt: 1_715_558_400 }),
  nm('openai/gpt-6.1-terra-pro', 'OpenAI: GPT-6.1 Terra Pro', { inputPer1M: 1, outputPer1M: 5, contextWindow: 1_050_000, createdAt: 1_793_040_000 }),
  // Newer, but each is excluded for a reason the picker must honour.
  nm('openai/gpt-6.1-terra-mini', 'OpenAI: GPT-6.1 Terra Mini', { createdAt: 1_793_100_000 }),
  nm('openai/gpt-6.1-terra-pro:batch', 'OpenAI: GPT-6.1 Terra Pro (batch)', { createdAt: 1_793_100_001 }),
  nm('openai/gpt-image-3', 'OpenAI: GPT Image 3', { outputModalities: ['text', 'image'], createdAt: 1_793_100_002 }),
  nm('openai/gpt-6.2-preview', 'OpenAI: GPT-6.2 Preview', { isDeprecated: true, createdAt: 1_793_100_003 }),
  nm('deepseek/deepseek-chat', 'DeepSeek: DeepSeek V3', { inputPer1M: 0.25, outputPer1M: 1, createdAt: 1_735_200_000 }),
  nm('deepseek/deepseek-v4.1-flash', 'DeepSeek: DeepSeek V4.1 Flash', { inputPer1M: 0.05, outputPer1M: 0.5, createdAt: 1_792_000_000 }),
  nm('spacexai/grok-4.20', 'SpaceXAI: Grok 4.20', { contextWindow: 2_000_000 }),
  nm('google/gemini-3.6-pro', 'Google: Gemini 3.6 Pro', { contextWindow: 1_500_000 }),
  // Routers and ~aliases are not models: they must not win "largest context".
  nm('openrouter/auto', 'Auto Router', { contextWindow: 3_000_000, inputPer1M: -1, outputPer1M: -1 }),
  nm('typesafe/jev-router', 'TypeSafe: Jev Router', { contextWindow: 2_200_000, inputPer1M: -1, outputPer1M: -1 }),
  nm('~google/gemini-pro-latest', 'Google: Gemini Pro Latest', { contextWindow: 2_500_000 }),
  nm('nvidia/nemotron-3.5-lightning:free', 'NVIDIA: Nemotron 3.5 Lightning (free)', { inputPer1M: 0, outputPer1M: 0, isFree: true }),
  nm('google/gemma-4-31b-it:free', 'Google: Gemma 4 31B (free)', { inputPer1M: 0, outputPer1M: 0, isFree: true }),
  // A :free twin of the largest-context model: the name ends "(free)", not ":free",
  // so a suffix test run against `id + ' ' + name` never sees it (Codex, #58).
  nm('spacexai/grok-4.20:free', 'SpaceXAI: Grok 4.20 (free)', { contextWindow: 2_000_000, inputPer1M: 0, outputPer1M: 0, isFree: true }),
];

function faqOf(html) {
  const visible = [...html.matchAll(/<details class="faq-item">\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>/g)]
    .map(([, q, a]) => ({ q, a }));
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(([, s]) => JSON.parse(s))
    .find((d) => d['@type'] === 'FAQPage');
  return { visible, ld };
}

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

const { visible, ld } = faqOf(getHtml({ initialModels: JSON.stringify(CATALOGUE) }));
const allText = visible.map((x) => x.q + ' ' + x.a).join('\n');

test('the OpenAI question names the newest eligible OpenAI model, not GPT-4o', () => {
  const q = visible.find((x) => /OpenAI|GPT/.test(x.q));
  assert.ok(q, 'an OpenAI pricing question exists');
  assert.match(q.q, /GPT-6\.1 Terra Pro/);
  assert.match(q.a, /\$1\.00/);
  assert.match(q.a, /\$5\.00/);
  assert.doesNotMatch(allText, /GPT-4o/);
});

test('the DeepSeek comparison uses the newest DeepSeek and the same OpenAI pick', () => {
  const q = visible.find((x) => /DeepSeek/.test(x.q));
  assert.ok(q);
  assert.match(q.a, /DeepSeek V4\.1 Flash/);
  assert.match(q.a, /GPT-6\.1 Terra Pro/);
  assert.doesNotMatch(q.a, /DeepSeek V3\b/);
});

test('the context-window answer comes from the data, skipping routers and aliases', () => {
  const q = visible.find((x) => /context window/i.test(x.q));
  assert.ok(q);
  assert.match(q.a, /Grok 4\.20/);
  assert.match(q.a, /Gemini 3\.6 Pro/);
  assert.doesNotMatch(q.a, /Auto Router|Jev Router|Gemini Pro Latest/);
  assert.doesNotMatch(allText, /As of 20\d\d|Gemini 1\.5|200K/);
  // Largest first.
  assert.ok(q.a.indexOf('Grok 4.20') < q.a.indexOf('Gemini 3.6 Pro'));
  // A :free twin must not take a second slot and push a distinct model out.
  assert.equal(q.a.match(/Grok 4\.20/g).length, 1);
  assert.doesNotMatch(q.a, /\(free\)/);
  assert.match(q.a, /GPT-6\.1 Terra Pro/);
});

test('the free-models answer counts the free models actually listed', () => {
  const q = visible.find((x) => /cheapest/i.test(x.q));
  assert.ok(q);
  assert.match(q.a, /\b3 models\b/);
});

test('FAQPage JSON-LD carries exactly the visible questions and answers', () => {
  assert.ok(ld, 'FAQPage JSON-LD present and valid JSON');
  assert.deepEqual(
    ld.mainEntity.map((e) => ({ q: e.name, a: e.acceptedAnswer.text })),
    visible.map(({ q, a }) => ({ q: decode(q), a: decode(a) })),
  );
});

test('with an empty catalogue, model-specific questions drop out and the JSON-LD stays valid', () => {
  const { visible: v, ld: l } = faqOf(getHtml({ initialModels: '[]' }));
  assert.ok(l, 'FAQPage JSON-LD still parses');
  assert.equal(l.mainEntity.length, v.length);
  const text = v.map((x) => x.q + ' ' + x.a).join('\n');
  assert.doesNotMatch(text, /varies|undefined|null|NaN/);
  assert.ok(!v.some((x) => /DeepSeek|context window|cheapest/i.test(x.q)));
});

test('model names from OpenRouter are escaped for HTML and for the JSON-LD script', () => {
  const evil = nm('openai/gpt-x', 'OpenAI: GPT "X" </script><blink>', { createdAt: 1_800_000_000 });
  const html = getHtml({ initialModels: JSON.stringify([evil]) });
  // Scoped to the FAQ: the client's model data is embedded raw elsewhere on the page.
  const faqSection = html.slice(html.indexOf('<section class="faq-section"'), html.indexOf('</section>', html.indexOf('<section class="faq-section"')));
  assert.ok(faqSection.length > 0);
  assert.doesNotMatch(faqSection, /<blink>/);
  const ldBlock = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g).find((s) => s.includes('FAQPage'));
  assert.doesNotMatch(ldBlock.slice(0, -'</script>'.length), /<\/script|<blink>/);
  const { visible: v, ld: l } = faqOf(html);
  assert.ok(l, 'JSON-LD survived a </script> in a model name');
  assert.match(v[0].q, /GPT &quot;X&quot; &lt;\/script&gt;&lt;blink&gt;/);
  assert.equal(l.mainEntity[0].name.includes('GPT "X" </script><blink>'), true);
});

test('an unpriced model is not counted as free in the FAQ', () => {
  const lyria = normalizeModel(raw('google/lyria-3-pro-preview', 'Google: Lyria 3 Pro Preview', 'text+image->text+audio', '0', '0'));
  const gemma = normalizeModel(raw('google/gemma-4-31b-it:free', 'Google: Gemma 4 31B (free)', 'text->text', '0', '0'));
  const { visible: v } = faqOf(getHtml({ initialModels: JSON.stringify([lyria, gemma]) }));
  const q = v.find((x) => /cheapest/i.test(x.q));
  assert.match(q.a, /\b1 model\b/);
});

// ── Model page for an unpriced model ─────────────────────────────────────────

test('an unpriced model page says it is not priced per token, never "Free" or "costs —"', async () => {
  const { getModelHtml } = await load('src/pages.ts', 'pages.mjs');
  const lyria = normalizeModel(raw('google/lyria-3-pro-preview', 'Google: Lyria 3 Pro Preview', 'text+image->text+audio', '0', '0'));
  const html = getModelHtml({ model: lyria, all: [lyria], benchmarks: null, subscriptions: [], endpoints: null });
  assert.doesNotMatch(html, /costs (—|Free)|at (—|Free) per million|— per million/);
  assert.match(html, /not priced per token/);
});
