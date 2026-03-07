import { Hono } from 'hono';
import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
import { reports } from '@namazue/db';
import { eq, and, desc } from 'drizzle-orm';

export const reportsRoute = new Hono<{ Bindings: Env }>();

// Reports are immutable once generated — cache aggressively.
const REPORT_CACHE_TTL = 86400; // 24 hours

/**
 * GET /api/reports/:type/:period
 * e.g. /api/reports/weekly/2026-W10
 *      /api/reports/monthly/2026-03
 */
reportsRoute.get('/:type/:period', async (c) => {
  const type = c.req.param('type');
  const period = c.req.param('period');

  if (!['weekly', 'monthly'].includes(type)) {
    return c.json({ error: 'Invalid report type' }, 400);
  }

  // CF Cache API check — reports are immutable, cache for 24h
  const cache = caches.default;
  const cachedRes = await cache.match(c.req.raw);
  if (cachedRes) return cachedRes;

  const db = createDb(c.env.DATABASE_URL);

  const rows = await db.select()
    .from(reports)
    .where(and(
      eq(reports.type, type),
      eq(reports.period, period),
    ))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: 'Report not found' }, 404);
  }

  const body = JSON.stringify(rows[0].content);
  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${REPORT_CACHE_TTL}`,
    },
  });

  c.executionCtx.waitUntil(cache.put(c.req.raw, response.clone()));
  return response;
});

/**
 * GET /api/reports/:type
 * Returns latest report of given type.
 */
reportsRoute.get('/:type', async (c) => {
  const type = c.req.param('type');

  if (!['weekly', 'monthly'].includes(type)) {
    return c.json({ error: 'Invalid report type' }, 400);
  }

  const db = createDb(c.env.DATABASE_URL);

  const rows = await db.select()
    .from(reports)
    .where(eq(reports.type, type))
    .orderBy(desc(reports.created_at))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: 'No reports yet' }, 404);
  }

  return c.json(rows[0].content);
});
