import { Hono } from 'hono';
import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
import { earthquakes } from '@namazue/db';
import { gte, lte, and, desc } from 'drizzle-orm';
import { generateAndStoreAnalysis } from './analyze.ts';

export const eventsRoute = new Hono<{ Bindings: Env }>();

type FaultType = 'crustal' | 'interface' | 'intraslab';
type EarthquakeInsert = typeof earthquakes.$inferInsert;

const VALID_SOURCES = new Set(['usgs', 'jma', 'gcmt']);
const VALID_FAULT_TYPES = new Set(['crustal', 'interface', 'intraslab']);
const BULK_LIMIT = 500;

interface IngestEventInput {
  id?: unknown;
  lat?: unknown;
  lng?: unknown;
  depth_km?: unknown;
  magnitude?: unknown;
  time?: unknown;
  source?: unknown;
  mag_type?: unknown;
  place?: unknown;
  place_ja?: unknown;
  fault_type?: unknown;
  tsunami?: unknown;
  mt_strike?: unknown;
  mt_dip?: unknown;
  mt_rake?: unknown;
  mt_strike2?: unknown;
  mt_dip2?: unknown;
  mt_rake2?: unknown;
}

interface IngestBody {
  event?: IngestEventInput;
  generate_analysis?: boolean;
  wait_for_analysis?: boolean;
}

interface BulkIngestBody {
  events?: IngestEventInput[];
  generate_analysis?: boolean;
  wait_for_analysis?: boolean;
}

/**
 * GET /api/events?mag_min=4&lat_min=24&lat_max=46&lng_min=122&lng_max=150&limit=100
 * Returns earthquakes matching filters.
 */
eventsRoute.get('/', async (c) => {
  const mag_min = parseFiniteNumber(c.req.query('mag_min')) ?? 0;
  const limit = Math.min(parseFiniteNumber(c.req.query('limit')) ?? 100, 1000);

  const db = createDb(c.env.DATABASE_URL);

  const conditions = [];
  if (mag_min > 0) {
    conditions.push(gte(earthquakes.magnitude, mag_min));
  }

  const lat_min = parseFiniteNumber(c.req.query('lat_min'));
  const lat_max = parseFiniteNumber(c.req.query('lat_max'));
  if (lat_min !== null) conditions.push(gte(earthquakes.lat, lat_min));
  if (lat_max !== null) conditions.push(lte(earthquakes.lat, lat_max));

  const lng_min = parseFiniteNumber(c.req.query('lng_min'));
  const lng_max = parseFiniteNumber(c.req.query('lng_max'));
  if (lng_min !== null) conditions.push(gte(earthquakes.lng, lng_min));
  if (lng_max !== null) conditions.push(lte(earthquakes.lng, lng_max));

  const rows = await db.select({
    id: earthquakes.id,
    lat: earthquakes.lat,
    lng: earthquakes.lng,
    depth_km: earthquakes.depth_km,
    magnitude: earthquakes.magnitude,
    time: earthquakes.time,
    place: earthquakes.place,
    fault_type: earthquakes.fault_type,
    source: earthquakes.source,
    tsunami: earthquakes.tsunami,
    mag_type: earthquakes.mag_type,
  })
    .from(earthquakes)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(earthquakes.time))
    .limit(limit);

  return c.json({ events: rows, count: rows.length });
});

/**
 * POST /api/events/ingest
 * Body:
 * {
 *   event: { ...earthquake fields... },
 *   generate_analysis?: boolean, // default true
 *   wait_for_analysis?: boolean  // default false (background generation)
 * }
 */
eventsRoute.post('/ingest', async (c) => {
  const body = await c.req.json<IngestBody>().catch(() => null);
  if (!body?.event) {
    return c.json({ error: 'event is required' }, 400);
  }

  if (!authorizeInternal(c.env.INTERNAL_API_TOKEN, c.req.header('x-internal-token'))) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const parsed = parseIngestEvent(body.event);
  if ('error' in parsed) {
    return c.json({ error: parsed.error }, 400);
  }

  const db = createDb(c.env.DATABASE_URL);
  await upsertEvent(db, parsed.value);

  const generateAnalysis = body.generate_analysis !== false;
  const waitForAnalysis = body.wait_for_analysis === true;

  if (!generateAnalysis) {
    return c.json({
      status: 'stored',
      event_id: parsed.value.id,
      analysis_status: 'skipped',
    });
  }

  if (waitForAnalysis) {
    try {
      const result = await generateAndStoreAnalysis(c.env, parsed.value.id);
      return c.json({
        status: 'stored',
        event_id: parsed.value.id,
        analysis_status: result.status,
      });
    } catch (err) {
      return c.json({
        status: 'stored',
        event_id: parsed.value.id,
        analysis_status: 'failed',
        error: (err as Error).message,
      }, 500);
    }
  }

  c.executionCtx.waitUntil(
    generateAndStoreAnalysis(c.env, parsed.value.id).catch((err) => {
      console.error(`[events] async analysis generation failed for ${parsed.value.id}:`, err);
    }),
  );

  return c.json({
    status: 'accepted',
    event_id: parsed.value.id,
    analysis_status: 'queued',
  }, 202);
});

/**
 * POST /api/events/ingest/bulk
 * Body:
 * {
 *   events: [{...}, ...],
 *   generate_analysis?: boolean, // default true
 *   wait_for_analysis?: boolean  // default false
 * }
 */
