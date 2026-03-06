import { Hono } from 'hono';
import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
import { checkRateLimit } from '../lib/rateLimit.ts';
import { earthquakes, analyses } from '@namazue/db';
import {
  gte, lte, and, desc, eq, arrayContains, ilike, or, sql,
  type SQL,
} from 'drizzle-orm';
import {
  EARTHQUAKE_LIMITS,
  parseFiniteNumber,
  validateRange,
} from '../lib/earthquakeValidation.ts';
import { parseValidatedRange } from '../lib/searchValidation.ts';

export const searchRoute = new Hono<{ Bindings: Env }>();
const MAX_QUERY_LENGTH = 256;
const MAX_REGION_LENGTH = 120;

/**
 * POST /api/search
 * Body: SearchFilter (from client parser or AI fallback)
 *
 * Returns matching events + their analyses if available.
 */
searchRoute.post('/', async (c) => {
  const ip = c.req.header('cf-connecting-ip') ?? '0.0.0.0';
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body) {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // Determine if this is an AI fallback request
  const rawQuery = getString(body.raw_query);
  if (rawQuery.length > MAX_QUERY_LENGTH) {
    return c.json({ error: `raw_query too long (max ${MAX_QUERY_LENGTH})` }, 400);
  }
  const isAiFallback = rawQuery.length > 0;
  const route = isAiFallback ? 'search_ai' : 'search_sql';
  const rl = await checkRateLimit(c.env.RATE_LIMIT, ip, route);
  if (!rl.allowed) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  const db = createDb(c.env.DATABASE_URL);
  const limit = clampLimit(body.limit, isAiFallback ? 20 : 50);
  if (isAiFallback && rawQuery.length > 120) {
    return c.json({ error: 'raw_query must be 120 characters or fewer' }, 400);
  }

  if (isAiFallback) {
    // Graceful fallback: keyword search over place fields.
    const pattern = `%${escapeLike(rawQuery)}%`;
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
      .where(or(
        ilike(earthquakes.place, pattern),
        ilike(earthquakes.place_ja, pattern),
      ))
      .orderBy(desc(earthquakes.time))
      .limit(limit);

    return c.json({ results: rows, count: rows.length, mode: 'keyword-fallback' });
  }

  // SQL-based search
  const conditions: SQL[] = [];

  const {
    min: magMin,
    max: magMax,
    error: magRangeErr,
  } = parseValidatedRange(
    body.mag_min,
    body.mag_max,
    'mag_min',
    'mag_max',
    EARTHQUAKE_LIMITS.magnitude.min,
    EARTHQUAKE_LIMITS.magnitude.max,
  );
  if (magRangeErr) {
    return c.json({ error: magRangeErr }, 400);
  }

  const {
    min: depthMin,
    max: depthMax,
    error: depthRangeErr,
  } = parseValidatedRange(
    body.depth_min,
    body.depth_max,
    'depth_min',
    'depth_max',
    EARTHQUAKE_LIMITS.depthKm.min,
    EARTHQUAKE_LIMITS.depthKm.max,
  );
  if (depthRangeErr) {
    return c.json({ error: depthRangeErr }, 400);
  }
  const lat = getNumber(body.lat);
  const lng = getNumber(body.lng);
  const radiusKm = getNumber(body.radius_km);
  const region = getString(body.region).slice(0, MAX_REGION_LENGTH);
  const depthClass = getDepthClass(body.depth_class);
  const relative = getRelativeWindow(body.relative);
  const tags = getTags(body.tags);

  const hasLat = lat !== null;
  const hasLng = lng !== null;
  if (hasLat !== hasLng) {
    return c.json({ error: 'lat and lng must be provided together' }, 400);
  }
  if (lat !== null && lng !== null) {
    const latErr = validateRange('lat', lat, EARTHQUAKE_LIMITS.lat.min, EARTHQUAKE_LIMITS.lat.max);
    const lngErr = validateRange('lng', lng, EARTHQUAKE_LIMITS.lng.min, EARTHQUAKE_LIMITS.lng.max);
    if (latErr || lngErr) {
      return c.json({ error: latErr ?? lngErr }, 400);
    }
  }

  if (radiusKm !== null) {
    if (!(hasLat && hasLng)) {
      return c.json({ error: 'radius_km requires lat and lng' }, 400);
    }
    const radiusErr = validateRange('radius_km', radiusKm, EARTHQUAKE_LIMITS.radiusKm.min, EARTHQUAKE_LIMITS.radiusKm.max);
    if (radiusErr) {
      return c.json({ error: radiusErr }, 400);
    }
  }

  if (magMin !== null) conditions.push(gte(earthquakes.magnitude, magMin));
  if (magMax !== null) conditions.push(lte(earthquakes.magnitude, magMax));
  if (depthMin !== null) conditions.push(gte(earthquakes.depth_km, depthMin));
  if (depthMax !== null) conditions.push(lte(earthquakes.depth_km, depthMax));

  if (depthClass === 'shallow') {
    conditions.push(lte(earthquakes.depth_km, 30));
  } else if (depthClass === 'intermediate') {
    conditions.push(gte(earthquakes.depth_km, 70), lte(earthquakes.depth_km, 300));
  } else if (depthClass === 'deep') {
    conditions.push(gte(earthquakes.depth_km, 300));
  }

  if (relative !== null) {
    conditions.push(gte(earthquakes.time, relative));
  }

  if (lat !== null && lng !== null) {
    const searchRadius = radiusKm ?? 200;
    const lngScale = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    conditions.push(
      sql`sqrt(power(${earthquakes.lat} - ${lat}, 2) + power((${earthquakes.lng} - ${lng}) * ${lngScale}, 2)) * 111 <= ${searchRadius}`,
    );
  }

  if (region.length > 0) {
    const pattern = `%${escapeLike(region)}%`;
    conditions.push(or(
      ilike(earthquakes.place, pattern),
      ilike(earthquakes.place_ja, pattern),
    ) as SQL);
  }

  if (tags.length > 0) {
    conditions.push(arrayContains(analyses.search_tags, tags));
  }

  // Category-based filters (search_index.categories JSON)
  const plate = getString(body.plate);
  const boundary = getString(body.boundary);
  const catDepthClass = getString(body.cat_depth_class);
  const catRegion = getString(body.cat_region);

  if (plate) {
    conditions.push(sql`${analyses.analysis}->'search_index'->'categories'->>'plate' = ${plate}`);
  }
  if (boundary) {
    conditions.push(sql`${analyses.analysis}->'search_index'->'categories'->>'boundary' = ${boundary}`);
  }
  if (catDepthClass) {
    conditions.push(sql`${analyses.analysis}->'search_index'->'categories'->>'depth_class' = ${catDepthClass}`);
  }
  if (catRegion) {
    conditions.push(sql`${analyses.analysis}->'search_index'->'categories'->>'region' = ${catRegion}`);
  }

  // Tier filter (S, A, B)
  const tierFilter = getString(body.tier);
  if (tierFilter) {
    const tiers = tierFilter.split(',').map(t => t.trim()).filter(t => ['S', 'A', 'B'].includes(t));
    if (tiers.length > 0) {
      conditions.push(sql`${analyses.tier} IN (${sql.join(tiers.map(t => sql`${t}`), sql`, `)})`);
    }
  }

  // has_analysis filter
  const hasAnalysis = body.has_analysis === true;
  if (hasAnalysis) {
    conditions.push(sql`${analyses.id} IS NOT NULL`);
  }

  // Sort field
  const sortField = getString(body.sort);
  const orderByClause = sortField === 'magnitude'
    ? desc(earthquakes.magnitude)
    : desc(earthquakes.time);

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
    tier: analyses.tier,
    search_tags: analyses.search_tags,
    search_region: analyses.search_region,
    has_analysis: sql<boolean>`${analyses.id} IS NOT NULL`,
  })
    .from(earthquakes)
    .leftJoin(analyses, and(
      eq(analyses.event_id, earthquakes.id),
      eq(analyses.is_latest, true),
    ))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderByClause)
    .limit(limit);

  return c.json({ results: rows, count: rows.length });
});

function getNumber(value: unknown): number | null {
  return parseFiniteNumber(value);
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function clampLimit(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), 200);
}

function getDepthClass(value: unknown): 'shallow' | 'intermediate' | 'deep' | null {
  return value === 'shallow' || value === 'intermediate' || value === 'deep'
    ? value
    : null;
}

function getRelativeWindow(value: unknown): Date | null {
  const rel = getString(value);
  if (!rel || rel === 'all') return null;

  const now = Date.now();
  const day = 86_400_000;
  switch (rel) {
    case '24h': return new Date(now - day);
    case '7d': return new Date(now - (7 * day));
    case '30d': return new Date(now - (30 * day));
    case '1yr': return new Date(now - (365 * day));
    default: return null;
  }
}

function getTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const uniq = new Set(
    value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .map((tag) => tag.toLowerCase())
    .filter((tag) => tag.length > 0)
    .filter((tag) => tag.length <= 32),
  );
  return Array.from(uniq).slice(0, 10);
}

/**
 * Escape LIKE wildcard characters so literal %/_ in user input are not treated as patterns.
 */
function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, (m) => `\\${m}`);
}
