/**
 * SSR pages: model detail (`/model/{slug}`) and comparisons (`/compare/{a}-vs-{b}`).
 *
 * WHY THESE EXIST: llm-stats.com's programmatic "X vs Y" pages are its SEO engine
 * and they are genuinely useful. We mirror the *structure* (verdict prose,
 * "choose X if", FAQ JSON-LD, dense interlinking) but point it at the data they
 * do not have: our hand-verified consumer SUBSCRIPTION catalogue. llm-stats is
 * API-only, so "ChatGPT Plus vs Claude Pro" is a question it structurally cannot
 * answer — and it is a far higher-volume query than any model-vs-model pair.
 *
 * Every number rendered here is either an API price (OpenRouter), a verified
 * subscription price (with its `lastVerified` stamp shown), or an independently
 * run benchmark (Epoch AI, CC BY, cited). No number renders without provenance.
 */

import type { NormalizedModel, Subscription, SubscriptionTier, BenchmarksPayload, ModelBenchmarks, ModelEndpoints, ModelUsage } from './types';
import { getProvider, PROVIDER_PAGE_SET } from './providers';

// ── Shared formatting ─────────────────────────────────────────────────────────

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtCtx(n: number | null | undefined): string {
  if (!n) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'K';
  return String(n);
}

function fmtP(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n === 0) return 'Free';
  if (n < 0.01) return '<$0.01';
  if (n < 1) return '$' + n.toFixed(3);
  if (n < 10) return '$' + n.toFixed(2);
  return '$' + n.toFixed(2);
}

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n === 0) return 'Free';
  return '$' + (Number.isInteger(n) ? n : n.toFixed(2));
}

function fmtDate(ts: number | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

// Blended $/1M at the same 3:1 input:output mix the main table sorts by. Keeping
// one ratio across the whole site means the compare pages and the frontier chart
// can never disagree about which of two models is "cheaper".
export const BLEND_IN = 0.75;
export const BLEND_OUT = 0.25;
export function blended(m: Pick<NormalizedModel, 'inputPer1M' | 'outputPer1M'>): number | null {
  if (m.inputPer1M === null || m.outputPer1M === null) return null;
  if (m.inputPer1M < 0 || m.outputPer1M < 0) return null;
  return m.inputPer1M * BLEND_IN + m.outputPer1M * BLEND_OUT;
}

function shortName(name: string): string {
  const i = name.indexOf(': ');
  return i > 0 ? name.slice(i + 2) : name;
}

// ── Shared page shell ─────────────────────────────────────────────────────────

const SHELL_CSS = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:#0c0c0e; --surface:#141418; --surface2:#1c1c22;
      --border:#27272f; --border2:#33333d;
      --text:#f0f0f4; --text2:#9090a0; --text3:#606070;
      --accent:#6366f1; --accent-dim:rgba(99,102,241,0.15);
      --green:#22c55e; --red:#ef4444; --radius:8px; --radius-sm:5px;
      --nav-bg:rgba(12,12,14,0.88);
    }
    html[data-theme="light"] {
      --bg:#f4f4f8; --surface:#ffffff; --surface2:#ebebf2;
      --border:#dcdce8; --border2:#c8c8d8;
      --text:#111118; --text2:#3d3d52; --text3:#62627a;
      --accent:#4746b8; --accent-dim:rgba(71,70,184,0.1);
      --green:#15803d; --red:#b91c1c; --nav-bg:rgba(244,244,248,0.92);
    }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif; background:var(--bg); color:var(--text); font-size:14px; line-height:1.5; min-height:100vh; }
    nav { position:sticky; top:0; z-index:100; background:var(--nav-bg); backdrop-filter:blur(14px); border-bottom:1px solid var(--border); padding:0 24px; height:52px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
    .nav-brand { display:flex; align-items:center; gap:8px; font-size:16px; font-weight:700; color:var(--text); text-decoration:none; letter-spacing:-0.3px; }
    .nav-brand .diamond { color:var(--accent); font-size:18px; }
    .nav-back { font-size:13px; color:var(--text2); text-decoration:none; }
    .nav-back:hover { color:var(--text); }
    main { max-width:1100px; margin:0 auto; padding:28px 24px 60px; }
    .crumb { font-size:12px; color:var(--text3); margin-bottom:14px; }
    .crumb a { color:var(--text2); text-decoration:none; }
    .crumb a:hover { color:var(--text); }
    h1 { font-size:26px; font-weight:700; margin-bottom:8px; letter-spacing:-0.4px; }
    h2 { font-size:16px; font-weight:650; margin-bottom:12px; }
    .lede { color:var(--text2); font-size:14px; line-height:1.65; max-width:760px; margin-bottom:20px; }
    .panel { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); margin-bottom:20px; overflow:hidden; }
    .panel-head { padding:14px 18px 12px; border-bottom:1px solid var(--border); }
    .panel-title { font-size:14px; font-weight:650; }
    .panel-sub { font-size:12px; color:var(--text3); margin-top:3px; }
    .panel-body { padding:16px 18px; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    thead th { text-align:left; padding:10px 14px; border-bottom:1px solid var(--border); font-size:11px; font-weight:600; color:var(--text3); text-transform:uppercase; letter-spacing:0.04em; white-space:nowrap; }
    tbody tr { border-bottom:1px solid var(--border); }
    tbody tr:last-child { border-bottom:none; }
    tbody td { padding:10px 14px; vertical-align:top; }
    .num { font-variant-numeric:tabular-nums; }
    .win { color:var(--green); font-weight:600; }
    .muted { color:var(--text3); }
    .chip { display:inline-block; padding:2px 7px; border-radius:20px; font-size:11px; font-weight:600; background:var(--surface2); color:var(--text2); }
    .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .stat-row { display:flex; justify-content:space-between; gap:12px; padding:7px 0; border-bottom:1px solid var(--border); font-size:13px; }
    .stat-row:last-child { border-bottom:none; }
    .stat-k { color:var(--text2); }
    .stat-v { font-weight:600; font-variant-numeric:tabular-nums; text-align:right; }
    ul.reasons { list-style:none; }
    ul.reasons li { padding:6px 0 6px 20px; position:relative; color:var(--text2); font-size:13px; line-height:1.55; }
    ul.reasons li::before { content:'→'; position:absolute; left:0; color:var(--accent); }
    .linkgrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:8px; }
    .linkgrid a { display:block; padding:9px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius-sm); font-size:13px; color:var(--text2); text-decoration:none; }
    .linkgrid a:hover { color:var(--text); border-color:var(--border2); }
    .hostwarn { font-size:11px; color:var(--orange,#f97316); margin-top:3px; font-weight:500; }
    .cite { font-size:11px; color:var(--text3); line-height:1.6; padding:12px 18px; border-top:1px solid var(--border); }
    .cite a { color:var(--text2); }
    details { border-bottom:1px solid var(--border); }
    details:last-child { border-bottom:none; }
    details summary { padding:12px 0; cursor:pointer; font-weight:550; font-size:13px; list-style:none; display:flex; justify-content:space-between; gap:12px; }
    details summary::-webkit-details-marker { display:none; }
    details summary::after { content:'+'; color:var(--text3); }
    details[open] summary::after { content:'−'; }
    details .ans { padding:0 0 12px; color:var(--text2); font-size:13px; line-height:1.65; }
    footer { border-top:1px solid var(--border); padding:20px 24px; text-align:center; font-size:12px; color:var(--text3); }
    footer a { color:var(--text3); text-decoration:none; }
    footer a:hover { color:var(--text2); }
    .tbl-wrap { overflow-x:auto; }
    .usage-stats { display:flex; gap:26px; flex-wrap:wrap; margin-bottom:16px; }
    .usage-stat .k { font-size:11px; color:var(--text3); text-transform:uppercase; letter-spacing:0.04em; }
    .usage-stat .v { font-size:19px; font-weight:650; font-variant-numeric:tabular-nums; margin-top:2px; }
    .usage-chart { width:100%; height:auto; display:block; }
    .usage-axis { display:flex; justify-content:space-between; font-size:11px; color:var(--text3); margin-top:5px; font-variant-numeric:tabular-nums; }
    .up { color:var(--green); }
    .down { color:var(--red); }
    @media (max-width:700px) {
      main { padding:20px 16px 40px; }
      h1 { font-size:21px; }
      .grid2 { grid-template-columns:1fr; }
      table { font-size:12px; }
      .usage-stats { gap:18px; }
      .usage-stat .v { font-size:17px; }
    }
`;

function shell(o: {
  title: string; description: string; canonical: string;
  jsonLd?: string[]; backHref?: string; backLabel?: string; body: string;
}): string {
  // JSON.stringify does NOT escape "<", so a model description containing
  // "</script>" would close the tag and inject markup. Escaping "<" as \u003c
  // keeps the JSON valid and the tag intact.
  const ld = (o.jsonLd ?? [])
    .map((j) => `<script type="application/ld+json">${j.replace(/</g, '\\u003c')}</script>`)
    .join('\n  ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(o.title)}</title>
  <meta name="description" content="${esc(o.description)}" />
  <meta name="author" content="Measurable AI" />
  <meta property="og:title" content="${esc(o.title)}" />
  <meta property="og:description" content="${esc(o.description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${esc(o.canonical)}" />
  <meta property="og:site_name" content="token.app" />
  <meta property="og:image" content="https://token.app/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://token.app/og.png" />
  <link rel="canonical" href="${esc(o.canonical)}" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔷</text></svg>" />
  ${ld}
  <script>(function(){var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);})();</script>
  <style>${SHELL_CSS}</style>
</head>
<body>
<nav>
  <a href="/" class="nav-brand"><span class="diamond">◈</span> token.app</a>
  <a href="${esc(o.backHref ?? '/')}" class="nav-back">← ${esc(o.backLabel ?? 'Back to token.app')}</a>
</nav>
<main>
${o.body}
</main>
<footer>
  <p>API prices from <a href="https://openrouter.ai" target="_blank" rel="noopener">OpenRouter</a>. Subscription prices verified by hand against provider pages. Benchmark scores by <a href="https://epoch.ai/benchmarks" target="_blank" rel="noopener">Epoch AI</a> under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Always verify with official sources.</p>
  <p style="margin-top:6px;">Powered by <a href="https://measurable.ai" target="_blank" rel="noopener">Measurable AI</a> · <a href="/">Back to token.app</a></p>
</footer>
</body>
</html>`;
}

function faqJsonLd(qs: { q: string; a: string }[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  });
}

