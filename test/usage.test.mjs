/**
 * Regression tests for the per-model usage read (readModelUsage in src/fetchers.ts).
 *
 * WHY THIS FILE EXISTS: the panel it feeds makes a claim in the present tense —
 * "this model is #3 with 1.4T tokens this week". D1 only ever holds OpenRouter's
 * top-15 board, so a model that drops off simply STOPS accumulating rows, and its
 * last point can be weeks old (measured in prod: poolside/laguna-m.1 stops at
 * 2026-07-22). Drawing that as a current trend is the 2026-05-28 fake-7D bug in
 * new clothes: nothing errors, the chart just quietly lies.
 *
 * The freshness gate is therefore the whole point of this file, along with the
 * rule that we never draw a trend from a single point.
 *
 * Uses node:test — no dependency added. The module is bundled with esbuild
 * because it is TypeScript, and D1 is stubbed, so nothing touches network or disk.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// fetchers.ts imports @cloudflare/puppeteer, which only exists inside the Workers
// runtime. Stub it at bundle time rather than marking it external: external would
// leave a bare import that Node cannot resolve from a temp dir, and the usage read
// never touches the browser path anyway.
const stubPuppeteer = {
  name: 'stub-puppeteer',
  setup(b) {
    b.onResolve({ filter: /^@cloudflare\/puppeteer$/ }, () => ({ path: 'stub', namespace: 'puppeteer-stub' }));
    b.onLoad({ filter: /.*/, namespace: 'puppeteer-stub' }, () => ({ contents: 'export default {};', loader: 'js' }));
  },
};

const dir = mkdtempSync(join(tmpdir(), 'usage-test-'));
const out = await build({
  entryPoints: ['src/fetchers.ts'],
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  plugins: [stubPuppeteer],
});
const bundlePath = join(dir, 'fetchers.mjs');
writeFileSync(bundlePath, out.outputFiles[0].text);
const { readModelUsage } = await import(pathToFileURL(bundlePath).href);

/**
 * Minimal D1 stub. readModelUsage issues exactly two shapes of query — the board
 * anchor (.first()) and the per-model series (.all()) — so dispatch on which one
 * the SQL is asking for rather than trying to parse it.
 */
function db({ boardAt, boardSize = 15, series = [] }) {
  return {
    RANKINGS_DB: {
      prepare(sql) {
        const isBoard = sql.includes('MAX(snapshot_at)');
        return {
          bind() { return this; },
          async first() { return isBoard ? { at: boardAt, n: boardSize } : null; },
          async all() { return { results: series }; },
        };
      },
    },
  };
}

/** N daily points ending on `lastDay`, ascending, at a fixed rank. */
function points(lastDay, n, { rank = 3, from = 100, step = 10 } = {}) {
  const end = new Date(lastDay + 'T00:00:00Z').getTime();
  return Array.from({ length: n }, (_, i) => ({
    identifier: 'x/model',
    day: new Date(end - (n - 1 - i) * 86400_000).toISOString().slice(0, 10),
    tokens: from + i * step,
    rank,
  }));
}

const BOARD_AT = '2026-08-12T09:00:00.000Z';
const BOARD_DAY = '2026-08-12';

test('a model on the current board returns its series', async () => {
  const u = await readModelUsage(db({ boardAt: BOARD_AT, series: points(BOARD_DAY, 10) }), 'x/model');
  assert.ok(u, 'expected a usage payload');
  assert.equal(u.points.length, 10);
  assert.equal(u.latestDay, BOARD_DAY);
  assert.equal(u.latestRank, 3);
  assert.equal(u.boardSize, 15);
});

test('a series that stops weeks ago is DROPPED, not drawn as current', async () => {
  // The laguna-m.1 case: 11 real points, none of them recent.
  const stale = points('2026-07-22', 11);
  const u = await readModelUsage(db({ boardAt: BOARD_AT, series: stale }), 'x/model');
  assert.equal(u, null, 'a three-week-old series must not render as a current trend');
});

