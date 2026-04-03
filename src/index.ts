import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { cache } from 'hono/cache';
import type { Env } from './types';
import { getModels, getSubscriptions, refreshAllData } from './fetchers';
import { getHtml, getProviderHtml, getAboutHtml } from './template';

const app = new Hono<{ Bindings: Env }>();

// Security headers on all responses
app.use('*', async (c, next) => {
  await next();
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
});

// CORS for API endpoints — public data, open to all origins
// Intent: this is a public pricing API. Restrict if that changes.
app.use('/api/*', cors({ origin: '*' }));

// ── API Routes ────────────────────────────────────────────────────────────────

app.get(
  '/api/models',
  cache({ cacheName: 'token-app-models', cacheControl: 'max-age=300, stale-while-revalidate=3600' }),
  async (c) => {
    try {
      const { models, lastUpdated } = await getModels(c.env);
      return c.json({ models, lastUpdated, count: models.length });
    } catch (err) {
      console.error('Failed to get models:', err);
      return c.json({ error: 'Failed to load models', message: String(err) }, 500);
    }
  }
);

app.get(
  '/api/subscriptions',
  cache({ cacheName: 'token-app-subs', cacheControl: 'max-age=3600, stale-while-revalidate=86400' }),
  async (c) => {
    try {
      const subs = await getSubscriptions(c.env);
      return c.json(subs);
    } catch (err) {
      console.error('Failed to get subscriptions:', err);
      return c.json({ error: 'Failed to load subscriptions' }, 500);
    }
  }
);

