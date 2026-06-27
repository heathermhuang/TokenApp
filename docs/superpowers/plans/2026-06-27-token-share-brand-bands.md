# Token Share brand-band redesign + agent-icon fallback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the muddy Token Share chart with a single brand-stacked chart whose colors are distinct and theme-aware, drill into per-model detail on hover, and make every app/agent row show an icon (never blank).

**Architecture:** All changes are in `src/template.ts` (the SSR single-file SPA; the client JS lives inside a template-literal string). One source-of-truth color module drives bands, legend, and tooltip. The By author/By model toggle is removed; the chart always stacks the `author` series, and the `model` series feeds the hover tooltip. Icons get a layered letter-tile fallback behind the `<img>`.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers (SSR string template). No test runner in this repo. Verification = `npx tsc --noEmit` + an esbuild-render harness (Task 0) that (a) syntax-checks every inline `<script>` with `node:vm` — catching embedded-JS errors `tsc` cannot — and (b) renders an offline preview with mock data for visual checks in both themes.

---

## About verification (read once)

This project has **no xUnit/jest/pytest** and no DOM in CI. The client logic we are editing is a string, so `tsc` only validates the TS wrapper, not the embedded JS. Therefore every task verifies with the same three gates:

1. **`npx tsc --noEmit`** → must be clean (TS wrapper correctness).
2. **`node scratchpad/verify.mjs`** → bundles + renders `getHtml({})`, syntax-checks every inline script (exit 1 on any error), and writes `scratchpad/preview-dark.html` + `scratchpad/preview-light.html`.
3. **Visual** → open the two preview files, click the **Rankings** tab, and confirm the task's acceptance criteria in both themes.

`wrangler` is broken in this environment — never invoke it. **Never deploy**; the user runs `npx wrangler deploy` after approving the look.

## File structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/template.ts` | SSR page + embedded client SPA | all functional edits below |
| `scratchpad/verify.mjs` | one-time render+syntax+preview harness | created in Task 0 (gitignored) |
| `.gitignore` | ignore scratchpad artifacts | add `scratchpad/` |

All client-JS helpers use **string concatenation, not backticks** — the code sits inside an outer template literal, and avoiding backticks/`${}` sidesteps the escaping gotchas documented in `CLAUDE.md`.

---

## Task 0: Verification harness

**Files:**
- Create: `scratchpad/verify.mjs`
- Modify: `.gitignore`

- [ ] **Step 1: Ignore scratchpad artifacts**

Append to `.gitignore`:

```
scratchpad/
```

- [ ] **Step 2: Create the harness**

Create `scratchpad/verify.mjs` exactly:

