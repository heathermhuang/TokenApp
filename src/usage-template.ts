// SSR template for /usage — the AI usage dashboard.
//
// Data flow: user pastes a `tokenapp.usage.v1` block → client JS parses, prices
// against the inlined model table, renders charts, persists to localStorage.
// Nothing leaves the browser. The server just ships the shell + price table.
//
// This file is deliberately split from template.ts (which is already 2900 lines)
// so the usage dashboard can iterate without churning the main page.

import { USAGE_PROMPTS } from './usage-prompts';

export function getUsageHtml(params: {
  initialModels?: string;       // JSON string of NormalizedModel[]
  initialSubscriptions?: string;// JSON string of Subscription[]
  lastUpdated?: string | null;
}): string {
  // Escape backticks and ${ so injected JSON / prompts don't break the template literal.
  const safeLiteral = (s: string): string => s.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

  const initialModels = safeLiteral(params.initialModels ?? '[]');
  const initialSubscriptions = safeLiteral(params.initialSubscriptions ?? '[]');
  const promptsJson = safeLiteral(JSON.stringify(USAGE_PROMPTS));

  const updatedStr = params.lastUpdated
    ? new Date(params.lastUpdated).toUTCString()
    : 'never';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Usage Dashboard — token.app</title>
  <meta name="description" content="Track and benchmark your AI API and subscription spend. Paste a usage export from any provider and see spend over time, model breakdown, and subscription breakeven — all computed in your browser." />
  <meta name="robots" content="index, follow" />
  <meta property="og:title" content="AI Usage Dashboard — token.app" />
  <meta property="og:description" content="Track and benchmark your AI API spend. Private by design — usage data never leaves your browser." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://token.app/usage" />
  <meta property="og:site_name" content="token.app" />
  <meta property="og:image" content="https://token.app/og.png" />
  <link rel="canonical" href="https://token.app/usage" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔷</text></svg>" />
  <script>(function(){var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);})();</script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0c0c0e; --surface: #141418; --surface2: #1c1c22;
      --border: #27272f; --border2: #33333d;
      --text: #f0f0f4; --text2: #9090a0; --text3: #606070;
      --accent: #6366f1; --accent-dim: rgba(99,102,241,0.15);
      --success: #22c55e; --warning: #f59e0b; --danger: #ef4444;
      --radius: 8px; --nav-bg: rgba(12,12,14,0.88);
    }
    html[data-theme="light"] {
      --bg: #f4f4f8; --surface: #ffffff; --surface2: #ebebf2;
      --border: #dcdce8; --border2: #c8c8d8;
      --text: #111118; --text2: #3d3d52; --text3: #62627a;
      --accent: #4746b8; --accent-dim: rgba(71,70,184,0.1);
      --nav-bg: rgba(244,244,248,0.92);
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); font-size: 14px; line-height: 1.55; min-height: 100vh; }
    nav { position: sticky; top: 0; z-index: 100; background: var(--nav-bg); backdrop-filter: blur(14px); border-bottom: 1px solid var(--border); padding: 0 24px; height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .nav-brand { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: var(--text); text-decoration: none; letter-spacing: -0.3px; }
    .nav-brand .diamond { color: var(--accent); font-size: 18px; }
    .nav-links { display: flex; gap: 20px; align-items: center; }
    .nav-links a { font-size: 13px; color: var(--text2); text-decoration: none; }
    .nav-links a:hover, .nav-links a.active { color: var(--text); }
    .nav-links a.active { color: var(--accent); }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 24px 80px; }
    h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.4px; margin-bottom: 4px; }
    .subtitle { font-size: 14px; color: var(--text2); margin-bottom: 24px; }
    .subtitle .pill { display: inline-block; background: var(--accent-dim); color: var(--accent); border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 600; margin-left: 6px; letter-spacing: 0.02em; }

    /* Cards */
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 16px; }
    .card h2 { font-size: 13px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 14px; }
    .card h2 .count { color: var(--text2); font-weight: 500; margin-left: 6px; text-transform: none; letter-spacing: 0; }

    /* Import block */
    .import-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 780px) { .import-grid { grid-template-columns: 1fr; } }
    .prompt-list { display: flex; flex-direction: column; gap: 8px; }
    .prompt-btn { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 12px 14px; color: var(--text); text-align: left; cursor: pointer; font-family: inherit; font-size: 13px; transition: border-color 120ms; }
    .prompt-btn:hover { border-color: var(--accent); }
    .prompt-btn .prompt-title { font-weight: 600; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .prompt-btn .prompt-subtitle { color: var(--text2); font-size: 12px; margin-top: 3px; line-height: 1.4; }
    .prompt-btn .copy-badge { font-size: 10px; color: var(--text3); font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; }
    .prompt-btn.copied { border-color: var(--success); }
    .prompt-btn.copied .copy-badge { color: var(--success); }

    textarea#paste { width: 100%; min-height: 180px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; color: var(--text); padding: 12px 14px; font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 12px; line-height: 1.55; resize: vertical; }
    textarea#paste:focus { outline: none; border-color: var(--accent); }
    .paste-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; gap: 12px; flex-wrap: wrap; }
    .btn { background: var(--accent); color: white; border: none; border-radius: 6px; padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
    .btn:hover { filter: brightness(1.1); }
    .btn.ghost { background: transparent; color: var(--text2); border: 1px solid var(--border); }
    .btn.ghost:hover { color: var(--text); border-color: var(--border2); }
    .btn.danger { background: transparent; color: var(--danger); border: 1px solid var(--border); }
    .btn.danger:hover { border-color: var(--danger); }

    .notice { font-size: 12px; color: var(--text2); }
    .notice.error { color: var(--danger); }
    .notice.warn { color: var(--warning); }
    .notice.ok { color: var(--success); }
    .privacy-note { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text3); }
    .privacy-note::before { content: '🔒'; font-size: 11px; }

    /* KPI row */
    .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
    @media (max-width: 780px) { .kpi-row { grid-template-columns: repeat(2, 1fr); } }
    .kpi { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; }
    .kpi-label { font-size: 11px; color: var(--text3); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
    .kpi-value { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .kpi-sub { font-size: 11px; color: var(--text2); margin-top: 4px; }

    /* Chart */
    .chart-wrap { height: 200px; position: relative; }
    .chart-wrap svg { width: 100%; height: 100%; }
    .chart-bar { fill: var(--accent); opacity: 0.85; }
    .chart-bar:hover { opacity: 1; }
    .chart-axis { stroke: var(--border); stroke-width: 1; }
    .chart-label { fill: var(--text3); font-size: 10px; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead th { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); font-size: 11px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.04em; }
    thead th.num { text-align: right; }
    tbody td { padding: 10px; border-bottom: 1px solid var(--border); }
    tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }
    tbody tr:last-child td { border-bottom: none; }
    .provider-chip { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; background: var(--surface2); border: 1px solid var(--border); color: var(--text2); }
    .model-cell .model-name { font-weight: 500; display: block; }
    .model-cell .model-provider { font-size: 11px; color: var(--text3); }
    .bad { color: var(--danger); }
    .good { color: var(--success); }
    .muted { color: var(--text3); }

    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }

    /* Breakeven / equivalents */
    .sub-row, .alt-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 13px; gap: 10px; }
    .sub-row:last-child, .alt-row:last-child { border-bottom: none; }
    .sub-row .sub-name { font-weight: 500; }
    .sub-row .sub-tier { color: var(--text3); font-size: 11px; }
    .sub-row .sub-price { color: var(--text); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .alt-row .alt-save { color: var(--success); font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .alt-row .alt-caveat { color: var(--text3); font-size: 11px; margin-top: 2px; }

    .empty { text-align: center; padding: 60px 20px; color: var(--text2); }
    .empty h3 { font-size: 16px; color: var(--text); margin-bottom: 6px; }
    .empty p { font-size: 13px; max-width: 440px; margin: 0 auto; }

    /* Modal */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; display: none; align-items: center; justify-content: center; padding: 24px; }
    .modal-backdrop.open { display: flex; }
    .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; width: 100%; max-width: 720px; max-height: 86vh; display: flex; flex-direction: column; overflow: hidden; }
    .modal-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .modal-header h3 { font-size: 15px; font-weight: 600; }
    .modal-close { background: none; border: none; color: var(--text2); cursor: pointer; font-size: 20px; line-height: 1; padding: 2px 6px; }
    .modal-body { padding: 20px; overflow: auto; }
    .modal-where { color: var(--text2); font-size: 13px; margin-bottom: 12px; }
    .modal-prompt { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 14px; font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 12px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; color: var(--text); max-height: 50vh; overflow: auto; }
    .modal-footer { padding: 14px 20px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; }

    footer { border-top: 1px solid var(--border); padding: 20px 24px; text-align: center; font-size: 12px; color: var(--text3); }
    footer a { color: var(--text3); text-decoration: none; }
    footer a:hover { color: var(--text2); }
  </style>
