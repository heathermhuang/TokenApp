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
