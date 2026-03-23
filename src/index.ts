import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { cache } from 'hono/cache';
import type { Env } from './types';
import { getModels, getSubscriptions, refreshAllData } from './fetchers';
import { getHtml } from './template';

const app = new Hono<{ Bindings: Env }>();

// CORS for API endpoints
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
  const expectedToken = c.env.REFRESH_SECRET ?? 'changeme';
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
  return c.text(
    'User-agent: *\nAllow: /\n\nSitemap: https://token.app/sitemap.xml\n',
    200,
    { 'Content-Type': 'text/plain; charset=utf-8' }
  );
});

app.get('/sitemap.xml', (c) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://token.app/</loc>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
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
