/**
 * Regression tests for the daily category scrape (fetchCategoryRankings in
 * src/fetchers.ts).
 *
 * WHY THIS FILE EXISTS: from 2026-11-23 the CLI Agents board stopped getting
 * rows while the other twelve kept updating. OpenRouter's cli-agent page keeps
 * a connection open, so `page.goto(..., { waitUntil: 'networkidle0' })` never
 * resolves and throws a TimeoutError after 30s. The loop's catch then skipped
 * the category, although by that point the page was fully rendered: running the
 * real extractor against it in Chrome found all 20 apps. So a goto TIMEOUT must
 * not discard a rendered page, while any OTHER goto error (DNS, reset) must still
 * skip it, because what is on screen then is whatever the previous page left.
 *
 * The browser is a stub that decides per URL how goto behaves and what the
 * page "shows", so nothing touches the network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const stubPuppeteer = {
  name: 'stub-puppeteer',
  setup(b) {
    b.onResolve({ filter: /^@cloudflare\/puppeteer$/ }, () => ({ path: 'stub', namespace: 'puppeteer-stub' }));
    b.onLoad({ filter: /.*/, namespace: 'puppeteer-stub' }, () => ({
      contents: 'export default { launch: (binding) => globalThis.__launch(binding) };',
      loader: 'js',
    }));
  },
};

const dir = mkdtempSync(join(tmpdir(), 'category-scrape-test-'));
const out = await build({
  entryPoints: ['src/fetchers.ts'],
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  plugins: [stubPuppeteer],
});
const bundlePath = join(dir, 'fetchers.mjs');
writeFileSync(bundlePath, out.outputFiles[0].text);
const { fetchCategoryRankings } = await import(pathToFileURL(bundlePath).href);

function named(name, message) {
  const e = new Error(message);
  e.name = name;
  return e;
}

const twoApps = (prefix) => [
  { rank: 1, title: prefix + ' One', description: '', totalTokens: 2e12, originUrl: '', faviconUrl: null },
  { rank: 2, title: prefix + ' Two', description: '', totalTokens: 1e12, originUrl: '', faviconUrl: null },
];

// slug -> how goto behaves, and what the page shows afterwards.
const PAGES = {
  'cli-agent':   { goto: () => Promise.reject(named('TimeoutError', 'Navigation timeout of 30000 ms exceeded')), apps: twoApps('Cli') },
  'cloud-agent': { goto: () => Promise.resolve(), apps: twoApps('Cloud') },
  // Timed out AND never rendered: the apps>0 guard must still skip it.
  'game':        { goto: () => Promise.reject(named('TimeoutError', 'Navigation timeout of 30000 ms exceeded')), apps: [] },
  // A non-timeout failure: the screen still holds the PREVIOUS page, so recording it would be wrong.
  'roleplay':    { goto: () => Promise.reject(new Error('net::ERR_CONNECTION_RESET')), apps: twoApps('Stale') },
};

async function scrape() {
  const visited = [];
  globalThis.__launch = async () => ({
    newPage: async () => {
      let current = null;
      return {
        setUserAgent: async () => {},
        setViewport: async () => {},
        goto: (url) => {
          const slug = url.split('/').pop();
          visited.push(slug);
          current = PAGES[slug] ?? { goto: () => Promise.resolve(), apps: [] };
          return current.goto();
        },
        evaluate: async () => ({ label: '', apps: current.apps }),
      };
    },
    close: async () => {},
  });
  // The loop sleeps 1.2s per page; run those immediately.
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => { fn(); return 0; };
  const errors = console.error;
  console.error = () => {};
  try {
    return { result: await fetchCategoryRankings({ BROWSER: {} }), visited };
  } finally {
    globalThis.setTimeout = realSetTimeout;
    console.error = errors;
  }
}

test('a goto TIMEOUT still records a page that rendered (cli-agent)', async () => {
  const { result } = await scrape();
  const cli = result.categories.find((c) => c.slug === 'cli-agent');
  assert.ok(cli, 'cli-agent must be recorded when the page rendered before the timeout');
  assert.deepEqual(cli.apps.map((a) => a.title), ['Cli One', 'Cli Two']);
});

test('a timed-out page that rendered nothing is still skipped', async () => {
  const { result } = await scrape();
  assert.equal(result.categories.find((c) => c.slug === 'game'), undefined);
});

test('a non-timeout goto error still skips the category', async () => {
  const { result } = await scrape();
  assert.equal(result.categories.find((c) => c.slug === 'roleplay'), undefined);
});

test('a normal page is unaffected, and one failure does not stop the loop', async () => {
  const { result, visited } = await scrape();
  assert.ok(result.categories.find((c) => c.slug === 'cloud-agent'));
  assert.ok(visited.includes('writing-assistant'), 'the loop must reach the last category');
});
