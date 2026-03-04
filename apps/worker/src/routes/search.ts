import { Hono } from 'hono';
import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
import { checkRateLimit } from '../lib/rateLimit.ts';
import { earthquakes, analyses } from '@namazue/db';
import {
  gte, lte, and, desc, eq, arrayContains, ilike, or, sql,
  type SQL,
} from 'drizzle-orm';

export const searchRoute = new Hono<{ Bindings: Env }>();

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
  const isAiFallback = rawQuery.length > 0;
  const route = isAiFallback ? 'search_ai' : 'search_sql';
  const rl = await checkRateLimit(c.env.RATE_LIMIT, ip, route);
  if (!rl.allowed) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  const db = createDb(c.env.DATABASE_URL);
  const limit = clampLimit(body.limit, isAiFallback ? 20 : 50);

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

  let magMin = getNumber(body.mag_min);
  let magMax = getNumber(body.mag_max);
  let depthMin = getNumber(body.depth_min);
  let depthMax = getNumber(body.depth_max);
  [magMin, magMax] = normalizeRange(magMin, magMax);
  [depthMin, depthMax] = normalizeRange(depthMin, depthMax);
  const lat = getNumber(body.lat);
  const lng = getNumber(body.lng);
  const radiusKm = getNumber(body.radius_km);
  const region = getString(body.region);
  const depthClass = getDepthClass(body.depth_class);
  const relative = getRelativeWindow(body.relative);
  const tags = getTags(body.tags);

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
    const searchRadius = radiusKm !== null && radiusKm > 0 ? radiusKm : 200;
    conditions.push(sql`sqrt(power(lat - ${lat}, 2) + power(lng - ${lng}, 2)) * 111 <= ${searchRadius}`);
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
    analysis: analyses.analysis,
    search_tags: analyses.search_tags,
    search_region: analyses.search_region,
  })
    .from(earthquakes)
    .leftJoin(analyses, and(
      eq(analyses.event_id, earthquakes.id),
      eq(analyses.is_latest, true),
    ))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(earthquakes.time))
    .limit(limit);

  return c.json({ results: rows, count: rows.length });
});

function getNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeRange(min: number | null, max: number | null): [number | null, number | null] {
  if (min === null || max === null) return [min, max];
  return min <= max ? [min, max] : [max, min];
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
  return value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .slice(0, 10);
}

/**
 * Escape LIKE wildcard characters so literal %/_ in user input are not treated as patterns.
 */
function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, (m) => `\\${m}`);
}