function faqHtml(qs: { q: string; a: string }[]): string {
  return qs.map((x, i) => `<details${i === 0 ? ' open' : ''}>
      <summary>${esc(x.q)}</summary>
      <div class="ans">${esc(x.a)}</div>
    </details>`).join('\n    ');
}

// ── Benchmark helpers ─────────────────────────────────────────────────────────

function benchOf(bench: BenchmarksPayload | null, modelId: string): ModelBenchmarks | null {
  if (!bench) return null;
  return bench.models.find((m) => m.modelId === modelId) ?? null;
}

function scoreCell(mb: ModelBenchmarks | null, benchId: string): number | null {
  const s = mb?.scores.find((x) => x.benchmarkId === benchId);
  return s ? s.score : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Model detail page — /model/{slug}
// ═══════════════════════════════════════════════════════════════════════════════

export function getModelHtml(params: {
  model: NormalizedModel;
  all: NormalizedModel[];
  benchmarks: BenchmarksPayload | null;
  subscriptions: Subscription[];
  endpoints: ModelEndpoints | null;
  usage?: ModelUsage | null;
}): string {
  const { model: m, all, benchmarks, subscriptions, endpoints, usage = null } = params;
  const prov = getProvider(m.providerId);
  const bl = blended(m);
  const mb = benchOf(benchmarks, m.id);
  const url = `https://token.app/model/${encodeURIComponent(m.slug)}`;
  const disp = shortName(m.name);

  // ── Cheaper-and-at-least-as-good alternatives.
  // This is the recommendation only a price+quality site can make, and it is
  // computed, not editorialised: strictly cheaper on the same blended basis AND
  // scoring at least as high on the same benchmark. Empty when we have no score
  // for this model — we do not guess.
  const primary = benchmarks?.benchmarks[0]?.id ?? 'gpqa_diamond';
  const primaryLabel = benchmarks?.benchmarks[0]?.label ?? 'GPQA Diamond';
  const myScore = scoreCell(mb, primary);
  const alternatives = (myScore === null || bl === null) ? [] : all
    .filter((o) => {
      if (o.id === m.id || o.isDeprecated) return false;
      const ob = blended(o);
      if (ob === null || ob >= bl) return false;
      const os = scoreCell(benchOf(benchmarks, o.id), primary);
      return os !== null && os >= myScore;
    })
    .sort((a, b) => (blended(a) ?? 0) - (blended(b) ?? 0))
    .slice(0, 5);

  // Subscriptions whose `underlyingModels` names this model.
  const inSubs = subscriptions.filter((s) => (s.underlyingModels ?? []).includes(m.id));

  const benchRows = mb && mb.scores.length
    ? mb.scores.map((s) => `<tr>
          <td>${esc(s.benchmark)}</td>
          <td class="num"><strong>${(s.score * 100).toFixed(1)}%</strong>${s.stderr ? ` <span class="muted">±${(s.stderr * 100).toFixed(1)}</span>` : ''}</td>
          <td class="muted">${s.variant ? esc(s.variant) + ' effort' : '—'}</td>
          <td class="muted num">${esc(s.recordedAt ?? '—')}</td>
          <td class="muted">${s.isSelfReported ? 'Self-reported' : 'Independently run'} · <a href="${esc(s.sourceUrl)}" target="_blank" rel="noopener">${esc(s.source)}</a></td>
        </tr>`).join('\n        ')
    : '';

  const modalities = [
    ...(m.inputModalities ?? []).map((x) => `in:${x}`),
    ...(m.outputModalities ?? []).map((x) => `out:${x}`),
  ];

  const faqs = [
    {
      q: `How much does ${disp} cost?`,
      a: `${disp} costs ${fmtP(m.inputPer1M)} per million input tokens and ${fmtP(m.outputPer1M)} per million output tokens on OpenRouter.` +
         (bl !== null ? ` At a 3:1 input:output mix that blends to ${fmtP(bl)} per million tokens.` : ''),
    },
    {
      q: `What is ${disp}'s context window?`,
      a: m.contextWindow
        ? `${disp} accepts up to ${m.contextWindow.toLocaleString()} tokens of context` +
          (m.maxOutput ? `, and can generate up to ${m.maxOutput.toLocaleString()} output tokens.` : '.')
        : `A context window is not published for ${disp}.`,
    },
    ...(myScore !== null ? [{
      q: `How good is ${disp} on benchmarks?`,
      a: `${disp} scores ${(myScore * 100).toFixed(1)}% on ${benchmarks?.benchmarks[0]?.label ?? 'GPQA Diamond'}, ` +
         `independently run and published by Epoch AI. ${mb!.scores.length} benchmark result${mb!.scores.length === 1 ? '' : 's'} are listed on this page, each with its run date and source.`,
    }] : []),
    ...(alternatives.length ? [{
      q: `Is there a cheaper model as good as ${disp}?`,
      a: `Yes — ${alternatives.length} model${alternatives.length === 1 ? '' : 's'} in our catalogue cost less per token than ${disp} and score at least as high on the same benchmark. ` +
         `The cheapest is ${shortName(alternatives[0].name)} at ${fmtP(blended(alternatives[0]))} per million tokens blended.`,
    }] : []),
  ];

  // Popular comparison targets: same-tier rivals from other providers, most
  // recent first. Cheap internal linking, which is most of why llm-stats ranks.
  const rivals = all
    .filter((o) => o.id !== m.id && !o.isDeprecated && o.providerId !== m.providerId && blended(o) !== null)
    .filter((o) => scoreCell(benchOf(benchmarks, o.id), primary) !== null)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, 8);

  const body = `
  <div class="crumb"><a href="/">token.app</a> › ${PROVIDER_PAGE_SET.has(m.providerId)
    ? `<a href="/${esc(m.providerId)}">${esc(m.provider)}</a>`
    : esc(m.provider)} › ${esc(disp)}</div>
  <h1>${esc(disp)} pricing &amp; benchmarks</h1>
  <p class="lede">
    ${esc(disp)} is available from ${esc(prov?.displayName ?? m.provider)} at ${esc(fmtP(m.inputPer1M))} per million input tokens
    and ${esc(fmtP(m.outputPer1M))} per million output tokens${bl !== null ? ` (${esc(fmtP(bl))} blended at 3:1)` : ''}.
    ${m.contextWindow ? `It accepts up to ${m.contextWindow.toLocaleString()} tokens of context.` : ''}
    ${m.description ? esc(m.description.slice(0, 240)) + (m.description.length > 240 ? '…' : '') : ''}
  </p>

  <div class="grid2">
    <div class="panel">
      <div class="panel-head"><div class="panel-title">Pricing</div><div class="panel-sub">Per million tokens · OpenRouter</div></div>
      <div class="panel-body">
        <div class="stat-row"><span class="stat-k">Input</span><span class="stat-v">${esc(fmtP(m.inputPer1M))}</span></div>
        <div class="stat-row"><span class="stat-k">Output</span><span class="stat-v">${esc(fmtP(m.outputPer1M))}</span></div>
        <div class="stat-row"><span class="stat-k">Blended (3:1)</span><span class="stat-v">${esc(fmtP(bl))}</span></div>
        ${m.imagePricePer !== null && m.imagePricePer !== undefined ? `<div class="stat-row"><span class="stat-k">Per image</span><span class="stat-v">${esc(fmtP(m.imagePricePer))}</span></div>` : ''}
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><div class="panel-title">Specification</div><div class="panel-sub">${esc(m.id)}</div></div>
      <div class="panel-body">
        <div class="stat-row"><span class="stat-k">Context window</span><span class="stat-v">${esc(fmtCtx(m.contextWindow))}</span></div>
        <div class="stat-row"><span class="stat-k">Max output</span><span class="stat-v">${esc(fmtCtx(m.maxOutput))}</span></div>
        <div class="stat-row"><span class="stat-k">Released</span><span class="stat-v">${esc(fmtDate(m.createdAt))}</span></div>
        <div class="stat-row"><span class="stat-k">Licence</span><span class="stat-v">${m.isOpenSource ? 'Open weights' : 'Proprietary'}</span></div>
        <div class="stat-row"><span class="stat-k">Modalities</span><span class="stat-v">${esc(modalities.join(', ') || '—')}</span></div>
      </div>
    </div>
  </div>

  ${usagePanel(usage, disp)}

  ${benchRows ? `<div class="panel">
    <div class="panel-head">
      <div class="panel-title">Benchmarks</div>
      <div class="panel-sub">Independently run — not vendor self-reports. Every score links its source.</div>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Benchmark</th><th>Score</th><th>Config</th><th>Run</th><th>Source</th></tr></thead>
      <tbody>
        ${benchRows}
      </tbody>
    </table></div>
    <div class="cite">Scores published by <a href="${esc(benchmarks!.attribution.url)}" target="_blank" rel="noopener">${esc(benchmarks!.attribution.text)}</a>, used under <a href="${esc(benchmarks!.attribution.licenseUrl)}" target="_blank" rel="noopener">${esc(benchmarks!.attribution.license)}</a>.</div>
  </div>` : `<div class="panel"><div class="panel-body muted">No independently-run benchmark scores are published for ${esc(disp)} yet. We show nothing rather than reprinting an unverified figure.</div></div>`}

  ${alternatives.length ? `<div class="panel">
    <div class="panel-head">
      <div class="panel-title">Cheaper models that score at least as well on ${esc(primaryLabel)}</div>
      <div class="panel-sub">Strictly lower blended price AND an equal-or-higher ${esc(primaryLabel)} score. One benchmark is one dimension — a model that wins here may still be weaker at your specific task.</div>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Model</th><th>Provider</th><th>Blended $/1M</th><th>${esc(primaryLabel)}</th><th></th></tr></thead>
      <tbody>
        ${alternatives.map((o) => {
          const os = scoreCell(benchOf(benchmarks, o.id), primary)!;
          const ob = blended(o)!;
          const save = bl !== null && bl > 0 ? Math.round((1 - ob / bl) * 100) : null;
          return `<tr>
          <td><a href="/model/${encodeURIComponent(o.slug)}" style="color:var(--text);text-decoration:none;font-weight:500">${esc(shortName(o.name))}</a></td>
          <td class="muted">${esc(o.provider)}</td>
          <td class="num win">${esc(fmtP(ob))}${save !== null && save > 0 ? ` <span class="muted">(−${save}%)</span>` : ''}</td>
          <td class="num">${(os * 100).toFixed(1)}%</td>
          <td><a href="/compare/${encodeURIComponent(m.slug)}-vs-${encodeURIComponent(o.slug)}" style="color:var(--accent);text-decoration:none">Compare →</a></td>
        </tr>`;
        }).join('\n        ')}
      </tbody>
    </table></div>
  </div>` : ''}

  ${hostsPanel(endpoints, m)}

  ${inSubs.length ? `<div class="panel">
    <div class="panel-head">
      <div class="panel-title">Subscriptions that include ${esc(disp)}</div>
      <div class="panel-sub">Consumer plans whose published model list names this model</div>
    </div>
    <div class="panel-body"><div class="linkgrid">
      ${inSubs.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} <span class="muted">· from ${esc(fmtUsd(cheapestPaid(s)))}/mo</span></a>`).join('\n      ')}
    </div></div>
  </div>` : ''}

  ${rivals.length ? `<div class="panel">
    <div class="panel-head"><div class="panel-title">Compare ${esc(disp)}</div></div>
    <div class="panel-body"><div class="linkgrid">
      ${rivals.map((o) => `<a href="/compare/${encodeURIComponent(m.slug)}-vs-${encodeURIComponent(o.slug)}">${esc(disp)} vs ${esc(shortName(o.name))}</a>`).join('\n      ')}
    </div></div>
  </div>` : ''}

  <div class="panel">
    <div class="panel-head"><div class="panel-title">FAQ</div></div>
    <div class="panel-body">
    ${faqHtml(faqs)}
    </div>
  </div>`;

  return shell({
    title: `${disp} pricing, context & benchmarks — token.app`,
    description: `${disp} costs ${fmtP(m.inputPer1M)}/1M input and ${fmtP(m.outputPer1M)}/1M output.` +
      (m.contextWindow ? ` ${fmtCtx(m.contextWindow)} context.` : '') +
      (myScore !== null ? ` Scores ${(myScore * 100).toFixed(1)}% on GPQA Diamond.` : ''),
    canonical: url,
    backHref: '/',
    backLabel: 'All models',
    jsonLd: [faqJsonLd(faqs), JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: disp,
      description: m.description?.slice(0, 300) ?? `${disp} API pricing and benchmarks`,
      brand: { '@type': 'Brand', name: m.provider },
      url,
      ...(m.inputPer1M !== null ? {
        offers: {
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: String(m.inputPer1M),
          description: 'USD per 1M input tokens',
          url,
        },
      } : {}),
    })],
    body,
  });
}

function fmtTokens(n: number): string {
  if (!n || n <= 0) return '0';
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

/**
 * "Usage on OpenRouter" — the axis a pure benchmark site structurally cannot show:
 * not how good a model tests, but how much of it people actually run. Accumulated
 * by our own hourly cron into D1, so it is ours rather than a re-publication.
 *
 * Every point is a TRAILING-WEEK token total as of its day — that is the series
 * OpenRouter's model board publishes. The caption says so, because read as daily
 * volume these numbers are ~7x too large.
 *
 * Only ever rendered for a model currently ON that board: `readModelUsage` returns
 * null for a stale series rather than letting a chart that stops three weeks ago
 * read as current. So this panel is absent from most pages by design.
 */
function usagePanel(u: ModelUsage | null, disp: string): string {
  if (!u || u.points.length < 2) return '';

  const W = 680, H = 128, PAD_T = 10, PAD_B = 6;
  const vals = u.points.map((p) => p.tokens);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = (max - min) || 1;            // a dead-flat series still needs an axis
  const n = vals.length;
  const plotH = H - PAD_T - PAD_B;
  const xy = vals.map((v, i) => [
    (i / (n - 1)) * W,
    PAD_T + (1 - (v - min) / span) * plotH,
  ] as const);
  const pt = ([x, y]: readonly [number, number]) => `${x.toFixed(1)},${y.toFixed(1)}`;
  const line = xy.map(pt).join(' ');
  const area = `M0,${H} L${xy.map(pt).join(' L')} L${W},${H} Z`;

  const pct = u.delta?.pctChange ?? null;
  const rankMove = u.delta?.rankChange ?? null;
  const first = u.points[0], last = u.points[n - 1];
  const dir = pct === null ? '' : pct >= 0 ? 'up' : 'down';

  // The aria-label carries the same facts as the chart — a screen reader gets the
  // trend, not "chart".
  const aria = `${disp} weekly token usage from ${first.day} to ${last.day}: ` +
    `${fmtTokens(first.tokens)} to ${fmtTokens(last.tokens)} tokens.`;

  return `<div class="panel">
    <div class="panel-head">
      <div class="panel-title">Usage on OpenRouter</div>
      <div class="panel-sub">How much ${esc(disp)} is actually being run — not how it benchmarks</div>
    </div>
    <div class="panel-body">
      <div class="usage-stats">
        <div class="usage-stat">
          <div class="k">Board rank</div>
          <div class="v">#${u.latestRank} <span class="muted" style="font-size:13px;font-weight:400">of ${u.boardSize}</span></div>
        </div>
        <div class="usage-stat">
          <div class="k">Tokens, trailing week</div>
          <div class="v">${esc(fmtTokens(u.latestTokens))}</div>
        </div>
        ${pct !== null ? `<div class="usage-stat">
          <div class="k">Change vs 7 days earlier</div>
          <div class="v ${dir}">${pct >= 0 ? '+' : ''}${(pct * 100).toFixed(1)}%</div>
        </div>` : ''}
        ${rankMove !== null && rankMove !== 0 ? `<div class="usage-stat">
          <div class="k">Rank move</div>
          <div class="v ${rankMove > 0 ? 'up' : 'down'}">${rankMove > 0 ? '▲' : '▼'} ${Math.abs(rankMove)}</div>
        </div>` : ''}
      </div>
      <svg class="usage-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
           role="img" aria-label="${esc(aria)}" style="height:128px">
        <path d="${area}" fill="var(--accent)" opacity="0.13"/>
        <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2"
          vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>
      <div class="usage-axis"><span>${esc(first.day)}</span><span>${esc(last.day)}</span></div>
    </div>
    <div class="cite">
      Each point is the <strong>trailing seven-day</strong> token total as of that day, which is what
      OpenRouter's model leaderboard publishes — not that day's usage on its own. Sampled hourly by
      token.app and stored since ${esc(first.day)}; only the models currently on OpenRouter's board
      appear here, so a missing panel means we have no current data, not zero usage.
    </div>
  </div>`;
}

/**
 * "Where to run it" — the per-host price spread.
 *
 * The point is not the list, it is the two traps: a host can be cheapest because
 * it serves a fraction of the context window, or because it runs lower-precision
 * weights. Both are flagged inline against the best value available for the model,
 * so "cheapest" is never presented as unqualified good news.
 */
function hostsPanel(eps: ModelEndpoints | null, m: NormalizedModel): string {
  if (!eps || eps.endpoints.length < 2) return '';   // one host is not a comparison

  const priced = eps.endpoints.filter((e) => e.blendedPer1M !== null);
  if (priced.length < 2) return '';

  const lo = priced[0], hi = priced[priced.length - 1];
  const spread = lo.blendedPer1M! > 0 ? hi.blendedPer1M! / lo.blendedPer1M! : null;
  const bestCtx = Math.max(...eps.endpoints.map((e) => e.contextLength ?? 0));
  const showQuant = eps.endpoints.some((e) => e.quantization);
  const anyLong = eps.endpoints.some((e) => e.longContext);

  const rows = eps.endpoints.map((e) => {
    const warn: string[] = [];
    // Flag only a materially smaller window — trivial differences are noise.
    if (bestCtx > 0 && e.contextLength && e.contextLength < bestCtx * 0.9) {
      warn.push(`${fmtCtx(e.contextLength)} context, not ${fmtCtx(bestCtx)}`);
    }
    if (e.longContext) {
      warn.push(`re-prices above ${fmtCtx(e.longContext.minPromptTokens)} prompt tokens (${fmtP(e.longContext.inputPer1M)}/${fmtP(e.longContext.outputPer1M)})`);
    }
    return `<tr>
          <td><strong>${esc(e.label)}</strong>${warn.length ? `<div class="hostwarn">⚠ ${warn.map(esc).join(' · ')}</div>` : ''}</td>
          <td class="num${e === lo ? ' win' : ''}">${esc(fmtP(e.blendedPer1M))}</td>
          <td class="num muted">${esc(fmtP(e.inputPer1M))} / ${esc(fmtP(e.outputPer1M))}</td>
          <td class="num muted">${esc(fmtCtx(e.contextLength))}</td>
          ${showQuant ? `<td class="muted">${e.quantization ? esc(e.quantization) : '—'}</td>` : ''}
          <td class="num muted">${e.uptimeDay !== null ? e.uptimeDay.toFixed(1) + '%' : '—'}</td>
        </tr>`;
  }).join('\n        ');

  // Count PROVIDERS separately from endpoints. Several rows are often the same
  // provider at a different service tier or region — GPT-5.6 Sol spans 4× purely
  // across OpenAI's own flex/standard/priority tiers. Calling that "6 hosts, 4×
  // spread" would imply competition between vendors that isn't there.
  const providers = new Set(eps.endpoints.map((e) => e.provider));
  const optionWord = eps.endpoints.length === providers.size ? 'hosts' : 'options';
  const acrossBit = providers.size === eps.endpoints.length
    ? ''
    : ` across ${providers.size} provider${providers.size === 1 ? '' : 's'}`;
  const headline = spread && spread >= 1.05
    ? `${eps.endpoints.length} ${optionWord}${acrossBit} · ${spread.toFixed(spread >= 10 ? 0 : 1)}× between cheapest and dearest`
    : `${eps.endpoints.length} ${optionWord}${acrossBit} · all priced within ~5% of each other`;

  return `<div class="panel">
    <div class="panel-head">
      <div class="panel-title">Where to run ${esc(shortName(m.name))}</div>
      <div class="panel-sub">${esc(headline)}. Blended at 3:1. ⚠ marks an option serving less context than the best available, or re-pricing above a prompt-length threshold. Bracketed labels are the provider's own service tier or region.</div>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Host</th><th>Blended $/1M</th><th>In / Out</th><th>Context</th>${showQuant ? '<th>Weights</th>' : ''}<th>Uptime 24h</th></tr></thead>
      <tbody>
        ${rows}
      </tbody>
    </table></div>
    <div class="cite">Host prices and uptime from OpenRouter, synced ${esc((eps.fetchedAt || '').slice(0, 10))}.${showQuant ? ' Lower-precision weights (fp4, fp8) can cost less and score worse than the same model at bf16 — the score above is not host-specific.' : ''}${anyLong ? '' : ''}</div>
  </div>`;
}

// Lowest non-zero monthly price across a subscription's tiers, used for "from $X".
function cheapestPaid(s: Subscription): number | null {
  const prices = s.tiers
    .map((t) => t.monthlyPrice)
    .filter((p): p is number => p !== null && p !== undefined && p > 0);
  return prices.length ? Math.min(...prices) : null;
}

/**
 * Does this tier actually offer a cheaper annual rate?
 *
 * `annualMonthlyPrice === monthlyPrice` is this dataset's convention for "a price
 * exists and there is NO annual discount" — 59 of 123 tier pairs use it, and it is
 * distinct from `null`, which every occurrence pairs with a null monthlyPrice and so
 * means "no price published at all" (Enterprise / contact-sales).
 *
 * Mirrors the same test the main page has always applied (`template.ts`, tier-annual
 * line): an annual figure is only shown when it BEATS monthly. Printing an equal
 * figure under a column headed "Annual /mo" asserts a purchasable annual rate, which
 * for GitHub Copilot is affirmatively false — its annual plans closed 2026-06-01 —
 * and is merely noise for the other 58.
 */
function hasAnnualDiscount(t: SubscriptionTier): boolean {
  return t.annualMonthlyPrice !== null && t.annualMonthlyPrice !== undefined
    && t.annualMonthlyPrice < (t.monthlyPrice ?? Infinity);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Comparison pages — /compare/{a}-vs-{b}
// ═══════════════════════════════════════════════════════════════════════════════

export function getSubCompareHtml(params: {
  a: Subscription; b: Subscription; all: Subscription[];
}): string {
  const { a, b, all } = params;
  const url = `https://token.app/compare/${encodeURIComponent(a.id)}-vs-${encodeURIComponent(b.id)}`;
  const aMin = cheapestPaid(a), bMin = cheapestPaid(b);
  const aFree = a.tiers.some((t) => t.monthlyPrice === 0);
  const bFree = b.tiers.some((t) => t.monthlyPrice === 0);

  // Verdict is DERIVED, never asserted beyond what the data supports.
  const verdictBits: string[] = [];
  if (aMin !== null && bMin !== null) {
    if (aMin < bMin) verdictBits.push(`${a.name} starts cheaper (${fmtUsd(aMin)}/mo vs ${fmtUsd(bMin)}/mo).`);
    else if (bMin < aMin) verdictBits.push(`${b.name} starts cheaper (${fmtUsd(bMin)}/mo vs ${fmtUsd(aMin)}/mo).`);
    else verdictBits.push(`Both start at the same price, ${fmtUsd(aMin)}/mo.`);
  }
  if (aFree && !bFree) verdictBits.push(`${a.name} has a free tier; ${b.name} does not.`);
  if (bFree && !aFree) verdictBits.push(`${b.name} has a free tier; ${a.name} does not.`);
  if (aFree && bFree) verdictBits.push('Both offer a free tier.');

  function tierRows(s: Subscription): string {
    return s.tiers.map((t) => `<tr>
          <td><strong>${esc(t.name)}</strong>${t.badge ? ` <span class="chip">${esc(t.badge)}</span>` : ''}</td>
          <td class="num">${esc(fmtUsd(t.monthlyPrice))}${t.perSeat && t.monthlyPrice ? '<span class="muted">/seat</span>' : ''}</td>
          <td class="num muted">${hasAnnualDiscount(t) ? esc(fmtUsd(t.annualMonthlyPrice)) : '—'}</td>
        </tr>`).join('\n        ');
  }

  function featureList(s: Subscription): string {
    const top = s.tiers.find((t) => t.highlight) ?? s.tiers[s.tiers.length - 1];
    if (!top) return '<li class="muted">No features listed.</li>';
    return top.features.slice(0, 8).map((f) => `<li>${esc(f)}</li>`).join('\n        ');
  }

  const faqs = [
    {
      q: `Is ${a.name} or ${b.name} cheaper?`,
      a: aMin !== null && bMin !== null
        ? (aMin === bMin
            ? `Both start at ${fmtUsd(aMin)} per month for their cheapest paid tier.`
            : `${aMin < bMin ? a.name : b.name} is cheaper to start: ${fmtUsd(Math.min(aMin, bMin))} per month versus ${fmtUsd(Math.max(aMin, bMin))}. Higher tiers may change the picture — the full tier tables are on this page.`)
        : `Paid pricing is not published for at least one of these services, so a direct price comparison is not possible.`,
    },
    {
      q: `Does ${a.name} or ${b.name} have a free tier?`,
      a: aFree && bFree ? 'Both offer a free tier.'
        : aFree ? `${a.name} offers a free tier. ${b.name} does not.`
        : bFree ? `${b.name} offers a free tier. ${a.name} does not.`
        : 'Neither offers a free tier.',
    },
    {
      q: `What models power ${a.name} and ${b.name}?`,
      a: `${a.name}: ${(a.underlyingModels ?? []).length ? (a.underlyingModels ?? []).join(', ') : 'not publicly itemised'}. ` +
         `${b.name}: ${(b.underlyingModels ?? []).length ? (b.underlyingModels ?? []).join(', ') : 'not publicly itemised'}.`,
    },
    {
      q: 'How current are these prices?',
      a: `${a.name} was last verified against its own pricing page on ${a.lastVerified ?? 'an unrecorded date'}, and ${b.name} on ${b.lastVerified ?? 'an unrecorded date'}. ` +
         `We check prices by hand rather than scraping, and show the date so you can judge staleness yourself.`,
    },
  ];

  const related = all
    .filter((s) => s.id !== a.id && s.id !== b.id && s.category === a.category)
    .slice(0, 6);

  const body = `
  <div class="crumb"><a href="/">token.app</a> › Compare › ${esc(a.name)} vs ${esc(b.name)}</div>
  <h1>${esc(a.name)} vs ${esc(b.name)}</h1>
  <p class="lede">${esc(verdictBits.join(' '))} Prices below are the published list prices, each with the date we last checked it against the provider's own page.</p>

  <div class="grid2">
    ${[a, b].map((s) => `<div class="panel">
      <div class="panel-head">
        <div class="panel-title">${esc(s.name)}</div>
        <div class="panel-sub">${esc(s.description.slice(0, 110))}</div>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Tier</th><th>Monthly</th><th>Annual /mo</th></tr></thead>
        <tbody>
        ${tierRows(s)}
        </tbody>
      </table></div>
      <div class="cite">Last verified ${esc(s.lastVerified ?? 'not recorded')} · <a href="${esc(s.url)}" target="_blank" rel="noopener">Official pricing page</a></div>
    </div>`).join('\n    ')}
  </div>

  <div class="grid2">
    ${[a, b].map((s) => `<div class="panel">
      <div class="panel-head"><div class="panel-title">What you get with ${esc(s.name)}</div>
      <div class="panel-sub">Top paid tier</div></div>
      <div class="panel-body"><ul class="reasons">
        ${featureList(s)}
      </ul></div>
    </div>`).join('\n    ')}
  </div>

  <div class="panel">
    <div class="panel-head"><div class="panel-title">FAQ</div></div>
    <div class="panel-body">
    ${faqHtml(faqs)}
    </div>
  </div>

  ${related.length ? `<div class="panel">
    <div class="panel-head"><div class="panel-title">Related comparisons</div></div>
    <div class="panel-body"><div class="linkgrid">
      ${related.map((s) => `<a href="/compare/${encodeURIComponent(a.id)}-vs-${encodeURIComponent(s.id)}">${esc(a.name)} vs ${esc(s.name)}</a>`).join('\n      ')}
      ${related.slice(0, 3).map((s) => `<a href="/compare/${encodeURIComponent(b.id)}-vs-${encodeURIComponent(s.id)}">${esc(b.name)} vs ${esc(s.name)}</a>`).join('\n      ')}
    </div></div>
  </div>` : ''}`;

  return shell({
    title: `${a.name} vs ${b.name}: pricing & plans compared — token.app`,
    description: `${a.name} vs ${b.name} — every tier, monthly and annual pricing, and what each plan includes. ${verdictBits[0] ?? ''}`.trim(),
    canonical: url,
    backHref: '/',
    backLabel: 'All subscriptions',
    jsonLd: [faqJsonLd(faqs)],
    body,
  });
}

