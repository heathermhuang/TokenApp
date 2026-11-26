/**
 * OpenRouter's task-spend taxonomy changed (seen 2026-11-26): tags went from
 * `code:general_impl` to `software.implementation`, and the four macro
 * categories (general/agent/code/data) became eight. Our curated labels and
 * palette matched none of it, so the treemap printed "Software.Implementation"
 * and drew seven of eight categories in fallback grey.
 *
 * Labels and colours were read off OpenRouter's own rendered treemap. Four tiny
 * tiles carry no label there either, so they keep the generic fallback.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'task-taxonomy-'));
async function load(entry, name) {
  const out = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  writeFileSync(join(dir, name), out.outputFiles[0].text);
  return import(pathToFileURL(join(dir, name)).href);
}
const { taskSpendFromRaw } = await load('src/openrouter-json.ts', 'orj.mjs');
const { getHtml } = await load('src/template.ts', 'tpl.mjs');

const CATEGORIES = ['software', 'data', 'information', 'writing', 'assistance', 'creative', 'media', 'retrieval'];
const block = (tags) => ({
  windowDays: 30,
  macroCategories: CATEGORIES.map((key) => ({ key, label: key, spendShare: 0.1 })),
  tasks: tags.map((tag, i) => ({ tag, macroCategory: tag.split('.')[0], spendShareOfTotal: 0.1 - i / 1000, models: [] })),
});
const labels = (tags) => {
  const ts = taskSpendFromRaw({ data: { spend: block(tags), tokens: block(tags) } });
  return Object.fromEntries(ts.tasks.map((t) => [t.tag, t.label]));
};

test('new-taxonomy tags get OpenRouter\'s curated labels', () => {
  assert.deepEqual(labels(['software.implementation', 'information.context_grounded_qa', 'data.classification_tagging', 'software.code_explanation_documentation']), {
    'software.implementation': 'Implementation',
    'information.context_grounded_qa': 'Context-grounded Q&A',
    'data.classification_tagging': 'Classification & tagging',
    'software.code_explanation_documentation': 'Code explanation & docs',
  });
});

test('an unlabelled tag never shows its category prefix', () => {
  // OpenRouter renders no label for this one; the fallback must drop "software."
  assert.equal(labels(['software.database_sql'])['software.database_sql'], 'Database Sql');
  assert.equal(labels(['brand_new_tag'])['brand_new_tag'], 'Brand New Tag');
});

test('every one of the eight categories has its own colour', () => {
  const html = getHtml({ initialModels: '[]' });
  const src = html.match(/var TASK_CAT_BASE = (\{[^}]*\});/);
  assert.ok(src, 'TASK_CAT_BASE not found in the shipped page');
  const base = JSON.parse(src[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
  for (const k of CATEGORIES) assert.match(base[k] || '', /^#[0-9a-f]{6}$/i, k + ' has no colour');
  assert.equal(new Set(CATEGORIES.map((k) => base[k])).size, 8, 'colours are distinct');
});
