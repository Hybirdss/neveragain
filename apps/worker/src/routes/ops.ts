import { Hono, type Context } from 'hono';
import {
  createOpsConsoleEarthquakeQuery,
  fetchOpsConsoleEarthquakes,
} from '@namazue/adapters-storage';
import { buildConsoleSnapshot } from '@namazue/application-console';
import { computeIntensityGrid, deriveZoomTier } from '@namazue/ops';
import { OPS_ASSETS } from '@namazue/ops/ops/assetCatalog';
import {
  buildServiceReadModel,
  createEmptyServiceReadModel,
} from '@namazue/ops/ops/serviceReadModel';
import type { ConsoleSnapshot } from '@namazue/contracts';
import type { ViewportState } from '@namazue/kernel';

import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
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
  const events = await fetchOpsConsoleEarthquakes(createOpsConsoleEarthquakeQuery(db));

  const snapshot = buildConsoleSnapshot({
    now,
    updatedAt: now,
    source: 'server',
    currentSelectedEventId: selectedEventId,
    events,
    viewport,
    assets: OPS_ASSETS,
    computeIntensityGrid,
    buildServiceReadModel,
    createEmptyServiceReadModel,
  });

  const response: ConsoleSnapshot = {
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
  };

  return c.json(response);
});