test('one day of lag still counts as fresh — a cron can slip', async () => {
  const u = await readModelUsage(db({ boardAt: BOARD_AT, series: points('2026-08-11', 5) }), 'x/model');
  assert.ok(u, 'yesterday is not stale');
});

test('the gate is exactly 2 days: day-2 passes, day-3 does not', async () => {
  const ok = await readModelUsage(db({ boardAt: BOARD_AT, series: points('2026-08-10', 5) }), 'x/model');
  assert.ok(ok, 'boardDay-2 is the last fresh day');
  const no = await readModelUsage(db({ boardAt: BOARD_AT, series: points('2026-08-09', 5) }), 'x/model');
  assert.equal(no, null, 'boardDay-3 is stale');
});

test('freshness is measured against the BOARD, not the wall clock', async () => {
  // Cron has been down for a month: the board itself is old. Every model is then
  // equally old, and calling them all stale would empty every panel at once. The
  // model is still the most recent thing the board knows about, so it renders.
  const oldBoard = '2026-07-01T09:00:00.000Z';
  const u = await readModelUsage(db({ boardAt: oldBoard, series: points('2026-07-01', 6) }), 'x/model');
  assert.ok(u, 'a stalled cron must not blank every model');
});

test('a single point is not a trend', async () => {
  const u = await readModelUsage(db({ boardAt: BOARD_AT, series: points(BOARD_DAY, 1) }), 'x/model');
  assert.equal(u, null);
});

test('no history at all returns null rather than throwing', async () => {
  const u = await readModelUsage(db({ boardAt: BOARD_AT, series: [] }), 'x/model');
  assert.equal(u, null);
});

test('an empty board returns null — nothing to anchor freshness against', async () => {
  const u = await readModelUsage(db({ boardAt: null, series: points(BOARD_DAY, 10) }), 'x/model');
  assert.equal(u, null);
});

test('the 7-day delta compares against a point ~7 days back', async () => {
  // 10 days, 2026-08-03..08-12, tokens 100,110,…,190. Latest is 08-12 at 190;
  // seven days earlier is 08-05, which carries 120 — NOT the 130 on 08-06. The
  // comparison anchors on the last point at-or-before the target day, so a gap in
  // the history reaches further back rather than silently shortening the window.
  const u = await readModelUsage(db({ boardAt: BOARD_AT, series: points(BOARD_DAY, 10) }), 'x/model');
  assert.ok(u.delta, 'expected a delta');
  assert.equal(u.latestTokens, 190);
  assert.equal(u.points[2].day, '2026-08-05');
  assert.ok(Math.abs(u.delta.pctChange - (190 - 120) / 120) < 1e-9,
    `pctChange was ${u.delta.pctChange}`);
});

test('too little history emits NO delta rather than a guess', async () => {
  // Three days cannot support a 7-day comparison.
  const u = await readModelUsage(db({ boardAt: BOARD_AT, series: points(BOARD_DAY, 3) }), 'x/model');
  assert.ok(u, 'three points still draw a sparkline');
  assert.equal(u.delta, null, 'but there is no honest 7-day delta to report');
});

test('a rank move is reported in the direction a human reads it', async () => {
  // Rank 8 seven days ago → rank 3 today is an IMPROVEMENT of 5 places.
  const s = points(BOARD_DAY, 10);
  for (const p of s) if (p.day <= '2026-08-05') p.rank = 8;
  const u = await readModelUsage(db({ boardAt: BOARD_AT, series: s }), 'x/model');
  assert.equal(u.delta.rankChange, 5, 'positive means moved up');
});

test('a D1 failure omits the panel instead of 500ing the page', async () => {
  const broken = { RANKINGS_DB: { prepare() { throw new Error('D1 unavailable'); } } };
  const u = await readModelUsage(broken, 'x/model');
  assert.equal(u, null);
});
