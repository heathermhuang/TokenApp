/**
 * Regression tests for the history gate on category-scoped app boards
 * (countAppDaysInRange -> getRankings in src/fetchers.ts).
 *
 * WHY THIS FILE EXISTS: the gate exists so a 1-day SUM is never labelled "7D"
 * (the 2026-05-28 fake-7D bug). But on a CATEGORY board it counted zero days
 * forever, so those boards stayed empty no matter how much history accumulated.
 * The cause was bind ORDER, not a missing clause: the SQL read
 *   ... AND category = ? AND snapshot_at >= ?
 * while the binds were [cutoff, category], so D1 compared the category column
 * against an ISO timestamp and the window against a slug. Measured against prod
 * on 2026-09-21: as bound, 0 days; as intended, 7. The global board (category IS
 * NULL, one placeholder) was unaffected, which is why it went unnoticed.
 *
 * THE STUB MAPS EACH `?` TO ITS BOUND VALUE BY POSITION. That is the whole point
 * here: a stub that reads the SQL but assumes which value belongs to which
 * placeholder cannot see this bug — it would pass against the broken order. So
 * it walks the query text, pairs every placeholder with the comparison directly
 * to its left, and filters with the values in the order they were bound.
 *
 * Uses node:test; the TypeScript module is bundled with esbuild and D1/KV are
 * stubbed, so nothing touches network or disk.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Same reason as usage.test.mjs: @cloudflare/puppeteer only exists in the
// Workers runtime, and this read never touches the browser path.
const stubPuppeteer = {
  name: 'stub-puppeteer',
  setup(b) {
    b.onResolve({ filter: /^@cloudflare\/puppeteer$/ }, () => ({ path: 'stub', namespace: 'puppeteer-stub' }));
    b.onLoad({ filter: /.*/, namespace: 'puppeteer-stub' }, () => ({ contents: 'export default {};', loader: 'js' }));
  },
};

const dir = mkdtempSync(join(tmpdir(), 'category-history-test-'));
const out = await build({
  entryPoints: ['src/fetchers.ts'],
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  plugins: [stubPuppeteer],
});
const bundlePath = join(dir, 'fetchers.mjs');
writeFileSync(bundlePath, out.outputFiles[0].text);
const { getRankings } = await import(pathToFileURL(bundlePath).href);

const DAY = 86400_000;

/**
 * `n` daily app rows ending today, one per calendar day — the shape the cron
 * writes. `category` is null for the global board and a slug for a category one.
 */
function appRows(identifier, n, { category = null, tokens = 1000, endOffsetDays = 0 } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const at = new Date(Date.now() - (endOffsetDays + n - 1 - i) * DAY);
    const iso = at.toISOString();
    return {
      kind: 'app', period: 'day', category, identifier,
      snapshot_at: iso, snapshot_day: iso.slice(0, 10),
      name: null, description: identifier + ' desc', origin_url: 'https://e.example',
      favicon_url: null, total_tokens: tokens + i,
    };
  });
}

/**
 * Pair every `?` with the comparison immediately to its left, taking values in
 * bind order. Mis-ordered binds therefore filter on the wrong columns here
 * exactly as they do in D1.
 */
function placeholderPredicates(sql, binds) {
  const chunks = sql.split('?');
  return chunks.slice(0, -1).map((before, i) => {
    const m = before.match(/([a-z_]+)\s*(>=|<=|<>|!=|=|>|<)\s*$/i);
    assert.ok(m, `stub could not map placeholder ${i} in: ${sql}`);
    return { col: m[1], op: m[2], value: binds[i] };
  });
}

function satisfies(row, { col, op, value }) {
  const have = row[col];
  if (have == null || value == null) return false;
  switch (op) {
    case '=': return have === value;
    case '>=': return have >= value;
    case '<=': return have <= value;
    case '>': return have > value;
    case '<': return have < value;
    default: return false;
  }
}

/** Literal (non-placeholder) predicates the query pins itself. */
function literalPredicates(sql) {
  const preds = [];
  for (const [, col, val] of sql.matchAll(/([a-z_]+)\s*=\s*'([^']+)'/gi)) preds.push((r) => r[col] === val);
  if (/category\s+IS\s+NULL/i.test(sql)) preds.push((r) => r.category == null);
  return preds;
}

/**
 * D1 stub. It answers the two app queries this path depends on — the history
 * COUNT and the window aggregate — from one set of raw rows, and returns empty
 * for the model-board queries (readLatestModels, attachTrends, snapshotAtBefore),
 * which this gate does not involve.
 */
function env(allRows) {
  return {
    TOKEN_APP_KV: { get: async () => null, put: async () => {} },
    RANKINGS_DB: {
      prepare(sql) {
        let binds = [];
        const keep = () => {
          const preds = placeholderPredicates(sql, binds);
          const lits = literalPredicates(sql);
          return allRows.filter((r) => preds.every((p) => satisfies(r, p)) && lits.every((f) => f(r)));
        };
        return {
          bind(...args) { binds = args; return this; },

          async first() {
            if (/COUNT\(DISTINCT snapshot_day\)/i.test(sql)) {
              return { n: new Set(keep().map((r) => r.snapshot_day)).size };
            }
            return null; // model-board anchor / snapshotAtBefore
          },

          async all() {
            if (!/WITH daily_last/i.test(sql)) return { results: [] };
            // ROW_NUMBER() ... PARTITION BY identifier, snapshot_day ORDER BY
            // snapshot_at DESC, rn = 1 -> last row of each day, then SUM per id.
            const lastPerDay = new Map();
            for (const r of keep()) {
              const key = r.identifier + '|' + r.snapshot_day;
              const cur = lastPerDay.get(key);
              if (!cur || r.snapshot_at > cur.snapshot_at) lastPerDay.set(key, r);
            }
            const totals = new Map();
            for (const r of lastPerDay.values()) {
              const t = totals.get(r.identifier) || { identifier: r.identifier, name: r.name, description: r.description, origin_url: r.origin_url, favicon_url: r.favicon_url, total: 0 };
              t.total += r.total_tokens;
              totals.set(r.identifier, t);
            }
            return { results: [...totals.values()].sort((a, b) => b.total - a.total).slice(0, 20) };
          },
        };
      },
    },
  };
}

