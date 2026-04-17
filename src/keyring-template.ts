// SSR template for /keyring — live BYOK demo.
//
// Fetches /registry.json, renders a provider grid, lets the user paste an API
// key per provider (stored in localStorage only), validates it against the
// provider's endpoint, and lets the user send a test chat directly to the
// provider. Nothing routes through token.app — keys never leave the browser.
//
// CORS caveat: not every provider allows browser-origin requests. We show a
// note when a call fails from that root cause. Anthropic requires an explicit
// opt-in header (`anthropic-dangerous-direct-browser-access: true`).

export function getKeyringHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Keyring — BYOK LLM Registry &amp; Client • token.app</title>
  <meta name="description" content="Open registry + client SDK for bring-your-own-key LLM access. One manifest for every major provider. WalletConnect for AI model keys." />
  <meta name="robots" content="index, follow" />
  <meta property="og:title" content="Keyring — BYOK LLM Registry" />
  <meta property="og:description" content="One manifest for every major LLM provider. Stop re-implementing the key modal, the stale model dropdown, and the per-provider switch statement." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://token.app/keyring" />
  <meta property="og:site_name" content="token.app" />
  <meta property="og:image" content="https://token.app/og.png" />
  <link rel="canonical" href="https://token.app/keyring" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔑</text></svg>" />
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
    body {
      font: 14px/1.55 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
      background: var(--bg); color: var(--text); min-height: 100vh;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code, pre, .mono { font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace; font-size: 12.5px; }

    .container { max-width: 1120px; margin: 0 auto; padding: 32px 24px 80px; }
    nav { position: sticky; top: 0; z-index: 10; background: var(--nav-bg); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); }
    nav .container { padding: 14px 24px; display: flex; gap: 20px; align-items: center; }
    nav .brand { font-weight: 700; color: var(--text); }
    nav .spacer { flex: 1; }
    nav a.nav-link { color: var(--text2); font-size: 13px; }
    nav a.nav-link:hover { color: var(--text); text-decoration: none; }
    nav button.theme-btn { background: none; border: 1px solid var(--border); color: var(--text2); padding: 5px 10px; border-radius: var(--radius); cursor: pointer; font-size: 13px; }
    nav button.theme-btn:hover { color: var(--text); border-color: var(--border2); }

    h1 { font-size: 34px; letter-spacing: -0.025em; line-height: 1.15; margin-bottom: 8px; }
    h1 .gradient { background: linear-gradient(90deg, var(--accent) 0%, #a855f7 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
    h2 { font-size: 17px; font-weight: 600; margin: 28px 0 12px; letter-spacing: -0.005em; }
    h3 { font-size: 14px; font-weight: 600; margin: 0 0 6px; }
    p.lead { color: var(--text2); font-size: 15px; max-width: 720px; line-height: 1.55; }
    p.note { color: var(--text3); font-size: 12.5px; margin-top: 8px; max-width: 680px; }

    .pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; font-size: 11.5px; border-radius: 999px; background: var(--surface2); color: var(--text2); border: 1px solid var(--border); }
    .pill.ok { background: rgba(34,197,94,0.08); color: var(--success); border-color: rgba(34,197,94,0.2); }
    .pill.warn { background: rgba(245,158,11,0.08); color: var(--warning); border-color: rgba(245,158,11,0.2); }
    .pill.err { background: rgba(239,68,68,0.08); color: var(--danger); border-color: rgba(239,68,68,0.2); }

    .meta-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
    .card {
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 16px; display: flex; flex-direction: column; gap: 10px;
      transition: border-color .15s ease, transform .15s ease;
    }
    .card:hover { border-color: var(--border2); }
    .card .head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .card .name { font-weight: 600; font-size: 14.5px; }
    .card .desc { color: var(--text2); font-size: 13px; line-height: 1.45; }
    .card .stats { display: flex; gap: 12px; color: var(--text3); font-size: 12px; margin-top: 2px; }
    .card .actions { display: flex; gap: 8px; margin-top: auto; }
    .btn { appearance: none; border: 1px solid var(--border2); background: var(--surface2); color: var(--text); padding: 6px 12px; border-radius: 6px; font: inherit; font-size: 12.5px; cursor: pointer; transition: all .12s ease; }
    .btn:hover { border-color: var(--accent); color: var(--accent); }
    .btn.primary { background: var(--accent); border-color: var(--accent); color: white; }
    .btn.primary:hover { filter: brightness(1.1); color: white; }
    .btn.danger { color: var(--danger); border-color: rgba(239,68,68,0.3); }
    .btn.danger:hover { background: rgba(239,68,68,0.08); }
    .btn[disabled] { opacity: .5; cursor: not-allowed; }

    /* Modal */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(3px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; max-width: 520px; width: 100%; padding: 24px; }
    .modal h3 { font-size: 16px; margin-bottom: 6px; }
    .modal p { color: var(--text2); font-size: 13px; margin-bottom: 14px; }
    .modal input[type="password"], .modal input[type="text"], .modal textarea {
      width: 100%; background: var(--bg); border: 1px solid var(--border); color: var(--text);
      padding: 10px 12px; border-radius: 6px; font: inherit; font-size: 13px;
    }
    .modal input:focus, .modal textarea:focus { outline: none; border-color: var(--accent); }
    .modal .row { display: flex; gap: 8px; margin-top: 14px; justify-content: flex-end; }
    .modal .status { margin-top: 10px; font-size: 12.5px; min-height: 18px; }
    .modal .status.ok { color: var(--success); }
    .modal .status.err { color: var(--danger); }

    /* Test chat panel */
    .chat-panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-top: 16px; }
    .chat-panel .controls { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
    .chat-panel select, .chat-panel textarea { background: var(--bg); color: var(--text); border: 1px solid var(--border); padding: 8px 10px; border-radius: 6px; font: inherit; font-size: 13px; }
    .chat-panel textarea { width: 100%; min-height: 70px; margin-top: 4px; resize: vertical; }
    .chat-panel .response { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 12px 14px; font-size: 13px; min-height: 60px; max-height: 280px; overflow-y: auto; white-space: pre-wrap; color: var(--text); margin-top: 10px; }
    .chat-panel .response.err { border-color: rgba(239,68,68,0.4); color: var(--danger); }

    .snippet { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; overflow-x: auto; color: var(--text2); }
    .snippet .k { color: #c084fc; } .snippet .s { color: #7dd3fc; } .snippet .c { color: var(--text3); font-style: italic; }

    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid var(--border); color: var(--text3); font-size: 12px; }
  </style>
</head>
<body>
<nav>
  <div class="container">
    <a href="/" class="brand">🔷 token.app</a>
    <a href="/models" class="nav-link">Models</a>
    <a href="/subscriptions" class="nav-link">Subscriptions</a>
    <a href="/usage" class="nav-link">Usage</a>
    <a href="/keyring" class="nav-link" style="color: var(--text);">Keyring</a>
    <span class="spacer"></span>
    <button class="theme-btn" id="themeBtn">Theme</button>
  </div>
</nav>

<div class="container">
  <h1><span class="gradient">Keyring</span> — BYOK for every LLM, one manifest.</h1>
  <p class="lead">
    An open registry and client SDK for bring-your-own-key LLM access. Stop re-implementing the key-entry modal,
    the stale model dropdown, and the per-provider <code>switch</code> statement in every project. Keyring is the
    shared layer underneath — think WalletConnect, but for AI model keys.
  </p>
  <div class="meta-row">
    <span class="pill" id="regStatus">loading registry…</span>
    <span class="pill mono"><a href="/registry.json">GET /registry.json</a></span>
    <span class="pill">v1 schema</span>
  </div>

  <h2>Your providers</h2>
  <p class="note">Paste an API key to light up a provider. Keys stay in <code>localStorage</code>; nothing is sent to token.app.</p>
  <div id="providerGrid" class="grid" style="margin-top: 14px;"></div>

  <h2>Test a chat</h2>
  <p class="note">Picks a configured provider + model and sends a single user message directly from your browser. Some providers don't allow browser-origin requests; you'll see a CORS error if so.</p>
  <div class="chat-panel">
    <div class="controls">
      <select id="modelSelect"><option>Add a key first…</option></select>
      <input type="text" id="promptInput" placeholder="Say something…" style="flex: 1; background: var(--bg); color: var(--text); border: 1px solid var(--border); padding: 8px 10px; border-radius: 6px; font: inherit; font-size: 13px;" />
      <button class="btn primary" id="sendBtn" disabled>Send</button>
    </div>
    <div id="chatResponse" class="response" style="color: var(--text3);">response will appear here…</div>
  </div>

  <h2>Drop-in usage</h2>
  <p class="note">The dumbest possible integration — just fetch the registry and use it. No SDK required.</p>
  <pre class="snippet mono"><span class="c">// Fetch the registry (CDN-cached, 5min SWR)</span>
<span class="k">const</span> reg = <span class="k">await</span> <span class="k">fetch</span>(<span class="s">'https://token.app/registry.json'</span>).<span class="k">then</span>(r =&gt; r.<span class="k">json</span>());
<span class="k">const</span> openai = reg.providers.<span class="k">find</span>(p =&gt; p.id === <span class="s">'openai'</span>);
<span class="k">const</span> model  = openai.models.<span class="k">find</span>(m =&gt; m.id === <span class="s">'gpt-4o'</span>);

<span class="k">await</span> <span class="k">fetch</span>(openai.endpoints.base + openai.endpoints.chat, {
  method: <span class="s">'POST'</span>,
  headers: {
    <span class="s">'Content-Type'</span>: <span class="s">'application/json'</span>,
    [openai.auth.headerName]: openai.auth.headerPrefix + userKey,
  },
  body: <span class="k">JSON</span>.<span class="k">stringify</span>({ model: model.providerModelId, messages: [...] }),
});</pre>

  <h2>Or use the SDK</h2>
  <pre class="snippet mono"><span class="c">// npm i keyring-client</span>
<span class="k">import</span> { createKeyring } <span class="k">from</span> <span class="s">'keyring-client'</span>;

<span class="k">const</span> kr = <span class="k">createKeyring</span>();
<span class="k">await</span> kr.<span class="k">setKey</span>(<span class="s">'openai'</span>, userKey);
<span class="k">await</span> kr.<span class="k">validateKey</span>(<span class="s">'openai'</span>);     <span class="c">// → { ok: true, status: 200 }</span>

<span class="k">const</span> res = <span class="k">await</span> kr.<span class="k">chat</span>({
  model: <span class="s">'gpt-4o'</span>,             <span class="c">// canonical id, provider-agnostic</span>
  messages: [{ role: <span class="s">'user'</span>, content: <span class="s">'hi'</span> }],
});</pre>

  <div class="footer">
    Keyring v0.1 · registry cached 5 min · SWR 1 hr · source on <a href="https://github.com/heathermhuang/TokenApp">GitHub</a>
  </div>
</div>

<!-- Modal root -->
<div id="modalRoot"></div>

<script>
(function(){
  // ── Theme toggle ─────────────────────────────────────────────────────────
  const themeBtn = document.getElementById('themeBtn');
  themeBtn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });

  // ── State ────────────────────────────────────────────────────────────────
  const KEY_PREFIX = 'keyring:v1:';
  const state = { registry: null };

  const getKey = (id) => localStorage.getItem(KEY_PREFIX + id);
  const setKey = (id, v) => localStorage.setItem(KEY_PREFIX + id, v);
  const removeKey = (id) => localStorage.removeItem(KEY_PREFIX + id);

  // ── Load registry ────────────────────────────────────────────────────────
  async function loadRegistry() {
    const statusEl = document.getElementById('regStatus');
    try {
      const res = await fetch('/registry.json');
      const reg = await res.json();
      state.registry = reg;
      const modelCount = reg.providers.reduce((s, p) => s + p.models.length, 0);
      statusEl.textContent = reg.providers.length + ' providers · ' + modelCount + ' models';
      statusEl.className = 'pill ok';
      renderGrid();
      refreshModelSelect();
    } catch (err) {
      statusEl.textContent = 'registry load failed';
      statusEl.className = 'pill err';
    }
  }

  // ── Provider grid ────────────────────────────────────────────────────────
  function renderGrid() {
    const root = document.getElementById('providerGrid');
    root.innerHTML = '';
    for (const p of state.registry.providers) {
      const hasKey = !!getKey(p.id);
      const card = document.createElement('div');
      card.className = 'card';
      const caps = [];
      if (p.capabilities.scopedKeys) caps.push('scoped keys');
      if (p.capabilities.usageEndpoint) caps.push('usage API');
      const pillCls = hasKey ? 'ok' : 'warn';
      const pillTxt = hasKey ? 'key saved' : 'no key';
      card.innerHTML =
        '<div class="head">' +
          '<div class="name">' + escapeHtml(p.name) + '</div>' +
          '<span class="pill ' + pillCls + '">' + pillTxt + '</span>' +
        '</div>' +
        '<div class="desc">' + escapeHtml(p.description || p.id) + '</div>' +
        '<div class="stats">' +
          '<span>' + p.models.length + ' models</span>' +
          '<span>' + p.protocol.family + '</span>' +
          (caps.length ? '<span>' + caps.join(' · ') + '</span>' : '') +
        '</div>' +
        '<div class="actions">' +
          '<button class="btn' + (hasKey ? '' : ' primary') + '" data-action="key" data-id="' + p.id + '">' + (hasKey ? 'Replace' : 'Add key') + '</button>' +
          (hasKey ? '<button class="btn danger" data-action="remove" data-id="' + p.id + '">Remove</button>' : '') +
          '<a class="btn" href="' + p.consoleUrl + '" target="_blank" rel="noopener">Get key ↗</a>' +
        '</div>';
      root.appendChild(card);
    }
    root.addEventListener('click', onGridClick, { once: true });
  }

  function onGridClick(ev) {
    const t = ev.target;
    if (!(t instanceof HTMLElement)) return;
    const action = t.dataset.action, id = t.dataset.id;
    if (action === 'key') openKeyModal(id);
    else if (action === 'remove') {
      removeKey(id);
      renderGrid();
      refreshModelSelect();
    }
  }

  // ── Key modal ────────────────────────────────────────────────────────────
  function openKeyModal(providerId) {
    const p = state.registry.providers.find(x => x.id === providerId);
    if (!p) return;
    const root = document.getElementById('modalRoot');
    const hint = p.keyHints ? 'Looks like: ' + (p.keyHints.sampleMask || p.keyHints.prefix + '…') : '';
    root.innerHTML =
      '<div class="modal-backdrop" id="mbd">' +
        '<div class="modal" onclick="event.stopPropagation()">' +
          '<h3>Add key for ' + escapeHtml(p.name) + '</h3>' +
          '<p>Paste your API key. Stored in localStorage only. ' +
            '<a href="' + p.consoleUrl + '" target="_blank" rel="noopener">Create one ↗</a>' +
          '</p>' +
          '<input type="password" id="keyInput" placeholder="' + escapeHtml(p.keyHints?.prefix || 'sk-') + '…" autocomplete="off" />' +
          (hint ? '<div class="status" style="color: var(--text3);">' + escapeHtml(hint) + '</div>' : '') +
          '<div class="status" id="modalStatus"></div>' +
          '<div class="row">' +
            '<button class="btn" id="cancelBtn">Cancel</button>' +
            '<button class="btn" id="validateBtn">Validate</button>' +
            '<button class="btn primary" id="saveBtn">Save</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    const input = document.getElementById('keyInput');
    const status = document.getElementById('modalStatus');
    input.value = getKey(providerId) || '';
    input.focus();

    document.getElementById('cancelBtn').onclick = close;
    document.getElementById('mbd').addEventListener('click', (e) => { if (e.target.id === 'mbd') close(); });
    document.getElementById('validateBtn').onclick = async () => {
      status.textContent = 'Validating…'; status.className = 'status';
      const r = await validateKey(p, input.value.trim());
      status.textContent = r.ok ? 'Valid (HTTP ' + r.status + ').' : 'Invalid or CORS-blocked (HTTP ' + r.status + ').';
      status.className = 'status ' + (r.ok ? 'ok' : 'err');
    };
    document.getElementById('saveBtn').onclick = () => {
      const v = input.value.trim();
      if (!v) return;
      setKey(p.id, v);
      close();
      renderGrid();
      refreshModelSelect();
    };
    function close() { root.innerHTML = ''; }
  }

  async function validateKey(provider, key) {
    if (!provider.keyValidation) return { ok: true, status: 0 };
    try {
      const headers = authHeaders(provider, key);
      const res = await fetch(provider.endpoints.base + provider.keyValidation.path, {
        method: provider.keyValidation.method,
        headers,
      });
      return { ok: res.status === provider.keyValidation.expectStatus, status: res.status };
    } catch (e) {
      return { ok: false, status: 0 };
    }
  }

  // ── Chat ────────────────────────────────────────────────────────────────
  function refreshModelSelect() {
    const sel = document.getElementById('modelSelect');
    const btn = document.getElementById('sendBtn');
    sel.innerHTML = '';
    const configured = state.registry.providers.filter(p => getKey(p.id));
    if (!configured.length) {
      sel.innerHTML = '<option>Add a key first…</option>';
      btn.disabled = true;
      return;
    }
    for (const p of configured) {
      const group = document.createElement('optgroup');
      group.label = p.name;
      for (const m of p.models.slice(0, 20)) {
        const opt = document.createElement('option');
        opt.value = p.id + '::' + m.id;
        opt.textContent = m.displayName;
        group.appendChild(opt);
      }
      sel.appendChild(group);
    }
    btn.disabled = false;
  }

  document.getElementById('sendBtn').addEventListener('click', async () => {
    const sel = document.getElementById('modelSelect');
    const [pid, mid] = sel.value.split('::');
    const prompt = document.getElementById('promptInput').value.trim();
    if (!prompt) return;
    const out = document.getElementById('chatResponse');
    out.textContent = 'requesting…'; out.className = 'response';

    const p = state.registry.providers.find(x => x.id === pid);
    const m = p.models.find(x => x.id === mid);
    const key = getKey(p.id);
    try {
      const res = await fetch(p.endpoints.base + (p.endpoints.chat || '/chat/completions').replace('{model}', encodeURIComponent(m.providerModelId)), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(p, key) },
        body: JSON.stringify(buildBody(p, m, prompt)),
      });
      const text = await res.text();
      let parsed; try { parsed = JSON.parse(text); } catch { parsed = null; }
      if (!res.ok) { out.textContent = 'HTTP ' + res.status + '\\n' + text; out.className = 'response err'; return; }
      out.textContent = extractText(p, parsed) || text;
      out.className = 'response';
    } catch (e) {
      out.textContent = 'Request failed: ' + e.message + '\\n\\n(Often this is CORS. Some providers block browser-origin requests; use the SDK from a backend.)';
      out.className = 'response err';
    }
  });

  // ── Request shaping (mirrors client/index.ts) ────────────────────────────
  function authHeaders(p, key) {
    const h = Object.assign({}, p.auth.extraHeaders || {});
    if (p.auth.type === 'bearer') {
      h[p.auth.headerName || 'Authorization'] = (p.auth.headerPrefix || 'Bearer ') + key;
    } else if (p.auth.type === 'header' || p.auth.type === 'header-with-version') {
      h[p.auth.headerName] = key;
    }
    // Anthropic requires an explicit opt-in for browser access.
    if (p.id === 'anthropic') h['anthropic-dangerous-direct-browser-access'] = 'true';
    return h;
  }

  function buildBody(p, m, prompt) {
    const fam = p.protocol.family;
    if (fam === 'openai' || p.protocol.acceptsOpenAIBody) {
      return { model: m.providerModelId, messages: [{ role: 'user', content: prompt }], max_tokens: 256 };
    }
    if (fam === 'anthropic') {
      return { model: m.providerModelId, messages: [{ role: 'user', content: prompt }], max_tokens: 256 };
    }
    if (fam === 'google') {
      return { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 256 } };
    }
    if (fam === 'cohere') {
      return { model: m.providerModelId, messages: [{ role: 'user', content: prompt }], max_tokens: 256 };
    }
    return { model: m.providerModelId, messages: [{ role: 'user', content: prompt }] };
  }

  function extractText(p, parsed) {
    if (!parsed) return '';
    const fam = p.protocol.family;
    if (fam === 'openai' || p.protocol.acceptsOpenAIBody) return parsed.choices?.[0]?.message?.content || '';
    if (fam === 'anthropic') return (parsed.content || []).map(c => c.text || '').join('');
    if (fam === 'google') return parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (fam === 'cohere') return parsed.message?.content?.[0]?.text || '';
    return JSON.stringify(parsed, null, 2);
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' })[c]); }

  loadRegistry();
})();
</script>
</body>
</html>`;
}
