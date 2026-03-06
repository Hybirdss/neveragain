import { Hono } from 'hono';
import { analyzeRoute } from './routes/analyze.ts';
import { eventsRoute } from './routes/events.ts';
import { searchRoute } from './routes/search.ts';
import { reportsRoute } from './routes/reports.ts';
import { askRoute } from './routes/ask.ts';
import { chatRoute } from './routes/chat.ts';
import { maritimeRoute } from './routes/maritime.ts';
import { railRoute } from './routes/rail.ts';
import { handleCron } from './routes/cron.ts';
export { MaritimeHub } from './durableObjects/maritimeHub.ts';

export interface Env {
  DATABASE_URL: string;
  XAI_API_KEY: string;
  RATE_LIMIT: KVNamespace;
  MARITIME_HUB: DurableObjectNamespace;
  ALLOWED_ORIGINS?: string;
  INTERNAL_API_TOKEN?: string;
  AISSTREAM_API_KEY?: string;
  AIS_SNAPSHOT_TTL_MS?: number;
  AISSTREAM_COLLECTION_WINDOW_MS?: number;
  ODPT_CONSUMER_KEY?: string;
}

const app = new Hono<{ Bindings: Env }>();

const ALLOW_METHODS = 'GET, POST, OPTIONS';
const ALLOW_HEADERS = 'Content-Type';
const MAX_AGE = '86400';

// CORS — explicit origin allow-list from env.ALLOWED_ORIGINS (comma-separated).
app.use('/api/*', async (c, next) => {
  const requestOrigin = c.req.header('origin');
  const allowedOrigins = parseAllowedOrigins(c.env.ALLOWED_ORIGINS);
  const allowAllOrigins = allowedOrigins.size === 0;
  const isAllowedOrigin = requestOrigin
    ? allowAllOrigins || allowedOrigins.has(requestOrigin)
    : false;

  if (c.req.method === 'OPTIONS') {
    if (requestOrigin && !isAllowedOrigin) {
      return c.json({ error: 'Origin not allowed' }, 403);
    }

    const res = new Response(null, { status: 204 });
    if (requestOrigin && isAllowedOrigin) {
      res.headers.set('Access-Control-Allow-Origin', requestOrigin);
      res.headers.set('Vary', 'Origin');
    }
    res.headers.set('Access-Control-Allow-Methods', ALLOW_METHODS);
    res.headers.set('Access-Control-Allow-Headers', ALLOW_HEADERS);
    res.headers.set('Access-Control-Max-Age', MAX_AGE);
    return res;
  }

  await next();

  if (requestOrigin && isAllowedOrigin) {
    c.header('Access-Control-Allow-Origin', requestOrigin);
    c.header('Vary', 'Origin');
    c.header('Access-Control-Allow-Methods', ALLOW_METHODS);
    c.header('Access-Control-Allow-Headers', ALLOW_HEADERS);
    c.header('Access-Control-Max-Age', MAX_AGE);
  }
});

app.onError((err, c) => {
  console.error('[worker] unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

// Routes
app.route('/api/analyze', analyzeRoute);
app.route('/api/events', eventsRoute);
app.route('/api/search', searchRoute);
app.route('/api/reports', reportsRoute);
app.route('/api/ask', askRoute);
app.route('/api/chat', chatRoute);
app.route('/api/maritime', maritimeRoute);
app.route('/api/rail', railRoute);

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleCron(event, env));
  },
};

function parseAllowedOrigins(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  );
}
