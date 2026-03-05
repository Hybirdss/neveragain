import { Hono } from 'hono';
import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
import { earthquakes } from '@namazue/db';
import { gte, lte, and, desc } from 'drizzle-orm';
import { generateAndStoreAnalysis } from './analyze.ts';
import { checkRateLimit } from '../lib/rateLimit.ts';
import {
  EARTHQUAKE_LIMITS,
  parseFiniteNumber,
  parseString,
  parseTimestamp,
  validateEventTime,
  validateMomentTensor,
  validateRange,
  validateRangePair,
} from '../lib/earthquakeValidation.ts';

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
// Edge cache TTL for event lists. Public, time-bounded data.
const EVENTS_CACHE_TTL = 30; // seconds

/**
 * Normalize the request URL for cache keying:
 * Sort query params so ?a=1&b=2 and ?b=2&a=1 share the same cache entry.
 */
function normalizeEventsCacheKey(req: Request): Request {
  const url = new URL(req.url);
  const sorted = new URLSearchParams(
    [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );
  url.search = sorted.toString();
  return new Request(url.toString());
}

eventsRoute.get('/', async (c) => {
  // ── CF Cache API check ──────────────────────────────────────────────────
  // Workers run *before* CF's HTTP cache layer, so Cache-Control alone does
  // nothing for Worker responses. We must use caches.default explicitly.
  const cache = caches.default;
  const cacheKey = normalizeEventsCacheKey(c.req.raw);

  const cachedRes = await cache.match(cacheKey);
  if (cachedRes) {
    // ETag check: if client has the same version, return 304 (zero bandwidth).
    const clientEtag = c.req.header('if-none-match');
    const cachedEtag = cachedRes.headers.get('etag');
    if (clientEtag && cachedEtag && clientEtag === cachedEtag) {
      return new Response(null, { status: 304 });
    }
    return new Response(cachedRes.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${EVENTS_CACHE_TTL}`,
        ...(cachedEtag ? { 'ETag': cachedEtag } : {}),
        'X-Cache': 'HIT',
      },
    });
  }

  // ── Rate limit (only hits on cache MISS) ─────────────────────────────
  const ip = c.req.header('cf-connecting-ip') ?? '0.0.0.0';
  const rl = await checkRateLimit(c.env.RATE_LIMIT, ip, 'events');
  if (!rl.allowed) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  // ── Validate params ───────────────────────────────────────────────────
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

  const lat_min = parseFiniteNumber(c.req.query('lat_min'));
  const lat_max = parseFiniteNumber(c.req.query('lat_max'));
  const latMinErr = lat_min === null ? null : validateRange('lat_min', lat_min, EARTHQUAKE_LIMITS.lat.min, EARTHQUAKE_LIMITS.lat.max);
  const latMaxErr = lat_max === null ? null : validateRange('lat_max', lat_max, EARTHQUAKE_LIMITS.lat.min, EARTHQUAKE_LIMITS.lat.max);
  const latPairErr = validateRangePair('lat_min', lat_min, 'lat_max', lat_max);
  if (latMinErr || latMaxErr || latPairErr) {
    return c.json({ error: latMinErr ?? latMaxErr ?? latPairErr }, 400);
  }

  const lng_min = parseFiniteNumber(c.req.query('lng_min'));
  const lng_max = parseFiniteNumber(c.req.query('lng_max'));
  const lngMinErr = lng_min === null ? null : validateRange('lng_min', lng_min, EARTHQUAKE_LIMITS.lng.min, EARTHQUAKE_LIMITS.lng.max);
  const lngMaxErr = lng_max === null ? null : validateRange('lng_max', lng_max, EARTHQUAKE_LIMITS.lng.min, EARTHQUAKE_LIMITS.lng.max);
  const lngPairErr = validateRangePair('lng_min', lng_min, 'lng_max', lng_max);
  if (lngMinErr || lngMaxErr || lngPairErr) {
    return c.json({ error: lngMinErr ?? lngMaxErr ?? lngPairErr }, 400);
  }

  // ── DB query ──────────────────────────────────────────────────────────
  const conditions = [];
  if (mag_min !== null && mag_min > 0) conditions.push(gte(earthquakes.magnitude, mag_min));
  if (lat_min !== null) conditions.push(gte(earthquakes.lat, lat_min));
  if (lat_max !== null) conditions.push(lte(earthquakes.lat, lat_max));
  if (lng_min !== null) conditions.push(gte(earthquakes.lng, lng_min));
  if (lng_max !== null) conditions.push(lte(earthquakes.lng, lng_max));

  const db = createDb(c.env.DATABASE_URL);
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

  // ── Build response + ETag ─────────────────────────────────────────────
  // ETag = latest event time + count (cheap surrogate for content hash).
  // Clients that re-poll with If-None-Match get 304 if nothing changed.
  const latestTime = rows[0]?.time instanceof Date
    ? rows[0].time.getTime()
    : (rows[0]?.time ?? 0);
  const etag = `"${latestTime}-${rows.length}"`;

  const clientEtag = c.req.header('if-none-match');
  if (clientEtag === etag) {
    return new Response(null, { status: 304 });
  }

  const body = JSON.stringify({ events: rows, count: rows.length });
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': `public, max-age=${EVENTS_CACHE_TTL}`,
    'ETag': etag,
  };

  // Store in CF edge cache for subsequent requests from any IP.
  c.executionCtx.waitUntil(
    cache.put(cacheKey, new Response(body, { headers: responseHeaders })),
  );

  return new Response(body, { status: 200, headers: responseHeaders });
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
  if (id.length > 128) return { error: 'event.id must be 128 chars or fewer' };

  const lat = parseFiniteNumber(input.lat);
  if (lat === null) return { error: `event.lat must be a finite number (id=${id})` };
  const latErr = validateRange('event.lat', lat, EARTHQUAKE_LIMITS.lat.min, EARTHQUAKE_LIMITS.lat.max);
  if (latErr) return { error: `${latErr} (id=${id})` };

  const lng = parseFiniteNumber(input.lng);
  if (lng === null) return { error: `event.lng must be a finite number (id=${id})` };
  const lngErr = validateRange('event.lng', lng, EARTHQUAKE_LIMITS.lng.min, EARTHQUAKE_LIMITS.lng.max);
  if (lngErr) return { error: `${lngErr} (id=${id})` };

  const depth_km = parseFiniteNumber(input.depth_km);
  if (depth_km === null) return { error: `event.depth_km must be a finite number (id=${id})` };
  const depthErr = validateRange('event.depth_km', depth_km, EARTHQUAKE_LIMITS.depthKm.min, EARTHQUAKE_LIMITS.depthKm.max);
  if (depthErr) return { error: `${depthErr} (id=${id})` };

  const magnitude = parseFiniteNumber(input.magnitude);
  if (magnitude === null) return { error: `event.magnitude must be a finite number (id=${id})` };
  const magErr = validateRange('event.magnitude', magnitude, EARTHQUAKE_LIMITS.magnitude.min, EARTHQUAKE_LIMITS.magnitude.max);
  if (magErr) return { error: `${magErr} (id=${id})` };

  const time = parseTimestamp(input.time);
  if (!time) return { error: `event.time must be a valid timestamp (id=${id})` };
  const timeErr = validateEventTime(time);
  if (timeErr) return { error: `${timeErr} (id=${id})` };

  const source = (parseString(input.source)?.toLowerCase()) ?? 'usgs';
  if (!VALID_SOURCES.has(source)) {
    return { error: `event.source must be one of: usgs|jma|gcmt (id=${id})` };
  }

  const faultTypeRaw = parseString(input.fault_type)?.toLowerCase();
  if (faultTypeRaw && !VALID_FAULT_TYPES.has(faultTypeRaw)) {
    return { error: `event.fault_type must be one of: crustal|interface|intraslab (id=${id})` };
  }
  const fault_type = faultTypeRaw ? (faultTypeRaw as FaultType) : null;

  const mtStrike = parseFiniteNumber(input.mt_strike);
  const mtDip = parseFiniteNumber(input.mt_dip);
  const mtRake = parseFiniteNumber(input.mt_rake);
  const mtStrike2 = parseFiniteNumber(input.mt_strike2);
  const mtDip2 = parseFiniteNumber(input.mt_dip2);
  const mtRake2 = parseFiniteNumber(input.mt_rake2);

  const mtPrimaryErr = validateMomentTensor(mtStrike, mtDip, mtRake, 'event.mt_nodal_plane_1');
  if (mtPrimaryErr) return { error: `${mtPrimaryErr} (id=${id})` };

  const mtSecondaryErr = validateMomentTensor(mtStrike2, mtDip2, mtRake2, 'event.mt_nodal_plane_2');
  if (mtSecondaryErr) return { error: `${mtSecondaryErr} (id=${id})` };

  const mag_type = parseString(input.mag_type);
  if (mag_type && mag_type.length > 16) {
    return { error: `event.mag_type must be 16 chars or fewer (id=${id})` };
  }

  const place = parseString(input.place);
  if (place && place.length > 255) {
    return { error: `event.place must be 255 chars or fewer (id=${id})` };
  }

  const place_ja = parseString(input.place_ja);
  if (place_ja && place_ja.length > 255) {
    return { error: `event.place_ja must be 255 chars or fewer (id=${id})` };
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
      mag_type,
      place,
      place_ja,
      fault_type,
      tsunami: parseBoolean(input.tsunami),
      mt_strike: mtStrike,
      mt_dip: mtDip,
      mt_rake: mtRake,
      mt_strike2: mtStrike2,
      mt_dip2: mtDip2,
      mt_rake2: mtRake2,
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

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (typeof value === 'string' && value.trim().toLowerCase() === 'true') return true;
  return false;
}
