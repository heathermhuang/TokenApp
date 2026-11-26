/**
 * `:batch` twins are the same model sold through an async batch API, at a lower
 * price. They already say "(batch)" in the name, but nothing explained what that
 * means, and a price sort put them above their real-time twin with no way to
 * separate the two. They now carry a "Batch" badge whose tooltip explains it, and
 * the table has a "Batch" category tab. Checked against the shipped client code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'batch-label-'));
const out = await build({ entryPoints: ['src/template.ts'], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
writeFileSync(join(dir, 't.mjs'), out.outputFiles[0].text);
const { getHtml } = await import(pathToFileURL(join(dir, 't.mjs')).href);

const html = getHtml({ initialModels: '[]' });
const fnSrc = (name) => {
  const m = html.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
  assert.ok(m, name + ' not found in the shipped page');
  return m[0];
};
const helpers = fnSrc('isBatchModel') + fnSrc('batchBadge');
const buildModIcons = new Function(helpers + fnSrc('buildModIcons') + '; return buildModIcons;')();
const buildMobileMeta = new Function(helpers + fnSrc('buildMobileMeta') + '; return buildMobileMeta;')();
const filterWith = (state) => new Function('state', helpers + fnSrc('filterModels') + '; return filterModels;')(state)();

const model = (o) => ({ name: 'X', provider: 'P', providerId: 'p', outputModalities: ['text'], ...o });
const batch = model({ id: 'google/gemini-4-neon:batch', name: 'Google: Gemini 4 Neon (batch)', inputPer1M: 1.5 });
const live = model({ id: 'google/gemini-4-neon', name: 'Google: Gemini 4 Neon', inputPer1M: 3 });
// Matching on the name would catch this one; the id is the only reliable signal.
const lookalike = model({ id: 'acme/batch-writer', name: 'Acme: Batch Writer', inputPer1M: 1 });

test('a :batch model carries an explained Batch badge, desktop and mobile', () => {
  for (const render of [buildModIcons, buildMobileMeta]) {
    const b = render(batch);
    assert.match(b, />Batch</);
    assert.match(b, /title="[^"]*async/i, 'the tooltip says what batch means');
    assert.doesNotMatch(render(live), /Batch/);
    assert.doesNotMatch(render(lookalike), />Batch</, 'keyed on the :batch id, not the name');
  }
});

test('the table has a Batch tab, and it lists only :batch twins', () => {
  assert.match(html, /<button class="cat-tab" data-cat="batch">Batch<\/button>/);
  const state = { models: [live, batch, lookalike], search: '', cat: 'batch', providers: new Set(), benchFilter: null, benchIndex: {}, sortKey: 'inputPer1M', sortDir: 1 };
  assert.deepEqual(filterWith(state).map((m) => m.id), [batch.id]);
  assert.equal(filterWith({ ...state, cat: 'all' }).length, 3, 'All still shows them');
});
