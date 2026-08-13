/**
 * Deploy preflight.
 *
 * WHY THIS EXISTS: `wrangler deploy` has twice died mid-run with a twenty-line
 * stack trace out of undici's internals — `mixinBody is not a function` from
 * lib/web/fetch/response.js, and a second variant from lib/dispatcher/h2c-client.js.
 * Both times `npm ci` fixed it. Both times the message said nothing about that.
 *
 * The root cause is NOT known. Falsified on 2026-08-13, so nobody repeats them:
 * git hooks (none installed, core.hooksPath unset), `npm test`, the esbuild
 * preview builds, `tsc`, and npm run from the worktree through a symlinked
 * node_modules — none mutate node_modules/undici (byte-identical before/after).
 * There is one undici (7.24.4, via wrangler → miniflare), and `npm ci` is
 * idempotent on a healthy tree. Whatever breaks it was not reproducible.
 *
 * So this does not pretend to fix it. It converts a confusing failure into an
 * actionable one, and writes a snapshot so the NEXT occurrence is diagnosable
 * instead of being cleared away by the `npm ci` reflex.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const problems = [];
const snapshot = {};

// 1. undici — the failure actually seen. Importing it is the same thing wrangler
//    does on startup, so this reproduces the break before the upload begins.
try {
  await import('undici');
  snapshot.undici = require('undici/package.json').version;
} catch (err) {
  snapshot.undiciError = String(err && err.message);
  problems.push(
    'undici failed to load — this is the failure that has killed two deploys.\n' +
    '    ' + String(err && err.message) + '\n' +
    '    Fix: npm ci'
  );
}

// 2. workerd's binary. npm 11 blocks install scripts by default (it warns
//    "allow-scripts ... workerd postinstall"), so a fresh clone can end up with
//    the package present and the binary missing — a different failure that also
//    surfaces late and unhelpfully.
try {
  const wd = require.resolve('workerd/package.json');
  snapshot.workerd = require(wd).version;
  if (!existsSync(new URL('../node_modules/.bin/workerd', import.meta.url))) {
    problems.push('workerd binary missing from node_modules/.bin — its postinstall may have been blocked.\n    Fix: npm ci, then npm approve-scripts workerd if it persists');
  }
} catch {
  problems.push('workerd is not installed.\n    Fix: npm ci');
}

// 3. wrangler.toml is gitignored (it carries KV/D1 ids), so a fresh clone has
//    none and the failure is otherwise a confusing config error.
if (!existsSync(new URL('../wrangler.toml', import.meta.url))) {
  problems.push('wrangler.toml is missing — it is gitignored.\n    Fix: copy wrangler.toml.example and fill in the KV namespace and D1 database ids');
}

if (problems.length === 0) {
  console.log(`preflight ok — undici ${snapshot.undici}, workerd ${snapshot.workerd}`);
  process.exit(0);
}

// Evidence for next time. The npm ci reflex destroys the broken tree, which is
// why two occurrences produced no diagnosis; capture it before that happens.
snapshot.when = new Date().toISOString();
snapshot.node = process.version;
try {
  writeFileSync(new URL('../preflight-failure.json', import.meta.url), JSON.stringify(snapshot, null, 2));
} catch { /* diagnostics are best-effort — never block on them */ }

console.error('\nDeploy preflight FAILED — not deploying.\n');
for (const p of problems) console.error('  • ' + p + '\n');
console.error('  Snapshot written to preflight-failure.json (gitignored). Attach it if this recurs.\n');
process.exit(1);