</head>
<body>
<nav>
  <a href="/" class="nav-brand"><span class="diamond">◈</span> token.app</a>
  <div class="nav-links">
    <a href="/">Pricing</a>
    <a href="/usage" class="active">Usage</a>
    <a href="/about">About</a>
  </div>
</nav>

<main>
  <h1>Usage Dashboard <span class="pill" style="color: var(--accent); background: var(--accent-dim); font-size: 10px; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.04em;">BETA</span></h1>
  <p class="subtitle">Track your AI API and subscription spend. Paste an export from any provider and we'll chart it against live list prices. <span class="privacy-note">Everything stays in your browser.</span></p>

  <!-- Import card -->
  <div class="card" id="import-card">
    <h2>Load usage</h2>
    <div class="import-grid">
      <div>
        <p class="notice" style="margin-bottom: 10px;">Click a prompt, copy it, and use your AI of choice to generate a standardized block.</p>
        <div class="prompt-list" id="prompt-list"></div>
      </div>
      <div>
        <p class="notice" style="margin-bottom: 10px;">Then paste the <code style="background:var(--surface2);padding:1px 5px;border-radius:3px;">tokenapp-usage</code> block below:</p>
        <textarea id="paste" placeholder='\`\`\`tokenapp-usage\n{\n  "schema": "tokenapp.usage.v1",\n  "source": "openrouter",\n  "events": [ ... ]\n}\n\`\`\`'></textarea>
        <div class="paste-footer">
          <div>
            <button class="btn" id="import-btn">Import</button>
            <button class="btn ghost" id="sample-btn" type="button">Load sample</button>
          </div>
          <span class="notice" id="import-status"></span>
        </div>
      </div>
    </div>
  </div>

  <!-- Dashboard (hidden until data) -->
  <div id="dash" hidden>
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-label">Total spend</div><div class="kpi-value" id="kpi-spend">—</div><div class="kpi-sub" id="kpi-spend-sub"></div></div>
      <div class="kpi"><div class="kpi-label">Avg / day</div><div class="kpi-value" id="kpi-avg">—</div><div class="kpi-sub" id="kpi-avg-sub"></div></div>
      <div class="kpi"><div class="kpi-label">Tokens (in / out)</div><div class="kpi-value" id="kpi-tokens">—</div><div class="kpi-sub" id="kpi-tokens-sub"></div></div>
      <div class="kpi"><div class="kpi-label">Requests</div><div class="kpi-value" id="kpi-requests">—</div><div class="kpi-sub" id="kpi-requests-sub"></div></div>
    </div>

    <div class="card">
      <h2>Spend over time <span class="count" id="spend-range"></span></h2>
      <div class="chart-wrap"><svg id="chart" preserveAspectRatio="none"></svg></div>
    </div>

    <div class="two-col">
      <div class="card">
        <h2>By model <span class="count" id="model-count"></span></h2>
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th class="num">Spend</th>
              <th class="num">Eff. $/1M out</th>
              <th class="num">List $/1M out</th>
            </tr>
          </thead>
          <tbody id="model-table"></tbody>
        </table>
      </div>
      <div class="card">
        <h2>By provider</h2>
        <table>
          <thead>
            <tr><th>Provider</th><th class="num">Spend</th><th class="num">Share</th></tr>
          </thead>
          <tbody id="provider-table"></tbody>
        </table>
      </div>
    </div>

    <div class="two-col">
      <div class="card">
        <h2>Subscription breakeven</h2>
        <p class="notice" style="margin-bottom: 10px;">Your API spend expressed as months of each subscription. <strong class="muted">"≥ 1 month"</strong> usually means the sub is cheaper for your pattern.</p>
        <div id="breakeven-list"></div>
      </div>
      <div class="card">
        <h2>Cheaper equivalents</h2>
        <p class="notice" style="margin-bottom: 10px;">Models that could handle your workload at lower cost. Always validate quality before switching.</p>
        <div id="equivalents-list"></div>
      </div>
    </div>

    <div class="card">
      <h2>Data management</h2>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn ghost" id="export-btn">Export as JSON</button>
        <button class="btn danger" id="clear-btn">Clear all usage data</button>
        <span class="notice" id="storage-info" style="margin-left: auto; align-self: center;"></span>
      </div>
    </div>
  </div>

  <div class="empty" id="empty-state">
    <h3>No usage loaded yet</h3>
    <p>Pick a prompt above, run it with the AI of your choice, and paste the result. Or click <strong>Load sample</strong> to see how the dashboard looks.</p>
  </div>