export function getModelCompareHtml(params: {
  a: NormalizedModel; b: NormalizedModel;
  all: NormalizedModel[]; benchmarks: BenchmarksPayload | null;
}): string {
  const { a, b, all, benchmarks } = params;
  const url = `https://token.app/compare/${encodeURIComponent(a.slug)}-vs-${encodeURIComponent(b.slug)}`;
  const an = shortName(a.name), bn = shortName(b.name);
  const ab = blended(a), bb = blended(b);
  const amb = benchOf(benchmarks, a.id), bmb = benchOf(benchmarks, b.id);

  // Head-to-head only over benchmarks BOTH models have — comparing a model's
  // GPQA against another's SWE-bench would be meaningless.
  const shared = (benchmarks?.benchmarks ?? [])
    .map((bm) => ({ bm, as: scoreCell(amb, bm.id), bs: scoreCell(bmb, bm.id) }))
    .filter((r) => r.as !== null && r.bs !== null) as { bm: { id: string; label: string; blurb: string }; as: number; bs: number }[];
  const aWins = shared.filter((r) => r.as > r.bs);
  const bWins = shared.filter((r) => r.bs > r.as);

  const verdict: string[] = [];
  if (shared.length) {
    if (aWins.length > bWins.length) verdict.push(`${an} leads on ${aWins.length} of ${shared.length} shared benchmarks.`);
    else if (bWins.length > aWins.length) verdict.push(`${bn} leads on ${bWins.length} of ${shared.length} shared benchmarks.`);
    else verdict.push(`${an} and ${bn} split the ${shared.length} shared benchmarks evenly.`);
  }
  if (ab !== null && bb !== null && ab !== bb) {
    const cheap = ab < bb ? an : bn;
    const lo = Math.min(ab, bb), hi = Math.max(ab, bb);
    // A free model blends to exactly 0, so the ratio is undefined — say "free"
    // rather than rendering "Infinity× cheaper".
    verdict.push(lo === 0
      ? `${cheap} is free to use, against ${fmtP(hi)} per million tokens.`
      : `${cheap} is ${(hi / lo).toFixed(hi / lo >= 10 ? 0 : 1)}× cheaper per token on a blended 3:1 basis.`);
  }
  if (a.contextWindow && b.contextWindow && a.contextWindow !== b.contextWindow) {
    const big = a.contextWindow > b.contextWindow ? a : b;
    verdict.push(`${shortName(big.name)} accepts the larger context window (${fmtCtx(big.contextWindow)}).`);
  }

  // "Winner" highlighting must require BOTH values to exist. Coalescing a missing
  // price to 0 would silently award the win to the model we have no data for.
  const lowerWins = (x: number | null | undefined, y: number | null | undefined) =>
    (typeof x === 'number' && typeof y === 'number' && x < y) ? ' win' : '';
  const higherWins = (x: number | null | undefined, y: number | null | undefined) =>
    (typeof x === 'number' && typeof y === 'number' && x > y) ? ' win' : '';

  function reasons(x: NormalizedModel, y: NormalizedModel, xb: number | null, yb: number | null, wins: typeof shared): string {
    const out: string[] = [];
    if (xb !== null && yb !== null && xb < yb) out.push(`Costs less per token — ${fmtP(xb)} vs ${fmtP(yb)} blended`);
    for (const w of wins.slice(0, 4)) {
      const xs = x.id === a.id ? w.as : w.bs, ys = x.id === a.id ? w.bs : w.as;
      out.push(`Higher ${w.bm.label} (${(xs * 100).toFixed(1)}% vs ${(ys * 100).toFixed(1)}%)`);
    }
    if (x.contextWindow && y.contextWindow && x.contextWindow > y.contextWindow) out.push(`Larger context window (${fmtCtx(x.contextWindow)})`);
    if (x.isOpenSource && !y.isOpenSource) out.push('Open weights — self-hostable');
    if ((x.createdAt ?? 0) > (y.createdAt ?? 0)) out.push(`Newer model (released ${fmtDate(x.createdAt)})`);
    return out.length ? out.map((r) => `<li>${esc(r)}</li>`).join('\n        ') : '<li class="muted">No clear advantage on the data we hold.</li>';
  }

  const faqs = [
    {
      q: `Which is better, ${an} or ${bn}?`,
      a: shared.length
        ? `Across the ${shared.length} benchmark${shared.length === 1 ? '' : 's'} both models have independently-run scores for, ${an} leads on ${aWins.length} and ${bn} leads on ${bWins.length}. ` +
          `Benchmarks are one input — price and context window are on this page too.`
        : `We do not hold independently-run benchmark scores covering both ${an} and ${bn}, so we make no quality claim. Their pricing and specifications are compared on this page.`,
    },
    {
      q: `Is ${an} cheaper than ${bn}?`,
      a: ab !== null && bb !== null
        ? (ab === bb
            ? `They cost the same on a blended 3:1 basis: ${fmtP(ab)} per million tokens.`
            : `${ab < bb ? an : bn} is cheaper: ${fmtP(Math.min(ab, bb))} versus ${fmtP(Math.max(ab, bb))} per million tokens blended at 3:1 input:output. ` +
              `Input alone: ${fmtP(a.inputPer1M)} vs ${fmtP(b.inputPer1M)}. Output alone: ${fmtP(a.outputPer1M)} vs ${fmtP(b.outputPer1M)}.`)
        : 'Pricing is not published for at least one of these models.',
    },
    {
      q: `What context windows do ${an} and ${bn} have?`,
      a: `${an}: ${a.contextWindow ? a.contextWindow.toLocaleString() + ' tokens' : 'not published'}. ${bn}: ${b.contextWindow ? b.contextWindow.toLocaleString() + ' tokens' : 'not published'}.`,
    },
    {
      q: `Who makes ${an} and ${bn}?`,
      a: `${an} is made by ${a.provider}. ${bn} is made by ${b.provider}.`,
    },
  ];

  const relatedA = all.filter((o) => o.id !== a.id && o.id !== b.id && !o.isDeprecated && blended(o) !== null)
    .sort((x, y) => (y.createdAt ?? 0) - (x.createdAt ?? 0)).slice(0, 6);

  const body = `
  <div class="crumb"><a href="/">token.app</a> › Compare › ${esc(an)} vs ${esc(bn)}</div>
  <h1>${esc(an)} vs ${esc(bn)}</h1>
  <p class="lede">${esc(verdict.join(' ')) || 'Side-by-side pricing, context and specification.'}</p>

  <div class="panel">
    <div class="panel-head"><div class="panel-title">Head to head</div><div class="panel-sub">Blended price uses a 3:1 input:output mix</div></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th></th><th>${esc(an)}</th><th>${esc(bn)}</th></tr></thead>
      <tbody>
        <tr><td class="stat-k">Provider</td><td>${esc(a.provider)}</td><td>${esc(b.provider)}</td></tr>
        <tr><td class="stat-k">Input $/1M</td><td class="num${lowerWins(a.inputPer1M, b.inputPer1M)}">${esc(fmtP(a.inputPer1M))}</td><td class="num${lowerWins(b.inputPer1M, a.inputPer1M)}">${esc(fmtP(b.inputPer1M))}</td></tr>
        <tr><td class="stat-k">Output $/1M</td><td class="num${lowerWins(a.outputPer1M, b.outputPer1M)}">${esc(fmtP(a.outputPer1M))}</td><td class="num${lowerWins(b.outputPer1M, a.outputPer1M)}">${esc(fmtP(b.outputPer1M))}</td></tr>
        <tr><td class="stat-k">Blended $/1M</td><td class="num${lowerWins(ab, bb)}">${esc(fmtP(ab))}</td><td class="num${lowerWins(bb, ab)}">${esc(fmtP(bb))}</td></tr>
        <tr><td class="stat-k">Context window</td><td class="num${higherWins(a.contextWindow, b.contextWindow)}">${esc(fmtCtx(a.contextWindow))}</td><td class="num${higherWins(b.contextWindow, a.contextWindow)}">${esc(fmtCtx(b.contextWindow))}</td></tr>
        <tr><td class="stat-k">Max output</td><td class="num${higherWins(a.maxOutput, b.maxOutput)}">${esc(fmtCtx(a.maxOutput))}</td><td class="num${higherWins(b.maxOutput, a.maxOutput)}">${esc(fmtCtx(b.maxOutput))}</td></tr>
        <tr><td class="stat-k">Released</td><td>${esc(fmtDate(a.createdAt))}</td><td>${esc(fmtDate(b.createdAt))}</td></tr>
        <tr><td class="stat-k">Licence</td><td>${a.isOpenSource ? 'Open weights' : 'Proprietary'}</td><td>${b.isOpenSource ? 'Open weights' : 'Proprietary'}</td></tr>
        ${shared.map((r) => `<tr>
          <td class="stat-k">${esc(r.bm.label)}</td>
          <td class="num${r.as > r.bs ? ' win' : ''}">${(r.as * 100).toFixed(1)}%</td>
          <td class="num${r.bs > r.as ? ' win' : ''}">${(r.bs * 100).toFixed(1)}%</td>
        </tr>`).join('\n        ')}
      </tbody>
    </table></div>
    ${shared.length && benchmarks ? `<div class="cite">Benchmark scores independently run and published by <a href="${esc(benchmarks.attribution.url)}" target="_blank" rel="noopener">${esc(benchmarks.attribution.text)}</a>, used under <a href="${esc(benchmarks.attribution.licenseUrl)}" target="_blank" rel="noopener">${esc(benchmarks.attribution.license)}</a>. Only benchmarks with a score for BOTH models are compared.</div>` : ''}
  </div>

  <div class="grid2">
    <div class="panel">
      <div class="panel-head"><div class="panel-title">Choose ${esc(an)} if…</div></div>
      <div class="panel-body"><ul class="reasons">
        ${reasons(a, b, ab, bb, aWins)}
      </ul></div>
    </div>
    <div class="panel">
      <div class="panel-head"><div class="panel-title">Choose ${esc(bn)} if…</div></div>
      <div class="panel-body"><ul class="reasons">
        ${reasons(b, a, bb, ab, bWins)}
      </ul></div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-head"><div class="panel-title">FAQ</div></div>
    <div class="panel-body">
    ${faqHtml(faqs)}
    </div>
  </div>

  <div class="panel">
    <div class="panel-head"><div class="panel-title">Related comparisons</div></div>
    <div class="panel-body"><div class="linkgrid">
      <a href="/model/${encodeURIComponent(a.slug)}">${esc(an)} full details</a>
      <a href="/model/${encodeURIComponent(b.slug)}">${esc(bn)} full details</a>
      ${relatedA.map((o) => `<a href="/compare/${encodeURIComponent(a.slug)}-vs-${encodeURIComponent(o.slug)}">${esc(an)} vs ${esc(shortName(o.name))}</a>`).join('\n      ')}
    </div></div>
  </div>`;

  return shell({
    title: `${an} vs ${bn}: price, context & benchmarks — token.app`,
    description: `${an} vs ${bn} compared on price per token, context window and independently-run benchmarks. ${verdict[0] ?? ''}`.trim(),
    canonical: url,
    backHref: '/',
    backLabel: 'All models',
    jsonLd: [faqJsonLd(faqs)],
    body,
  });
}
