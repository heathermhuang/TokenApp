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
 * THE STUB MODELS D1's FILTERING ON PURPOSE. An earlier version returned a fixed
 * series no matter what SQL it was handed, and that hid a real bug: readSeries
 * computes its cutoff from `Date.now()` unless given an upper anchor, so once the
 * cron had been down longer than the window, every row fell outside the cutoff and
 * every panel blanked — while the test asserting the opposite still passed. A stub
 * that ignores the query can only ever confirm what you already believe, so this
 * one holds raw snapshot rows and applies the cutoff, the upper bound and the
 * last-row-per-day rule the way the real SQL does.
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

const DAY = 86400_000;
const iso = (ms) => new Date(ms).toISOString();

/**
 * Raw snapshot rows, one per day, ending on `lastDay` at `hour`. This is the
 * table's real shape — snapshot_at carries a time, which is the whole reason a
 * day-granularity freshness check was not enough.
 */
function rows(identifier, lastDay, n, { rank = 3, from = 100, step = 10, hour = 'T09:00:00.000Z' } = {}) {
  const end = new Date(lastDay + 'T00:00:00Z').getTime();
  return Array.from({ length: n }, (_, i) => {
    const day = iso(end - (n - 1 - i) * DAY).slice(0, 10);
    return { identifier, snapshot_at: day + hour, snapshot_day: day, tokens: from + i * step, rank };
  });
}

/**
 * D1 stub that actually answers the queries it is given. readModelUsage issues
 * two: the board anchor (a CTE, via .first()) and the per-model series (via
 * .all()). Both are served from the same raw rows so the two cannot disagree.
 */
function db(allRows) {
  return {
    RANKINGS_DB: {
      prepare(sql) {
        const isBoard = sql.includes('WITH latest');
        const hasUpper = sql.includes('snapshot_at <= ?');
        let binds = [];
        return {
          bind(...args) { binds = args; return this; },

          async first() {
            if (!isBoard || allRows.length === 0) return isBoard ? { at: null, n: 0, rank: null } : null;
            const at = allRows.reduce((m, r) => (r.snapshot_at > m ? r.snapshot_at : m), allRows[0].snapshot_at);
            const atRows = allRows.filter((r) => r.snapshot_at === at);
            const mine = atRows.find((r) => r.identifier === binds[0]);
            return { at, n: atRows.length, rank: mine ? mine.rank : null };
          },

          async all() {
            // readSeries binds [kind, period, cutoff, (upper), ...identifiers].
            const cutoff = binds[2];
            const upper = hasUpper ? binds[3] : null;
            const ids = binds.slice(hasUpper ? 4 : 3);
            const kept = allRows.filter((r) =>
              ids.includes(r.identifier) &&
              r.snapshot_at >= cutoff &&
              (upper === null || r.snapshot_at <= upper));
            // ROW_NUMBER() OVER (PARTITION BY identifier, snapshot_day ORDER BY snapshot_at DESC) = 1
            const lastPerDay = new Map();
            for (const r of kept) {
              const key = r.identifier + '|' + r.snapshot_day;
              const cur = lastPerDay.get(key);
              if (!cur || r.snapshot_at > cur.snapshot_at) lastPerDay.set(key, r);
            }
            const results = [...lastPerDay.values()]
              .sort((a, b) => (a.snapshot_day < b.snapshot_day ? -1 : 1))
              .map((r) => ({ identifier: r.identifier, day: r.snapshot_day, tokens: r.tokens, rank: r.rank }));
            return { results };
          },
        };
      },
    },
  };
}

const ME = 'x/model';
const OTHER = 'y/other';
const TODAY = '2026-08-12';

test('a model on the current board returns its series', async () => {
  const u = await readModelUsage(db(rows(ME, TODAY, 10)), ME);
  assert.ok(u, 'expected a usage payload');
  assert.equal(u.points.length, 10);
  assert.equal(u.latestDay, TODAY);
  assert.equal(u.latestRank, 3);
  assert.equal(u.boardSize, 1);
});

test('a series that stops weeks ago is DROPPED, not drawn as current', async () => {
  // The laguna-m.1 case: 11 real points, none recent, while the board moved on.
  const all = [...rows(ME, '2026-07-22', 11), ...rows(OTHER, TODAY, 5)];
  assert.equal(await readModelUsage(db(all), ME), null,
    'a three-week-old series must not render as a current trend');
});

test('a model that charted this morning but is off the LATEST snapshot is dropped', async () => {
  // The gap a day-granularity check leaks through: the board is scraped hourly,
  // so this model has a row dated today — taken at 09:00, before it dropped out.
  // The newest snapshot is 10:00 and does not contain it, so its rank is stale.
  const all = [
    ...rows(ME, TODAY, 8, { hour: 'T09:00:00.000Z' }),
    ...rows(OTHER, TODAY, 8, { hour: 'T09:00:00.000Z' }),
    { identifier: OTHER, snapshot_at: TODAY + 'T10:00:00.000Z', snapshot_day: TODAY, tokens: 999, rank: 1 },
  ];
  assert.equal(await readModelUsage(db(all), ME), null,
    'same-day is not the same as still-ranked');
});