</main>

<!-- Prompt modal -->
<div class="modal-backdrop" id="modal">
  <div class="modal">
    <div class="modal-header">
      <h3 id="modal-title"></h3>
      <button class="modal-close" type="button" data-close>✕</button>
    </div>
    <div class="modal-body">
      <p class="modal-where" id="modal-where"></p>
      <div class="modal-prompt" id="modal-prompt"></div>
    </div>
    <div class="modal-footer">
      <button class="btn ghost" type="button" data-close>Close</button>
      <button class="btn" type="button" id="modal-copy">Copy prompt</button>
    </div>
  </div>
</div>

<footer>
  <p>Pricing updated ${updatedStr} · Built on <a href="https://workers.cloudflare.com">Cloudflare Workers</a> · <a href="https://measurable.ai" target="_blank" rel="noopener">Measurable AI</a></p>
  <p style="margin-top:6px;"><a href="/">Pricing</a> · <a href="/about">About</a> · <a href="https://measurable.ai/en-US/privacyPolicy" target="_blank" rel="noopener">Privacy</a></p>
</footer>

<script>
(function() {
  'use strict';

  // ── Data injected from the server ────────────────────────────────────────
  const MODELS = ${initialModels};
  const SUBSCRIPTIONS = ${initialSubscriptions};
  const PROMPTS = ${promptsJson};
  const LS_KEY = 'tokenapp:usage:v1';

  // ── Utility ──────────────────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const fmtMoney = (n) => {
    if (n == null || isNaN(n)) return '—';
    if (Math.abs(n) >= 1000) return '$' + n.toFixed(0);
    if (Math.abs(n) >= 1) return '$' + n.toFixed(2);
    return '$' + n.toFixed(4);
  };
  const fmtTokens = (n) => {
    if (!n) return '0';
    if (n >= 1e9) return (n/1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
    return String(n);
  };
  const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  // ── Parser (mirrors usage-schema.ts) ─────────────────────────────────────
  const FENCE_RE = /\`\`\`tokenapp-usage\\s*\\n([\\s\\S]*?)\\n\`\`\`/;

  function extractJson(text) {
    const m = FENCE_RE.exec(text);
    if (m && m[1]) return m[1].trim();
    const t = text.trim();
    if (t.startsWith('{') && t.endsWith('}')) return t;
    return null;
  }

  function normalizeModelId(raw) {
    if (!raw) return '';
    let id = String(raw).toLowerCase().trim();
    id = id.replace(/^(openai|anthropic|google|meta-llama|meta|mistralai|mistral|deepseek|x-ai|xai|qwen|cohere|nvidia|amazon)\\//, '');
    id = id.replace(/-\\d{8}$/, '');
    id = id.replace(/-\\d{4}-\\d{2}-\\d{2}$/, '');
    return id;
  }

  function inferProvider(modelId, hinted) {
    const map = { meta: 'meta-llama', xai: 'x-ai', mistral: 'mistralai' };
    if (hinted) { const h = String(hinted).toLowerCase(); return map[h] || h; }
    const id = modelId.toLowerCase();
    if (/^(gpt|o1|o3|o4|text-)/.test(id)) return 'openai';
    if (id.startsWith('claude')) return 'anthropic';
    if (/^(gemini|gemma|palm)/.test(id)) return 'google';
    if (id.startsWith('llama')) return 'meta-llama';
    if (/^(mistral|mixtral|codestral)/.test(id)) return 'mistralai';
    if (id.startsWith('deepseek')) return 'deepseek';
    if (id.startsWith('grok')) return 'x-ai';
    if (/^(qwen|qwq)/.test(id)) return 'qwen';
    if (id.startsWith('command')) return 'cohere';
    return 'other';
  }

  function parsePaste(text) {
    const errors = [], warnings = [];
    const jsonStr = extractJson(text);
    if (!jsonStr) return { ok: false, errors: ['No tokenapp-usage fenced block found. Paste the full output from the AI prompt.'], warnings };
    let obj;
    try { obj = JSON.parse(jsonStr); } catch (e) { return { ok: false, errors: ['JSON parse failed: ' + e.message], warnings }; }
    if (!obj || obj.schema !== 'tokenapp.usage.v1') return { ok: false, errors: ['Unexpected schema. Expected tokenapp.usage.v1.'], warnings };

    const events = [];
    (Array.isArray(obj.events) ? obj.events : []).forEach((e, i) => {
      if (!e || typeof e !== 'object') return;
      if (!e.ts || !e.modelId) { warnings.push('event[' + i + '] dropped: missing ts or modelId'); return; }
      const d = new Date(e.ts);
      if (isNaN(d.getTime())) { warnings.push('event[' + i + '] dropped: invalid ts'); return; }
      const modelId = normalizeModelId(e.modelId);
      const provider = inferProvider(modelId, e.provider);
      const num = (v) => (v == null || v === '' ? null : (isNaN(+v) ? null : +v));
      const nnz = (v) => Math.max(0, Math.floor(num(v) || 0));
      events.push({
        ts: d.toISOString(), provider, modelId,
        inputTokens: num(e.inputTokens), outputTokens: num(e.outputTokens),
        cachedInputTokens: nnz(e.cachedInputTokens), cacheCreationTokens: nnz(e.cacheCreationTokens),
        requests: num(e.requests), costUSD: num(e.costUSD),
        sessionId: e.sessionId ? String(e.sessionId).slice(0, 32) : undefined,
        taskContext: e.taskContext ? String(e.taskContext).slice(0, 64) : undefined,
      });
    });
    if (!events.length) return { ok: false, errors: ['No valid events found in the paste.'], warnings };
    return { ok: true, data: { schema: 'tokenapp.usage.v1', source: obj.source || 'other', capturedAt: obj.capturedAt || new Date().toISOString(), currency: obj.currency || 'USD', events, notes: obj.notes }, errors, warnings };
  }

  function fingerprint(e) {
    return [e.ts.slice(0,10), e.provider, e.modelId, e.inputTokens ?? 'n', e.outputTokens ?? 'n', e.sessionId || ''].join('|');
  }

  // ── Pricer + aggregator (mirrors usage-pricer.ts) ────────────────────────
  function slugCandidates(slug) {
    const s = slug.toLowerCase();
    const out = new Set([s]);
    out.add(s.replace(/-(\\d+)-(\\d+)(?=$|[-:])/g, '-$1.$2'));
    out.add(s.replace(/-(\\d+)\\.(\\d+)(?=$|[-:])/g, '-$1-$2'));
    return Array.from(out);
  }
  function findModel(modelId, provider) {
    const p = provider.toLowerCase();
    const inProv = MODELS.filter(x => x.providerId.toLowerCase() === p);
    for (const m of slugCandidates(modelId)) {
      const hit = MODELS.find(x => x.id.toLowerCase() === p + '/' + m)
               || inProv.find(x => x.slug.toLowerCase() === m)
               || inProv.filter(x => x.slug.toLowerCase().startsWith(m + '-')).sort((a,b)=>a.slug.length-b.slug.length)[0]
               || MODELS.find(x => x.slug.toLowerCase() === m);
      if (hit) return hit;
    }
    return null;
  }

  function priceEvent(e) {
    const hit = findModel(e.modelId, e.provider);
    let computed = null;
    if (hit && e.inputTokens != null && e.outputTokens != null) {
      const ip = hit.inputPer1M || 0, op = hit.outputPer1M || 0;
      computed = ip * (e.inputTokens / 1e6) + op * (e.outputTokens / 1e6) + ip * 0.1 * ((e.cachedInputTokens || 0) / 1e6);
    }
    return Object.assign({}, e, {
      // Canonicalize so dash/dot variants of the same model aggregate together.
      modelId: hit ? hit.slug : e.modelId,
      provider: hit ? hit.providerId : e.provider,
      effectiveCostUSD: e.costUSD != null ? e.costUSD : (computed || 0),
      computedCostUSD: computed,
      listInputPer1M: hit ? hit.inputPer1M : null,
      listOutputPer1M: hit ? hit.outputPer1M : null,
      modelMatched: !!hit,
    });
  }

  function buildDashboard(events) {
    const priced = events.map(priceEvent);
    const totals = { events: priced.length, daysCovered: 0, firstDay: null, lastDay: null, totalCostUSD: 0, computedCostUSD: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, requests: 0 };
    const days = new Set();
    const byDay = {};
    const byModel = {};
    const byProvider = {};
    const unmatched = new Set();

    for (const p of priced) {
      const day = p.ts.slice(0, 10);
      days.add(day);
      totals.totalCostUSD += p.effectiveCostUSD;
      if (p.computedCostUSD != null) totals.computedCostUSD += p.computedCostUSD;
      totals.inputTokens += p.inputTokens || 0;
      totals.outputTokens += p.outputTokens || 0;
      totals.cachedInputTokens += p.cachedInputTokens || 0;
      totals.requests += p.requests || 0;
      byDay[day] = byDay[day] || { costUSD: 0, inputTokens: 0, outputTokens: 0 };
      byDay[day].costUSD += p.effectiveCostUSD;
      byDay[day].inputTokens += p.inputTokens || 0;
      byDay[day].outputTokens += p.outputTokens || 0;

      const key = p.provider + '/' + p.modelId;
      byModel[key] = byModel[key] || { modelId: p.modelId, provider: p.provider, costUSD: 0, inputTokens: 0, outputTokens: 0, requests: 0, effectiveOutputPer1M: null, listInputPer1M: p.listInputPer1M, listOutputPer1M: p.listOutputPer1M, matched: p.modelMatched };
      const row = byModel[key];
      row.costUSD += p.effectiveCostUSD;
      row.inputTokens += p.inputTokens || 0;
      row.outputTokens += p.outputTokens || 0;
      row.requests += p.requests || 0;
      byProvider[p.provider] = (byProvider[p.provider] || 0) + p.effectiveCostUSD;
      if (!p.modelMatched) unmatched.add(p.provider + '/' + p.modelId);
    }

    for (const k in byModel) {
      const row = byModel[k];
      if (row.listInputPer1M != null && row.listOutputPer1M != null && row.inputTokens + row.outputTokens > 0) {
        const inW = row.listInputPer1M * row.inputTokens;
        const outW = row.listOutputPer1M * row.outputTokens;
        const tot = inW + outW;
        if (tot > 0 && row.outputTokens > 0) {
          const outCost = row.costUSD * (outW / tot);
          row.effectiveOutputPer1M = outCost / (row.outputTokens / 1e6);
        }
      }
    }

    totals.daysCovered = days.size;
    const sortedDays = Array.from(days).sort();
    totals.firstDay = sortedDays[0] || null;
    totals.lastDay = sortedDays[sortedDays.length - 1] || null;

    const spendOverTime = sortedDays.map(d => ({ day: d, costUSD: byDay[d].costUSD, inputTokens: byDay[d].inputTokens, outputTokens: byDay[d].outputTokens }));
    const byModelArr = Object.values(byModel).sort((a, b) => b.costUSD - a.costUSD);
    const byProviderArr = Object.entries(byProvider).map(([providerId, costUSD]) => ({ providerId, costUSD, share: totals.totalCostUSD > 0 ? costUSD / totals.totalCostUSD : 0 })).sort((a, b) => b.costUSD - a.costUSD);

    // Subscription breakeven
    const monthlyEst = totals.daysCovered >= 7 ? (totals.totalCostUSD / totals.daysCovered) * 30 : totals.totalCostUSD;
    const topModelIds = new Set(byModelArr.slice(0, 5).map(m => m.modelId));
    const subBreakeven = [];
    for (const sub of SUBSCRIPTIONS) {
      for (const tier of (sub.tiers || [])) {
        if (tier.monthlyPrice == null || tier.monthlyPrice <= 0) continue;
        const matches = (sub.underlyingModels || []).some(m => topModelIds.has(m.toLowerCase().replace(/^.+?\\//, '')));
        subBreakeven.push({ subscriptionId: sub.id, subscriptionName: sub.name, tierName: tier.name, monthlyPriceUSD: tier.monthlyPrice, monthsCoveredByAPISpend: monthlyEst > 0 ? monthlyEst / tier.monthlyPrice : 0, matchesUnderlyingModels: matches });
      }
    }
    subBreakeven.sort((a, b) => (a.matchesUnderlyingModels === b.matchesUnderlyingModels ? b.monthsCoveredByAPISpend - a.monthsCoveredByAPISpend : (a.matchesUnderlyingModels ? -1 : 1)));

    // Cheaper equivalents
    const equivs = [];
    for (const m of byModelArr.slice(0, 5)) {
      if (!m.matched || m.costUSD < 1) continue;
      const yours = MODELS.find(x => x.providerId.toLowerCase() === m.provider.toLowerCase() && x.slug.toLowerCase() === m.modelId.toLowerCase());
      if (!yours || yours.inputPer1M == null || yours.outputPer1M == null) continue;
      const yourBlended = (yours.inputPer1M + yours.outputPer1M * 3) / 4;
      const candidates = MODELS.filter(c => {
        if (c.id === yours.id) return false;
        if (c.inputPer1M == null || c.outputPer1M == null) return false;
        if (c.isDeprecated) return false;
        const b = (c.inputPer1M + c.outputPer1M * 3) / 4;
        if (b >= yourBlended * 0.5) return false;
        if (yours.isVision && !c.isVision) return false;
        if (yours.isReasoning && !c.isReasoning) return false;
        return true;
      }).sort((a, b) => {
        const sA = a.providerId === yours.providerId ? 0 : 1;
        const sB = b.providerId === yours.providerId ? 0 : 1;
        if (sA !== sB) return sA - sB;
        return (a.inputPer1M + a.outputPer1M * 3) - (b.inputPer1M + b.outputPer1M * 3);
      });
      const alt = candidates[0];
      if (!alt) continue;
      const altCost = alt.inputPer1M * (m.inputTokens / 1e6) + alt.outputPer1M * (m.outputTokens / 1e6);
      const saves = m.costUSD - altCost;
      if (saves <= 0) continue;
      equivs.push({
        yourModelId: yours.id, yourProvider: yours.providerId, yourCostUSD: m.costUSD,
        alternativeId: alt.id, alternativeProvider: alt.providerId, alternativeCostUSD: altCost,
        savingsUSD: saves, savingsPct: saves / m.costUSD,
        caveat: alt.providerId !== yours.providerId ? 'Cross-provider — validate quality first.' : 'Same provider — lighter model, may be less capable.',
      });
    }
    equivs.sort((a, b) => b.savingsUSD - a.savingsUSD);

    return { totals, spendOverTime, byModel: byModelArr, byProvider: byProviderArr, subBreakeven: subBreakeven.slice(0, 6), cheaperEquivalents: equivs.slice(0, 3), unmatchedModels: Array.from(unmatched) };
  }

  // ── Storage ──────────────────────────────────────────────────────────────
  function loadStore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return { version: 1, events: [], imports: [] };
      const s = JSON.parse(raw);
      if (!s || s.version !== 1) return { version: 1, events: [], imports: [] };
      return s;
    } catch { return { version: 1, events: [], imports: [] }; }
  }

  function saveStore(store) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch (e) { console.warn('localStorage full:', e); }
  }

  function mergeImport(store, exp) {
    const seen = new Set(store.events.map(fingerprint));
    let added = 0;
    for (const e of exp.events) {
      const fp = fingerprint(e);
      if (!seen.has(fp)) { store.events.push(e); seen.add(fp); added++; }
    }
    store.imports.push({ source: exp.source, capturedAt: exp.capturedAt, eventCount: added, notes: exp.notes });
    return { added, duplicates: exp.events.length - added };
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  function renderPromptList() {
    const list = $('#prompt-list');
    list.innerHTML = PROMPTS.map((p, i) => (
      '<button class="prompt-btn" type="button" data-idx="' + i + '">' +
        '<div class="prompt-title"><span>' + escape(p.title) + '</span><span class="copy-badge">View / Copy</span></div>' +
        '<div class="prompt-subtitle">' + escape(p.subtitle) + '</div>' +
      '</button>'
    )).join('');
  }

  function openModal(idx) {
    const p = PROMPTS[idx];
    $('#modal-title').textContent = p.title;
    $('#modal-where').textContent = p.where;
    $('#modal-prompt').textContent = p.body;
    $('#modal').classList.add('open');
    $('#modal-copy').dataset.idx = String(idx);
  }
  function closeModal() { $('#modal').classList.remove('open'); }

  async function copyPromptFromModal() {
    const idx = parseInt($('#modal-copy').dataset.idx || '0', 10);
    const p = PROMPTS[idx];
    try {
      await navigator.clipboard.writeText(p.body);
      $('#modal-copy').textContent = 'Copied ✓';
      // Highlight the corresponding button
      const btn = document.querySelector('.prompt-btn[data-idx="' + idx + '"]');
      if (btn) {
        btn.classList.add('copied');
        const badge = btn.querySelector('.copy-badge');
        if (badge) badge.textContent = 'Copied ✓';
        setTimeout(() => {
          btn.classList.remove('copied');
          if (badge) badge.textContent = 'View / Copy';
        }, 2500);
      }
      setTimeout(() => { $('#modal-copy').textContent = 'Copy prompt'; }, 1500);
    } catch { $('#modal-copy').textContent = 'Copy failed — select the text manually'; }
  }

  function renderDashboard(data) {
    const dash = $('#dash'), empty = $('#empty-state');
    if (!data.totals.events) { dash.hidden = true; empty.hidden = false; return; }
    dash.hidden = false; empty.hidden = true;

    // KPIs
    $('#kpi-spend').textContent = fmtMoney(data.totals.totalCostUSD);
    $('#kpi-spend-sub').textContent = data.totals.daysCovered + (data.totals.daysCovered === 1 ? ' day' : ' days') + ' covered';
    const avg = data.totals.daysCovered > 0 ? data.totals.totalCostUSD / data.totals.daysCovered : 0;
    $('#kpi-avg').textContent = fmtMoney(avg);
    $('#kpi-avg-sub').textContent = avg > 0 ? '~' + fmtMoney(avg * 30) + '/mo at this rate' : '';
    $('#kpi-tokens').textContent = fmtTokens(data.totals.inputTokens) + ' / ' + fmtTokens(data.totals.outputTokens);
    $('#kpi-tokens-sub').textContent = data.totals.cachedInputTokens ? fmtTokens(data.totals.cachedInputTokens) + ' cached' : 'in / out';
    $('#kpi-requests').textContent = data.totals.requests.toLocaleString();
    $('#kpi-requests-sub').textContent = data.totals.requests > 0 && data.totals.totalCostUSD > 0 ? fmtMoney(data.totals.totalCostUSD / data.totals.requests) + ' / req' : '';

    // Chart
    renderChart(data.spendOverTime);
    $('#spend-range').textContent = data.totals.firstDay && data.totals.lastDay
      ? data.totals.firstDay + ' → ' + data.totals.lastDay
      : '';

    // By model
    $('#model-count').textContent = '(' + data.byModel.length + ')';
    $('#model-table').innerHTML = data.byModel.slice(0, 12).map(r => {
      const effOut = r.effectiveOutputPer1M != null ? '$' + r.effectiveOutputPer1M.toFixed(2) : '<span class="muted">—</span>';
      const listOut = r.listOutputPer1M != null ? '$' + r.listOutputPer1M.toFixed(2) : '<span class="muted">—</span>';
      return '<tr>' +
        '<td class="model-cell"><span class="model-name">' + escape(r.modelId) + (r.matched ? '' : ' <span class="bad" title="Not matched to a priced model">⚠</span>') + '</span><span class="model-provider">' + escape(r.provider) + '</span></td>' +
        '<td class="num">' + fmtMoney(r.costUSD) + '</td>' +
        '<td class="num">' + effOut + '</td>' +
        '<td class="num">' + listOut + '</td>' +
      '</tr>';
    }).join('');

    // By provider
    $('#provider-table').innerHTML = data.byProvider.map(r =>
      '<tr><td><span class="provider-chip">' + escape(r.providerId) + '</span></td>' +
      '<td class="num">' + fmtMoney(r.costUSD) + '</td>' +
      '<td class="num">' + (r.share * 100).toFixed(1) + '%</td></tr>'
    ).join('');

    // Breakeven
    $('#breakeven-list').innerHTML = data.subBreakeven.length ? data.subBreakeven.map(s => {
      const months = s.monthsCoveredByAPISpend;
      const color = months >= 1 ? 'good' : months >= 0.5 ? 'warning' : 'muted';
      return '<div class="sub-row">' +
        '<div><div class="sub-name">' + escape(s.subscriptionName) + (s.matchesUnderlyingModels ? ' <span class="muted" style="font-weight:normal;font-size:11px;">(matches your usage)</span>' : '') + '</div>' +
        '<div class="sub-tier">' + escape(s.tierName) + ' · $' + s.monthlyPriceUSD.toFixed(2) + '/mo</div></div>' +
        '<div class="sub-price ' + color + '">' + months.toFixed(1) + ' mo</div>' +
      '</div>';
    }).join('') : '<p class="notice">No priced subscriptions available.</p>';

    // Equivalents
    $('#equivalents-list').innerHTML = data.cheaperEquivalents.length ? data.cheaperEquivalents.map(eq =>
      '<div class="alt-row">' +
        '<div><div><strong>' + escape(eq.alternativeId) + '</strong> instead of <strong>' + escape(eq.yourModelId) + '</strong></div>' +
        '<div class="alt-caveat">' + escape(eq.caveat) + '</div></div>' +
        '<div class="alt-save">save ' + fmtMoney(eq.savingsUSD) + '<br/><span class="muted" style="font-weight:normal;font-size:11px;">(' + (eq.savingsPct * 100).toFixed(0) + '% less)</span></div>' +
      '</div>'
    ).join('') : '<p class="notice">No material savings spotted — you\\'re already well-optimized for price.</p>';

    // Storage info
    const bytes = (localStorage.getItem(LS_KEY) || '').length;
    $('#storage-info').textContent = data.totals.events + ' events · ~' + (bytes / 1024).toFixed(1) + ' KB';
  }

  function renderChart(series) {
    const svg = $('#chart');
    const wrap = svg.parentElement;
    const W = wrap.clientWidth || 900, H = 200;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = '';
    if (!series.length) return;
    const max = Math.max.apply(null, series.map(s => s.costUSD)) || 1;
    const padL = 36, padR = 8, padT = 10, padB = 22;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const barW = Math.max(1, innerW / series.length - 2);

    let html = '';
    // Baseline
    html += '<line class="chart-axis" x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - padR) + '" y2="' + (H - padB) + '"/>';
    // Y labels (max and half)
    html += '<text class="chart-label" x="4" y="' + (padT + 4) + '">' + fmtMoney(max) + '</text>';
    html += '<text class="chart-label" x="4" y="' + (padT + innerH / 2 + 4) + '">' + fmtMoney(max / 2) + '</text>';
    html += '<text class="chart-label" x="4" y="' + (H - padB + 4) + '">$0</text>';

    series.forEach((s, i) => {
      const h = (s.costUSD / max) * innerH;
      const x = padL + i * (innerW / series.length) + 1;
      const y = H - padB - h;
      html += '<rect class="chart-bar" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + h.toFixed(1) + '"><title>' + s.day + ': ' + fmtMoney(s.costUSD) + '</title></rect>';
    });

    // X labels — first, middle, last
    const labels = [0, Math.floor(series.length / 2), series.length - 1].filter((v, i, a) => a.indexOf(v) === i);
    labels.forEach((i) => {
      const x = padL + i * (innerW / series.length) + barW / 2;
      html += '<text class="chart-label" x="' + x.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + series[i].day.slice(5) + '</text>';
    });

    svg.innerHTML = html;
  }

  // ── Flow controllers ─────────────────────────────────────────────────────
  function refresh() {
    const store = loadStore();
    const data = buildDashboard(store.events);
    renderDashboard(data);
  }

  function doImport() {
    const text = $('#paste').value;
    const status = $('#import-status');
    if (!text.trim()) { status.className = 'notice warn'; status.textContent = 'Nothing to import.'; return; }
    const parsed = parsePaste(text);
    if (!parsed.ok) {
      status.className = 'notice error';
      status.textContent = parsed.errors.join(' ');
      return;
    }
    const store = loadStore();
    const { added, duplicates } = mergeImport(store, parsed.data);
    saveStore(store);
    $('#paste').value = '';
    status.className = 'notice ok';
    const warn = parsed.warnings.length ? ' · ' + parsed.warnings.length + ' skipped' : '';
    status.textContent = 'Imported ' + added + ' events' + (duplicates ? ' (' + duplicates + ' duplicates)' : '') + warn + '.';
    refresh();
  }

  function doClear() {
    if (!confirm('Clear all stored usage data? This cannot be undone.')) return;
    localStorage.removeItem(LS_KEY);
    refresh();
    $('#import-status').textContent = '';
  }

  function doExport() {
    const store = loadStore();
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tokenapp-usage-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function loadSample() {
    const now = new Date();
    const day = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) + 'T12:00:00Z'; };
    const sample = {
      schema: 'tokenapp.usage.v1', source: 'openai-api', capturedAt: now.toISOString(), currency: 'USD',
      events: [
        { ts: day(14), provider: 'openai',    modelId: 'gpt-4o',              inputTokens: 180000, outputTokens: 42000, requests: 120, costUSD: null },
        { ts: day(10), provider: 'openai',    modelId: 'gpt-4o',              inputTokens: 220000, outputTokens: 51000, requests: 140, costUSD: null },
        { ts: day(7),  provider: 'anthropic', modelId: 'claude-sonnet-4.5',   inputTokens: 420000, outputTokens: 88000, requests: 210, costUSD: null },
        { ts: day(5),  provider: 'anthropic', modelId: 'claude-sonnet-4.5',   inputTokens: 390000, outputTokens: 76000, requests: 195, costUSD: null },
        { ts: day(3),  provider: 'openai',    modelId: 'o3',                  inputTokens: 98000,  outputTokens: 44000, requests: 38,  costUSD: null },
        { ts: day(1),  provider: 'anthropic', modelId: 'claude-sonnet-4.5',   inputTokens: 510000, outputTokens: 112000, requests: 280, costUSD: null },
      ],
      notes: 'Sample data for preview.'
    };
    $('#paste').value = '\`\`\`tokenapp-usage\\n' + JSON.stringify(sample, null, 2) + '\\n\`\`\`';
  }

  // ── Wiring ───────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    renderPromptList();
    $('#prompt-list').addEventListener('click', (e) => {
      const btn = e.target.closest('.prompt-btn');
      if (btn) openModal(parseInt(btn.dataset.idx, 10));
    });
    document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModal));
    $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    $('#modal-copy').addEventListener('click', copyPromptFromModal);
    $('#import-btn').addEventListener('click', doImport);
    $('#sample-btn').addEventListener('click', loadSample);
    $('#clear-btn').addEventListener('click', doClear);
    $('#export-btn').addEventListener('click', doExport);
    window.addEventListener('resize', refresh);
    refresh();
  });
})();
</script>

</body>
</html>`;
}
