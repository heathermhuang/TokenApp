export function getHtml(params: {
  initialModels?: string;
  initialSubscriptions?: string;
  lastUpdated?: string | null;
}): string {
  const { initialModels = '[]', initialSubscriptions = '[]', lastUpdated = null } = params;

  // Compute counts server-side for accurate meta tags and hero description
  const parsedModels = JSON.parse(initialModels) as Array<{ providerId: string }>;
  const modelCount = parsedModels.length;
  const providerCount = new Set(parsedModels.map(m => m.providerId)).size;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>token.app — AI Token &amp; Subscription Pricing</title>
  <meta name="description" content="Real-time AI model token pricing and subscription costs. Compare ${modelCount}+ models from ${providerCount}+ providers including OpenAI, Anthropic, Google, Meta, and more." />
  <meta property="og:title" content="token.app — AI Pricing Tracker" />
  <meta property="og:description" content="Real-time token pricing for ${modelCount}+ AI models. Compare input/output costs, context windows, and subscription plans." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://token.app/" />
  <meta property="og:site_name" content="token.app" />
  <meta property="og:image" content="https://token.app/og.svg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="token.app — AI Pricing Tracker" />
  <meta name="twitter:description" content="Real-time token pricing for ${modelCount}+ AI models. Compare input/output costs, context windows, and subscription plans." />
  <meta name="twitter:image" content="https://token.app/og.svg" />
  <link rel="canonical" href="https://token.app/" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔷</text></svg>" />
  <script>(function(){var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);})();</script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "token.app",
    "url": "https://token.app/",
    "description": "Real-time AI model token pricing and subscription costs. Compare ${modelCount}+ models from ${providerCount}+ providers including OpenAI, Anthropic, Google, Meta, and more.",
    "applicationCategory": "UtilityApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  }
  </script>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-Z59RHGWMWD"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('consent', 'default', { analytics_storage: 'denied' });
    if (localStorage.getItem('cookie_consent') === 'accepted') {
      gtag('consent', 'update', { analytics_storage: 'granted' });
    }
    gtag('config', 'G-Z59RHGWMWD');
  </script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0c0c0e;
      --surface: #141418;
      --surface2: #1c1c22;
      --border: #27272f;
      --border2: #33333d;
      --text: #f0f0f4;
      --text2: #9090a0;
      --text3: #606070;
      --accent: #6366f1;
      --accent-dim: rgba(99,102,241,0.15);
      --green: #22c55e;
      --yellow: #eab308;
      --orange: #f97316;
      --red: #ef4444;
      --radius: 8px;
      --radius-sm: 5px;
      --nav-bg: rgba(12,12,14,0.88);
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
      --shadow-md: 0 4px 16px rgba(0,0,0,0.4);
    }

    html[data-theme="light"] {
      --bg: #f4f4f8;
      --surface: #ffffff;
      --surface2: #ebebf2;
      --border: #dcdce8;
      --border2: #c8c8d8;
      --text: #111118;
      --text2: #484860;
      --text3: #8888a0;
      --accent: #5254d0;
      --accent-dim: rgba(82,84,208,0.1);
      --green: #16a34a;
      --yellow: #ca8a04;
      --orange: #ea580c;
      --red: #dc2626;
      --nav-bg: rgba(244,244,248,0.9);
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
      --shadow-md: 0 4px 16px rgba(0,0,0,0.12);
    }

    html { scroll-behavior: smooth; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
      line-height: 1.5;
      min-height: 100vh;
    }

    /* ── Nav ──────────────────────────────────────────────────────────────── */
    nav {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--nav-bg);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--border);
      padding: 0 24px;
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .nav-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 700;
      color: var(--text);
      text-decoration: none;
      letter-spacing: -0.3px;
    }

    .nav-brand .diamond { color: var(--accent); font-size: 18px; }

    .nav-meta {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 12px;
      color: var(--text3);
    }

    .nav-meta .dot { color: var(--border2); }

    .updated-badge {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      color: var(--text3);
    }

    .updated-badge .pulse {
      width: 6px; height: 6px;
      background: var(--green);
      border-radius: 50%;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* ── Theme Toggle ──────────────────────────────────────────────────────── */
    .theme-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid var(--border2);
      background: var(--surface2);
      color: var(--text2);
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s;
    }

    .theme-btn:hover {
      background: var(--border);
      border-color: var(--text3);
      color: var(--text);
      transform: rotate(15deg);
    }

    .theme-btn svg { display: block; pointer-events: none; }

    /* Show correct icon per theme */
    .theme-btn .icon-moon { display: block; }
    .theme-btn .icon-sun  { display: none; }
    html[data-theme="light"] .theme-btn .icon-moon { display: none; }
    html[data-theme="light"] .theme-btn .icon-sun  { display: block; }

    /* Smooth theme transition */
    html { transition: background 0.2s, color 0.2s; }
    body, nav, .hero, table, .sub-card, .modal-content, .consent-bar, footer {
      transition: background-color 0.2s, border-color 0.2s, color 0.2s;
    }

    /* ── Hero ─────────────────────────────────────────────────────────────── */
    .hero {
      padding: 48px 24px 36px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .hero h1 {
      font-size: clamp(24px, 4vw, 38px);
      font-weight: 800;
      letter-spacing: -0.8px;
      line-height: 1.15;
      color: var(--text);
      margin-bottom: 10px;
    }

    .hero h1 span { color: var(--accent); }

    .hero p {
      font-size: 15px;
      color: var(--text2);
      max-width: 560px;
      margin-bottom: 24px;
    }

    .stats-row {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }

    .stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .stat-value {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: var(--text);
    }

    .stat-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text3);
    }

    /* ── Controls ─────────────────────────────────────────────────────────── */
    .controls {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px 16px;
    }

    .main-tabs {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 16px;
    }

    .main-tab {
      padding: 8px 16px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text2);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
      margin-bottom: -1px;
    }

    .main-tab:hover { color: var(--text); }
    .main-tab.active { color: var(--text); border-bottom-color: var(--accent); }

    .filter-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }

    .search-wrap {
      position: relative;
      flex: 1;
      min-width: 200px;
      max-width: 320px;
    }

    .search-icon {
      position: absolute;
      left: 10px; top: 50%;
      transform: translateY(-50%);
      color: var(--text3);
      pointer-events: none;
      font-size: 13px;
    }

    #search {
      width: 100%;
      padding: 7px 10px 7px 32px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 13px;
      outline: none;
      transition: border-color 0.15s;
    }

    #search:focus { border-color: var(--accent); }
    #search::placeholder { color: var(--text3); }

    .filter-group {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
    }

    .filter-pill {
      padding: 5px 11px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      color: var(--text2);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
      user-select: none;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    .filter-pill:hover { border-color: var(--border2); color: var(--text); }

    .filter-pill.active {
      background: var(--accent-dim);
      border-color: var(--accent);
      color: var(--accent);
    }

    .filter-divider {
      width: 1px;
      height: 20px;
      background: var(--border);
      align-self: center;
    }

    /* ── Category Tabs ─────────────────────────────────────────────────────── */
    .cat-tabs {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
    }

    .cat-tab {
      padding: 5px 13px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text2);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }

    .cat-tab:hover { border-color: var(--border2); color: var(--text); }
    .cat-tab.active { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); }

    /* ── Table ─────────────────────────────────────────────────────────────── */
    .table-wrap {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px 48px;
    }

    .table-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0 10px;
      font-size: 12px;
      color: var(--text3);
    }

    .table-meta strong { color: var(--text2); }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    thead th {
      text-align: left;
      padding: 10px 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text3);
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      transition: color 0.15s;
    }

    thead th:hover { color: var(--text2); }
    thead th.sorted { color: var(--accent); }

    thead th .sort-icon { margin-left: 4px; opacity: 0.5; }
    thead th.sorted .sort-icon { opacity: 1; }

    tbody tr {
      border-bottom: 1px solid rgba(39,39,47,0.6);
      transition: background 0.1s;
    }

    tbody tr:hover { background: rgba(255,255,255,0.025); }

    tbody td {
      padding: 11px 12px;
      vertical-align: middle;
    }

    td.model-cell {
      min-width: 200px;
      max-width: 280px;
    }

    .model-name {
      font-weight: 500;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 260px;
      display: block;
    }

    .model-id {
      font-size: 11px;
      color: var(--text3);
      font-family: 'Menlo', 'Monaco', 'Cascadia Code', monospace;
      margin-top: 1px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 260px;
      display: block;
    }

    .provider-chip {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      white-space: nowrap;
    }

    .ctx {
      font-family: 'Menlo', 'Monaco', monospace;
      font-size: 12px;
      color: var(--text2);
    }

    .price {
      font-family: 'Menlo', 'Monaco', monospace;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }

    .price-free { color: var(--green); }
    .price-cheap { color: #86efac; }
    .price-mid { color: var(--yellow); }
    .price-high { color: var(--orange); }
    .price-expensive { color: var(--red); }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .badge-free { background: rgba(34,197,94,0.15); color: var(--green); }
    .badge-vision { background: rgba(96,165,250,0.15); color: #60a5fa; }
    .badge-reasoning { background: rgba(167,139,250,0.15); color: #a78bfa; }
    .badge-audio       { background: rgba(251,191,36,0.15); color: #fbbf24; }
    .badge-text        { background: rgba(148,163,184,0.10); color: #94a3b8; border-color: rgba(148,163,184,0.2); }
    .badge-image-gen   { background: rgba(232,121,249,0.12); color: #e879f9; border-color: rgba(232,121,249,0.25); }
    .badge-video       { background: rgba(99,102,241,0.12);  color: #818cf8; border-color: rgba(99,102,241,0.25); }
    .badge-deprecated  { background: rgba(100,116,139,0.12); color: #64748b; border-color: rgba(100,116,139,0.25); font-style: italic; }
    .badge-active      { background: rgba(34,197,94,0.10);   color: #22c55e; border-color: rgba(34,197,94,0.25); }

    /* ── Provider logos ─────────────────────────────────────────────────── */
    .provider-chip { display: inline-flex; align-items: center; gap: 5px; }
    .provider-logo {
      width: 13px; height: 13px;
      border-radius: 3px;
      flex-shrink: 0;
      object-fit: contain;
    }
    .filter-pill .provider-logo { width: 12px; height: 12px; }

    /* ── Clickable links ────────────────────────────────────────────────── */
    a.model-link { text-decoration: none; color: inherit; }
    a.model-link:hover .model-name { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
    a.provider-link { text-decoration: none; }
    a.provider-link:hover .provider-chip { opacity: 0.82; }
    a.provider-link:hover .sub-provider-chip { opacity: 0.82; }

    /* ── CNY price row ───────────────────────────────────────────────────── */
    .tier-cn-price {
      font-size: 10px;
      color: var(--text3);
      margin-top: 2px;
      letter-spacing: 0.2px;
    }

    /* ── Deprecated row ─────────────────────────────────────────────────── */
    tr.row-deprecated td { opacity: 0.45; }
    tr.row-deprecated .model-name { text-decoration: line-through; text-decoration-color: #64748b; }

    .modality-icons { display: flex; gap: 4px; flex-wrap: wrap; }

    .empty-state {
      text-align: center;
      padding: 64px 24px;
      color: var(--text3);
    }

    .empty-state h3 { font-size: 16px; color: var(--text2); margin-bottom: 8px; }

    /* ── Subscription Cards ────────────────────────────────────────────────── */
    #subs-section {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px 48px;
    }

    .subs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }

    .sub-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      transition: border-color 0.2s;
    }

    .sub-card:hover { border-color: var(--border2); }

    .sub-header {
      padding: 16px 20px 12px;
      border-bottom: 1px solid var(--border);
    }

    .sub-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .sub-name {
      font-size: 15px;
      font-weight: 700;
      color: var(--text);
    }

    .sub-provider-chip {
      font-size: 11px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .sub-provider-chip .provider-logo { width: 12px; height: 12px; }

    .sub-desc {
      font-size: 12px;
      color: var(--text2);
      line-height: 1.4;
    }

    .tiers-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0;
    }

    .tier {
      flex: 1;
      min-width: 100px;
      padding: 12px 16px;
      border-right: 1px solid var(--border);
      position: relative;
    }

    .tier:last-child { border-right: none; }

    .tier.highlight {
      background: rgba(99,102,241,0.05);
    }

    .tier-name {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text3);
      margin-bottom: 4px;
    }

    .tier-price {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: var(--text);
    }

    .tier-price .cents {
      font-size: 12px;
      font-weight: 600;
      vertical-align: super;
    }

    .tier-price .period {
      font-size: 11px;
      font-weight: 400;
      color: var(--text3);
      letter-spacing: 0;
    }

    .tier-annual {
      font-size: 10px;
      color: var(--green);
      margin-top: 1px;
    }

    .tier-badge {
      position: absolute;
      top: -8px; left: 50%;
      transform: translateX(-50%);
      background: var(--accent);
      color: white;
      font-size: 9px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    .tier-features {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .tier-feature {
      font-size: 11px;
      color: var(--text2);
      display: flex;
      gap: 5px;
      align-items: flex-start;
    }

    .tier-feature::before {
      content: '·';
      color: var(--text3);
      flex-shrink: 0;
    }

    .sub-footer {
      padding: 10px 16px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: flex-end;
    }

    .sub-link {
      font-size: 11px;
      color: var(--accent);
      text-decoration: none;
      opacity: 0.8;
    }

    .sub-link:hover { opacity: 1; text-decoration: underline; }

    /* ── Loading ───────────────────────────────────────────────────────────── */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 80px 24px;
      gap: 10px;
      color: var(--text3);
    }

    .spinner {
      width: 18px; height: 18px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Footer ───────────────────────────────────────────────────────────── */
    footer {
      border-top: 1px solid var(--border);
      padding: 20px 24px;
      text-align: center;
      font-size: 12px;
      color: var(--text3);
    }

    footer a { color: var(--text3); text-decoration: none; }
    footer a:hover { color: var(--text2); }

    .footer-powered {
      margin-top: 10px;
      font-size: 11px;
      color: var(--text3);
    }

    .footer-powered a { color: var(--text2); }
    .footer-powered a:hover { color: var(--text); }

    /* ── Consent Bar ───────────────────────────────────────────────────────── */
    .consent-bar {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      z-index: 200;
      background: var(--surface);
      border-top: 1px solid var(--border2);
      padding: 14px 24px;
      display: none;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      box-shadow: 0 -4px 24px rgba(0,0,0,0.35);
    }

    .consent-text {
      font-size: 13px;
      color: var(--text2);
      flex: 1;
      min-width: 200px;
      line-height: 1.5;
    }

    .consent-text a { color: var(--accent); text-decoration: none; }
    .consent-text a:hover { text-decoration: underline; }

    .consent-actions { display: flex; gap: 8px; flex-shrink: 0; }

    .consent-btn {
      padding: 7px 16px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid var(--border2);
      transition: all 0.15s;
      white-space: nowrap;
    }

    .consent-btn-accept { background: var(--accent); border-color: var(--accent); color: white; }
    .consent-btn-accept:hover { background: #4f52e5; }
    .consent-btn-decline { background: transparent; color: var(--text2); }
    .consent-btn-decline:hover { background: var(--surface2); color: var(--text); }

    /* ── Modal ─────────────────────────────────────────────────────────────── */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      z-index: 300;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
    }

    .modal-overlay.open { opacity: 1; pointer-events: all; }

    .modal-content {
      background: var(--surface);
      border: 1px solid var(--border2);
      border-radius: 12px;
      width: 100%;
      max-width: 640px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 24px 14px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .modal-header h2 { font-size: 17px; font-weight: 700; color: var(--text); }

    .modal-close {
      background: none;
      border: none;
      color: var(--text3);
      font-size: 16px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--radius-sm);
      transition: color 0.15s;
      line-height: 1;
    }

    .modal-close:hover { color: var(--text); }

    .modal-body {
      padding: 24px;
      overflow-y: auto;
      font-size: 13px;
      line-height: 1.7;
      color: var(--text2);
    }

    .modal-body h3 { font-size: 13px; font-weight: 600; color: var(--text); margin: 16px 0 5px; }
    .modal-body h3:first-child { margin-top: 0; }
    .modal-body p { margin-bottom: 10px; }
    .modal-body a { color: var(--accent); }

    /* ── Responsive ───────────────────────────────────────────────────────── */
    @media (max-width: 768px) {
      /* Hero */
      .hero { padding: 24px 16px 20px; }
      .hero h1 { font-size: 22px; }
      .hero p { font-size: 13px; }

      /* Stats: 2×2 grid */
      .stats-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .stat { padding: 10px 12px; }
      .stat-value { font-size: 18px; }

      /* Controls: full width search */
      .controls { padding: 0 12px 12px; }
      .filter-bar { gap: 6px; flex-wrap: wrap; }
      .search-wrap { min-width: unset; max-width: unset; flex: 1 1 100%; order: -1; margin-bottom: 4px; }
      #search { max-width: unset; }
      .filter-pill { font-size: 12px; padding: 4px 8px; }

      /* Table: hide Released (3rd), Context (4th), Modalities (7th)
         Columns: Model 33% | Provider 23% | Input 22% | Output 22% */
      .table-wrap { padding: 0 0 32px; overflow-x: hidden; }
      table { min-width: unset; width: 100%; table-layout: fixed; }
      table th:nth-child(1) { width: 33%; }
      table th:nth-child(2) { width: 23%; }
      table th:nth-child(5) { width: 22%; }
      table th:nth-child(6) { width: 22%; }
      table th:nth-child(3),
      table td:nth-child(3),
      table th:nth-child(4),
      table td:nth-child(4),
      table th:nth-child(7),
      table td:nth-child(7) { display: none; }
      table th, table td { padding: 7px 6px; }
      /* Price column headers: smaller font to fit "Input $/1M" */
      table th:nth-child(5),
      table th:nth-child(6) { font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      /* Truncate long model names */
      .model-name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .model-id { font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      /* Provider chip: tighter, logo only fallback on very small */
      .provider-chip { font-size: 11px; padding: 2px 6px; gap: 3px; }
      .provider-chip img { width: 13px; height: 13px; }
      .price { font-size: 12px; }
      /* Price cell: right-align and nowrap */
      table td:nth-child(5),
      table td:nth-child(6) { text-align: right; white-space: nowrap; }

      /* Subscriptions */
      .subs-grid { grid-template-columns: 1fr; }
      #subs-section { padding: 0 16px 32px; }
      /* Subscription tier row: allow horizontal scroll if too many tiers */
      .tiers-row { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .tier { min-width: 100px; flex-shrink: 0; }

      /* Nav */
      .nav-meta { display: none; }
    }
  </style>
</head>
<body>

<!-- ── Nav ──────────────────────────────────────────────────────────────────── -->
<nav>
  <a href="/" class="nav-brand">
    <span class="diamond">◈</span>
    <span>token.app</span>
  </a>
  <div class="nav-meta">
    <span id="nav-model-count">Loading…</span>
    <span class="dot">·</span>
    <span id="nav-providers">— providers</span>
    <span class="dot">·</span>
    <div class="updated-badge">
      <div class="pulse"></div>
      <span id="nav-updated">checking…</span>
    </div>
  </div>
  <button class="theme-btn" onclick="toggleTheme()" title="Toggle light/dark theme" aria-label="Toggle light/dark theme">
    <!-- Moon (shown in dark mode) -->
    <svg class="icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
    <!-- Sun (shown in light mode) -->
    <svg class="icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  </button>
</nav>

<!-- ── Hero ─────────────────────────────────────────────────────────────────── -->
<section class="hero">
  <h1>AI Token &amp; Subscription<br/><span>Pricing Tracker</span></h1>
  <p>Real-time token costs and subscription pricing across the AI ecosystem. Compare <span id="stat-desc-models">—</span> models from <span id="stat-desc-providers">—</span> providers.</p>
  <div class="stats-row">
    <div class="stat">
      <span class="stat-value" id="stat-models">—</span>
      <span class="stat-label">Models tracked</span>
    </div>
    <div class="stat">
      <span class="stat-value" id="stat-providers">—</span>
      <span class="stat-label">Providers</span>
    </div>
    <div class="stat">
      <span class="stat-value" id="stat-free">—</span>
      <span class="stat-label">Free models</span>
    </div>
    <div class="stat">
      <span class="stat-value" id="stat-subs">—</span>
      <span class="stat-label">Subscriptions</span>
    </div>
  </div>
</section>

<!-- ── Controls ─────────────────────────────────────────────────────────────── -->
<div class="controls">
  <div class="main-tabs">
    <button class="main-tab active" data-view="api">API Pricing</button>
    <button class="main-tab" data-view="subscriptions">Subscriptions</button>
  </div>

  <div id="api-controls">
    <div class="filter-row" style="margin-bottom: 10px;">
      <div class="search-wrap">
        <span class="search-icon">⌕</span>
        <input type="search" id="search" placeholder="Search models…" autocomplete="off" />
      </div>
      <div class="filter-divider"></div>
      <div class="cat-tabs" id="cat-tabs">
        <button class="cat-tab active" data-cat="all">All</button>
        <button class="cat-tab" data-cat="text">Text</button>
        <button class="cat-tab" data-cat="vision">Vision</button>
        <button class="cat-tab" data-cat="audio">Audio</button>
        <button class="cat-tab" data-cat="reasoning">Reasoning</button>
        <button class="cat-tab" data-cat="free">Free</button>
        <button class="cat-tab" data-cat="opensource">Open Source</button>
        <button class="cat-tab" data-cat="deprecated">Deprecated</button>
      </div>
    </div>
    <div class="filter-row" id="provider-filters">
      <!-- provider pills injected by JS -->
    </div>
  </div>

  <div id="subs-controls" style="display:none;">
    <div class="filter-row">
      <div class="cat-tabs">
        <button class="cat-tab active" data-subcat="all">All</button>
        <button class="cat-tab" data-subcat="chat">Chat AI</button>
        <button class="cat-tab" data-subcat="coding">Coding</button>
        <button class="cat-tab" data-subcat="search">Search</button>
        <button class="cat-tab" data-subcat="media">Media</button>
      </div>
    </div>
  </div>
</div>

<!-- ── API Pricing Table ─────────────────────────────────────────────────────── -->
<div class="table-wrap" id="api-section">
  <div class="table-meta">
    <span><strong id="filtered-count">—</strong> models shown</span>
    <span id="table-updated"></span>
  </div>
  <table>
    <thead>
      <tr>
        <th data-sort="name">Model <span class="sort-icon">↕</span></th>
        <th data-sort="provider">Provider <span class="sort-icon">↕</span></th>
        <th data-sort="createdAt" class="sorted">Released <span class="sort-icon">↓</span></th>
        <th data-sort="contextWindow" title="Context window">Context <span class="sort-icon">↕</span></th>
        <th data-sort="inputPer1M">Input $/1M <span class="sort-icon">↕</span></th>
        <th data-sort="outputPer1M">Output $/1M <span class="sort-icon">↕</span></th>
        <th>Modalities</th>
      </tr>
    </thead>
    <tbody id="models-tbody">
      <tr><td colspan="7"><div class="loading"><div class="spinner"></div> Loading models…</div></td></tr>
    </tbody>
  </table>
</div>

<!-- ── Subscriptions ─────────────────────────────────────────────────────────── -->
<div id="subs-section" style="display:none;">
  <div class="subs-grid" id="subs-grid">
    <!-- Injected by JS -->
  </div>
</div>

<!-- ── Footer ───────────────────────────────────────────────────────────────── -->
<footer>
  <p>Data sourced from <a href="https://openrouter.ai">OpenRouter</a> and provider pricing pages. Prices shown for reference — always verify with official sources.</p>
  <p style="margin-top: 6px;">Built on <a href="https://workers.cloudflare.com">Cloudflare Workers</a> · Updates every hour</p>
  <p class="footer-powered">
    Powered by <a href="https://measurable.ai" target="_blank" rel="noopener">Measurable AI</a>
    &nbsp;·&nbsp;
    <a href="https://measurable.ai/en-US/termsOfUse" target="_blank" rel="noopener">Terms of Use</a>
    &nbsp;·&nbsp;
    <a href="https://measurable.ai/en-US/privacyPolicy" target="_blank" rel="noopener">Privacy Policy</a>
  </p>
</footer>

<!-- ── Consent Bar ───────────────────────────────────────────────────────────── -->
<div class="consent-bar" id="consent-bar">
  <p class="consent-text">
    We use cookies and analytics to understand how token.app is used. See our
    <a href="https://measurable.ai/en-US/privacyPolicy" target="_blank" rel="noopener">Privacy Policy</a> and
    <a href="https://measurable.ai/en-US/termsOfUse" target="_blank" rel="noopener">Terms of Use</a>.
  </p>
  <div class="consent-actions">
    <button class="consent-btn consent-btn-decline" onclick="setConsent('declined')">Decline</button>
    <button class="consent-btn consent-btn-accept" onclick="setConsent('accepted')">Accept</button>
  </div>
</div>

<!-- ── Legal Modals ──────────────────────────────────────────────────────────── -->
<div class="modal-overlay" id="modal-overlay" onclick="closeModal()">
  <div class="modal-content" onclick="event.stopPropagation()">
    <div class="modal-header">
      <h2 id="modal-title"></h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" id="modal-body"></div>
  </div>
</div>

<script>
// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  models: [],
  subscriptions: [],
  view: 'api',       // 'api' | 'subscriptions'
  cat: 'all',
  subCat: 'all',
  providers: new Set(),
  search: '',
  sortKey: 'createdAt',
  sortDir: -1,       // 1 = asc, -1 = desc (newest first by default)
};

// ── Utilities ──────────────────────────────────────────────────────────────────
function fmtCtx(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'K';
  return String(n);
}

function fmtPrice(n) {
  if (n === null || n === undefined) return '—';
  if (n === 0) return '$0.00';
  if (n < 0.01) return '<$0.01';
  if (n < 1) return '$' + n.toFixed(3);
  if (n < 10) return '$' + n.toFixed(2);
  return '$' + n.toFixed(1);
}

function priceClass(n, field) {
  if (n === null || n === undefined) return '';
  if (n === 0) return 'price-free';
  const threshold = field === 'input' ? [0.5, 3, 15] : [2, 12, 50];
  if (n < threshold[0]) return 'price-cheap';
  if (n < threshold[1]) return 'price-mid';
  if (n < threshold[2]) return 'price-high';
  return 'price-expensive';
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

function fmtUpdated(iso) {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return d.toLocaleDateString();
}

function escape(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getProviderStyle(providerId) {
  const map = {
    openai:       { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    anthropic:    { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
    google:       { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
    'meta-llama': { color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
    mistralai:    { color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
    deepseek:     { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
    'x-ai':       { color: '#e2e8f0', bg: 'rgba(226,232,240,0.10)' },
    cohere:       { color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
    perplexityai: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
    cursor:       { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
    windsurf:     { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
    microsoft:    { color: '#60a5fa', bg: 'rgba(0,120,212,0.12)' },
    // Chinese providers
    baidu:        { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    bytedance:    { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)' },
    'bytedance-seed': { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)' },
    minimax:      { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
    moonshotai:   { color: '#e2e8f0', bg: 'rgba(226,232,240,0.10)' },
    tencent:      { color: '#1eff7a', bg: 'rgba(30,255,122,0.10)' },
    xiaomi:       { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
    stepfun:      { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
    alibaba:      { color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
    kwaipilot:    { color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
    meituan:      { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
    // Research / others
    allenai:      { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
    'ibm-granite':{ color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    openrouter:   { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
    nvidia:       { color: '#76b900', bg: 'rgba(118,185,0,0.12)' },
  };
  return map[providerId] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
}

const PROVIDER_DOMAINS = {
  // Major Western providers
  openai:               'openai.com',
  anthropic:            'anthropic.com',
  google:               'deepmind.google',
  'meta-llama':         'meta.com',
  mistralai:            'mistral.ai',
  deepseek:             'deepseek.com',
  'x-ai':               'x.ai',
  cohere:               'cohere.com',
  perplexityai:         'perplexity.ai',
  perplexity:           'perplexity.ai',
  nvidia:               'nvidia.com',
  amazon:               'aws.amazon.com',
  microsoft:            'microsoft.com',
  inflection:           'inflection.ai',
  writer:               'writer.com',
  '01-ai':              '01.ai',
  // Coding tools
  cursor:               'cursor.com',
  windsurf:             'windsurf.com',
  codeium:              'windsurf.com',
  // Chinese providers
  qwen:                 'qianwen.aliyun.com',
  alibaba:              'alibaba.com',
  baidu:                'baidu.com',
  bytedance:            'doubao.com',
  'bytedance-seed':     'doubao.com',
  minimax:              'minimax.io',
  moonshotai:           'moonshot.cn',
  tencent:              'tencent.com',
  xiaomi:               'xiaomi.com',
  stepfun:              'stepfun.com',
  zhipuai:              'zhipuai.cn',
  kwaipilot:            'kuaishou.com',
  meituan:              'meituan.com',
  'z-ai':               'zhipuai.cn',
  // Open-source / research labs
  allenai:              'allenai.org',
  eleutherai:           'eleuther.ai',
  nousresearch:         'nousresearch.com',
  ibm:                  'ibm.com',
  'ibm-granite':        'ibm.com',
  // API / infra providers
  openrouter:           'openrouter.ai',
  ai21:                 'ai21.com',
  'arcee-ai':           'arcee.ai',
  upstage:              'upstage.ai',
  liquid:               'liquid.ai',
  inception:            'inceptionlabs.ai',
  'prime-intellect':    'primeintellect.ai',
  essentialai:          'essential.ai',
  switchpoint:          'switchpoint.ai',
  // Community fine-tuners / small labs with websites
  'aion-labs':          'aionlabs.ai',
  cognitivecomputations:'cognitivecomputations.com',
  deepcogito:           'deepcogito.com',
  mancer:               'mancer.tech',
  morph:                'morph.so',
  tngtech:              'tngtech.com',
  'anthracite-org':     'anthracite.org',
  relace:               'relace.ai',
  'nex-agi':            'nexagi.com',
  writer:               'writer.com',
  perplexity:           'perplexity.ai',
  amazon:               'amazon.com',
  microsoft:            'microsoft.com',
  cohere:               'cohere.com',
  inflection:           'inflection.ai',
};

// ── Provider AI product pages (for provider chip links) ─────────────────────
const PROVIDER_URLS = {
  // Major Western — link to AI product / API / models page
  openai:               'https://platform.openai.com/docs/models',
  anthropic:            'https://www.anthropic.com/claude',
  google:               'https://aistudio.google.com/',
  'meta-llama':         'https://ai.meta.com/models/',
  mistralai:            'https://mistral.ai/technology/',
  deepseek:             'https://www.deepseek.com/',
  'x-ai':               'https://x.ai/grok',
  cohere:               'https://cohere.com/models',
  perplexityai:         'https://www.perplexity.ai/',
  perplexity:           'https://www.perplexity.ai/',
  nvidia:               'https://build.nvidia.com/models',
  amazon:               'https://aws.amazon.com/bedrock/foundation-models/',
  microsoft:            'https://ai.azure.com/explore/models',
  inflection:           'https://inflection.ai/',
  writer:               'https://writer.com/',
  '01-ai':              'https://01.ai/',
  // Coding tools
  cursor:               'https://cursor.com/',
  windsurf:             'https://windsurf.com/',
  codeium:              'https://windsurf.com/',
  // Chinese — link to the actual AI chat/platform product
  qwen:                 'https://tongyi.aliyun.com/',
  alibaba:              'https://tongyi.aliyun.com/',
  baidu:                'https://yiyan.baidu.com/',
  bytedance:            'https://www.doubao.com/',
  'bytedance-seed':     'https://www.doubao.com/',
  minimax:              'https://minimax.io/platform',
  moonshotai:           'https://kimi.ai/',
  tencent:              'https://hunyuan.tencent.com/',
  xiaomi:               'https://mimo.xiaomi.com/',       // MiMo AI model page
  stepfun:              'https://stepfun.com/',
  zhipuai:              'https://chatglm.cn/',
  'z-ai':               'https://chatglm.cn/',
  kwaipilot:            'https://kwaipilot.kuaishou.com/',
  meituan:              'https://www.meituan.com/',
  // Research & open-source
  allenai:              'https://allenai.org/papers',
  eleutherai:           'https://www.eleuther.ai/',
  nousresearch:         'https://nousresearch.com/',
  ibm:                  'https://www.ibm.com/products/watsonx-ai',
  'ibm-granite':        'https://www.ibm.com/granite',
  // API / infra / community
  openrouter:           'https://openrouter.ai/models',
  ai21:                 'https://www.ai21.com/jamba',
  'arcee-ai':           'https://arcee.ai/',
  upstage:              'https://upstage.ai/',
  liquid:               'https://liquid.ai/',
  inception:            'https://inceptionlabs.ai/',
  'prime-intellect':    'https://primeintellect.ai/',
  essentialai:          'https://essential.ai/',
  switchpoint:          'https://switchpoint.ai/',
  'aion-labs':          'https://aionlabs.ai/',
  cognitivecomputations:'https://cognitivecomputations.com/',
  deepcogito:           'https://deepcogito.com/',
  mancer:               'https://mancer.tech/',
  morph:                'https://morph.so/',
  tngtech:              'https://www.tngtech.com/',
  'anthracite-org':     'https://anthracite.org/',
  relace:               'https://relace.ai/',
  'nex-agi':            'https://nexagi.com/',
};

// ── Model page URLs (link to the provider's own model/docs page) ─────────────
// Providers with per-model doc pages: use a template function.
// All others: link to provider's models listing or docs page.
const MODEL_PAGE_URLS = {
  openai:               null,  // handled per-model below
  anthropic:            'https://docs.anthropic.com/en/docs/about-claude/models/overview',
  google:               'https://ai.google.dev/gemini-api/docs/models',
  'meta-llama':         'https://ai.meta.com/models/',
  mistralai:            'https://mistral.ai/technology/',
  deepseek:             'https://github.com/deepseek-ai',
  'x-ai':               'https://x.ai/grok',
  cohere:               'https://cohere.com/models',
  perplexityai:         'https://docs.perplexity.ai/models/model-cards',
  perplexity:           'https://docs.perplexity.ai/models/model-cards',
  nvidia:               'https://build.nvidia.com/models',
  amazon:               'https://aws.amazon.com/bedrock/foundation-models/',
  microsoft:            'https://ai.azure.com/explore/models',
  qwen:                 'https://qwenlm.github.io/',
  alibaba:              'https://qwenlm.github.io/',
  baidu:                'https://yiyan.baidu.com/',
  bytedance:            'https://www.doubao.com/',
  'bytedance-seed':     'https://www.doubao.com/',
  minimax:              'https://minimax.io/platform',
  moonshotai:           'https://kimi.ai/',
  tencent:              'https://hunyuan.tencent.com/',
  xiaomi:               'https://mimo.xiaomi.com/',
  stepfun:              'https://stepfun.com/',
  zhipuai:              'https://chatglm.cn/',
  'z-ai':               'https://chatglm.cn/',
  ai21:                 'https://www.ai21.com/jamba',
  'arcee-ai':           'https://arcee.ai/',
  upstage:              'https://upstage.ai/',
  allenai:              'https://allenai.org/papers',
  nousresearch:         'https://nousresearch.com/',
  eleutherai:           'https://www.eleuther.ai/',
  'ibm-granite':        'https://www.ibm.com/granite',
  ibm:                  'https://www.ibm.com/products/watsonx-ai',
  liquid:               'https://liquid.ai/',
  inception:            'https://inceptionlabs.ai/',
  writer:               'https://writer.com/',
  inflection:           'https://inflection.ai/',
  morph:                'https://morph.so/',
  deepcogito:           'https://deepcogito.com/',
};

function getProviderUrl(providerId) {
  return PROVIDER_URLS[providerId] ?? null;
}

function getModelUrl(m) {
  if (m.providerId === 'openai') {
    return 'https://platform.openai.com/docs/models/' + m.slug;
  }
  if (m.providerId === 'mistralai') {
    var s = m.slug;
    var ci = s.indexOf(':'); if (ci !== -1) s = s.slice(0, ci);
    if (s.slice(-7) === '-latest') s = s.slice(0, -7);
    return 'https://mistral.ai/models/' + s;
  }
  if (m.providerId === 'nvidia') {
    return 'https://build.nvidia.com/' + m.id;
  }
  if (m.providerId === 'deepseek') {
    return 'https://github.com/deepseek-ai/' + m.slug.split('/').join('-');
  }
  return MODEL_PAGE_URLS[m.providerId] || PROVIDER_URLS[m.providerId] || 'https://openrouter.ai/' + m.id;
}

function getProviderLogo(providerId) {
  const domain = PROVIDER_DOMAINS[providerId];
  if (!domain) return null;
  return \`https://www.google.com/s2/favicons?domain=\${domain}&sz=32\`;
}

function providerLogoImg(providerId) {
  const src = getProviderLogo(providerId);
  if (!src) return '';
  return \`<img src="\${src}" class="provider-logo" alt="" loading="lazy" onerror="this.style.display='none'">\`;
}

// ── Filter & Sort ─────────────────────────────────────────────────────────────
function filterModels() {
  let list = state.models;
  const q = state.search.toLowerCase().trim();

  if (q) {
    list = list.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.provider.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q)
    );
  }

  if (state.cat !== 'all') {
    list = list.filter(m => {
      switch (state.cat) {
        case 'text':       return m.outputModalities?.includes('text') && !m.isVision;
        case 'vision':     return m.isVision;
        case 'audio':      return m.inputModalities?.includes('audio') || m.outputModalities?.includes('audio');
        case 'reasoning':  return m.isReasoning;
        case 'free':       return m.isFree;
        case 'opensource': return m.isOpenSource;
        case 'deprecated': return m.isDeprecated;
        default: return true;
      }
    });
  }

  if (state.providers.size > 0) {
    list = list.filter(m => state.providers.has(m.providerId));
  }

  // Sort
  const key = state.sortKey;
  list = [...list].sort((a, b) => {
    let av = a[key], bv = b[key];
    if (av === null || av === undefined) av = state.sortDir === 1 ? Infinity : -Infinity;
    if (bv === null || bv === undefined) bv = state.sortDir === 1 ? Infinity : -Infinity;
    if (typeof av === 'string') return av.localeCompare(bv) * state.sortDir;
    return (av - bv) * state.sortDir;
  });

  return list;
}

function filterSubs() {
  if (state.subCat === 'all') return state.subscriptions;
  return state.subscriptions.filter(s => s.category === state.subCat);
}

// ── Render Table ──────────────────────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('models-tbody');
  const list = filterModels();
  document.getElementById('filtered-count').textContent = list.length.toLocaleString();

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><h3>No models found</h3><p>Try adjusting your filters or search query.</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = list.map(m => {
    const ps = getProviderStyle(m.providerId);
    const modIcons = buildModIcons(m);
    const inPClass = priceClass(m.inputPer1M, 'input');
    const outPClass = priceClass(m.outputPer1M, 'output');
    const depClass = m.isDeprecated ? ' row-deprecated' : '';
    const logoImg = providerLogoImg(m.providerId);
    const modelUrl = getModelUrl(m);
    const providerUrl = getProviderUrl(m.providerId);
    const providerChip = \`<span class="provider-chip" style="background:\${ps.bg};color:\${ps.color}">\${logoImg}\${escape(m.provider)}</span>\`;

    return \`<tr class="model-row\${depClass}">
      <td class="model-cell">
        <a href="\${modelUrl}" target="_blank" rel="noopener" class="model-link">
          <span class="model-name">\${escape(m.name)}</span>
          <span class="model-id">\${escape(m.slug || m.id)}</span>
        </a>
      </td>
      <td>
        \${providerUrl
          ? \`<a href="\${providerUrl}" target="_blank" rel="noopener" class="provider-link">\${providerChip}</a>\`
          : providerChip}
      </td>
      <td class="ctx">\${fmtDate(m.createdAt)}</td>
      <td class="ctx">\${fmtCtx(m.contextWindow)}</td>
      <td><span class="price \${inPClass}">\${fmtPrice(m.inputPer1M)}</span></td>
      <td><span class="price \${outPClass}">\${fmtPrice(m.outputPer1M)}</span></td>
      <td><div class="modality-icons">\${modIcons}</div></td>
    </tr>\`;
  }).join('');
}

function buildModIcons(m) {
  const badges = [];
  // Status
  if (m.isDeprecated) {
    badges.push('<span class="badge badge-deprecated">Deprecated</span>');
  } else {
    badges.push('<span class="badge badge-active">Active</span>');
  }
  // Modalities
  const hasText = m.outputModalities?.includes('text');
  const hasImageOut = m.outputModalities?.includes('image');
  const hasVideoOut = m.outputModalities?.includes('video');
  const hasAudio = m.inputModalities?.includes('audio') || m.outputModalities?.includes('audio');
  if (hasText)     badges.push('<span class="badge badge-text">Text</span>');
  if (m.isVision)  badges.push('<span class="badge badge-vision">Vision</span>');
  if (hasImageOut) badges.push('<span class="badge badge-image-gen">Image</span>');
  if (hasVideoOut) badges.push('<span class="badge badge-video">Video</span>');
  if (hasAudio)    badges.push('<span class="badge badge-audio">Audio</span>');
  if (m.isReasoning) badges.push('<span class="badge badge-reasoning">Think</span>');
  if (m.isFree)    badges.push('<span class="badge badge-free">Free</span>');
  return badges.join('');
}

// ── Render Provider Filters ────────────────────────────────────────────────────
function renderProviderFilters() {
  const providerCounts = {};
  for (const m of state.models) {
    providerCounts[m.providerId] = (providerCounts[m.providerId] || { name: m.provider, count: 0 });
    providerCounts[m.providerId].count++;
  }

  const sorted = Object.entries(providerCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 12);

  const container = document.getElementById('provider-filters');
  container.innerHTML = sorted.map(([pid, info]) => {
    const ps = getProviderStyle(pid);
    const active = state.providers.has(pid) ? ' active' : '';
    const logo = providerLogoImg(pid);
    return \`<button class="filter-pill\${active}" data-provider="\${escape(pid)}"
      style="\${active ? 'background:' + ps.bg + ';border-color:' + ps.color + ';color:' + ps.color : ''}"
    >\${logo}\${escape(info.name)} <span style="opacity:0.5">\${info.count}</span></button>\`;
  }).join('');

  container.querySelectorAll('[data-provider]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.provider;
      if (state.providers.has(pid)) {
        state.providers.delete(pid);
        btn.classList.remove('active');
        btn.removeAttribute('style');
      } else {
        state.providers.add(pid);
        const ps = getProviderStyle(pid);
        btn.classList.add('active');
        btn.style.cssText = \`background:\${ps.bg};border-color:\${ps.color};color:\${ps.color}\`;
      }
      renderTable();
    });
  });
}

// ── Render Subscriptions ───────────────────────────────────────────────────────
function renderSubscriptions() {
  const grid = document.getElementById('subs-grid');
  const list = filterSubs();

  if (list.length === 0) {
    grid.innerHTML = '<div style="color:var(--text3);padding:40px;text-align:center">No subscriptions in this category.</div>';
    return;
  }

  grid.innerHTML = list.map(sub => {
    const ps = getProviderStyle(sub.providerId);
    const tiersHtml = sub.tiers.map(t => {
      const priceHtml = t.monthlyPrice === null
        ? '<span class="tier-price">Contact</span>'
        : t.monthlyPrice === 0
          ? '<span class="tier-price" style="color:var(--green)">Free</span>'
          : \`<span class="tier-price">$\${t.monthlyPrice}<span class="period">/mo</span></span>\`;

      const annualHtml = (t.annualMonthlyPrice && t.annualMonthlyPrice < (t.monthlyPrice ?? Infinity))
        ? \`<div class="tier-annual">$\${t.annualMonthlyPrice}/mo billed annually</div>\`
        : '';

      const cnPriceHtml = t.cnMonthlyPrice != null && t.monthlyPrice !== 0
        ? \`<div class="tier-cn-price">🇨🇳 ¥\${t.cnMonthlyPrice}/mo\${t.cnAnnualMonthlyPrice && t.cnAnnualMonthlyPrice < t.cnMonthlyPrice ? ' · ¥' + t.cnAnnualMonthlyPrice + ' annual' : ''}</div>\`
        : '';

      const badgeHtml = t.badge ? \`<div class="tier-badge">\${escape(t.badge)}</div>\` : '';
      const feats = t.features.slice(0, 5).map(f => \`<div class="tier-feature">\${escape(f)}</div>\`).join('');
      const perSeat = t.perSeat ? '<div style="font-size:10px;color:var(--text3);margin-top:2px">per seat</div>' : '';

      return \`<div class="tier\${t.highlight ? ' highlight' : ''}">
        \${badgeHtml}
        <div class="tier-name">\${escape(t.name)}</div>
        \${priceHtml}
        \${perSeat}
        \${annualHtml}
        \${cnPriceHtml}
        <div class="tier-features">\${feats}</div>
      </div>\`;
    }).join('');

    const logoImg = providerLogoImg(sub.providerId);
    const providerUrl = getProviderUrl(sub.providerId);
    const providerChipHtml = \`<span class="sub-provider-chip" style="background:\${ps.bg};color:\${ps.color}">\${logoImg}\${escape(sub.provider)}</span>\`;
    return \`<div class="sub-card">
      <div class="sub-header">
        <div class="sub-title-row">
          <span class="sub-name">\${escape(sub.name)}</span>
          \${providerUrl
            ? \`<a href="\${providerUrl}" target="_blank" rel="noopener" class="provider-link">\${providerChipHtml}</a>\`
            : providerChipHtml}
        </div>
        <p class="sub-desc">\${escape(sub.description)}</p>
      </div>
      <div class="tiers-row">\${tiersHtml}</div>
      <div class="sub-footer">
        <a href="\${escape(sub.url)}" target="_blank" rel="noopener" class="sub-link">View pricing →</a>
      </div>
    </div>\`;
  }).join('');
}

// ── Stats ──────────────────────────────────────────────────────────────────────
function updateStats() {
  const providers = new Set(state.models.map(m => m.providerId));
  const free = state.models.filter(m => m.isFree).length;

  document.getElementById('stat-models').textContent = state.models.length.toLocaleString();
  document.getElementById('stat-providers').textContent = providers.size;
  document.getElementById('stat-free').textContent = free;
  document.getElementById('stat-subs').textContent = state.subscriptions.length;
  document.getElementById('nav-model-count').textContent = state.models.length.toLocaleString() + ' models';
  document.getElementById('nav-providers').textContent = providers.size + ' providers';
  document.getElementById('stat-desc-models').textContent = state.models.length.toLocaleString();
  document.getElementById('stat-desc-providers').textContent = providers.size;
}

// ── Sort Headers ───────────────────────────────────────────────────────────────
function bindSortHeaders() {
  document.querySelectorAll('thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (state.sortKey === key) {
        state.sortDir *= -1;
      } else {
        state.sortKey = key;
        state.sortDir = 1;
      }
      document.querySelectorAll('thead th').forEach(t => {
        t.classList.remove('sorted');
        const icon = t.querySelector('.sort-icon');
        if (icon) icon.textContent = '↕';
      });
      th.classList.add('sorted');
      const icon = th.querySelector('.sort-icon');
      if (icon) icon.textContent = state.sortDir === 1 ? '↑' : '↓';
      renderTable();
    });
  });
}

// ── View Switch ────────────────────────────────────────────────────────────────
function switchView(view) {
  state.view = view;
  const apiSection = document.getElementById('api-section');
  const subsSection = document.getElementById('subs-section');
  const apiControls = document.getElementById('api-controls');
  const subsControls = document.getElementById('subs-controls');

  document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(\`.main-tab[data-view="\${view}"]\`).classList.add('active');

  if (view === 'api') {
    apiSection.style.display = '';
    subsSection.style.display = 'none';
    apiControls.style.display = '';
    subsControls.style.display = 'none';
  } else {
    apiSection.style.display = 'none';
    subsSection.style.display = '';
    apiControls.style.display = 'none';
    subsControls.style.display = '';
    renderSubscriptions();
  }
}

// ── Consent ────────────────────────────────────────────────────────────────────
function setConsent(choice) {
  localStorage.setItem('cookie_consent', choice);
  if (choice === 'accepted' && window.gtag) {
    gtag('consent', 'update', { analytics_storage: 'granted' });
  }
  const bar = document.getElementById('consent-bar');
  bar.style.display = 'none';
  document.body.style.paddingBottom = '';
}

function initConsent() {
  if (localStorage.getItem('cookie_consent')) return;
  const bar = document.getElementById('consent-bar');
  bar.style.display = 'flex';
  const sync = () => { document.body.style.paddingBottom = bar.offsetHeight + 'px'; };
  sync();
  window.addEventListener('resize', sync);
}

// ── Legal Modals ───────────────────────────────────────────────────────────────
const TERMS_HTML = \`
<h3>1. Acceptance of Terms</h3>
<p>By accessing token.app, you agree to these Terms of Use. If you do not agree, please do not use this service.</p>
<h3>2. Service Description</h3>
<p>token.app is a free tool that aggregates and displays AI model pricing information from public sources including OpenRouter and provider websites. It is provided for informational purposes only.</p>
<h3>3. Accuracy of Information</h3>
<p>Prices displayed are sourced from third-party APIs and may not reflect current or accurate pricing. Always verify pricing directly with the relevant AI provider before making purchasing decisions. We make no warranties about the accuracy, completeness, or timeliness of the information shown.</p>
<h3>4. Intellectual Property</h3>
<p>The token.app interface, design, and code are owned by Measurable AI. Pricing data is sourced from third-party providers and subject to their respective terms.</p>
<h3>5. Limitation of Liability</h3>
<p>token.app and Measurable AI are not liable for any decisions made based on information displayed on this site. Use of this service is at your own risk.</p>
<h3>6. Changes to Service</h3>
<p>We reserve the right to modify, suspend, or discontinue the service at any time without notice.</p>
<h3>7. Contact</h3>
<p>For questions, contact us at <a href="mailto:hello@measurable.ai">hello@measurable.ai</a>.</p>
\`;

const PRIVACY_HTML = \`
<h3>What We Collect</h3>
<p>With your consent, we use Google Analytics (GA4) to collect anonymous usage data — pages visited, session duration, and general geographic region. No personally identifiable information is collected or stored by us.</p>
<h3>Cookies</h3>
<p>Google Analytics uses cookies to distinguish visitors and track sessions. These cookies are only activated after you accept via the consent banner. You can withdraw consent at any time by clearing your browser cookies.</p>
<h3>Third-Party Services</h3>
<p>Pricing data is fetched from <a href="https://openrouter.ai" target="_blank" rel="noopener">OpenRouter's public API</a>. Analytics data is governed by <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google's Privacy Policy</a>.</p>
<h3>Data Retention</h3>
<p>Analytics data is retained in Google Analytics for 14 months. We do not store any personal data on our own servers.</p>
<h3>Your Rights</h3>
<p>You may decline analytics cookies using the banner on this site. You can also opt out globally using the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener">Google Analytics Opt-out Browser Add-on</a>.</p>
<h3>Contact</h3>
<p>For privacy inquiries, contact <a href="mailto:hello@measurable.ai">hello@measurable.ai</a>.</p>
\`;

function openModal(type) {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = type === 'terms' ? 'Terms of Use' : 'Privacy Policy';
  document.getElementById('modal-body').innerHTML = type === 'terms' ? TERMS_HTML : PRIVACY_HTML;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Init ───────────────────────────────────────────────────────────────────────
async function init() {
  // Use server-injected initial data if available
  const initialModels = ${initialModels};
  const initialSubs = ${initialSubscriptions};
  const lastUpdated = ${lastUpdated ? JSON.stringify(lastUpdated) : 'null'};

  if (initialModels && initialModels.length > 0) {
    state.models = initialModels;
    state.subscriptions = initialSubs;
    updateStats();
    renderProviderFilters();
    renderTable();
    if (lastUpdated) {
      const upd = fmtUpdated(lastUpdated);
      document.getElementById('nav-updated').textContent = upd;
      document.getElementById('table-updated').textContent = 'Last updated: ' + upd;
    }
  } else {
    // Fetch from API
    try {
      const [modelsRes, subsRes] = await Promise.all([
        fetch('/api/models'),
        fetch('/api/subscriptions'),
      ]);
      const { models, lastUpdated: lu } = await modelsRes.json();
      const subs = await subsRes.json();
      state.models = models;
      state.subscriptions = subs;
      updateStats();
      renderProviderFilters();
      renderTable();
      if (lu) {
        const upd = fmtUpdated(lu);
        document.getElementById('nav-updated').textContent = upd;
        document.getElementById('table-updated').textContent = 'Last updated: ' + upd;
      }
    } catch (err) {
      document.getElementById('models-tbody').innerHTML =
        '<tr><td colspan="7"><div class="empty-state"><h3>Failed to load data</h3><p>' + err.message + '</p></div></td></tr>';
    }
  }
}

// ── Theme ──────────────────────────────────────────────────────────────────────
function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme');
  var next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

// ── Event Bindings ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  init();
  bindSortHeaders();
  initConsent();

  // Main view tabs
  document.querySelectorAll('.main-tab').forEach(tab => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });

  // Category tabs
  document.getElementById('cat-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    state.cat = btn.dataset.cat;
    document.querySelectorAll('[data-cat]').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    renderTable();
  });

  // Subscription category tabs
  document.querySelectorAll('[data-subcat]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.subCat = btn.dataset.subcat;
      document.querySelectorAll('[data-subcat]').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      renderSubscriptions();
    });
  });

  // Search
  let searchTimer;
  document.getElementById('search').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value;
      renderTable();
    }, 150);
  });
});
</script>
</body>
</html>`;
}