test('the model still on the latest snapshot renders in that same situation', async () => {
  // Control for the test above: identical data, asking about the model that IS
  // in the 10:00 snapshot. Without this, the gate could reject everything and
  // still look correct.
  const all = [
    ...rows(ME, TODAY, 8, { hour: 'T09:00:00.000Z' }),
    ...rows(OTHER, TODAY, 8, { hour: 'T09:00:00.000Z' }),
    { identifier: OTHER, snapshot_at: TODAY + 'T10:00:00.000Z', snapshot_day: TODAY, tokens: 999, rank: 1 },
  ];
  const u = await readModelUsage(db(all), OTHER);
  assert.ok(u, 'the still-ranked model must render');
  assert.equal(u.latestRank, 1);
  assert.equal(u.latestTokens, 999, 'the newest row of the day wins, not the 09:00 one');
});

test('freshness is measured against the BOARD, not the wall clock', async () => {
  // Cron down for ~40 days, which is LONGER than the 30-day window. If the series
  // cutoff were computed from Date.now(), every row would fall outside it and the
  // panel would blank — the exact bug a query-ignoring stub could not see.
  const stalled = iso(Date.now() - 40 * DAY).slice(0, 10);
  const u = await readModelUsage(db(rows(ME, stalled, 6)), ME);
  assert.ok(u, 'a stalled cron must not blank every model');
  assert.equal(u.points.length, 6);
});

test('the window still bounds history when the board is current', async () => {
  // 45 days of history, 30-day window: the oldest points must be excluded, or the
  // board anchor would have quietly turned the window off.
  const u = await readModelUsage(db(rows(ME, TODAY, 45)), ME, 30);
  assert.ok(u);
  assert.ok(u.points.length <= 31, `window not applied: got ${u.points.length} points`);
  assert.equal(u.points[u.points.length - 1].day, TODAY);
});

test('a single point is not a trend', async () => {
  assert.equal(await readModelUsage(db(rows(ME, TODAY, 1)), ME), null);
});

test('no history at all returns null rather than throwing', async () => {
  assert.equal(await readModelUsage(db([]), ME), null);
});

test('a model absent from a populated board returns null', async () => {
  assert.equal(await readModelUsage(db(rows(OTHER, TODAY, 10)), ME), null);
});

test('the reported rank comes from the current snapshot', async () => {
  const all = rows(ME, TODAY, 6, { rank: 4 });
  all[all.length - 1].rank = 2;          // promoted in the newest snapshot
  const u = await readModelUsage(db(all), ME);
  assert.equal(u.latestRank, 2);
});

test('boardSize counts the models in the latest snapshot', async () => {
  const all = [...rows(ME, TODAY, 4), ...rows(OTHER, TODAY, 4), ...rows('z/third', TODAY, 4)];
  const u = await readModelUsage(db(all), ME);
  assert.equal(u.boardSize, 3);
});

test('the 7-day delta compares against a point ~7 days back', async () => {
  // 10 days, 2026-08-03..08-12, tokens 100,110,…,190. Latest is 08-12 at 190;
  // seven days earlier is 08-05, which carries 120 — NOT the 130 on 08-06. The
  // comparison anchors on the last point at-or-before the target day, so a gap in
  // the history reaches further back rather than silently shortening the window.
  const u = await readModelUsage(db(rows(ME, TODAY, 10)), ME);
  assert.ok(u.delta, 'expected a delta');
  assert.equal(u.latestTokens, 190);
  assert.equal(u.points[2].day, '2026-08-05');
  assert.ok(Math.abs(u.delta.pctChange - (190 - 120) / 120) < 1e-9,
    `pctChange was ${u.delta.pctChange}`);
});

test('too little history emits NO delta rather than a guess', async () => {
  const u = await readModelUsage(db(rows(ME, TODAY, 3)), ME);
  assert.ok(u, 'three points still draw a sparkline');
  assert.equal(u.delta, null, 'but there is no honest 7-day delta to report');
});

test('a rank move is reported in the direction a human reads it', async () => {
  // Rank 8 seven days ago → rank 3 today is an IMPROVEMENT of 5 places.
  const all = rows(ME, TODAY, 10);
  for (const r of all) if (r.snapshot_day <= '2026-08-05') r.rank = 8;
  const u = await readModelUsage(db(all), ME);
  assert.equal(u.delta.rankChange, 5, 'positive means moved up');
});

test('a D1 failure omits the panel instead of 500ing the page', async () => {
  const broken = { RANKINGS_DB: { prepare() { throw new Error('D1 unavailable'); } } };
  assert.equal(await readModelUsage(broken, ME), null);
});