```js
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

const OUT = path.resolve('scratchpad');
mkdirSync(OUT, { recursive: true });

const res = await build({
  entryPoints: ['src/template.ts'],
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const bundleFile = path.join(OUT, '_template.mjs');
writeFileSync(bundleFile, res.outputFiles[0].text);
const { getHtml } = await import(pathToFileURL(bundleFile).href);
const html = getHtml({});

const re = /<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g;
const scripts = [...html.matchAll(re)].map((m) => m[1]);
let bad = 0;
scripts.forEach((s, i) => {
  if (!s.trim()) return;
  try { new vm.Script(s); } catch (e) { bad++; console.error('inline script #' + i + ' SYNTAX ERROR: ' + e.message); }
});
console.log('inline scripts checked: ' + scripts.length + ', syntax errors: ' + bad);

const D = ['2026-05-04','2026-05-11','2026-05-18','2026-05-25','2026-06-01','2026-06-08','2026-06-15','2026-06-22'];
const pts = (a) => a.map((p, i) => ({ date: D[i], pct: p, tokens: Math.round(p * 1e9) }));
const ent = (key, label, a) => ({ key, label, latestPct: a[a.length - 1], points: pts(a) });
const share = {
  fetchedAt: D[7] + 'T00:00:00Z',
  author: { weeks: 52, fetchedAt: D[7], entities: [
    ent('anthropic','Anthropic',[28,29,30,31,30,31,32,31]),
    ent('openai','OpenAI',[26,25,24,23,24,23,22,24]),
    ent('google','Google',[12,12,13,13,13,13,13,13]),
    ent('deepseek','DeepSeek',[10,11,11,11,11,11,11,11]),
    ent('x-ai','xAI',[5,5,5,5,5,5,5,5]),
    ent('acme-labs','Acme Labs',[4,3,3,3,3,3,3,3]),
    ent('others','Others',[15,15,11,11,11,11,11,11]),
  ]},
  model: { weeks: 52, fetchedAt: D[7], entities: [
    ent('anthropic/claude-3.7-sonnet','Claude 3.7 Sonnet',[20,21,22,22,21,22,23,22]),
    ent('anthropic/claude-3.5-haiku','Claude 3.5 Haiku',[8,8,8,9,9,9,9,9]),
    ent('openai/gpt-4o','GPT-4o',[16,15,15,15,16,15,14,16]),
    ent('openai/gpt-4o-mini','GPT-4o mini',[10,10,9,8,8,8,8,8]),
    ent('google/gemini-2.0-flash','Gemini 2.0 Flash',[12,12,13,13,13,13,13,13]),
    ent('deepseek/deepseek-v3','DeepSeek V3',[10,11,11,11,11,11,11,11]),
    ent('x-ai/grok-2','Grok 2',[5,5,5,5,5,5,5,5]),
    ent('acme-labs/acme-1','Acme 1',[4,3,3,3,3,3,3,3]),
    ent('others','Others',[15,15,11,11,11,11,11,11]),
  ]},
};
const app = (rank, title, fav, origin) => ({ rank, title, description: '', categories: ['coding-agent'],
  originUrl: origin, faviconUrl: fav, totalTokens: Math.round(5e11 / rank), totalRequests: Math.round(1e7 / rank),
  sparkline: [3,4,4,5,6], delta: null });
const rankings = {
  fetchedAt: share.fetchedAt,
  topModels: [
    { modelSlug: 'anthropic/claude-3.7-sonnet', totalTokens: 9e11, totalRequests: 2e7, sparkline: [4,5,5,6,7], delta: null },
    { modelSlug: 'openai/gpt-4o', totalTokens: 6e11, totalRequests: 15e6, sparkline: [5,5,4,5,6], delta: null },
  ],
  topApps: {
    day: [
      app(1, 'Cline', 'https://www.google.com/s2/favicons?domain=cline.bot&sz=64', 'https://cline.bot'),
      app(2, 'Roo Code', null, 'https://roocode.com'),
      app(3, 'Mystery Agent', null, ''),
    ], week: [], month: [],
  },
  appsHistoryDays: 1, appsHistoryRequired: 7,
};
const MOCK = { share, rankings, categories: [] };
const inject = (theme) => '<script>'
  + 'document.documentElement.setAttribute("data-theme","' + theme + '");'
  + 'window.__M__=' + JSON.stringify(MOCK) + ';'
  + 'window.fetch=function(u){u=String(u);'
  + 'if(u.indexOf("/api/market-share")>=0)return Promise.resolve(new Response(JSON.stringify(window.__M__.share),{headers:{"content-type":"application/json"}}));'
  + 'if(u.indexOf("/api/rankings/categories")>=0)return Promise.resolve(new Response(JSON.stringify(window.__M__.categories),{headers:{"content-type":"application/json"}}));'
  + 'if(u.indexOf("/api/rankings")>=0)return Promise.resolve(new Response(JSON.stringify(window.__M__.rankings),{headers:{"content-type":"application/json"}}));'
  + 'return Promise.resolve(new Response("{}",{headers:{"content-type":"application/json"}}));'
  + '};</script>';
writeFileSync(path.join(OUT, 'preview-dark.html'), html.replace('</head>', inject('dark') + '</head>'));
writeFileSync(path.join(OUT, 'preview-light.html'), html.replace('</head>', inject('light') + '</head>'));
console.log('wrote scratchpad/preview-dark.html and scratchpad/preview-light.html');
process.exit(bad ? 1 : 0);
```

- [ ] **Step 3: Run the harness against current (unmodified) code to establish a green baseline**

Run: `node scratchpad/verify.mjs`
Expected: `inline scripts checked: N, syntax errors: 0` and the two preview files written; exit 0.

- [ ] **Step 4: Open both previews, click the Rankings tab, confirm the baseline renders**

