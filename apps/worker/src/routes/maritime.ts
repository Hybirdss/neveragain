import { Hono } from 'hono';
import {
  buildSyntheticMaritimeSnapshot,
  parseAisCoverageProfileId,
} from '@namazue/db';
import type { Env } from '../index.ts';

export const maritimeRoute = new Hono<{ Bindings: Env }>();

function parseFinite(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

maritimeRoute.get('/vessels', async (c) => {
  const west = parseFinite(c.req.query('west'));
  const south = parseFinite(c.req.query('south'));
  const east = parseFinite(c.req.query('east'));
  const north = parseFinite(c.req.query('north'));
  const limit = parseFinite(c.req.query('limit'));
  const profileId = parseAisCoverageProfileId(c.req.query('profile'));

  const bounds: [number, number, number, number] | undefined = west !== null && south !== null && east !== null && north !== null
    ? [west, south, east, north]
    : undefined;

  const snapshot = buildSyntheticMaritimeSnapshot({
    profileId,
    bounds,
    limit: limit !== null ? Math.floor(limit) : undefined,
  });

  return c.json({
    source: snapshot.source,
    profile: {
      id: snapshot.profile.id,
      label: snapshot.profile.label,
    },
    generated_at: snapshot.generatedAt,
    total_tracked: snapshot.totalTracked,
    visible_count: snapshot.vessels.length,
    vessels: snapshot.vessels,
  });
});
