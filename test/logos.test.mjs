/**
 * Pins the mono/mixed classification in scripts/build-provider-logos.mjs.
 *
 * `mono` is the flag that lets CSS invert a whole mark for the dark theme. Get it
 * wrong in the permissive direction and a brand colour flips — AWS orange to blue —
 * on a site whose entire posture is "show nothing rather than something wrong".
 *
 * The first version asked "does a non-black HEX appear?", which fails open: a named
 * colour, an rgb(), or paint inside a <style> block was invisible to it. Today's icon
 * package happens to use hex only, so the corpus hid the bug. The package is pinned
 * but gets bumped, and `npm run logos:check` makes regeneration routine, so the
 * classifier has to be right for syntax the current corpus does not contain. That is
 * what most of these cases are: they are not hypothetical, they are the next bump.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, paintValues, unsafeConstructs, unsafeStyles, elementNames, MONO_SAFE_PAINT, MIXED_INK } from '../scripts/build-provider-logos.mjs';

const svg = (inner, attrs = '') =>
  `<svg viewBox="0 0 24 24" ${attrs} xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

const classify = (raw) => {
  const { mono, mixed, svg: out } = normalise(raw, 'test-icon');
  return { mono, mixed, out };
};

test('a mark drawn only in currentColor is invertible', () => {
  const r = classify(svg('<path fill="currentColor" d="M0 0h24v24H0z"/>'));
  assert.equal(r.mono, true);
  assert.equal(r.mixed, false);
  assert.match(r.out, /fill="#000"/, 'currentColor bakes to black for the invert path');
});

test('a mark with no currentColor at all is neither mono nor mixed', () => {
  const r = classify(svg('<path fill="#4285F4" d="M0 0h24v24H0z"/>'));
  assert.equal(r.mono, false);
  assert.equal(r.mixed, false);
});

test('black in every spelling still counts as invertible', () => {
  for (const black of ['#000', '#000000', '#000f', '#000000ff', 'black', 'rgb(0, 0, 0)', 'none', 'transparent']) {
    const r = classify(svg(`<path fill="currentColor" d="M1 1"/><path fill="${black}" d="M2 2"/>`));
    assert.equal(r.mono, true, `${black} should not disqualify a mark from inverting`);
  }
});

// ── The cases the first classifier failed open on ────────────────────────────
// Each of these mixes currentColor with real paint. Marking any of them mono would
// invert the brand colour on the dark theme.

test('a fixed HEX brand colour makes a mark non-invertible', () => {
  // The real one: AWS ships `currentColor` text beside a #F90 smile.
  const r = classify(svg('<path fill="currentColor" d="M1 1"/><path fill="#F90" d="M2 2"/>'));
  assert.equal(r.mono, false);
  assert.equal(r.mixed, true);
  assert.match(r.out, new RegExp(MIXED_INK), 'mixed marks bake to the neutral ink');
  assert.match(r.out, /#F90/, 'and keep the brand colour untouched');
});

test('a NAMED brand colour makes a mark non-invertible', () => {
  const r = classify(svg('<path fill="currentColor" d="M1 1"/><path fill="red" d="M2 2"/>'));
  assert.equal(r.mono, false, 'a named colour is paint even though it contains no #');
  assert.equal(r.mixed, true);
});

test('rgb() and hsl() paint makes a mark non-invertible', () => {
  for (const paint of ['rgb(255,153,0)', 'hsl(36,100%,50%)', 'rgba(255,153,0,0.5)']) {
    const r = classify(svg(`<path fill="currentColor" d="M1 1"/><path fill="${paint}" d="M2 2"/>`));
    assert.equal(r.mono, false, `${paint} must disqualify the mark`);
    assert.equal(r.mixed, true);
  }
});

test('paint hidden in a <style> block makes a mark non-invertible', () => {
  const r = classify(svg('<style>.a{fill:#F90}</style><path fill="currentColor" d="M1 1"/><path class="a" d="M2 2"/>'));
  assert.equal(r.mono, false, 'CSS is paint too — attribute-only scanning misses it');
  assert.equal(r.mixed, true);
});

test('paint in an inline style attribute makes a mark non-invertible', () => {
  const r = classify(svg('<path fill="currentColor" d="M1 1"/><path style="fill:#F90" d="M2 2"/>'));
  assert.equal(r.mono, false);
  assert.equal(r.mixed, true);
});

test('a CSS variable is unrecognised paint, so it is NOT treated as invertible', () => {
  const r = classify(svg('<path fill="currentColor" d="M1 1"/><path fill="var(--brand)" d="M2 2"/>'));
  assert.equal(r.mono, false, 'unknown syntax must fail safe, not fail open');
  assert.equal(r.mixed, true);
});

test('stroke and stop-color count as paint, not just fill', () => {
  const stroke = classify(svg('<path fill="currentColor" d="M1 1"/><path stroke="#F90" d="M2 2"/>'));
  assert.equal(stroke.mixed, true, 'stroke paints pixels');
  const stop = classify(svg(
    '<linearGradient id="g"><stop stop-color="#F90"/></linearGradient>' +
    '<path fill="currentColor" d="M1 1"/><path fill="url(#g)" d="M2 2"/>'));
  assert.equal(stop.mixed, true, 'a gradient stop is where the colour actually lives');
});

test('a gradient whose stops are ALL currentColor stays invertible', () => {
  // url(#…) is allowed only because the stops behind it are checked directly. This is
  // the case that would regress if url() were blanket-rejected.
  const r = classify(svg(
    '<linearGradient id="g"><stop stop-color="currentColor"/><stop stop-color="currentColor"/></linearGradient>' +
    '<path fill="url(#g)" d="M1 1"/>'));
  assert.equal(r.mono, true);
  assert.equal(r.mixed, false);
});

// ── Supporting units ─────────────────────────────────────────────────────────

test('paintValues finds paint in attributes, inline style and <style> alike', () => {
  const vals = paintValues(svg('<style>.a{fill:#F90;stroke:red}</style><path fill="currentColor" style="stop-color:blue"/>'));
  assert.ok(vals.includes('#f90'), 'CSS rule');
  assert.ok(vals.includes('red'), 'second CSS declaration');
  assert.ok(vals.includes('currentcolor'), 'attribute');
  assert.ok(vals.includes('blue'), 'inline style');
});

test('MONO_SAFE_PAINT rejects anything it does not positively recognise', () => {
  for (const ok of ['currentcolor', 'none', 'transparent', 'black', '#000', '#000000', 'url(#g)']) {
    assert.ok(MONO_SAFE_PAINT.test(ok), `${ok} should be safe`);
  }
  for (const bad of ['red', '#f90', 'rgb(1,2,3)', 'var(--x)', 'hsl(1,2%,3%)', '#ffffff', 'white']) {
    assert.ok(!MONO_SAFE_PAINT.test(bad), `${bad} must NOT be treated as safe`);
  }
});

test('normalise refuses an icon it cannot size, rather than guessing', () => {
  assert.throws(() => normalise('<svg xmlns="http://www.w3.org/2000/svg"><path/></svg>', 'no-viewbox'), /viewBox/);
});

test('normalise refuses an icon carrying a script', () => {
  assert.throws(() => normalise(svg('<script>alert(1)</script>'), 'scripted'), /script/);
});

test('the root tag is pinned to explicit pixels, since 1em resolves in the wrong document', () => {
  const { svg: out } = normalise(svg('<path fill="currentColor" d="M1 1"/>', 'width="1em" height="1em" style="flex:none"'), 'sized');
  assert.match(out, /^<svg width="24" height="24" role="img"/);
  assert.doesNotMatch(out, /1em/);
  assert.doesNotMatch(out, /flex:none/);
});

test('inner style attributes survive the root-tag rewrite', () => {
  // A global style strip would take the brand fill off the inner path with it.
  const { svg: out } = normalise(svg('<path style="fill:#F90" d="M1 1"/>', 'style="flex:none"'), 'inner-style');
  assert.match(out, /style="fill:#F90"/);
  assert.doesNotMatch(out, /flex:none/);
});

// ── Colour reachable by a route the paint scan cannot follow ─────────────────
// Scanning for paint VALUES can only ever fail open: syntax the regex misses yields no
// value, so "every value was safe" comes out vacuously true. The element allowlist is
// what closes that, so each case below is written to trip ONE guard — a fixture that
// also contains a stray colour would pass whether or not its guard existed.

test('an element outside the safe list makes a mark non-invertible', () => {
  // Every fixture paints only in currentColor, so the ONLY thing that can classify it
  // mixed is the element itself. Remove the allowlist and every one of these flips.
  const elements = {
    '<pattern> can wrap a raster': '<pattern id="p"/><path fill="currentColor" d="M1 1"/>',
    '<image> is a raster': '<image href="brand.png"/><path fill="currentColor" d="M1 1"/>',
    '<use> can reference elsewhere': '<use href="other.svg#i"/><path fill="currentColor" d="M1 1"/>',
    '<filter> can feFlood': '<filter id="f"/><path fill="currentColor" d="M1 1"/>',
    '<animate> can animate paint': '<animate attributeName="fill"/><path fill="currentColor" d="M1 1"/>',
    '<set> can set paint': '<set attributeName="fill"/><path fill="currentColor" d="M1 1"/>',
    '<style> can hide paint in CSS': '<style>.a{}</style><path fill="currentColor" d="M1 1"/>',
    '<foreignObject> renders HTML': '<foreignObject/><path fill="currentColor" d="M1 1"/>',
    'a namespace prefix defeats tag patterns': '<s:animate attributeName="fill"/><path fill="currentColor" d="M1 1"/>',
    'an element nobody thought of': '<somethingNew/><path fill="currentColor" d="M1 1"/>',
  };
  for (const [why, inner] of Object.entries(elements)) {
    const { mono, mixed } = normalise(svg(inner), 'stranger');
    assert.equal(mono, false, `${why}: must not be treated as invertible`);
    assert.equal(mixed, true, `${why}: must be classified mixed`);
  }
});

test('colour routes that ride on safe elements are still caught', () => {
  // These use nothing but allowlisted elements, so the allowlist cannot be what saves
  // them — each isolates one entry in UNSAFE_CONSTRUCTS.
  const residual = {
    'filter as a CSS property transforms the ink': '<path fill="currentColor" style="filter:invert(1)" d="M1 1"/>',
    'filter as a presentation attribute': '<path fill="currentColor" filter="url(#f)" d="M1 1"/>',
    'gradient inheriting external stops': '<linearGradient id="g" href="#other"/><path fill="currentColor" d="M1 1"/><path fill="url(#g)" d="M2 2"/>',
    'SVG 2 paint fallback': '<path fill="currentColor" style="fill:url(#missing) red" d="M1 1"/>',
    'the same fallback in uppercase': '<path fill="currentColor" style="fill:URL(#missing) red" d="M1 1"/>',
    'a character entity hiding a separator': '<path fill="currentColor" d="M1 1"/><path fill="&#35;f90" d="M2 2"/>',
  };
  for (const [why, inner] of Object.entries(residual)) {
    const { mono, mixed } = normalise(svg(inner), 'residual');
    assert.equal(mono, false, `${why}: must not be treated as invertible`);
    assert.equal(mixed, true, `${why}: must be classified mixed`);
  }
});

test('a mask is coverage, not colour, so it does not disqualify a mark', () => {
  // poolside is the one mark in the corpus relying on this. The mask contents are pure
  // ink on purpose: an earlier version of this test used #fff inside the mask, so it
  // passed even with <mask> denylisted — it was proving the wrong thing.
  const masked = normalise(svg(
    '<mask id="m"><path fill="currentColor" d="M0 0h24v24H0z"/></mask>' +
    '<path fill="currentColor" mask="url(#m)" d="M1 1"/>'), 'masked');
  assert.equal(masked.mono, true, 'a mask of pure ink must stay invertible');
  assert.equal(masked.mixed, false);

  const clipped = normalise(svg(
    '<clipPath id="c"><rect width="24" height="24"/></clipPath>' +
    '<path fill="currentColor" clip-path="url(#c)" d="M1 1"/>'), 'clipped');
  assert.equal(clipped.mono, true, 'geometry-only clipping keeps a mark invertible');
});

test('a real colour inside a mask is still caught by the paint scan', () => {
  const r = normalise(svg('<mask id="m"><path fill="#f90" d="M0 0h24v24H0z"/></mask>' +
    '<path fill="currentColor" mask="url(#m)" d="M1 1"/>'), 'masked-colour');
  assert.equal(r.mixed, true);
});

test('elementNames sees prefixed and closing tags alike', () => {
  const names = elementNames('<svg><s:animate/><g><path/></g></svg>');
  assert.ok(names.includes('s:animate'), 'the prefix is part of the name, not stripped');
  assert.ok(names.includes('path') && names.includes('g') && names.includes('svg'));
});

test('a NON-ASCII namespace prefix cannot truncate to an allowlisted name', () => {
  // <gπ:animate> is a valid QName. A name-shaped pattern built on \w (ASCII) captures
  // just "g", which IS allowlisted, and the animation sails through. Reading to the
  // next delimiter is what stops that.
  const names = elementNames('<svg><gπ:animate attributeName="fill"/></svg>');
  assert.ok(!names.includes('g'), 'must not truncate the QName down to an allowed name');
  assert.ok(names.some(n => n.includes('animate')), 'the real name is captured whole');

  const { mono, mixed } = normalise(
    svg('<path fill="currentColor" d="M1 1"/><gπ:animate attributeName="fill" values="currentColor;#f90"/>'), 'qname');
  assert.equal(mono, false);
  assert.equal(mixed, true);
});

test('a CSS-escaped property name cannot smuggle paint past the scan', () => {
  // CSS decodes f\69ll as fill, so a scanner looking for the literal word sees only
  // currentColor while the renderer paints orange. Same trick hides `filter`.
  for (const decl of ['f\\69ll:#f90', 'f\\69lter:invert(1)', 'fill:#f90/*x*/']) {
    const { mono, mixed } = normalise(svg(`<path fill="currentColor" style="${decl}" d="M1 1"/>`), 'escaped');
    assert.equal(mono, false, `${decl}: must not be treated as invertible`);
    assert.equal(mixed, true, `${decl}: must be classified mixed`);
  }
});

test('an ordinary style attribute is still fine', () => {
  // poolside ships style="mask-type:alpha" and must keep following the theme —
  // refusing every inner style would have cost a real mark.
  const r = normalise(svg('<mask id="m" style="mask-type:alpha"><path fill="currentColor" d="M0 0h24v24H0z"/></mask>' +
    '<path fill="currentColor" mask="url(#m)" d="M1 1"/>'), 'plain-style');
  assert.equal(r.mono, true);
  assert.deepEqual(unsafeStyles('<path style="mask-type:alpha"/>'), []);
  assert.equal(unsafeStyles('<path style="f\\69ll:#f90"/>').length, 1);
});

test('unsafeConstructs names what it rejected, so the build can report it', () => {
  assert.deepEqual(unsafeConstructs(svg('<path fill="currentColor"/>')), []);
  const named = unsafeConstructs(svg('<pattern id="p"/><image href="x.png"/>'));
  assert.ok(named.some(n => n.includes('pattern')), 'names the offending element');
  assert.ok(named.some(n => n.includes('image')));
  assert.ok(named.every(n => typeof n === 'string' && n.length > 0));
});
