/**
 * Open item 12: every subscription tier STATES how annual billing works, instead
 * of leaving readers to infer it from annualMonthlyPrice vs monthlyPrice.
 *
 * The old convention stored annual == monthly for two different facts ("annual at
 * the same price" and "no annual plan at all"), and /api/subscriptions exposed it
 * raw, so a consumer read Copilot Pro's annualMonthlyPrice: 10 as a purchasable
 * annual rate. Copilot sells no annual plan. The 2026-11 re-verify sourced every
 * such tier and found NONE that sells annual at the same price, so the field
 * has four values:
 *
 *   discounted   a cheaper annual rate exists      monthly > annual, both numbers
 *   annual-only  no monthly plan is published      monthly null, annual a number
 *   unavailable  the vendor sells no annual plan   annual null
 *   unpublished  may exist, no annual price found  annual null
 *
 * Checked against the real data, and against both renderers' shipped code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'annual-billing-'));
async function load(entry, name) {
  const out = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  const p = join(dir, name);
  writeFileSync(p, out.outputFiles[0].text);
  return import(pathToFileURL(p).href);
}
const { SUBSCRIPTIONS } = await load('src/subscriptions.ts', 'subs.mjs');
const { getSubCompareHtml } = await load('src/pages.ts', 'pages.mjs');
const { getHtml } = await load('src/template.ts', 'template.mjs');

const VALUES = new Set(['discounted', 'annual-only', 'unavailable', 'unpublished']);
const tiers = SUBSCRIPTIONS.flatMap((s) => s.tiers.map((t) => ({ id: s.id, ...t })));
const label = (t) => `${t.id} · ${t.name}`;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

test('every tier states its annual billing', () => {
  for (const t of tiers) assert.ok(VALUES.has(t.annualBilling), `${label(t)}: ${t.annualBilling}`);
});

test('the prices agree with the stated billing', () => {
  for (const t of tiers) {
    const L = label(t);
    switch (t.annualBilling) {
      case 'discounted':
        assert.ok(isNum(t.monthlyPrice) && isNum(t.annualMonthlyPrice), `${L}: both prices must be numbers`);
        assert.ok(t.annualMonthlyPrice < t.monthlyPrice, `${L}: a discount must be cheaper`);
        break;
      case 'annual-only':
        assert.equal(t.monthlyPrice, null, `${L}: no monthly price is published`);
        assert.ok(isNum(t.annualMonthlyPrice) && t.annualMonthlyPrice > 0, `${L}: needs its annual price`);
        break;
      default: // unavailable, unpublished: no annual figure may be asserted
        assert.equal(t.annualMonthlyPrice, null, `${L}: ${t.annualBilling} must not carry an annual price`);
    }
  }
});

test('no tier stores annual == monthly any more', () => {
  const eq = tiers.filter((t) => isNum(t.monthlyPrice) && t.monthlyPrice === t.annualMonthlyPrice);
  assert.deepEqual(eq.map(label), []);
});

test('the sourced cases land where the evidence put them', () => {
  const get = (id, name) => tiers.find((t) => t.id === id && t.name === name)?.annualBilling;
  assert.equal(get('github-copilot', 'Pro'), 'unavailable');       // annual closed 2026-06-01
  assert.equal(get('chatgpt', 'Plus'), 'unavailable');             // help 6950777
  assert.equal(get('gemini', 'AI Pro'), 'discounted');             // $199.99/yr list
  assert.equal(get('gemini', 'AI Plus'), 'unpublished');           // exists, no price
  assert.equal(get('kimi', 'Business'), 'annual-only');            // "billed annually"
  assert.equal(get('microsoft-copilot', 'M365 Copilot'), 'annual-only');
});

// ── Renderers ────────────────────────────────────────────────────────────────

const sub = (tierList) => ({ id: 'x', name: 'X', provider: 'P', providerId: 'p', description: '', url: 'https://x.example', category: 'chat', tiers: tierList });
const tier = (o) => ({ perSeat: false, features: [], highlight: false, ...o });
const T = {
  disc: tier({ name: 'Disc', monthlyPrice: 20, annualMonthlyPrice: 16, annualBilling: 'discounted' }),
  none: tier({ name: 'None', monthlyPrice: 10, annualMonthlyPrice: null, annualBilling: 'unavailable' }),
  only: tier({ name: 'Only', monthlyPrice: null, annualMonthlyPrice: 50, annualBilling: 'annual-only', perSeat: true }),
};

test('compare page: the annual column shows a real annual rate, never an inferred one', () => {
  const html = getSubCompareHtml({ a: sub([T.disc, T.none]), b: sub([T.only]), all: [] });
  const row = (name) => html.match(new RegExp(`<strong>${name}</strong>[\\s\\S]*?</tr>`))[0];
  assert.match(row('Disc'), /\$16/);
  assert.doesNotMatch(row('None'), /\$10[\s\S]*\$10/, 'an unavailable tier must not repeat its monthly price as annual');
  assert.match(row('Only'), /\$50/, 'an annual-only tier shows its annual price');
  assert.match(row('Only'), /annual only|billed annually/i);
  assert.match(row('Only'), /\$50<span class="muted">\/seat<\/span>/, 'a per-seat annual-only price keeps its unit');
  const solo = getSubCompareHtml({ a: sub([{ ...T.only, perSeat: false }]), b: sub([T.disc]), all: [] });
  assert.doesNotMatch(solo.match(/<strong>Only<\/strong>[\s\S]*?<\/tr>/)[0], /\/seat/, 'and only a per-seat one');
});

// The main page renders tiers in client JS; evaluate the shipped helper.
const html = getHtml({ initialModels: '[]' });
const fnSrc = (name) => {
  const m = html.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
  assert.ok(m, name + ' not found in the shipped page');
  return m[0];
};
const tierPriceHtml = new Function(fnSrc('tierPriceHtml') + '; return tierPriceHtml;')();

test('main page: annual line follows the stated billing', () => {
  assert.match(tierPriceHtml(T.disc), /\$16\/mo billed annually/);
  assert.doesNotMatch(tierPriceHtml(T.none), /annual/i);
  const only = tierPriceHtml(T.only);
  assert.match(only, /\$50/);
  assert.match(only, /billed annually only/i);
  assert.doesNotMatch(only, /Contact/, 'an annual-only tier has a price, it is not contact-sales');
  assert.match(tierPriceHtml(tier({ name: 'Ent', monthlyPrice: null, annualMonthlyPrice: null, annualBilling: 'unpublished' })), /Contact/);
  assert.match(tierPriceHtml(tier({ name: 'Free', monthlyPrice: 0, annualMonthlyPrice: null, annualBilling: 'unavailable' })), /Free/);
});
