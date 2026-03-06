import { Hono, type Context } from 'hono';
import { and, desc, gte, lte } from 'drizzle-orm';
import { earthquakes } from '@namazue/db';
import { deriveZoomTier, type FaultType, type ViewportState } from '@namazue/ops';

import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
import { buildConsoleSnapshot } from '../lib/consoleOps.ts';
import {
  EARTHQUAKE_LIMITS,
  parseFiniteNumber,
  parseString,
  validateRange,
  validateRangePair,
} from '../lib/earthquakeValidation.ts';

export const opsRoute = new Hono<{ Bindings: Env }>();

function classifyZoomTier(zoom: number): ViewportState['tier'] {
  return deriveZoomTier(zoom);
}

function classifyRegion(lat: number, lng: number): ViewportState['activeRegion'] {
  if (lat >= 42) return 'hokkaido';
  if (lat >= 37) return 'tohoku';
  if (lat >= 34.5 && lng >= 138) return 'kanto';
  if (lat >= 34 && lng >= 136) return 'chubu';
  if (lat >= 33.5 && lng >= 132.5) return 'kansai';
  if (lat >= 33 && lng >= 131) return 'chugoku';
  if (lat >= 32.5 && lng >= 133) return 'shikoku';
  return 'kyushu';
}

function normalizeFaultType(value: string | null): FaultType {
  return value === 'crustal' || value === 'interface' || value === 'intraslab'
    ? value
    : 'crustal';
}

function parseViewport(c: Context<{ Bindings: Env }>): ViewportState | { error: string } {
  const centerLat = parseFiniteNumber(c.req.query('center_lat'));
  const centerLng = parseFiniteNumber(c.req.query('center_lng'));
  const zoom = parseFiniteNumber(c.req.query('zoom'));
  const west = parseFiniteNumber(c.req.query('west'));
  const south = parseFiniteNumber(c.req.query('south'));
  const east = parseFiniteNumber(c.req.query('east'));
  const north = parseFiniteNumber(c.req.query('north'));

  const required = [
    ['center_lat', centerLat],
    ['center_lng', centerLng],
    ['zoom', zoom],
    ['west', west],
    ['south', south],
    ['east', east],
    ['north', north],
  ] as const;

  for (const [field, value] of required) {
    if (value === null) {
      return { error: `${field} is required` };
    }
  }

  const errors = [
    validateRange('center_lat', centerLat!, EARTHQUAKE_LIMITS.lat.min, EARTHQUAKE_LIMITS.lat.max),
    validateRange('center_lng', centerLng!, EARTHQUAKE_LIMITS.lng.min, EARTHQUAKE_LIMITS.lng.max),
    validateRange('zoom', zoom!, 0, 22),
    validateRange('west', west!, EARTHQUAKE_LIMITS.lng.min, EARTHQUAKE_LIMITS.lng.max),
    validateRange('east', east!, EARTHQUAKE_LIMITS.lng.min, EARTHQUAKE_LIMITS.lng.max),
    validateRange('south', south!, EARTHQUAKE_LIMITS.lat.min, EARTHQUAKE_LIMITS.lat.max),
    validateRange('north', north!, EARTHQUAKE_LIMITS.lat.min, EARTHQUAKE_LIMITS.lat.max),
    validateRangePair('west', west, 'east', east),
    validateRangePair('south', south, 'north', north),
  ].filter((value): value is string => Boolean(value));

  if (errors.length > 0) {
    return { error: errors[0]! };
  }

  return {
    center: { lat: centerLat!, lng: centerLng! },
    zoom: zoom!,
    bounds: [west!, south!, east!, north!],
    tier: classifyZoomTier(zoom!),
    activeRegion: classifyRegion(centerLat!, centerLng!),
  };
}

opsRoute.get('/console', async (c) => {
  const viewport = parseViewport(c);
  if ('error' in viewport) {
    return c.json({ error: viewport.error }, 400);
  }

  const selectedEventId = parseString(c.req.query('selected_event_id'));
  const db = createDb(c.env.DATABASE_URL);
  const now = Date.now();

  const rows = await db.select({
    id: earthquakes.id,
    lat: earthquakes.lat,
    lng: earthquakes.lng,
    depth_km: earthquakes.depth_km,
    magnitude: earthquakes.magnitude,
    time: earthquakes.time,
    place: earthquakes.place,
    fault_type: earthquakes.fault_type,
    tsunami: earthquakes.tsunami,
  })
    .from(earthquakes)
    .where(and(
      gte(earthquakes.lat, 24),
      lte(earthquakes.lat, 46),
      gte(earthquakes.lng, 122),
      lte(earthquakes.lng, 150),
    ))
    .orderBy(desc(earthquakes.time))
    .limit(80);

  const events = rows.map((row) => ({
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    depth_km: row.depth_km,
    magnitude: row.magnitude,
    time: row.time instanceof Date ? row.time.getTime() : Date.parse(String(row.time)),
    faultType: normalizeFaultType(row.fault_type),
    tsunami: row.tsunami ?? false,
    place: { text: row.place ?? 'Unknown location' },
  }));

  const snapshot = buildConsoleSnapshot({
    now,
    updatedAt: now,
    source: 'server',
    currentSelectedEventId: selectedEventId,
    events,
    viewport,
  });

  return c.json({
    events,
    ...snapshot,
    intensityGrid: snapshot.intensityGrid
      ? {
          ...snapshot.intensityGrid,
          data: Array.from(snapshot.intensityGrid.data),
        }
      : null,
    sourceMeta: {
      source: 'server',
      updatedAt: now,
    },
  });
});
