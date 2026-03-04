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
const BULK_UPSERT_CONCURRENCY = 20;
const MAX_SYNC_ANALYSIS_EVENTS = 25;
const MIN_EVENT_TIMESTAMP_MS = Date.UTC(1900, 0, 1);
const MAX_EVENT_FUTURE_SKEW_MS = 24 * 3600 * 1000;

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
  try {
    const mag_min = Math.max(0, parseFiniteNumber(c.req.query('mag_min')) ?? 0);
    const limit = clampLimit(c.req.query('limit'), 100, 1000);

    const db = createDb(c.env.DATABASE_URL);

    const conditions = [];
    if (mag_min > 0) {
      conditions.push(gte(earthquakes.magnitude, mag_min));
    }

    const [lat_min, lat_max] = normalizeRange(
      parseFiniteNumber(c.req.query('lat_min')),
      parseFiniteNumber(c.req.query('lat_max')),
    );
    if (lat_min !== null) conditions.push(gte(earthquakes.lat, lat_min));
    if (lat_max !== null) conditions.push(lte(earthquakes.lat, lat_max));

    const [lng_min, lng_max] = normalizeRange(
      parseFiniteNumber(c.req.query('lng_min')),
      parseFiniteNumber(c.req.query('lng_max')),
    );
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
  } catch (err) {
    console.error('[events] GET /api/events failed:', err);
    return c.json({ error: 'Failed to fetch events' }, 500);
  }
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
  try {
    await upsertEvent(db, parsed.value);
  } catch (err) {
    console.error(`[events] failed to upsert event ${parsed.value.id}:`, err);
    return c.json({ error: 'Failed to store event' }, 500);
  }

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
  const acceptedEvents: EarthquakeInsert[] = [];
  const rejected: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < body.events.length; i++) {
    const parsed = parseIngestEvent(body.events[i]);
    if ('error' in parsed) {
      rejected.push({ index: i, error: parsed.error });
      continue;
    }
    accepted.push(parsed.value.id);
    acceptedEvents.push(parsed.value);
  }

  try {
    await upsertEvents(db, acceptedEvents);
  } catch (err) {
    console.error('[events] bulk upsert failed:', err);
    return c.json({ error: 'Failed to store events' }, 500);
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
    if (accepted.length > MAX_SYNC_ANALYSIS_EVENTS) {
      return c.json({
        error: `wait_for_analysis supports up to ${MAX_SYNC_ANALYSIS_EVENTS} events per request`,
      }, 400);
    }

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
  if (lat < -90 || lat > 90) return { error: `event.lat must be within -90..90 (id=${id})` };

  const lng = parseFiniteNumber(input.lng);
  if (lng === null) return { error: `event.lng must be a finite number (id=${id})` };
  if (lng < -180 || lng > 180) return { error: `event.lng must be within -180..180 (id=${id})` };

  const depth_km = parseFiniteNumber(input.depth_km);
  if (depth_km === null) return { error: `event.depth_km must be a finite number (id=${id})` };
  if (depth_km < 0 || depth_km > 700) {
    return { error: `event.depth_km must be within 0..700km (id=${id})` };
  }

  const magnitude = parseFiniteNumber(input.magnitude);
  if (magnitude === null) return { error: `event.magnitude must be a finite number (id=${id})` };
  if (magnitude < -2 || magnitude > 10) {
    return { error: `event.magnitude must be within -2..10 (id=${id})` };
  }

  const time = parseTimestamp(input.time);
  if (!time) return { error: `event.time must be a valid timestamp (id=${id})` };
  const timeMs = time.getTime();
  if (timeMs < MIN_EVENT_TIMESTAMP_MS || timeMs > Date.now() + MAX_EVENT_FUTURE_SKEW_MS) {
    return { error: `event.time is outside accepted range (id=${id})` };
  }

  const source = (parseString(input.source)?.toLowerCase()) ?? 'usgs';
  if (!VALID_SOURCES.has(source)) {
    return { error: `event.source must be one of: usgs|jma|gcmt (id=${id})` };
  }

  const faultTypeRaw = parseString(input.fault_type)?.toLowerCase();
  if (faultTypeRaw && !VALID_FAULT_TYPES.has(faultTypeRaw)) {
    return { error: `event.fault_type must be crustal|interface|intraslab (id=${id})` };
  }
  const fault_type = (faultTypeRaw ?? null) as FaultType | null;

  const plane1 = parseMomentTensorPlane(
    id,
    {
      strike: 'mt_strike',
      dip: 'mt_dip',
      rake: 'mt_rake',
    },
    input.mt_strike,
    input.mt_dip,
    input.mt_rake,
  );
  if ('error' in plane1) return plane1;

  const plane2 = parseMomentTensorPlane(
    id,
    {
      strike: 'mt_strike2',
      dip: 'mt_dip2',
      rake: 'mt_rake2',
    },
    input.mt_strike2,
    input.mt_dip2,
    input.mt_rake2,
  );
  if ('error' in plane2) return plane2;
  if (plane2.value && !plane1.value) {
    return { error: `event.mt_strike/mt_dip/mt_rake are required when secondary tensor is provided (id=${id})` };
  }

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
      mt_strike: plane1.value?.strike ?? null,
      mt_dip: plane1.value?.dip ?? null,
      mt_rake: plane1.value?.rake ?? null,
      mt_strike2: plane2.value?.strike ?? null,
      mt_dip2: plane2.value?.dip ?? null,
      mt_rake2: plane2.value?.rake ?? null,
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

async function upsertEvents(
  db: ReturnType<typeof createDb>,
  events: EarthquakeInsert[],
): Promise<void> {
  if (events.length === 0) return;
  for (let i = 0; i < events.length; i += BULK_UPSERT_CONCURRENCY) {
    const chunk = events.slice(i, i + BULK_UPSERT_CONCURRENCY);
    await Promise.all(chunk.map((event) => upsertEvent(db, event)));
  }
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

function normalizeRange(min: number | null, max: number | null): [number | null, number | null] {
  if (min === null || max === null) return [min, max];
  return min <= max ? [min, max] : [max, min];
}

function clampLimit(value: unknown, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const floored = Math.floor(n);
  if (floored <= 0) return fallback;
  return Math.min(floored, max);
}

interface MomentTensorPlane {
  strike: number;
  dip: number;
  rake: number;
}

function parseMomentTensorPlane(
  id: string,
  labels: { strike: string; dip: string; rake: string },
  strikeInput: unknown,
  dipInput: unknown,
  rakeInput: unknown,
): { value: MomentTensorPlane | null } | { error: string } {
  const strike = parseFiniteNumber(strikeInput);
  const dip = parseFiniteNumber(dipInput);
  const rake = parseFiniteNumber(rakeInput);

  const present = [strike, dip, rake].filter((v) => v !== null).length;
  if (present === 0) return { value: null };
  if (present !== 3) {
    return { error: `event.${labels.strike}/${labels.dip}/${labels.rake} must be provided together (id=${id})` };
  }

  if (strike! < 0 || strike! > 360) {
    return { error: `event.${labels.strike} must be within 0..360 (id=${id})` };
  }
  if (dip! < 0 || dip! > 90) {
    return { error: `event.${labels.dip} must be within 0..90 (id=${id})` };
  }
  if (rake! < -180 || rake! > 180) {
    return { error: `event.${labels.rake} must be within -180..180 (id=${id})` };
  }

  return {
    value: {
      strike: strike!,
      dip: dip!,
      rake: rake!,
    },
  };
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