const CAT = 'cli-agent';

test('a category board with 7 days of history reports them and aggregates', async () => {
  // The bug in one assertion: these rows ARE 7 distinct days of cli-agent
  // history, so the 7D board must light up rather than report zero forever.
  const r = await getRankings(env(appRows('Cline', 7, { category: CAT })), 'week', undefined, CAT);
  assert.equal(r.appsHistoryDays, 7, 'the gate must see the category rows');
  assert.equal(r.appsHistoryRequired, 7);
  assert.equal(r.topApps.week.length, 1, 'the aggregate must run once the gate passes');
  assert.equal(r.topApps.week[0].title, 'Cline');
});

test('other categories and the global board do not pad a category count', async () => {
  // Guards the fix that "works" by dropping the category predicate: the other
  // rows sit on days the target category has no history for, so ignoring the
  // predicate would count days this category never charted on.
  const rows = [
    ...appRows('Cline', 5, { category: CAT }),
    ...appRows('Cursor', 4, { category: 'ide-extension', endOffsetDays: 5 }),
    ...appRows('Roo', 4, { category: null, endOffsetDays: 5 }),
  ];
  const r = await getRankings(env(rows), 'week', undefined, CAT);
  assert.equal(r.appsHistoryDays, 5, 'only the requested category counts');
  assert.equal(r.topApps.week.length, 0, '5 days is short of 7, so the board stays gated');
});

test('the gate still blocks a short category history', async () => {
  // The gate is the point of the function; a fix that just removes it would
  // label a 3-day SUM as "7D" — the fake-7D bug this code exists to prevent.
  const r = await getRankings(env(appRows('Cline', 3, { category: CAT })), 'week', undefined, CAT);
  assert.equal(r.appsHistoryDays, 3);
  assert.equal(r.topApps.week.length, 0);
});

test('the 30-day board counts the same history against its own threshold', async () => {
  const rows = appRows('Cline', 10, { category: CAT });
  const r = await getRankings(env(rows), 'month', undefined, CAT);
  assert.equal(r.appsHistoryDays, 10);
  assert.equal(r.appsHistoryRequired, 30);
  assert.equal(r.topApps.month.length, 0, '10 days is short of 30');
});

test('the global board still counts its own rows', async () => {
  // Control: the global path binds one placeholder and was never broken. If a
  // fix swapped the clauses without re-ordering the binds, this would break.
  const rows = [
    ...appRows('Roo', 7, { category: null }),
    ...appRows('Cline', 4, { category: CAT, endOffsetDays: 7 }),
  ];
  const r = await getRankings(env(rows), 'week', undefined, null);
  assert.equal(r.appsHistoryDays, 7, 'category rows must not pad the global count');
  assert.equal(r.topApps.week.length, 1);
  assert.equal(r.topApps.week[0].title, 'Roo');
});

test('category rows INSIDE the window do not pad the global count', async () => {
  // The control above cannot see `category IS NULL` go missing: its category
  // rows are 7-10 days old, so the cutoff excludes them anyway and dropping the
  // predicate changes nothing (Codex review, P2). Here the category rows sit
  // inside the window, on days the global board never charted, so only the
  // predicate itself keeps them out of the count.
  const rows = [
    ...appRows('Roo', 5, { category: null }),
    ...appRows('Cline', 7, { category: CAT }),
  ];
  const r = await getRankings(env(rows), 'week', undefined, null);
  assert.equal(r.appsHistoryDays, 5, 'only global rows count toward the global board');
  assert.equal(r.topApps.week.length, 0, '5 global days is short of 7, so it stays gated');
});

test('history outside the window does not unlock the board', async () => {
  // Nothing else here can see `snapshot_at >= ?` go missing: every other fixture
  // row sits inside its window (Codex review, P2). These 10 days of cli-agent
  // history ended 20 days ago, so a board that renders from them is reporting a
  // "7D" total built out of three-week-old snapshots.
  const r = await getRankings(env(appRows('Cline', 10, { category: CAT, endOffsetDays: 20 })), 'week', undefined, CAT);
  assert.equal(r.appsHistoryDays, 0, 'stale days must not count toward the window');
  assert.equal(r.topApps.week.length, 0);
});

test('only the in-window days of a longer category history count', async () => {
  // Same predicate from the other side: recent history passes the gate, but the
  // older run must not inflate the count past what the window holds.
  const rows = [
    ...appRows('Cline', 7, { category: CAT }),
    ...appRows('Cline', 10, { category: CAT, endOffsetDays: 20 }),
  ];
  const r = await getRankings(env(rows), 'week', undefined, CAT);
  assert.equal(r.appsHistoryDays, 7, 'the 10 stale days must not be counted');
  assert.equal(r.topApps.week.length, 1);
});