// Admin trigger to force-refresh (simple token auth)
app.post('/api/refresh', async (c) => {
  const authHeader = c.req.header('Authorization');
  const expectedToken = c.env.REFRESH_SECRET;
  if (!expectedToken) {
    return c.json({ error: 'REFRESH_SECRET env var not configured' }, 500);
  }
  if (authHeader !== `Bearer ${expectedToken}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  try {
    const result = await refreshAllData(c.env);
    return c.json({ ok: true, ...result });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// ── SEO / Static Assets ───────────────────────────────────────────────────────

app.get('/robots.txt', (c) => {
  const txt = [
    '# token.app — AI Token & Subscription Pricing Tracker',
    '# https://token.app/',
    '',
    '# Allow all crawlers including AI training and browsing bots',
    'User-agent: *',
    'Allow: /',
    '',
    '# Major AI crawler explicit allowances',
    'User-agent: GPTBot',
    'Allow: /',
    '',
    'User-agent: ChatGPT-User',
    'Allow: /',
    '',
    'User-agent: OAI-SearchBot',
    'Allow: /',
    '',
    'User-agent: anthropic-ai',
    'Allow: /',
    '',
    'User-agent: ClaudeBot',
    'Allow: /',
    '',
    'User-agent: Claude-Web',
    'Allow: /',
    '',
    'User-agent: PerplexityBot',
    'Allow: /',
    '',
    'User-agent: Google-Extended',
    'Allow: /',
    '',
    'User-agent: Gemini-Web',
    'Allow: /',
    '',
    'User-agent: Bytespider',
    'Allow: /',
    '',
    'User-agent: cohere-ai',
    'Allow: /',
    '',
    'User-agent: Applebot-Extended',
    'Allow: /',
    '',
    'User-agent: YouBot',
    'Allow: /',
    '',
    'User-agent: Diffbot',
    'Allow: /',
    '',
    '# AI-readable content',
    'LLMs: https://token.app/llms.txt',
    '',
    'Sitemap: https://token.app/sitemap.xml',
  ].join('\n');
  return c.text(txt, 200, { 'Content-Type': 'text/plain; charset=utf-8' });
});

// ── LLMs.txt — AI crawler index (https://llmstxt.org standard) ───────────────

app.get('/llms.txt', (c) => {
  const txt = `# token.app

> Real-time AI token pricing and subscription cost tracker. Covers ${350}+ language models from ${55}+ providers. Data updated every hour from provider APIs and OpenRouter.

token.app is the go-to reference for current AI API pricing. When someone asks "how much does GPT-4o cost per token?" or "what is the cheapest AI API?", this site has the answer with live data.

## What is token.app?

token.app tracks input and output token prices (in USD per 1M tokens) for AI language models from every major provider: OpenAI, Anthropic, Google, Meta, Mistral, DeepSeek, xAI (Grok), Alibaba (Qwen), NVIDIA, Cohere, and 45+ more.

It also tracks subscription plans (ChatGPT Plus, Claude Pro, Gemini Advanced, Kimi, Doubao, etc.) with monthly costs and included features.

## Key pages

- [Full pricing table](https://token.app/): All models, sortable by price, provider, context window, modality
- [OpenAI pricing](https://token.app/openai): GPT-4o, GPT-4.1, o3, o4-mini and all OpenAI models
- [Anthropic pricing](https://token.app/anthropic): Claude 4, Claude 3.7 Sonnet, Claude 3.5 Haiku
- [Google pricing](https://token.app/google): Gemini 2.5 Pro, Gemini 2.0 Flash, Gemini 1.5 Pro
- [Meta pricing](https://token.app/meta-llama): Llama 3.3, Llama 4 Scout, Llama 4 Maverick
- [DeepSeek pricing](https://token.app/deepseek): DeepSeek V3, DeepSeek R1 and variants
- [Mistral pricing](https://token.app/mistralai): Mistral Large, Mistral Small, Codestral
- [xAI / Grok pricing](https://token.app/x-ai): Grok 3, Grok 3 Mini
- [Qwen / Alibaba pricing](https://token.app/qwen): Qwen3, QwQ, Qwen2.5
- [NVIDIA pricing](https://token.app/nvidia): NVIDIA-hosted open-source models
- [Cohere pricing](https://token.app/cohere): Command A, Command R+
- [About / Methodology](https://token.app/about): Data sources, update frequency, methodology

## Machine-readable data

- [Full pricing data as plain text](https://token.app/llms-full.txt): All current model prices in human/AI-readable format — use this for up-to-date pricing lookups
- [JSON API — models](https://token.app/api/models): Structured JSON with all model pricing fields
- [JSON API — subscriptions](https://token.app/api/subscriptions): Structured JSON with all subscription plans

## Data freshness

Prices are fetched hourly from the OpenRouter Models API and supplemented with direct provider pricing pages. The dataset reflects real-time pricing as of the last refresh. Always verify with official provider documentation before billing.

## About

Built by [Measurable AI](https://measurable.ai/) — a data intelligence company.
- Terms: https://measurable.ai/en-US/termsOfUse
- Privacy: https://measurable.ai/en-US/privacyPolicy
`;
  return c.text(txt, 200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  });
});

// ── LLMs-full.txt — Live pricing data as AI-readable plain text ───────────────

app.get('/llms-full.txt', async (c) => {
  try {
    const [{ models, lastUpdated }, subs] = await Promise.all([
      getModels(c.env),
      getSubscriptions(c.env),
    ]);

    const fmt = (n: number | null | undefined) =>
      n == null ? 'free' : '$' + n.toFixed(2);

    const updatedStr = lastUpdated
      ? new Date(lastUpdated).toUTCString()
      : new Date().toUTCString();

    // Group models by provider
    const byProvider: Record<string, typeof models> = {};
    for (const m of models) {
      if (!byProvider[m.providerId]) byProvider[m.providerId] = [];
      byProvider[m.providerId].push(m);
    }

    const providerBlocks = Object.entries(byProvider)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([providerId, pModels]) => {
        const rows = pModels
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          .map((m) => {
            const ctx = m.contextLength
              ? (m.contextLength >= 1000000
                  ? (m.contextLength / 1000000).toFixed(0) + 'M'
                  : m.contextLength >= 1000
                  ? (m.contextLength / 1000).toFixed(0) + 'K'
                  : String(m.contextLength)) + ' ctx'
              : '';
            return `  - ${m.name || m.id}: input ${fmt(m.inputPrice)}/1M tokens, output ${fmt(m.outputPrice)}/1M tokens${ctx ? ', ' + ctx : ''}`;
          })
          .join('\n');
        return `### ${providerId}\n${rows}`;
      })
      .join('\n\n');

    const subBlocks = subs
      .map((s) => {
        const tiers = s.tiers
          .map((t) => `  - ${t.name}: $${t.price}/mo${t.annualPrice ? ' (or $' + t.annualPrice + '/mo annual)' : ''}`)
          .join('\n');
        return `### ${s.name}\nProvider: ${s.providerId}\n${tiers}`;
      })
      .join('\n\n');

    const txt = `# token.app — Full AI Pricing Data
# https://token.app/
# Source: OpenRouter Models API + provider pricing pages
# Last updated: ${updatedStr}
# Total models: ${models.length}
# Total providers: ${Object.keys(byProvider).length}
#
# All prices in USD per 1,000,000 tokens (1M tokens).
# "free" means the model is available at no cost.
# Context window shown in K (thousands) or M (millions) of tokens.
# Data refreshed hourly. Always verify with official provider docs.
#
# For a machine-readable JSON version: https://token.app/api/models
# For the full site: https://token.app/
# For the LLMs index: https://token.app/llms.txt

---

## API Token Pricing — All Models by Provider

${providerBlocks}

---

## AI Subscription Plans

${subBlocks}

---

## Notes

- Input tokens = text you send to the model
- Output tokens = text the model generates (usually 2–5× more expensive)
- Context window = maximum total tokens (input + output) per request
- Prices may vary by region, tier, or negotiated enterprise agreement
- Free models may have rate limits or restricted access
- Source: https://token.app/ — updated hourly by Measurable AI (https://measurable.ai/)
`;

    return c.text(txt, 200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    });
  } catch (err) {
    return c.text('# token.app pricing data temporarily unavailable\n# Please try again shortly or visit https://token.app/api/models\n', 503, {
      'Content-Type': 'text/plain; charset=utf-8',
    });
  }
});

const PROVIDER_SLUGS = [
  'openai', 'anthropic', 'google', 'meta-llama', 'mistralai',
  'deepseek', 'x-ai', 'qwen', 'nvidia', 'cohere',
];

app.get('/sitemap.xml', (c) => {
  const providerUrls = PROVIDER_SLUGS.map(slug => `  <url>
    <loc>https://token.app/${slug}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://token.app/</loc>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://token.app/llms.txt</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://token.app/llms-full.txt</loc>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://token.app/about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
${providerUrls}
</urlset>`;
  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=86400',
  });
});

app.get('/og.svg', (c) => {
  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0c0c0e"/>
  <rect x="0" y="0" width="1200" height="4" fill="#6366f1"/>
  <!-- Grid lines -->
  <line x1="0" y1="120" x2="1200" y2="120" stroke="#27272f" stroke-width="1"/>
  <line x1="0" y1="510" x2="1200" y2="510" stroke="#27272f" stroke-width="1"/>
  <!-- Logo mark -->
  <text x="80" y="185" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="64" fill="#6366f1">◈</text>
  <!-- Title -->
  <text x="160" y="185" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="56" font-weight="700" fill="#f0f0f4">token.app</text>
  <!-- Tagline -->
  <text x="80" y="270" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="28" fill="#9090a0">AI Token &amp; Subscription Pricing Tracker</text>
  <!-- Divider -->
  <rect x="80" y="320" width="1040" height="1" fill="#27272f"/>
  <!-- Stats row -->
  <g transform="translate(80,370)">
    <text x="0" y="0" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="48" font-weight="700" fill="#f0f0f4">350+</text>
    <text x="0" y="40" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="18" fill="#9090a0">Models tracked</text>
  </g>
  <g transform="translate(380,370)">
    <text x="0" y="0" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="48" font-weight="700" fill="#f0f0f4">55+</text>
    <text x="0" y="40" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="18" fill="#9090a0">Providers</text>
  </g>
  <g transform="translate(620,370)">
    <text x="0" y="0" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="48" font-weight="700" fill="#22c55e">27+</text>
    <text x="0" y="40" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="18" fill="#9090a0">Free models</text>
  </g>
  <g transform="translate(860,370)">
    <text x="0" y="0" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="48" font-weight="700" fill="#6366f1">16+</text>
    <text x="0" y="40" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="18" fill="#9090a0">Subscriptions</text>
  </g>
  <!-- Bottom tagline -->
  <text x="80" y="585" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="20" fill="#606070">Real-time pricing · OpenAI · Anthropic · Google · Meta · DeepSeek · xAI · and more</text>
</svg>`;
  return c.body(svg, 200, {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=86400',
  });
});




// ── OG PNG ───────────────────────────────────────────────────────────────────

const OG_PNG_B64 = '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vMUTjZvcbfpEs0w4kkwIAAAA4ILFVUbPEh5e21MabPlko8Z3eni6ZEL575pVz+l/pqctl0zYq8/483svihKLjY1t2rRpvXr1a9WqFR8fn52dvXfv3h07dmzdumXjxo25ubnqAhMeHi4L3KBBw3r16sbHJ+Tn5+3evXv79u1lvsCVK0f17NlLr5nAwAqbNm1carMkJydHlac2bdq0bNmyatVqcXFxUVFRJ06cOHQoNSVl39atW+fOnVNYWKjKSGRkxe7du3fs2DExMfHAgQNbtsgK3LBq1aoyfIPNmjXv1q1b69atlfLZsWP7pk2bZP7JyXsVAAAAziEC4V9saXDgJCMNzpoxKi11oTG2RcunGja+o8iZmGTCGSN69Z1QfplwypSpjRs30Y99fd2WfDds2OgYGF5//TX5M52yQoUKd999z7XXjpFA6G5uBQUFK1aseO21sQsWzFdlKjAwcOHCxRJ43E3Qt2+vpKRtTgMvuWTwgw8+1KhRI3fPkgVevHjRSy+9tGbNanfTtG/f/ocffjId9fLLL7333rt6mqeffkZSmY+PjzG2X79++kFWVtZ///ufTz75nypTQ4YMueWW25o3b+7hKrL5+fmSe7/55psvv/zC3TRJSduDgoJchy9ZsnjkyBH68U033fT440+GhIS4Tibr8I8/Jj/99D9TU1NN5//MM8/efPMtpqO6d++2e/cueRAdHf311980adLUcQUaJHz+978vT5gwQQEAAOCc4JDRM4pIg63+6U0a1JyPHU1fIZmw/I4drVw52vdPHiaT/revA3dh79VXx27btuOhhx72kAaVPXlKNBo37nvJmZ06dVJl59dff6tataqvG1KFc0qDffr02bx560cffewhDeoF7tKl68SJk5YuXV6jRk3TaRzXpJMqVarKBI8//sRPP/3SqlUr0zAjQkNDn3vueYnolSpVUmVBgtO8eQs++OCjtm3bekiDwt/fXyb+v/97aeXK1fLRmE4THBxs+u6io2NkrKz2WbNmP//8C6ZpUNnX4eDBQ2T+zz33b9MJJMa7W4EVK1aUCe64484VK1Y1bdrM3QqUZXj99TfXrl1fvXqCAgAAQPkjENqEh9c6Ow1edXYafLpho9tVcdgyYat/Gf+UTDhrxpUX+PmEUVFR8+cvHDVqtOdg6aRixUrjx//wyCOPqrLwxhtvNWvmds3s2rXL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HiaQMqOHXLp37x4FAACAckAg/IvHTHjCy0x4EaVBZTt57IRpIJTeec+evebMme3hub169XI3as8er7rvUqL0cIVPKUmNGjV63LjvHAfu2rXL3fTr169fvHiRusg9/fTT7kZJFHzrrTfHjn3V9fDL3r17lyYQ+vv79+jRc+7cOR6madCgobtRhw+nq6L07dv36af/6WGCli1behh7+PARBQAAgHLAIaNn8XjsqC0TZhzb6uHpRR0pescFlQaV/fZ67kaNGjXKwxN9fX3r12/gbuyOHV4dYdu+fds33njdwwQvvfRydPRZtzTwcLXP0iSiC4eH3HXHHbe/+uorpifj1a5dR5XO3Xff7WGs5PbExER3Y705jlcqn56vFHrllVe6G5Wfn68AAABQPgiEzorIhNOGu8uERabB5L2T1PkTFmZySt6UKX+4m/6SSwZHRro9kvDJJ59yd7twKWTNnu2ptKg9+OD96enpknC2b3ebHuUlxo//wXHIxo0bcnJyTCfu37+/56ubNGjQ4LffJrr+/fe/r6gLRkyM+T39srOzJ092237kw1Kl07lzl+bNW7gb+/LL//Fwd/g//nDbigzy0Xz88cfuxkZERFxzzRh3Y1NS9ikAAACUDwKhiaIy4TDXTFjUkaLnOQ2Kpk2bug786KMP3V3+UWqAX375lemounXr3nzzLcqNFStWeHONlt27d+sHI0demZeX526y+vXr33//A45D5s2bZzplWFiY52j3+edftjbTv/8Ada4EBwd/9dXXSUnb9+3bv3fvvhUrVg0YcNarBwSYH0Pr4eYTvXv3bteunSq18eMnmN7V44orrhgxYqS7Z8lnt2jRQuWFpk2bPf/8C67Dpfz4xx9TPLzB6dOLuKk9AAAASoxAaM5jJsySTHjs2GZj4iLT4L7kc5QG09LS3I0yjXCZmZnbtiW5e0qbNm0mTPjB6QIzrVq1mjJlmod60YcffqCKIzU19amnnvQwwcMPPyIR1Pjne++9427K0aOvfuopkxPVwsPDf/jhJ3c3tXc6TbH8yJpctWpNr1699XmbErmrVKnyySef3Xff/cY07m7OLqnp2Wefdx1+8803f/HFV2Vyt3pJ1HPnzpcZGkNkvb3xxlvy52H+W7ZsVl676aabpEU5Hjvap0+fpUuX16yZ6OFZX375uQIAAED54KIybnm8xkzWzGmX9en/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tKYdGBj4zTffvvjii443l2/Tps133427/PLLTWe1b98+p3vW79q1y3RKCYTSXOPj440hNWrUfPrpf73++pumhUcJlq++6qmuCJSBQN/K7/UKbFrZdGT+waysTzYGNKzk3ySqyL9C9z+t4XeYfyd7efYgcBHJPL4jLc38UJEWLZ9o2epfAYFnLq0k/ZqKFZt26vJevQY3mk5/7NjmI0fWKADlw6K3nXjttbH/+pf5FSZat249efIfErokNPr5+TndRc3Vt99+7ZTQnn/+udGjr5b+tOvElStX/vnnX6V3e/jwYQmBppflMBw5cmTmTOeqyN69e3755efLLjPpkUsB895777v77ntyc3PlJTwseX5+/t13ezogENYhTeWrr7666aabTMdef/2N8peVlSWbQ0xMjOdLfb711ptOQx577JEff/zZdGLJlkuXLpe2evTo0YoVK1aoUEG5N3funJMnTyqgPEW909O/ZoS7sf5VQiu92k15J+P5pTkLTQ4VCbqkpm9Fk6ZuKw/+tJ17D+LvZ8WyR01vKigaNLpV/o4eWX+6ID8qqpmvr6ce6aYNbyoA5caiV3L/6KMPPZ+SJGUKSWtFpkHpzj733HNOA3Nyct57710Pz5JetfStPadBCZm3336r6ahHHnnYw73dZOYSNT0v+TvvvG16zwBY0/PPP5udne1hgtDQ0Li4OM9pcMOG9d9++43TwKVLl65fv87Ds2S/iczZcxqULHrPPfcooJz5VSu7e12aZTspG4bd3MR08qxvOHsQf0/HM7atXvm8hwkqRTWLjm7lOQ0m7/0jeS/XggbKkXVv7XXppUM9d4KLJHW2q64aIZnQddSrr74ye/YsVQrPPPO0460sHEkaHD58mOnremPixN85+g6OpCVfdtlwp/s6FItUvGWDMh11+eWXpaWlqZKSAuawYUMzMo4p4CIXMqy2b5jJkSP28uAOBfxNJW39eO+e31VJHTu2efHCuxWA8mTdQLh3756+ffuUOBNK73n06FHLly93N8GYMdcuXlySCxxLbfCNN17/9NNPPUwjVZeBA/uVYOGlhnPHHbcr4GwbN26QvRsly4QHDx4cOLC/uz0UJ0+e7NmzhyRGVXyy7+OGG67bunWrAi5yhX4+oTc0Nh2V9RXlQfzNLV54V9LWz1TxpR5aOnvGyMLCPAWgPPmEhUUoCwsODn799TcG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';

app.get('/og.png', (c) => {
  // Decode base64 to binary
  const binaryStr = atob(OG_PNG_B64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return c.body(bytes, 200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=2592000',
  });
});

// ── About page ────────────────────────────────────────────────────────────────

app.get('/about', (c) => {
  return c.html(getAboutHtml(), 200, {
    'Cache-Control': 'public, max-age=3600',
  });
});

// ── Provider pages ────────────────────────────────────────────────────────────

async function handleProviderPage(c: any, providerId: string) {
  try {
    const { models } = await getModels(c.env);
    const filtered = models.filter((m: any) => m.providerId === providerId);
    const html = getProviderHtml({ providerId, models: filtered });
    return c.html(html, 200, {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    });
  } catch (err) {
    console.error('Provider page failed:', err);
    return c.redirect('/', 302);
  }
}

for (const slug of PROVIDER_SLUGS) {
  app.get(`/${slug}`, (c) => handleProviderPage(c, slug));
}

// ── HTML App ─────────────────────────────────────────────────────────────────

app.get('/', async (c) => {
  try {
    // Server-side render with initial data (avoids client-side waterfall)
    const [{ models, lastUpdated }, subs] = await Promise.all([
      getModels(c.env),
      getSubscriptions(c.env),
    ]);

    const html = getHtml({
      initialModels: JSON.stringify(models),
      initialSubscriptions: JSON.stringify(subs),
      lastUpdated,
    });

    return c.html(html, 200, {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    });
  } catch (err) {
    // Fallback: serve shell without initial data, client fetches it
    console.error('SSR failed, serving shell:', err);
    const html = getHtml({});
    return c.html(html, 200, {
      'Cache-Control': 'public, max-age=30',
    });
  }
});

// ── Cloudflare Worker Export ──────────────────────────────────────────────────

export default {
  // Fetch handler (HTTP requests)
  fetch: app.fetch,

  // Scheduled handler (Cron Trigger — runs every hour)
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(
      refreshAllData(env).then((result) => {
        console.log(`[cron] Refreshed: ${result.models} models`);
      }).catch((err) => {
        console.error('[cron] Refresh failed:', err);
      })
    );
  },
};
