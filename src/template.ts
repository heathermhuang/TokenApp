export function getHtml(params: {
  initialModels?: string;
  initialSubscriptions?: string;
  lastUpdated?: string | null;
}): string {
  const { initialModels = '[]', initialSubscriptions = '[]', lastUpdated = null } = params;

  // Compute counts server-side for accurate meta tags and hero description
  const parsedModels = JSON.parse(initialModels) as Array<{
    providerId: string;
    id: string;
    name: string;
    inputPer1M?: number | null;
    outputPer1M?: number | null;
  }>;
  const modelCount = parsedModels.length;
  const providerCount = new Set(parsedModels.map(m => m.providerId)).size;

  // Extract specific model prices for FAQ answers
  const gpt4o = parsedModels.find(m => m.id === 'openai/gpt-4o');
  const claude35sonnet = parsedModels.find(m => m.id === 'anthropic/claude-3-5-sonnet');
  const gemini15pro = parsedModels.find(m => m.id === 'google/gemini-pro-1.5' || m.id === 'google/gemini-1.5-pro');
  const deepseekV3 = parsedModels.find(m => m.id?.includes('deepseek') && m.id?.includes('chat'));

  function fmtPriceSsr(n: number | null | undefined): string {
    if (n === null || n === undefined) return 'varies';
    if (n === 0) return '$0.00';
    if (n < 0.01) return '<$0.01';
    if (n < 1) return '$' + n.toFixed(3);
    if (n < 10) return '$' + n.toFixed(2);
    return '$' + n.toFixed(1);
  }

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
  <meta property="og:image" content="https://token.app/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="token.app — AI Pricing Tracker" />
  <meta name="twitter:description" content="Real-time token pricing for ${modelCount}+ AI models. Compare input/output costs, context windows, and subscription plans." />
  <meta name="twitter:image" content="https://token.app/og.png" />
  <meta name="author" content="Measurable AI" />
  <link rel="canonical" href="https://token.app/" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔷</text></svg>" />
  <script>(function(){var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);})();</script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "name": "AI Model Token Pricing Dataset",
    "description": "Real-time token pricing for ${modelCount}+ AI language models from ${providerCount}+ providers including OpenAI, Anthropic, Google, Meta, Mistral, and DeepSeek. Updated hourly.",
    "url": "https://token.app/",
    "creator": {
      "@type": "Organization",
      "name": "Measurable AI",
      "url": "https://measurable.ai/"
    },
    "license": "https://measurable.ai/en-US/termsOfUse",
    "keywords": ["AI pricing", "LLM tokens", "API cost", "language models", "GPT", "Claude", "Gemini", "token pricing"],
    "measurementTechnique": "Automated hourly fetching from provider APIs and OpenRouter",
    "variableMeasured": ["input token price", "output token price", "context window", "model availability"]
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How much does GPT-4o cost per 1M tokens?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "GPT-4o costs ${fmtPriceSsr(gpt4o?.inputPer1M)} per 1M input tokens and ${fmtPriceSsr(gpt4o?.outputPer1M)} per 1M output tokens. These prices are sourced from OpenRouter and updated hourly."
        }
      },
      {
        "@type": "Question",
        "name": "How much does Claude 3.5 Sonnet cost per 1M tokens?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Claude 3.5 Sonnet costs ${fmtPriceSsr(claude35sonnet?.inputPer1M)} per 1M input tokens and ${fmtPriceSsr(claude35sonnet?.outputPer1M)} per 1M output tokens as listed by Anthropic."
        }
      },
      {
        "@type": "Question",
        "name": "What is the cheapest AI API for text generation?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Several AI models offer free API access with $0 per token pricing, including models from DeepSeek, Meta's Llama, and various open-source providers. token.app tracks ${modelCount}+ models so you can compare and find the lowest-cost option for your use case."
        }
      },
      {
        "@type": "Question",
        "name": "How often are token prices updated?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "token.app updates pricing data every hour by fetching from OpenRouter and official provider pricing pages. The last update time is shown at the top of the pricing table."
        }
      },
      {
        "@type": "Question",
        "name": "What is a token in AI models?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "A token is a unit of text processed by AI language models. Roughly 1 token equals 4 characters or 0.75 words in English. AI APIs charge separately for input tokens (the text you send) and output tokens (the text the model generates). Prices are typically quoted per 1 million tokens."
        }
      },
      {
        "@type": "Question",
        "name": "How does DeepSeek compare in price to OpenAI?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "DeepSeek models are significantly cheaper than OpenAI equivalents. DeepSeek V3 costs ${fmtPriceSsr(deepseekV3?.inputPer1M)} per 1M input tokens compared to GPT-4o at ${fmtPriceSsr(gpt4o?.inputPer1M)} per 1M input tokens — making it one of the most cost-effective frontier models available."
        }
      }
    ]
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

    /* Mobile-only compact meta row (context + capability badges) */
    .mobile-meta {
      display: none;
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

    /* ── About Data Section ───────────────────────────────────────────────── */
    .about-data {
      max-width: 860px;
      margin: 0 auto 12px;
      padding: 20px 24px;
      border-top: 1px solid var(--border);
    }

    .about-data h2 {
      font-size: 13px;
      font-weight: 600;
      color: var(--text2);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 10px;
    }

    .about-data p {
      font-size: 13px;
      color: var(--text3);
      line-height: 1.65;
      margin-bottom: 8px;
    }

    .about-data p:last-child { margin-bottom: 0; }

    /* ── FAQ Section ──────────────────────────────────────────────────────── */
    .faq-section {
      max-width: 860px;
      margin: 0 auto 8px;
      padding: 20px 24px;
      border-top: 1px solid var(--border);
    }

    .faq-section h2 {
      font-size: 13px;
      font-weight: 600;
      color: var(--text2);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 14px;
    }

    .faq-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .faq-item {
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }

    .faq-item summary {
      padding: 12px 16px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      color: var(--text2);
      list-style: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      user-select: none;
    }

    .faq-item summary::-webkit-details-marker { display: none; }

    .faq-item summary::after {
      content: '+';
      color: var(--text3);
      font-size: 16px;
      font-weight: 400;
      flex-shrink: 0;
      transition: transform 0.15s;
    }

    .faq-item[open] summary::after { content: '−'; }

    .faq-item summary:hover { color: var(--text); background: var(--surface2); }

    .faq-item p {
      padding: 0 16px 14px;
      font-size: 13px;
      color: var(--text3);
      line-height: 1.65;
    }

    /* ── sr-only ──────────────────────────────────────────────────────────── */
    .sr-only {
      position: absolute;
      width: 1px; height: 1px;
      padding: 0; margin: -1px;
      overflow: hidden;
      clip: rect(0,0,0,0);
      white-space: nowrap;
      border: 0;
    }

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
      /* Nav */
      .nav-meta { display: none; }

      /* Hero: tighter vertical rhythm */
      .hero { padding: 16px 16px 14px; }
      .hero h1 { font-size: 21px; margin-bottom: 6px; }
      .hero p { font-size: 13px; margin-bottom: 16px; }

      /* Stats: compact 2×2 grid */
      .stats-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .stat { padding: 8px 10px; }
      .stat-value { font-size: 17px; }
      .stat-label { font-size: 10px; }

      /* Controls */
      .controls { padding: 0 12px 10px; }

      /* Search: full width on its own row */
      .filter-row { gap: 6px; }
      .search-wrap { min-width: unset; max-width: unset; flex: 1 1 100%; margin-bottom: 0; }
      #search { max-width: unset; font-size: 14px; }
      /* Hide the desktop vertical separator — it orphans on its own row on mobile */
      .filter-divider { display: none; }

      /* Category + filter pills: tighter */
      .cat-tabs { gap: 4px; }
      .cat-tab { padding: 4px 10px; font-size: 12px; }
      .filter-pill { font-size: 11px; padding: 3px 7px; }

      /* Table: all columns visible, swipe right to see all */
      .table-wrap { padding: 0 0 32px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
      table { min-width: 720px; table-layout: auto; }
      table th, table td { padding: 6px 8px; }
      .model-name { font-size: 12px; }
      .model-id { font-size: 10px; }
      .provider-chip { font-size: 11px; padding: 2px 6px; gap: 3px; }
      .provider-chip img { width: 13px; height: 13px; }
      .price { font-size: 12px; }

      /* Subscriptions */
      .subs-grid { grid-template-columns: 1fr; }
      #subs-section { padding: 0 16px 32px; }
      .tiers-row { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .tier { min-width: 100px; flex-shrink: 0; }
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

<!-- ── About the Data ────────────────────────────────────────────────────────── -->
<section class="about-data" id="about-data">
  <h2>About This Data</h2>
  <p>
    token.app tracks real-time token pricing and subscription costs across the AI ecosystem.
    We aggregate pricing data from <a href="https://openrouter.ai" target="_blank" rel="noopener">OpenRouter</a>
    and official provider pricing pages, refreshing every hour so you always see current rates.
    Coverage spans ${modelCount}+ models from ${providerCount}+ providers — including frontier labs like OpenAI,
    Anthropic, Google DeepMind, Meta AI, Mistral, DeepSeek, xAI, Qwen, NVIDIA, and Cohere,
    as well as dozens of fine-tuned and open-weight variants.
  </p>
  <p>
    Every row in the table shows the model's input cost and output cost per 1 million tokens,
    its context window size, and the modality types it supports (text, vision, audio, reasoning).
    Prices reflect the listed API rate; enterprise or volume discounts may differ.
    For the most accurate billing information always check the provider's official pricing page.
    Data is provided by <a href="https://measurable.ai" target="_blank" rel="noopener">Measurable AI</a>
    and is intended for research and comparison purposes.
  </p>
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
<h2 class="sr-only">API Pricing</h2>
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
<h2 class="sr-only">AI Subscription Plans</h2>
<div id="subs-section" style="display:none;">
  <div class="subs-grid" id="subs-grid">
    <!-- Injected by JS -->
  </div>
</div>

<!-- ── FAQ ────────────────────────────────────────────────────────────────────── -->
<section class="faq-section" id="faq">
  <h2>Frequently Asked Questions</h2>
  <div class="faq-list">
    <details class="faq-item">
      <summary>How much does GPT-4o cost per 1M tokens?</summary>
      <p>GPT-4o costs ${fmtPriceSsr(gpt4o?.inputPer1M)} per 1M input tokens and ${fmtPriceSsr(gpt4o?.outputPer1M)} per 1M output tokens. These prices are sourced from OpenRouter and updated hourly. Always verify with OpenAI's official pricing page before billing decisions.</p>
    </details>
    <details class="faq-item">
      <summary>How much does Claude 3.5 Sonnet cost per 1M tokens?</summary>
      <p>Claude 3.5 Sonnet from Anthropic costs ${fmtPriceSsr(claude35sonnet?.inputPer1M)} per 1M input tokens and ${fmtPriceSsr(claude35sonnet?.outputPer1M)} per 1M output tokens. It supports a 200K context window, making it one of the best-value frontier models for long-document tasks.</p>
    </details>
    <details class="faq-item">
      <summary>What is a token in AI models?</summary>
      <p>A token is a chunk of text processed by an AI language model. In English, roughly 1 token equals 4 characters or 0.75 words. AI APIs charge separately for input tokens (your prompt) and output tokens (the model's response). Prices are quoted per 1 million tokens ($/1M). A typical ChatGPT-length exchange uses 300–500 tokens total.</p>
    </details>
    <details class="faq-item">
      <summary>How does DeepSeek compare in price to OpenAI?</summary>
      <p>DeepSeek models are significantly cheaper than most OpenAI equivalents. DeepSeek V3 costs ${fmtPriceSsr(deepseekV3?.inputPer1M)} per 1M input tokens compared to GPT-4o at ${fmtPriceSsr(gpt4o?.inputPer1M)} per 1M input tokens. For many tasks, DeepSeek delivers comparable quality at a fraction of the cost.</p>
    </details>
    <details class="faq-item">
      <summary>What is the cheapest AI API available?</summary>
      <p>Several models offer completely free API access ($0 per token), including models hosted on OpenRouter from Meta (Llama), Mistral, and others. Use the "Free" filter tab in the table above to see all currently free models. Availability of free tiers can change — check token.app regularly for the latest pricing.</p>
    </details>
    <details class="faq-item">
      <summary>How often are token prices updated?</summary>
      <p>token.app refreshes pricing data every hour by automatically fetching from OpenRouter and official provider pricing pages. The "Updated" timestamp at the top of the table shows when data was last refreshed. Prices can change without notice — always confirm critical pricing with the official provider.</p>
    </details>
    <details class="faq-item">
      <summary>What is the difference between input and output token pricing?</summary>
      <p>Input tokens are the text you send to the model (your prompt, context, examples). Output tokens are the text the model generates in response. Output tokens typically cost 3–5× more than input tokens because generating text requires more compute than reading it. When optimising costs, reducing your prompt length and caching repeated context can significantly lower your bill.</p>
    </details>
    <details class="faq-item">
      <summary>Which AI model has the largest context window?</summary>
      <p>As of 2025, several models support extremely large context windows. Google Gemini 1.5 Pro and 1.5 Flash support up to 2M tokens. Anthropic Claude models support up to 200K tokens. OpenAI GPT-4o supports 128K tokens. Larger context windows allow processing longer documents, conversations, and codebases in a single request.</p>
    </details>
  </div>
</section>

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

function safeUrl(url) {
  // Reject anything that isn't https:// — guards against javascript: or data: injection
  // from supply-chain-compromised upstream data (e.g. OpenRouter API poisoning)
  return (url && String(url).indexOf('https://') === 0) ? url : null;
}

function getModelUrl(m) {
  var url;
  if (m.providerId === 'openai') {
    url = 'https://platform.openai.com/docs/models/' + m.slug;
  } else if (m.providerId === 'mistralai') {
    var s = m.slug;
    var ci = s.indexOf(':'); if (ci !== -1) s = s.slice(0, ci);
    if (s.slice(-7) === '-latest') s = s.slice(0, -7);
    url = 'https://mistral.ai/models/' + s;
  } else if (m.providerId === 'nvidia') {
    url = 'https://build.nvidia.com/' + m.id;
  } else if (m.providerId === 'deepseek') {
    url = 'https://github.com/deepseek-ai/' + m.slug.split('/').join('-');
  } else {
    url = MODEL_PAGE_URLS[m.providerId] || PROVIDER_URLS[m.providerId] || 'https://openrouter.ai/' + m.id;
  }
  return safeUrl(url) || ('https://openrouter.ai/' + m.id);
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

    const ctxTag = m.contextWindow ? \`<span class="ctx-tag">\${fmtCtx(m.contextWindow)}</span>\` : '';
    const mobileBadges = buildMobileMeta(m);
    const mobileMeta = (ctxTag || mobileBadges) ? \`<div class="mobile-meta">\${ctxTag}\${mobileBadges}</div>\` : '';

    return \`<tr class="model-row\${depClass}">
      <td class="model-cell">
        <a href="\${modelUrl}" target="_blank" rel="noopener" class="model-link">
          <span class="model-name">\${escape(m.name)}</span>
          <span class="model-id">\${escape(m.slug || m.id)}</span>
        </a>
        \${mobileMeta}
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

function buildMobileMeta(m) {
  const b = [];
  if (m.isFree)    b.push('<span class="badge badge-free">Free</span>');
  if (m.isVision)  b.push('<span class="badge badge-vision">Vision</span>');
  if (m.isReasoning) b.push('<span class="badge badge-reasoning">Think</span>');
  if (m.outputModalities?.includes('image')) b.push('<span class="badge badge-image-gen">Image</span>');
  if (m.outputModalities?.includes('video')) b.push('<span class="badge badge-video">Video</span>');
  if (m.inputModalities?.includes('audio') || m.outputModalities?.includes('audio')) b.push('<span class="badge badge-audio">Audio</span>');
  if (m.isDeprecated) b.push('<span class="badge badge-deprecated">Deprecated</span>');
  return b.join('');
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

// ── Provider page descriptions ────────────────────────────────────────────────

const PROVIDER_META: Record<string, { name: string; description: string; about: string }> = {
  openai: {
    name: 'OpenAI',
    description: 'Real-time API token pricing for all OpenAI models including GPT-4o, GPT-4o mini, o1, o3, and GPT-3.5. Compare input/output costs and context windows.',
    about: `OpenAI is the San Francisco-based AI lab behind the GPT series and ChatGPT. Their model lineup spans the cost spectrum from the ultra-affordable GPT-4o mini to the flagship GPT-4o and the advanced reasoning models o1 and o3. OpenAI pioneered the pay-per-token API model and remains one of the most widely integrated AI providers in production applications. Their pricing is generally quoted via the OpenAI API and aggregated on OpenRouter.`,
  },
  anthropic: {
    name: 'Anthropic',
    description: 'Real-time API token pricing for all Anthropic Claude models including Claude 3.5 Sonnet, Claude 3.5 Haiku, and Claude 3 Opus. Compare input/output costs and context windows.',
    about: `Anthropic builds the Claude family of large language models with a strong emphasis on AI safety and reliability. Claude 3.5 Sonnet is widely regarded as one of the best-value frontier models, combining high capability with a 200K context window. Anthropic offers a tiered lineup from the fast and affordable Claude Haiku to the powerful Claude Opus, designed for enterprise reasoning and long-document analysis.`,
  },
  google: {
    name: 'Google',
    description: 'Real-time API token pricing for all Google AI models including Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 2.0 Flash, and PaLM. Compare input/output costs and context windows.',
    about: `Google DeepMind produces the Gemini family of multimodal AI models available through Google AI Studio and Vertex AI. Gemini 1.5 Pro and Flash support industry-leading context windows of up to 2 million tokens. Google also offers several models with generous free-tier quotas, making them popular for experimentation. Their models support text, vision, audio, and video modalities.`,
  },
  'meta-llama': {
    name: 'Meta Llama',
    description: 'Real-time API token pricing for Meta Llama models including Llama 3.1, Llama 3.2, and Llama 3.3. Many Llama models are available free via OpenRouter.',
    about: `Meta AI's Llama series are open-weight models released under a permissive research licence, making them the most widely deployed open-source AI models in the world. Llama 3 models are available in multiple sizes (8B, 70B, 405B) with strong performance across coding, reasoning, and instruction following. Many providers host Llama models at zero cost via OpenRouter, making them the default choice for budget-conscious developers.`,
  },
  mistralai: {
    name: 'Mistral AI',
    description: 'Real-time API token pricing for Mistral AI models including Mistral Large, Mistral Small, Mixtral 8x7B, and Codestral. Compare input/output costs.',
    about: `Mistral AI is a Paris-based AI company known for releasing highly efficient open-weight models. Their Mixtral 8x22B model uses a mixture-of-experts architecture to deliver frontier-quality performance at a fraction of the cost. Mistral also offers Codestral, a specialized coding model, and Le Chat, their consumer assistant. Mistral models are popular for European data sovereignty requirements.`,
  },
  deepseek: {
    name: 'DeepSeek',
    description: 'Real-time API token pricing for DeepSeek models including DeepSeek V3, DeepSeek R1, and DeepSeek Coder. DeepSeek offers some of the lowest prices among frontier AI models.',
    about: `DeepSeek is a Chinese AI research lab that has released highly capable models at remarkably low prices, disrupting the AI pricing landscape in 2025. DeepSeek V3 and R1 match or exceed many frontier models on benchmarks while costing a fraction of comparable OpenAI or Anthropic models. Their models are open-weight and widely available through OpenRouter and other providers.`,
  },
  'x-ai': {
    name: 'xAI (Grok)',
    description: 'Real-time API token pricing for xAI Grok models including Grok 3 and Grok 2. Compare Grok input/output costs and context windows.',
    about: `xAI is Elon Musk's AI company, best known for the Grok series of large language models. Grok models are available via the xAI API and through X (formerly Twitter) Premium subscriptions. Grok 3 is xAI's flagship reasoning model, designed to be competitive with GPT-4o and Claude 3.5 Sonnet. xAI emphasises real-time information access and integration with the X platform.`,
  },
  qwen: {
    name: 'Qwen (Alibaba)',
    description: 'Real-time API token pricing for Qwen models from Alibaba Cloud including Qwen 2.5, Qwen 2, and QwQ reasoning models. Compare input/output costs.',
    about: `Qwen is Alibaba Cloud's family of large language models, released under the Qwen series. Qwen 2.5 models span sizes from 0.5B to 72B parameters and include specialized variants for coding, math, and instruction following. QwQ is Alibaba's reasoning-focused model competitive with o1-mini. Many Qwen models are open-weight and available at very low cost via OpenRouter.`,
  },
  nvidia: {
    name: 'NVIDIA',
    description: 'Real-time API token pricing for NVIDIA AI models including Llama Nemotron and other NVIDIA-hosted models. Compare input/output costs via OpenRouter.',
    about: `NVIDIA hosts and fine-tunes AI models through NVIDIA NIM (NVIDIA Inference Microservices) and makes them available via API. Their offerings include fine-tuned variants of Meta Llama and other open-weight models optimized for NVIDIA hardware. NVIDIA also produces their own models like Nemotron, designed for enterprise workloads on NVIDIA GPU infrastructure.`,
  },
  cohere: {
    name: 'Cohere',
    description: 'Real-time API token pricing for Cohere models including Command R+, Command R, and Embed. Cohere specialises in enterprise RAG and embeddings.',
    about: `Cohere is a Toronto-based AI company specializing in enterprise language models, particularly for retrieval-augmented generation (RAG) and embeddings. Command R+ is their flagship model optimized for multi-step reasoning and tool use in enterprise RAG pipelines. Cohere also produces industry-leading embedding models and a reranker, making them a popular choice for search and knowledge management applications.`,
  },
};

// ── Provider page HTML ────────────────────────────────────────────────────────

export function getProviderHtml(params: {
  providerId: string;
  models: Array<{
    id: string;
    slug: string;
    name: string;
    provider: string;
    providerId: string;
    inputPer1M: number | null;
    outputPer1M: number | null;
    contextWindow: number | null;
    inputModalities: string[];
    outputModalities: string[];
    isFree: boolean;
    isVision: boolean;
    isReasoning: boolean;
    isOpenSource: boolean;
    isDeprecated: boolean;
    createdAt: number | null;
  }>;
}): string {
  const { providerId, models } = params;
  const meta = PROVIDER_META[providerId] ?? {
    name: providerId,
    description: `AI token pricing for ${providerId} models.`,
    about: `${providerId} offers AI language models available via API.`,
  };

  function fmtCtx(n: number | null): string {
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
    return '$' + n.toFixed(1);
  }

  function fmtDate(ts: number | null): string {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  }

  function escape(s: string): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const activeModels = models.filter(m => !m.isDeprecated);
  const modelCount = activeModels.length;

  const rows = models.map(m => {
    const mods: string[] = [];
    if (m.inputModalities.includes('image') || m.isVision) mods.push('Vision');
    if (m.inputModalities.includes('audio') || m.outputModalities.includes('audio')) mods.push('Audio');
    if (m.isReasoning) mods.push('Reasoning');
    if (m.isFree) mods.push('Free');
    if (m.isOpenSource) mods.push('Open Source');
    if (m.isDeprecated) mods.push('Deprecated');

    return `<tr${m.isDeprecated ? ' class="deprecated-row"' : ''}>
      <td><span class="model-name">${escape(m.name)}</span></td>
      <td style="font-size:11px;color:var(--text3);">${fmtDate(m.createdAt)}</td>
      <td style="font-size:12px;">${fmtCtx(m.contextWindow)}</td>
      <td class="${m.inputPer1M === 0 ? 'price-free' : m.inputPer1M && m.inputPer1M < 0.5 ? 'price-cheap' : m.inputPer1M && m.inputPer1M < 3 ? 'price-mid' : ''}">${fmtP(m.inputPer1M)}</td>
      <td class="${m.outputPer1M === 0 ? 'price-free' : m.outputPer1M && m.outputPer1M < 2 ? 'price-cheap' : m.outputPer1M && m.outputPer1M < 12 ? 'price-mid' : ''}">${fmtP(m.outputPer1M)}</td>
      <td style="font-size:11px;">${mods.join(', ') || 'Text'}</td>
    </tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escape(meta.name)} API Pricing — token.app</title>
  <meta name="description" content="${escape(meta.description)}" />
  <meta name="author" content="Measurable AI" />
  <meta property="og:title" content="${escape(meta.name)} API Pricing — token.app" />
  <meta property="og:description" content="${escape(meta.description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://token.app/${encodeURIComponent(providerId)}" />
  <meta property="og:site_name" content="token.app" />
  <meta property="og:image" content="https://token.app/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://token.app/og.png" />
  <link rel="canonical" href="https://token.app/${encodeURIComponent(providerId)}" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔷</text></svg>" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "name": "${escape(meta.name)} AI Model Token Pricing",
    "description": "${escape(meta.description)}",
    "url": "https://token.app/${encodeURIComponent(providerId)}",
    "creator": {
      "@type": "Organization",
      "name": "Measurable AI",
      "url": "https://measurable.ai/"
    }
  }
  </script>
  <script>(function(){var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);})();</script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0c0c0e; --surface: #141418; --surface2: #1c1c22;
      --border: #27272f; --border2: #33333d;
      --text: #f0f0f4; --text2: #9090a0; --text3: #606070;
      --accent: #6366f1; --accent-dim: rgba(99,102,241,0.15);
      --green: #22c55e; --radius: 8px; --radius-sm: 5px;
      --nav-bg: rgba(12,12,14,0.88);
    }
    html[data-theme="light"] {
      --bg: #f4f4f8; --surface: #ffffff; --surface2: #ebebf2;
      --border: #dcdce8; --border2: #c8c8d8;
      --text: #111118; --text2: #484860; --text3: #8888a0;
      --accent: #5254d0; --accent-dim: rgba(82,84,208,0.1);
      --green: #16a34a; --nav-bg: rgba(244,244,248,0.9);
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); font-size: 14px; line-height: 1.5; min-height: 100vh; }
    nav { position: sticky; top: 0; z-index: 100; background: var(--nav-bg); backdrop-filter: blur(14px); border-bottom: 1px solid var(--border); padding: 0 24px; height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .nav-brand { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: var(--text); text-decoration: none; letter-spacing: -0.3px; }
    .nav-brand .diamond { color: var(--accent); font-size: 18px; }
    .nav-back { font-size: 13px; color: var(--text2); text-decoration: none; }
    .nav-back:hover { color: var(--text); }
    main { max-width: 1100px; margin: 0 auto; padding: 32px 24px 60px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
    .provider-desc { color: var(--text2); font-size: 14px; line-height: 1.6; max-width: 680px; margin-bottom: 8px; }
    .provider-count { font-size: 12px; color: var(--text3); margin-bottom: 24px; }
    .about-block { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px; margin-bottom: 24px; font-size: 13px; color: var(--text2); line-height: 1.7; }
    .about-block h2 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text3); margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead th { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 11px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
    tbody tr { border-bottom: 1px solid var(--border); }
    tbody tr:hover { background: var(--surface2); }
    tbody td { padding: 10px 12px; }
    .model-name { font-weight: 500; color: var(--text); }
    .price-free { color: #22c55e; font-weight: 600; }
    .price-cheap { color: #4ade80; }
    .price-mid { color: var(--text); }
    .deprecated-row { opacity: 0.5; }
    footer { border-top: 1px solid var(--border); padding: 20px 24px; text-align: center; font-size: 12px; color: var(--text3); }
    footer a { color: var(--text3); text-decoration: none; }
    footer a:hover { color: var(--text2); }
    @media (max-width: 600px) { main { padding: 20px 16px 40px; } table { font-size: 12px; } }
  </style>
</head>
<body>
<nav>
  <a href="/" class="nav-brand"><span class="diamond">◈</span> token.app</a>
  <a href="/" class="nav-back">← All providers</a>
</nav>
<main>
  <h1>${escape(meta.name)} API Pricing</h1>
  <p class="provider-desc">${escape(meta.description)}</p>
  <p class="provider-count">${modelCount} active models · Data updated hourly</p>

  <div class="about-block">
    <h2>About ${escape(meta.name)}</h2>
    <p>${escape(meta.about)}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Model</th>
        <th>Released</th>
        <th>Context</th>
        <th>Input $/1M</th>
        <th>Output $/1M</th>
        <th>Modalities</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--text3);">No models found</td></tr>'}
    </tbody>
  </table>
</main>
<footer>
  <p>Data sourced from <a href="https://openrouter.ai">OpenRouter</a> and provider pricing pages. Always verify with official sources.</p>
  <p style="margin-top:6px;">Powered by <a href="https://measurable.ai" target="_blank" rel="noopener">Measurable AI</a> · <a href="/">Back to token.app</a></p>
</footer>
</body>
</html>`;
}

// ── About page HTML ───────────────────────────────────────────────────────────

export function getAboutHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>About — token.app</title>
  <meta name="description" content="About token.app — AI token and subscription pricing tracker built by Measurable AI. Learn about our methodology, data sources, and update frequency." />
  <meta name="author" content="Measurable AI" />
  <meta property="og:title" content="About token.app" />
  <meta property="og:description" content="About token.app — AI token and subscription pricing tracker built by Measurable AI." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://token.app/about" />
  <meta property="og:site_name" content="token.app" />
  <meta property="og:image" content="https://token.app/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <link rel="canonical" href="https://token.app/about" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔷</text></svg>" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "name": "About token.app",
    "url": "https://token.app/about",
    "description": "About token.app — AI token and subscription pricing tracker.",
    "creator": {
      "@type": "Organization",
      "name": "Measurable AI",
      "url": "https://measurable.ai/"
    }
  }
  </script>
  <script>(function(){var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);})();</script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0c0c0e; --surface: #141418; --surface2: #1c1c22;
      --border: #27272f; --text: #f0f0f4; --text2: #9090a0; --text3: #606070;
      --accent: #6366f1; --radius: 8px; --nav-bg: rgba(12,12,14,0.88);
    }
    html[data-theme="light"] {
      --bg: #f4f4f8; --surface: #ffffff; --surface2: #ebebf2;
      --border: #dcdce8; --text: #111118; --text2: #484860; --text3: #8888a0;
      --accent: #5254d0; --nav-bg: rgba(244,244,248,0.9);
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); font-size: 15px; line-height: 1.65; min-height: 100vh; }
    nav { position: sticky; top: 0; z-index: 100; background: var(--nav-bg); backdrop-filter: blur(14px); border-bottom: 1px solid var(--border); padding: 0 24px; height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .nav-brand { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: var(--text); text-decoration: none; letter-spacing: -0.3px; }
    .nav-brand .diamond { color: var(--accent); font-size: 18px; }
    .nav-back { font-size: 13px; color: var(--text2); text-decoration: none; }
    .nav-back:hover { color: var(--text); }
    main { max-width: 720px; margin: 0 auto; padding: 48px 24px 80px; }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 6px; }
    .subtitle { font-size: 16px; color: var(--text2); margin-bottom: 40px; }
    h2 { font-size: 16px; font-weight: 600; margin: 32px 0 12px; color: var(--text); }
    p { color: var(--text2); margin-bottom: 14px; }
    p:last-child { margin-bottom: 0; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .provider-list { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
    .provider-pill { background: var(--surface2); border: 1px solid var(--border); border-radius: 20px; padding: 4px 14px; font-size: 12px; color: var(--text2); text-decoration: none; }
    .provider-pill:hover { border-color: var(--accent); color: var(--accent); text-decoration: none; }
    footer { border-top: 1px solid var(--border); padding: 20px 24px; text-align: center; font-size: 12px; color: var(--text3); }
    footer a { color: var(--text3); text-decoration: none; }
    footer a:hover { color: var(--text2); }
    @media (max-width: 600px) { main { padding: 32px 16px 60px; } }
  </style>
</head>
<body>
<nav>
  <a href="/" class="nav-brand"><span class="diamond">◈</span> token.app</a>
  <a href="/" class="nav-back">← Back to pricing</a>
</nav>
<main>
  <h1>About token.app</h1>
  <p class="subtitle">AI token and subscription pricing tracker, built by Measurable AI.</p>

  <h2>What is token.app?</h2>
  <p>
    token.app is a real-time pricing tracker for AI language model APIs and subscriptions.
    We aggregate token pricing data from <a href="https://openrouter.ai" target="_blank" rel="noopener">OpenRouter</a>
    and official provider pricing pages, making it easy to compare costs across the rapidly growing
    AI provider landscape. The site covers 350+ models from 55+ providers and updates every hour.
  </p>

  <h2>Data Sources &amp; Methodology</h2>
  <p>
    Pricing data is sourced primarily from the <a href="https://openrouter.ai/api/v1/models" target="_blank" rel="noopener">OpenRouter Models API</a>,
    which aggregates publicly listed prices from the major AI providers. We supplement this with
    direct pricing data from provider pages for subscription products (ChatGPT, Claude.ai, Gemini Advanced, etc.).
  </p>
  <p>
    Our Cloudflare Worker fetches and normalizes the raw data every hour, extracting:
    input token price ($/1M tokens), output token price ($/1M tokens), context window size,
    model release date, and supported input/output modalities (text, vision, audio, reasoning).
    All prices are in US dollars unless otherwise noted.
  </p>
  <p>
    <strong>Important:</strong> Prices shown are for reference only. AI providers can change pricing
    at any time. Always verify current pricing with the official provider before making billing decisions.
  </p>

  <h2>Provider Coverage</h2>
  <p>We track models from the following providers, with dedicated pages for each:</p>
  <div class="provider-list">
    <a href="/openai" class="provider-pill">OpenAI</a>
    <a href="/anthropic" class="provider-pill">Anthropic</a>
    <a href="/google" class="provider-pill">Google</a>
    <a href="/meta-llama" class="provider-pill">Meta Llama</a>
    <a href="/mistralai" class="provider-pill">Mistral AI</a>
    <a href="/deepseek" class="provider-pill">DeepSeek</a>
    <a href="/x-ai" class="provider-pill">xAI / Grok</a>
    <a href="/qwen" class="provider-pill">Qwen</a>
    <a href="/nvidia" class="provider-pill">NVIDIA</a>
    <a href="/cohere" class="provider-pill">Cohere</a>
  </div>
  <p>And many more — see the <a href="/">full model table</a> for complete coverage.</p>

  <h2>About Measurable AI</h2>
  <p>
    token.app is built and maintained by <a href="https://measurable.ai" target="_blank" rel="noopener">Measurable AI</a>,
    a data and AI company focused on making AI infrastructure costs transparent and understandable.
    The site runs on <a href="https://workers.cloudflare.com" target="_blank" rel="noopener">Cloudflare Workers</a>
    with data stored in Cloudflare KV, making it fast and globally distributed.
  </p>
  <p>
    We built token.app because AI token pricing is genuinely confusing — providers use different
    units, price structures, and update their rates frequently. Our goal is a single, always-current
    reference that developers and product teams can rely on when estimating API costs.
  </p>

  <h2>Contact &amp; Legal</h2>
  <p>
    For questions or data corrections, please reach out via <a href="https://measurable.ai" target="_blank" rel="noopener">measurable.ai</a>.
    Use of this site is subject to our <a href="https://measurable.ai/en-US/termsOfUse" target="_blank" rel="noopener">Terms of Use</a>
    and <a href="https://measurable.ai/en-US/privacyPolicy" target="_blank" rel="noopener">Privacy Policy</a>.
  </p>
</main>
<footer>
  <p>Built on <a href="https://workers.cloudflare.com">Cloudflare Workers</a> · Powered by <a href="https://measurable.ai" target="_blank" rel="noopener">Measurable AI</a></p>
  <p style="margin-top:6px;"><a href="/">← Back to token.app</a> · <a href="https://measurable.ai/en-US/termsOfUse" target="_blank" rel="noopener">Terms</a> · <a href="https://measurable.ai/en-US/privacyPolicy" target="_blank" rel="noopener">Privacy</a></p>
</footer>
</body>
</html>`;
}