eventsRoute.post('/ingest/bulk', async (c) => {
  const body = await c.req.json<BulkIngestBody>().catch(() => null);
  if (!body?.events || !Array.isArray(body.events) || body.events.length === 0) {
    return c.json({ error: 'events[] is required' }, 400);
  }
  if (body.events.length > BULK_LIMIT) {
    return c.json({ error: `events[] too large (max ${BULK_LIMIT})` }, 400);
  }

  if (!authorizeInternal(c.env.INTERNAL_API_TOKEN, c.req.header('x-internal-token'))) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = createDb(c.env.DATABASE_URL);
  const accepted: string[] = [];
  const rejected: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < body.events.length; i++) {
    const parsed = parseIngestEvent(body.events[i]);
    if ('error' in parsed) {
      rejected.push({ index: i, error: parsed.error });
      continue;
    }
    await upsertEvent(db, parsed.value);
    accepted.push(parsed.value.id);
  }

  const generateAnalysis = body.generate_analysis !== false;
  const waitForAnalysis = body.wait_for_analysis === true;

  if (!generateAnalysis || accepted.length === 0) {
    return c.json({
      status: 'stored',
      accepted: accepted.length,
      rejected,
      analysis: {
        requested: false,
        generated: 0,
        cached: 0,
        failed: 0,
      },
    });
  }

  if (waitForAnalysis) {
    let generated = 0;
    let cached = 0;
    let failed = 0;

    for (const eventId of accepted) {
      try {
        const result = await generateAndStoreAnalysis(c.env, eventId);
        if (result.status === 'generated') generated += 1;
        else cached += 1;
      } catch (err) {
        failed += 1;
        console.error(`[events] sync analysis generation failed for ${eventId}:`, err);
      }
    }

    return c.json({
      status: 'stored',
      accepted: accepted.length,
      rejected,
      analysis: {
        requested: true,
        generated,
        cached,
        failed,
      },
    });
  }

  c.executionCtx.waitUntil((async () => {
    for (const eventId of accepted) {
      try {
        await generateAndStoreAnalysis(c.env, eventId);
      } catch (err) {
        console.error(`[events] async bulk analysis generation failed for ${eventId}:`, err);
      }
    }
  })());

  return c.json({
    status: 'accepted',
    accepted: accepted.length,
    rejected,
    analysis: {
      requested: true,
      queued: accepted.length,
    },
  }, 202);
});

function authorizeInternal(expectedToken: string | undefined, requestToken: string | undefined): boolean {
  if (!expectedToken) return true;
  return requestToken === expectedToken;
}

function parseIngestEvent(input: IngestEventInput): { value: EarthquakeInsert } | { error: string } {
  const id = parseString(input.id);
  if (!id) return { error: 'event.id is required' };

  const lat = parseFiniteNumber(input.lat);
  if (lat === null) return { error: `event.lat must be a finite number (id=${id})` };

  const lng = parseFiniteNumber(input.lng);
  if (lng === null) return { error: `event.lng must be a finite number (id=${id})` };

  const depth_km = parseFiniteNumber(input.depth_km);
  if (depth_km === null) return { error: `event.depth_km must be a finite number (id=${id})` };

  const magnitude = parseFiniteNumber(input.magnitude);
  if (magnitude === null) return { error: `event.magnitude must be a finite number (id=${id})` };

  const time = parseTimestamp(input.time);
  if (!time) return { error: `event.time must be a valid timestamp (id=${id})` };

  const source = (parseString(input.source)?.toLowerCase()) ?? 'usgs';
  if (!VALID_SOURCES.has(source)) {
    return { error: `event.source must be one of: usgs|jma|gcmt (id=${id})` };
  }

  const faultTypeRaw = parseString(input.fault_type)?.toLowerCase();
  const fault_type = faultTypeRaw && VALID_FAULT_TYPES.has(faultTypeRaw)
    ? (faultTypeRaw as FaultType)
    : null;

  return {
    value: {
      id,
      lat,
      lng,
      depth_km,
      magnitude,
      time,
      source,
      mag_type: parseString(input.mag_type),
      place: parseString(input.place),
      place_ja: parseString(input.place_ja),
      fault_type,
      tsunami: parseBoolean(input.tsunami),
      mt_strike: parseFiniteNumber(input.mt_strike),
      mt_dip: parseFiniteNumber(input.mt_dip),
      mt_rake: parseFiniteNumber(input.mt_rake),
      mt_strike2: parseFiniteNumber(input.mt_strike2),
      mt_dip2: parseFiniteNumber(input.mt_dip2),
      mt_rake2: parseFiniteNumber(input.mt_rake2),
    },
  };
}

async function upsertEvent(
  db: ReturnType<typeof createDb>,
  event: EarthquakeInsert,
): Promise<void> {
  const { id: _id, ...updateSet } = event;
  await db.insert(earthquakes)
    .values(event)
    .onConflictDoUpdate({
      target: earthquakes.id,
      set: updateSet,
    });
}

function parseString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (typeof value === 'string' && value.trim().toLowerCase() === 'true') return true;
  return false;
}

function parseTimestamp(value: unknown): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ts = value < 1_000_000_000_000 ? value * 1000 : value;
    const date = new Date(ts);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (!Number.isFinite(num)) return null;
      const ts = num < 1_000_000_000_000 ? num * 1000 : num;
      const fromNum = new Date(ts);
      return Number.isNaN(fromNum.getTime()) ? null : fromNum;
    }
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}