Open `scratchpad/preview-dark.html` and `scratchpad/preview-light.html` in a browser → click **Rankings**. Expected: the stacked chart and the model/app boards render (this is the current muddy version — that's fine, it's the baseline).

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: esbuild render+syntax verification harness for template.ts"
```

(`scratchpad/` is gitignored, so only `.gitignore` is staged.)

---

## Task 1: Lift the provider palette to module scope (DRY refactor)

So the chart can ask "is this slug a known provider?" instead of guessing from the grey fallback. No behavior change to the model table.

**Files:**
- Modify: `src/template.ts` — `getProviderStyle` (~1742–1813)

- [ ] **Step 1: Relocate the two color maps to module scope**

Cut the existing `var dark = { … }` and `var light = { … }` object literals out of `getProviderStyle` (they currently span ~1744–1807) and paste them **immediately above** the `function getProviderStyle` line, renamed and unchanged in content:

```js
var PROVIDER_STYLE_DARK = { /* the existing `dark` map contents, verbatim */ };
var PROVIDER_STYLE_LIGHT = { /* the existing `light` map contents, verbatim */ };
```

- [ ] **Step 2: Replace `getProviderStyle` body and add two helpers**

Replace the whole `function getProviderStyle(providerId) { … }` with:

```js
function isLightTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}
function isKnownProvider(id) {
  return Object.prototype.hasOwnProperty.call(PROVIDER_STYLE_DARK, id);
}
function getProviderStyle(providerId) {
  var map = isLightTheme() ? PROVIDER_STYLE_LIGHT : PROVIDER_STYLE_DARK;
  var fallback = isLightTheme()
    ? { color: '#475569', bg: 'rgba(71,85,105,0.08)' }
    : { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
  return map[providerId] || fallback;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → clean.
Run: `node scratchpad/verify.mjs` → `syntax errors: 0`, exit 0.
Visual: open both previews → API Pricing tab → provider chips/colors in the model table look identical to before, in both themes (no regression).

- [ ] **Step 4: Commit**

```bash
git add src/template.ts
git commit -m "refactor(template): lift provider color maps to module scope + isKnownProvider"
```

---

## Task 2: One-source color system (replace `authorColor`/`entityColor`)

**Files:**
- Modify: `src/template.ts` — the `authorColor` + `entityColor` block (~2329–2344)

- [ ] **Step 1: Replace the block**

Delete `authorColor` and the old `entityColor` (the two functions and their comments, ~2329–2344) and replace with:

```js
// ── Token-share band colors ─────────────────────────────────────────────────
// One source of truth for band, legend, and tooltip swatches so they never
// drift. Theme is read live (same as getProviderStyle), so a theme toggle
// recolors on the next render. Color follows the ENTITY, never its rank —
// filtering / window changes never repaint a band.
function hashCode(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return h;
}
// Neutral reserved for "Others" + the unnamed aggregate — never a real entity.
function othersColor() { return isLightTheme() ? '#94a3b8' : '#475569'; }
// Stable generated hue for an author with no brand-palette entry, so two
// distinct unknowns never collapse into the same grey.
function genHue(slug) {
  var h = Math.abs(hashCode(slug)) % 360;
  return isLightTheme() ? 'hsl(' + h + ',62%,40%)' : 'hsl(' + h + ',58%,62%)';
}
// Canonical brand hue for an author/provider slug.
function brandColor(slug) {
  if (!slug || slug.toLowerCase() === 'others') return othersColor();
  var id = slug.toLowerCase().replace(/\s+/g, '-');
  if (isKnownProvider(id)) return getProviderStyle(id).color;
  return genHue(id);
}
// Band + legend color, keyed by entity. Author entities are plain slugs; the
// split keeps it correct if ever handed a "provider/model" key.
function entityColor(e) {
  var key = e && e.key ? e.key : '';
  if (!key || key.toLowerCase() === 'others') return othersColor();
  var prov = key.indexOf('/') >= 0 ? key.split('/')[0] : key;
  return brandColor(prov);
}
// Mix a #rrggbb hex toward a target hex by t (0..1).
function mixHex(hex, target, t) {
  if (hex.charAt(0) !== '#' || hex.length !== 7) return hex;
  function ch(c, o) { return parseInt(c.substr(o, 2), 16); }
  function hx(n) { return ('0' + (n < 0 ? 0 : n > 255 ? 255 : n).toString(16)).slice(-2); }
  var r = Math.round(ch(hex, 1) + (ch(target, 1) - ch(hex, 1)) * t);
  var g = Math.round(ch(hex, 3) + (ch(target, 3) - ch(hex, 3)) * t);
  var b = Math.round(ch(hex, 5) + (ch(target, 5) - ch(hex, 5)) * t);
  return '#' + hx(r) + hx(g) + hx(b);
}
// Tooltip swatch for one model: its brand hue, nudged per model so siblings
// (Sonnet vs Haiku) differ while staying in the family. Generated hsl() brand
// colors (unknown providers) are returned unchanged.
function modelTint(modelKey) {
  if (!modelKey || modelKey.toLowerCase() === 'others') return othersColor();
  var prov = modelKey.indexOf('/') >= 0 ? modelKey.split('/')[0] : modelKey;
  var base = brandColor(prov);
  if (base.charAt(0) !== '#') return base;
  var bucket = Math.abs(hashCode(modelKey)) % 3;
  if (bucket === 0) return base;
  return bucket === 1 ? mixHex(base, '#ffffff', 0.18) : mixHex(base, '#000000', 0.16);
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → clean.
Run: `node scratchpad/verify.mjs` → `syntax errors: 0`, exit 0.
Visual: open both previews → Rankings tab → the stacked chart (still the `author` series by default) now shows **distinct** brand colors; the unknown author "Acme Labs" is a non-grey generated hue; "Others" is a single neutral slate; the legend swatches match the bands. Confirm in dark and light.

- [ ] **Step 3: Commit**

```bash
git add src/template.ts
git commit -m "feat(share): entity-stable brand color system (genHue for unknowns, neutral Others)"
```

---

## Task 3: Single brand chart — remove the toggle, slice both series

**Files:**
- Modify: `src/template.ts` — toggle markup (~1519–1529), `state` init (~1681), `renderMarketShare` (~2882–2895), `#ms-view-toggle` listener (~2918–2925), `shareChartAria` (~2352)

- [ ] **Step 1: Remove the By author/By model toggle markup**

Delete the `#ms-view-toggle` block so the head's flex wrapper contains only the window toggle:

```html
        <div class="period-toggle" id="ms-view-toggle">
          <button class="period-btn active" data-view="author">By author</button>
          <button class="period-btn" data-view="model">By model</button>
        </div>
```

(Leave the surrounding `<div style="display:flex;…">` and the `#ms-window-toggle` block intact.)

- [ ] **Step 2: Remove the `msView` state field**

Delete this line from the `state` object (~1681):

```js
  msView: 'author',    // 'author' | 'model'
```

- [ ] **Step 3: Rewrite `renderMarketShare` to always use `author` and slice both series**

Replace the body of `function renderMarketShare()` (~2882–2895) with:

```js
  function renderMarketShare() {
    var body = document.getElementById('market-share-body');
    if (!body) return;
    if (!state.shareSeries) { body.innerHTML = '<div class="ms-empty">Market share data unavailable.</div>'; return; }
    var authorFull = state.shareSeries.author;
    if (!authorFull || !authorFull.entities || !authorFull.entities.length) {
      body.innerHTML = '<div class="ms-empty">Market share data unavailable.</div>'; return;
    }
    var author = windowSlice(authorFull, state.msWindow);
    var modelFull = state.shareSeries.model;
    var model = (modelFull && modelFull.entities && modelFull.entities.length)
      ? windowSlice(modelFull, state.msWindow)
      : null;
    body.innerHTML = shareChartSvg(author) +
      '<div class="ms-legend">' + marketShareLegend(author) + '</div>' +
      '<div class="ms-tip" id="ms-tip"></div>';
    attachShareHover(author, model);
  }
```

- [ ] **Step 4: Remove the `#ms-view-toggle` click listener**

Delete the whole listener block (~2918–2925):

```js
  document.getElementById('ms-view-toggle').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-view]');
    if (!btn) return;
    state.msView = btn.dataset.view;
    document.querySelectorAll('#ms-view-toggle .period-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    renderMarketShare();
  });
```

- [ ] **Step 5: Update the chart's accessibility label**

In `shareChartAria` (~2352), change the summary to name brands and mention hover. Replace:

```js
  return 'Weekly token share over time. Latest: ' + top.map(function (e) {
```

with:

```js
  return 'Weekly token share by brand. Hover for the per-model breakdown. Latest: ' + top.map(function (e) {
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` → clean (note: `attachShareHover` now takes 2 args but is still defined with 1 until Task 4 — `verify.mjs` syntax check still passes; the call just passes an extra arg, which is valid JS).
Run: `node scratchpad/verify.mjs` → `syntax errors: 0`, exit 0.
Visual: open both previews → Rankings tab → only the `30D/90D/1Y` toggle remains (no By author/By model); the chart shows brand bands; switching windows re-renders without repainting band colors.

- [ ] **Step 7: Commit**

```bash
git add src/template.ts
git commit -m "feat(share): single brand-stacked chart; remove By author/By model toggle"
```

---

## Task 4: Model breakdown on hover

**Files:**
- Modify: `src/template.ts` — `attachShareHover` (~2418–2448); add `pointForDate` helper

- [ ] **Step 1: Replace `attachShareHover` and add `pointForDate`**

Replace the whole `function attachShareHover(series) { … }` with:

```js
// Crosshair + tooltip. Bands are brand-level (author); the tooltip breaks the
// hovered week down by MODEL (sorted desc, capped). Falls back to the author
// breakdown if the model series is absent — never an empty tooltip.
function attachShareHover(author, model) {
  var body = document.getElementById('market-share-body');
  var svg = body && body.querySelector('.ms-chart');
  var hit = svg && svg.querySelector('.ms-hit');
  var cross = svg && svg.querySelector('.ms-crosshair');
  var tip = document.getElementById('ms-tip');
  if (!svg || !hit || !cross || !tip) return;
  var aEnts = author.entities, n = aEnts[0].points.length;
  var vb = svg.viewBox.baseVal, mL = 34, pw = vb.width - mL - 8;
  var useModel = !!(model && model.entities && model.entities.length);
  var breakdown = useModel ? model : author;
  var tintOf = useModel
    ? function (key) { return modelTint(key); }
    : function (key) { return entityColor({ key: key }); };
  hit.addEventListener('mousemove', function (ev) {
    var r = svg.getBoundingClientRect();
    var sx = (ev.clientX - r.left) / r.width * vb.width;
    var i = Math.max(0, Math.min(n - 1, Math.round((sx - mL) / pw * (n - 1))));
    var cx = mL + (i / (n - 1)) * pw;
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.style.display = '';
    var date = aEnts[0].points[i].date;
    var rows = breakdown.entities.map(function (e) {
      var p = pointForDate(e.points, date, i);
      return { label: e.label, pct: p ? p.pct : 0, key: e.key };
    }).filter(function (rr) { return rr.pct >= 0.05; })
      .sort(function (a, b) { return b.pct - a.pct; })
      .slice(0, 12);
    tip.innerHTML = '<div class="ms-tip-date">' + shortDate(date) + '</div>' +
      rows.map(function (rr) {
        return '<div class="ms-tip-row"><span><i class="ms-swatch" style="background:' + tintOf(rr.key) +
          '"></i>' + escape(rr.label) + '</span><b>' + rr.pct.toFixed(1) + '%</b></div>';
      }).join('');
    tip.style.opacity = '1';
    var left = (cx / vb.width) * r.width + 12;
    if (left + 170 > r.width) left -= 194;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = '8px';
  });
  hit.addEventListener('mouseleave', function () { tip.style.opacity = '0'; cross.style.display = 'none'; });
}
// Match the author week's date in a model entity's points; fall back to index
// when the two series line up 1:1.
function pointForDate(points, date, idx) {
  if (!points || !points.length) return null;
  for (var j = 0; j < points.length; j++) { if (points[j].date === date) return points[j]; }
  return points[idx] || null;
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → clean.
Run: `node scratchpad/verify.mjs` → `syntax errors: 0`, exit 0.
Visual: open both previews → Rankings tab → hover across the chart. The tooltip lists **models** (Claude 3.7 Sonnet, GPT-4o, Gemini, …), each swatch tinted to its brand family (Sonnet/Haiku both warm), sorted desc, with the crosshair tracking. The unknown "Acme 1" model appears with its generated hue. Confirm dark + light.

- [ ] **Step 3: Commit**

```bash
git add src/template.ts
git commit -m "feat(share): hover tooltip drills the week into a per-model breakdown"
```

---

## Task 5: Agent/app icons never blank

**Files:**
- Modify: `src/template.ts` — add `.lb-icon-wrap`/`.lb-icon-tile` CSS (~after 940); add `hostOf`/`s2Favicon`/`appIconHtml` (near `getProviderLogo` ~2022); the apps `icon` line in `renderRankings` (~2504–2506)

- [ ] **Step 1: Add CSS**

Immediately after the `.lb-icon { … }` rule (ends ~line 940), add:

```css
    .lb-icon-wrap { position: relative; width: 20px; height: 20px; flex-shrink: 0; }
    .lb-icon-tile {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      border-radius: 4px; background: var(--surface2); color: var(--text2);
      font-size: 11px; font-weight: 600; line-height: 1;
    }
    .lb-icon-wrap .lb-icon { position: relative; z-index: 1; display: block; }
```

- [ ] **Step 2: Add the icon helpers**

After `function providerLogoImg(...) { … }` (~2032), add:

```js
function hostOf(url) {
  try { return new URL(url).hostname; } catch (e) { return null; }
}
function s2Favicon(url) {
  var h = hostOf(url);
  return h ? 'https://www.google.com/s2/favicons?domain=' + h + '&sz=64' : null;
}
// App/agent icon with a layered fallback: faviconUrl -> s2 favicon from
// originUrl -> a letter-tile. The tile sits behind the <img>; a broken image
// removes itself and reveals the tile. Never renders blank.
function appIconHtml(a) {
  var letter = escape((((a.title || '?').trim().charAt(0)) || '?').toUpperCase());
  var tile = '<span class="lb-icon-tile">' + letter + '</span>';
  var src = safeUrl(a.faviconUrl) || s2Favicon(a.originUrl);
  if (!src) return '<span class="lb-icon-wrap">' + tile + '</span>';
  return '<span class="lb-icon-wrap">' + tile +
    '<img class="lb-icon" src="' + escape(src) + '" alt="" loading="lazy" onerror="this.remove()"></span>';
}
```

- [ ] **Step 3: Use it in the apps board**

In `renderRankings`, replace the `icon` assignment (~2504–2506):

```js
      var icon = a.faviconUrl
        ? '<img class="lb-icon" src="' + escape(a.faviconUrl) + '" alt="" onerror="this.hidden=true">'
        : '';
```

with:

```js
      var icon = appIconHtml(a);
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → clean.
Run: `node scratchpad/verify.mjs` → `syntax errors: 0`, exit 0.
Visual: open both previews → Rankings tab → the apps board shows three rows: "Cline" (favicon image), "Roo Code" (s2 favicon derived from `roocode.com`), and "Mystery Agent" (a letter-tile "M" on `--surface2`). No blank gaps. Confirm dark + light.

- [ ] **Step 5: Commit**

```bash
git add src/template.ts
git commit -m "fix(rankings): letter-tile + s2 favicon fallback so agent icons never blank"
```

---

## Task 6: Full verification pass (no deploy)

**Files:** none (verification only)

- [ ] **Step 1: Clean gates**

Run: `npx tsc --noEmit` → clean.
Run: `node scratchpad/verify.mjs` → `syntax errors: 0`, exit 0.

- [ ] **Step 2: Visual acceptance — both themes**

Open `scratchpad/preview-dark.html` and `scratchpad/preview-light.html`, click **Rankings**, and confirm all of:
- Only the `30D/90D/1Y` window toggle is present (no By author/By model).
- Brand bands are individually distinct; "Acme Labs" (unknown) is a non-grey hue; "Others" is one neutral slate; legend swatches match bands exactly.
- Hover shows a per-model breakdown, brand-tinted, sorted desc, crosshair tracking; window changes don't repaint band colors.
- App rows: favicon, s2-fallback, and letter-tile all render — no blanks.
- Switch the in-page theme toggle on each file and re-confirm colors adapt.

- [ ] **Step 3: Report to the user (do NOT deploy)**

Summarize what changed and that `tsc` + the harness are green. The user reviews the look and runs `npx wrangler deploy` themselves. Per `CLAUDE.md`, `wrangler` is broken in this env and deploys are user-only.

---

## Self-review (against the spec)

- **Brand-stacked chart, toggle removed** → Task 3. ✓
- **Whole-week model breakdown on hover** → Task 4 (`slice(0,12)`, `pct ≥ 0.05`, date-matched, author fallback). ✓
- **Color follows entity not rank; one source for band/legend/tooltip** → Task 2 (`entityColor`/`brandColor`/`modelTint`). ✓
- **Unknown authors get stable distinct hues; Others a dedicated neutral** → Task 2 (`genHue`, `othersColor`). ✓
- **Theme-aware** → Task 1 `isLightTheme` used throughout; verified both themes each task. ✓
- **DRY refactor to detect known providers** → Task 1. ✓
- **Letter-tile + s2 icon fallback** → Task 5. ✓
- **No data-layer/API changes; model table untouched; no deploy** → no task edits fetchers/`index.ts`; `providerLogoImg` untouched; Task 6 explicitly defers deploy. ✓
- **Type/name consistency:** `entityColor(e)`, `attachShareHover(author, model)`, `pointForDate`, `appIconHtml`, `isKnownProvider`, `isLightTheme`, `brandColor`, `modelTint`, `othersColor`, `genHue`, `mixHex`, `hashCode`, `hostOf`, `s2Favicon` — each defined once and referenced with matching signatures. `safeUrl`/`escape`/`shortDate`/`windowSlice`/`getProviderStyle` are pre-existing and in scope. ✓
