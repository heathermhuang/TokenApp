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
 *
 * Wired into `deploy` itself, not just `predeploy`: npm skips pre/post hooks
 * entirely under ignore-scripts, which would silently un-guard the command.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const problems = [];
const snapshot = { node: process.version };

// 1. The module graph wrangler actually walks. Importing bare `undici` would
//    test whichever copy npm happens to have hoisted to the root, which is only
//    the same thing by coincidence of the current tree; wrangler eagerly loads
//    miniflare, and miniflare resolves undici from its own position. Going
//    through miniflare keeps the probe honest if that ever nests. ~175ms.
// Resolve miniflare's own require BEFORE importing it. resolve() only locates
// the file, so it works even when the module's code is the thing that is broken —
// and the failure path is exactly when this provenance matters. Building it
// inside the try meant a failed import fell back to the ROOT undici, recording
// the copy miniflare might not even use and defeating the point.
let fromMiniflare = null;
try { fromMiniflare = createRequire(require.resolve('miniflare')); } catch { /* recorded below */ }
const resolveUndici = () => {
  const r = fromMiniflare ?? require;
  try {
    snapshot.undiciPath = r.resolve('undici');
    snapshot.undici = r('undici/package.json').version;
  } catch { /* provenance is a bonus, never a gate */ }
};

try {
  await import('miniflare');
  snapshot.miniflare = require('miniflare/package.json').version;
  resolveUndici();
} catch (err) {
  snapshot.loadError = String(err && err.message);
  resolveUndici();
  problems.push(
    'miniflare/undici failed to load — this is the failure that has killed two deploys.\n' +
    '    ' + String(err && err.message) + '\n' +
    '    Fix: npm ci'
  );
}

// 2. workerd, by RUNNING it. The node_modules/.bin/workerd shim is created from
//    the package's `bin` field whether or not the platform binary behind it is
//    usable, so its mere existence proves nothing — a missing platform package,
//    a non-executable file, or a node_modules copied between machines all leave
//    the shim in place. Executing it is the only check that means anything.
try {
  const bin = require('workerd').default;
  snapshot.workerdBin = bin;
  // SIGKILL, not the default SIGTERM: execFileSync's timeout signals the child
  // and then WAITS for it to exit, so a wedged binary that ignores TERM would
  // hang the preflight forever — turning a guard against a broken toolchain into
  // another way for a broken toolchain to stall a deploy.
  snapshot.workerd = execFileSync(bin, ['--version'], {
    encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL',
  }).trim();
} catch (err) {
  problems.push(
    'workerd is present but will not run — wrangler cannot build without it.\n' +
    '    ' + String(err && err.message) + '\n' +
    '    Fix: npm ci'
  );
}

// 3. wrangler.toml is gitignored (it carries KV/D1 ids), so a fresh clone has
//    none and the failure is otherwise a confusing config error.
if (!existsSync(new URL('../wrangler.toml', import.meta.url))) {
  problems.push('wrangler.toml is missing — it is gitignored.\n    Fix: copy wrangler.toml.example and fill in the KV namespace and D1 database ids');
}

if (problems.length === 0) {
  console.log(`preflight ok — undici ${snapshot.undici ?? '?'}, ${snapshot.workerd ?? 'workerd ?'}`);
  process.exit(0);
}

// Evidence for next time. The npm ci reflex destroys the broken tree, which is
// why two occurrences produced no diagnosis; capture it before that happens.
snapshot.when = new Date().toISOString();
const out = new URL('../preflight-failure.json', import.meta.url);
let wrote = null;
try {
  writeFileSync(out, JSON.stringify(snapshot, null, 2));
  wrote = out.pathname;
} catch (err) {
  wrote = null;
  snapshot.snapshotWriteError = String(err && err.message);
}

console.error('\nDeploy preflight FAILED — not deploying.\n');
for (const p of problems) console.error('  • ' + p + '\n');
console.error(wrote
  ? `  Snapshot written to ${wrote} (gitignored). Keep it — attach it if this recurs.\n`
  : `  Could not write the snapshot (${snapshot.snapshotWriteError}). Copy the above by hand before running npm ci.\n`);
process.exit(1);
