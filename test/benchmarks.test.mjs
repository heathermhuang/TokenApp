/**
 * Regression tests for the Epoch benchmark version join (src/benchmarks.ts).
 *
 * WHY THIS FILE EXISTS: the join has one job — never attribute one model's
 * benchmark to another. Every bug it has had was silent: a plausible-looking
 * number on a page, with nothing failing. A Codex review flagged that the
 * truth table below was protected by nothing but careful reading.
 *
 * Uses node:test — built in, so this adds no dependency. Run: npm test
 * The module is bundled with esbuild because it is TypeScript; `fetch` is
 * stubbed so no network is touched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const HEADER = [
  'original_task_name', 'Model', 'id_model_version', 'Unique display name',
  'best_score', 'mean_score', 'stderr', 'started_at',
].join(',');

const TASK = 'GPQA diamond';
const TASK2 = 'SWE-Bench verified';

/** Build one CSV row in HEADER order. */
function row({ task = TASK, model, version, unique = '', best, started = '2026-01-01' }) {
  return [task, model, version, unique, best, best, '0.01', started].join(',');
}

function csv(rows) {
  return [HEADER, ...rows].join('\n') + '\n';
}

// Bundle once; each test re-imports with a cache-busting query so the stubbed
// fetch of that test is the one the module sees.
const dir = mkdtempSync(join(tmpdir(), 'bench-test-'));
const bundlePath = join(dir, 'benchmarks.mjs');
const out = await build({
  entryPoints: ['src/benchmarks.ts'],
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
writeFileSync(bundlePath, out.outputFiles[0].text);

let n = 0;
async function run(csvText) {
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => csvText });
  const { fetchBenchmarks } = await import(`${pathToFileURL(bundlePath).href}?n=${n++}`);
  return fetchBenchmarks();
}

const scoreOf = (p, id, bId = 'gpqa_diamond') =>
  p.models.find((m) => m.modelId === id)?.scores.find((s) => s.benchmarkId === bId)?.score;

// ── Effort variants: merged on purpose ───────────────────────────────────────

test('effort variants of one model merge, keeping the best score', async () => {
  const p = await run(csv([
    row({ model: 'GPT-5.4', version: 'gpt-5.4-2026-03-05_low', best: '0.60' }),
    row({ model: 'GPT-5.4', version: 'gpt-5.4-2026-03-05_high', best: '0.80' }),
    row({ model: 'GPT-5.4', version: 'gpt-5.4-2026-03-05_xhigh', best: '0.70' }),
  ]));
  assert.equal(scoreOf(p, 'openai/gpt-5.4'), 0.8, 'keeps the best effort');
  assert.equal(p.ambiguous.length, 0, 'effort variants are not ambiguous');
  assert.equal(p.models[0].versions.length, 1, 'only the winning row is recorded');
});

test('context-window variants (_32K, _64K) also merge', async () => {
  const p = await run(csv([
    row({ model: 'Claude Opus 4.6', version: 'claude-opus-4-6_32K', best: '0.50' }),
    row({ model: 'Claude Opus 4.6', version: 'claude-opus-4-6_64K', best: '0.55' }),
    row({ model: 'Claude Opus 4.6', version: 'claude-opus-4-6', best: '0.52' }),
  ]));
  assert.equal(scoreOf(p, 'anthropic/claude-opus-4.6'), 0.55);
  assert.equal(p.ambiguous.length, 0);
});

// ── Distinct snapshots: never merged ─────────────────────────────────────────

test('an UNPINNED name spanning two real versions is dropped, not merged', async () => {
  // Kimi K2.6 is mapped but has no VERSION_PIN. Two distinct snapshots must not
  // produce a chimera; they must surface in ambiguous[] so a pin gets added.
  const p = await run(csv([
    row({ model: 'Kimi K2.6', version: 'kimi-k2.6-0711', best: '0.40' }),
    row({ model: 'Kimi K2.6', version: 'kimi-k2.6-0930', best: '0.90' }),
  ]));
  assert.equal(scoreOf(p, 'moonshotai/kimi-k2.6'), undefined, 'no score attributed');
  assert.deepEqual(
    p.ambiguous.find((a) => a.model === 'Kimi K2.6')?.versions,
    ['kimi-k2.6-0711', 'kimi-k2.6-0930'],
  );
});

