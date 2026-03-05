import { Hono } from 'hono';
import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
import { earthquakes } from '@namazue/db';
import { gte, lte, and, desc } from 'drizzle-orm';
import { generateAndStoreAnalysis } from './analyze.ts';
import {
  EARTHQUAKE_LIMITS,
  parseFiniteNumber,
  validateRange,
  validateRangePair,
} from '../lib/earthquakeValidation.ts';
import {
  parseIngestEvent,
  type IngestEventInput,
} from '../lib/eventsValidation.ts';
import { authorizeInternal } from '../lib/eventsAuth.ts';
import { parseBulkIngestEvents } from '../lib/eventsBulk.ts';
import { upsertEvent, upsertEvents } from '../lib/eventsRepo.ts';

export const eventsRoute = new Hono<{ Bindings: Env }>();

const BULK_LIMIT = 500;
const MAX_SYNC_ANALYSIS_EVENTS = 25;

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
  const mag_min = parseFiniteNumber(c.req.query('mag_min'));
  if (mag_min !== null) {
    const magErr = validateRange('mag_min', mag_min, EARTHQUAKE_LIMITS.magnitude.min, EARTHQUAKE_LIMITS.magnitude.max);
    if (magErr) return c.json({ error: magErr }, 400);
  }

  const rawLimit = parseFiniteNumber(c.req.query('limit'));
  const limit = rawLimit === null ? 100 : Math.floor(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    return c.json({ error: 'limit must be an integer between 1 and 1000' }, 400);
  }

  const db = createDb(c.env.DATABASE_URL);

  const conditions = [];
  if (mag_min !== null && mag_min > 0) {
    conditions.push(gte(earthquakes.magnitude, mag_min));
  }

  const lat_min = parseFiniteNumber(c.req.query('lat_min'));
  const lat_max = parseFiniteNumber(c.req.query('lat_max'));
  const latMinErr = lat_min === null ? null : validateRange('lat_min', lat_min, EARTHQUAKE_LIMITS.lat.min, EARTHQUAKE_LIMITS.lat.max);
  const latMaxErr = lat_max === null ? null : validateRange('lat_max', lat_max, EARTHQUAKE_LIMITS.lat.min, EARTHQUAKE_LIMITS.lat.max);
  const latPairErr = validateRangePair('lat_min', lat_min, 'lat_max', lat_max);
  if (latMinErr || latMaxErr || latPairErr) {
    return c.json({ error: latMinErr ?? latMaxErr ?? latPairErr }, 400);
  }
  if (lat_min !== null) conditions.push(gte(earthquakes.lat, lat_min));
  if (lat_max !== null) conditions.push(lte(earthquakes.lat, lat_max));

  const lng_min = parseFiniteNumber(c.req.query('lng_min'));
  const lng_max = parseFiniteNumber(c.req.query('lng_max'));
  const lngMinErr = lng_min === null ? null : validateRange('lng_min', lng_min, EARTHQUAKE_LIMITS.lng.min, EARTHQUAKE_LIMITS.lng.max);
  const lngMaxErr = lng_max === null ? null : validateRange('lng_max', lng_max, EARTHQUAKE_LIMITS.lng.min, EARTHQUAKE_LIMITS.lng.max);
  const lngPairErr = validateRangePair('lng_min', lng_min, 'lng_max', lng_max);
  if (lngMinErr || lngMaxErr || lngPairErr) {
    return c.json({ error: lngMinErr ?? lngMaxErr ?? lngPairErr }, 400);
  }
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
  const { acceptedIds, acceptedEvents, rejected } = parseBulkIngestEvents(body.events);

  try {
    await upsertEvents(db, acceptedEvents);
  } catch (err) {
    console.error('[events] bulk upsert failed:', err);
    return c.json({ error: 'Failed to store events' }, 500);
  }

  const generateAnalysis = body.generate_analysis !== false;
  const waitForAnalysis = body.wait_for_analysis === true;

  if (!generateAnalysis || acceptedIds.length === 0) {
    return c.json({
      status: 'stored',
      accepted: acceptedIds.length,
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
    if (acceptedIds.length > MAX_SYNC_ANALYSIS_EVENTS) {
      return c.json({
        error: `wait_for_analysis supports up to ${MAX_SYNC_ANALYSIS_EVENTS} events per request`,
      }, 400);
    }

    let generated = 0;
    let cached = 0;
    let failed = 0;

    for (const eventId of acceptedIds) {
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
      accepted: acceptedIds.length,
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
    for (const eventId of acceptedIds) {
      try {
        await generateAndStoreAnalysis(c.env, eventId);
      } catch (err) {
        console.error(`[events] async bulk analysis generation failed for ${eventId}:`, err);
      }
    }
  })());

  return c.json({
    status: 'accepted',
    accepted: acceptedIds.length,
    rejected,
    analysis: {
      requested: true,
      queued: acceptedIds.length,
    },
  }, 202);
});
