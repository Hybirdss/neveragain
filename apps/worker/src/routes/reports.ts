import { Hono } from 'hono';
import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
import { reports } from '@namazue/db';
import { eq, and } from 'drizzle-orm';

export const reportsRoute = new Hono<{ Bindings: Env }>();

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

  return c.json(rows[0].content);
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
  const { desc: descOrder } = await import('drizzle-orm');

  const rows = await db.select()
    .from(reports)
    .where(eq(reports.type, type))
    .orderBy(descOrder(reports.created_at))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: 'No reports yet' }, 404);
  }

  return c.json(rows[0].content);
});