test('a PINNED name takes only its pinned version, across benchmarks', async () => {
  // The original chimera: GPQA from 2411, OTIS from 2407, welded into one record.
  const p = await run(csv([
    row({ model: 'Mistral Large 2', version: 'mistral-large-2411', best: '0.5133' }),
    row({ model: 'Mistral Large 2', version: 'mistral-large-2407', best: '0.4902' }),
  ]));
  assert.equal(scoreOf(p, 'mistralai/mistral-large-2407'), 0.4902, 'takes 2407 despite 2411 scoring higher');
  assert.equal(p.ambiguous.length, 0);
});

test('a PINNED name is gated even when only ONE version is present', async () => {
  // The fail-open hole: if Epoch drops the pinned snapshot the name stops
  // colliding, and a collision-only gate would wave the wrong rows through.
  const p = await run(csv([
    row({ model: 'Mistral Large 2', version: 'mistral-large-2411', best: '0.5133' }),
  ]));
  assert.equal(scoreOf(p, 'mistralai/mistral-large-2407'), undefined, 'must NOT accept 2411');
  assert.deepEqual(
    p.ambiguous.find((a) => a.model === 'Mistral Large 2')?.versions,
    ['mistral-large-2411'],
  );
});

test('a pinned name spanning a harness variant keeps only the plain version', async () => {
  // Gemini 3.1 Pro: the -customtools rows are a SEPARATE OpenRouter model.
  const p = await run(csv([
    row({ model: 'Gemini 3.1 Pro', version: 'gemini-3.1-pro-preview', best: '0.941' }),
    row({ task: TASK2, model: 'Gemini 3.1 Pro', version: 'gemini-3.1-pro-preview-customtools', best: '0.756' }),
  ]));
  assert.equal(scoreOf(p, 'google/gemini-3.1-pro-preview'), 0.941);
  assert.equal(
    scoreOf(p, 'google/gemini-3.1-pro-preview', 'swe_bench_verified'), undefined,
    'the customtools SWE-bench score is not ours to attribute here',
  );
});

// ── Malformed / missing version metadata: fail closed ────────────────────────

test('a blank id_model_version never scores, in either pass', async () => {
  const p = await run(csv([
    row({ model: 'Kimi K2.6', version: '', best: '0.99' }),
  ]));
  assert.equal(scoreOf(p, 'moonshotai/kimi-k2.6'), undefined, 'unidentifiable row must not score');
});

test('a blank version cannot sneak past alongside a good row', async () => {
  const p = await run(csv([
    row({ model: 'Kimi K2.6', version: 'kimi-k2.6-0711', best: '0.40' }),
    row({ task: TASK2, model: 'Kimi K2.6', version: '', best: '0.99' }),
  ]));
  assert.equal(scoreOf(p, 'moonshotai/kimi-k2.6'), 0.40);
  assert.equal(scoreOf(p, 'moonshotai/kimi-k2.6', 'swe_bench_verified'), undefined);
});

test('a missing id_model_version COLUMN throws rather than joining on name', async () => {
  // Dropping to a name-only join would silently re-create every chimera. The
  // caller treats benchmark errors as non-fatal, so KV keeps its last good copy.
  const noVersionCol = 'original_task_name,Model,best_score\n'
    + `${TASK},Mistral Large 2,0.5133\n`;
  await assert.rejects(() => run(noVersionCol), /missing id_model_version/);
});

// ── Ordering ─────────────────────────────────────────────────────────────────

test('a collision appearing LATE in the file still gates earlier rows', async () => {
  // Pass 1 must complete before any score is kept; otherwise row order decides
  // correctness, which is the worst kind of flake.
  const filler = Array.from({ length: 50 }, () =>
    row({ model: 'Claude Opus 4.6', version: 'claude-opus-4-6', best: '0.50' }));
  const p = await run(csv([
    row({ model: 'Kimi K2.6', version: 'kimi-k2.6-0711', best: '0.40' }),
    ...filler,
    row({ model: 'Kimi K2.6', version: 'kimi-k2.6-0930', best: '0.90' }),
  ]));
  assert.equal(scoreOf(p, 'moonshotai/kimi-k2.6'), undefined, 'late collision still drops the model');
});

// ── Unmapped names ───────────────────────────────────────────────────────────

test('an unmapped Epoch name is reported, never guessed at', async () => {
  const p = await run(csv([
    row({ model: 'Some Brand New Model', version: 'sbnm-1', best: '0.7' }),
  ]));
  assert.equal(p.models.length, 0);
  assert.deepEqual(p.unmapped, ['Some Brand New Model']);
});
