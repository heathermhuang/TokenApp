/**
 * Provider and category slugs come from upstream data (OpenRouter), and a bare
 * map[slug] in the page's client JS reaches Object.prototype: "constructor"
 * returns a function, which is truthy, so `map[slug] || fallback` hands the
 * caller a function instead of the fallback. #31 fixed this for PROVIDER_NAMES;
 * this pins the same fix for the sibling maps (provider styles and URLs, model
 * page URLs, treemap category colours).
 *
 * Exercises the functions the page actually ships, extracted from getHtml().
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'own-key-test-'));
const out = await build({
  entryPoints: ['src/template.ts'],
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const p = join(dir, 'template.mjs');
writeFileSync(p, out.outputFiles[0].text);
const { getHtml } = await import(pathToFileURL(p).href);
const html = getHtml({ initialModels: '[]' });

function fn(name) {
  const m = html.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
  assert.ok(m, name + ' not found in the shipped page — this test needs rewiring');
  return m[0];
}

const PROTO_KEYS = ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty'];

const ctx = new Function(
  [fn('ownGet'), fn('safeUrl'), fn('getProviderStyle'), fn('getProviderUrl'), fn('getModelUrl')].join('\n') + `
  var light = false;
  function isLightTheme() { return light; }
  var PROVIDER_STYLE_DARK = { openai: { color: '#dark', bg: 'd' } };
  var PROVIDER_STYLE_LIGHT = { openai: { color: '#light', bg: 'l' } };
  var PROVIDER_URLS = { mistralai: 'https://mistral.ai/' };
  var MODEL_PAGE_URLS = { mistralai: 'https://docs.mistral.ai/models' };
  return { ownGet, getProviderStyle, getProviderUrl, getModelUrl, setLight: function (v) { light = v; } };`,
)();

test('ownGet returns own values only', () => {
  assert.equal(ctx.ownGet({ a: 1 }, 'a'), 1);
  for (const k of PROTO_KEYS) assert.equal(ctx.ownGet({ a: 1 }, k), undefined, k);
});

test('getProviderStyle falls back for prototype keys, in both themes', () => {
  for (const light of [false, true]) {
    ctx.setLight(light);
    assert.equal(ctx.getProviderStyle('openai').color, light ? '#light' : '#dark');
    for (const k of PROTO_KEYS) {
      const s = ctx.getProviderStyle(k);
      assert.equal(typeof s.color, 'string', `${k} (${light ? 'light' : 'dark'})`);
      assert.match(s.color, /^#/);
    }
  }
});

test('getProviderUrl returns null, never a function, for prototype keys', () => {
  assert.equal(ctx.getProviderUrl('mistralai'), 'https://mistral.ai/');
  for (const k of PROTO_KEYS) assert.equal(ctx.getProviderUrl(k), null, k);
});

test('getModelUrl skips prototype keys and falls through to OpenRouter', () => {
  assert.equal(ctx.getModelUrl({ providerId: 'mistralai', id: 'mistralai/x', slug: 'x' }), 'https://docs.mistral.ai/models');
  for (const k of PROTO_KEYS) {
    assert.equal(ctx.getModelUrl({ providerId: k, id: k + '/m', slug: 'm' }), 'https://openrouter.ai/' + k + '/m', k);
  }
});

test('no bare lookup into these maps survives anywhere in the page', () => {
  // Covers the treemap's TASK_CAT_BASE, which lives inside a render closure.
  const bare = html.match(/\b(PROVIDER_STYLE_LIGHT|PROVIDER_STYLE_DARK|PROVIDER_URLS|MODEL_PAGE_URLS|TASK_CAT_BASE)\[/g);
  assert.equal(bare, null, 'bare lookup: ' + (bare || []).join(', '));
});
