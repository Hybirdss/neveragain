/**
 * Analysis routes
 *
 * Client flow:
 *   POST /api/analyze { event_id }
 *   - Returns cached analysis if already generated
 *   - Returns 202 (pending) if not generated yet
 *
 * Server/internal flow:
 *   POST /api/analyze/generate { event_id }
 *   - Generates and stores analysis immediately (for ingestion pipelines / cron)
 */

import { Hono } from 'hono';
import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
import { callGrok } from '../lib/grok.ts';
import { buildContext } from '../context/builder.ts';
import { analyses, earthquakes } from '@namazue/db';
import type { AnalysisTier, BuilderInput } from '@namazue/db';
import { eq, and, sql, gte, lte } from 'drizzle-orm';

export const analyzeRoute = new Hono<{ Bindings: Env }>();

interface AnalysisCacheRow {
  analysis: unknown;
}

async function getLatestAnalysis(
  db: ReturnType<typeof createDb>,
  eventId: string,
): Promise<AnalysisCacheRow | null> {
  const rows = await db.select({
    analysis: analyses.analysis,
  })
    .from(analyses)
    .where(and(
      eq(analyses.event_id, eventId),
      eq(analyses.is_latest, true),
    ))
    .limit(1);

  return rows[0] ?? null;
}

function classifyTier(mag: number, isJapan: boolean): AnalysisTier {
  if (isJapan) {
    if (mag >= 7.0) return 'S';
    if (mag >= 5.0) return 'A';
    return 'B';
  }
  if (mag >= 8.0) return 'S';
  if (mag >= 6.0) return 'A';
  return 'B';
}

function isJapan(lat: number, lng: number): boolean {
  return lat >= 20 && lat <= 50 && lng >= 120 && lng <= 155;
}

export async function generateAndStoreAnalysis(
  env: Env,
  eventId: string,
): Promise<{ status: 'cached' | 'generated'; analysis: unknown }> {
  const db = createDb(env.DATABASE_URL);

  const cached = await getLatestAnalysis(db, eventId);
  if (cached) {
    return { status: 'cached', analysis: cached.analysis };
  }

  const events = await db.select()
    .from(earthquakes)
    .where(eq(earthquakes.id, eventId))
    .limit(1);

  if (events.length === 0) {
    throw new Error(`Event not found: ${eventId}`);
  }

  const event = events[0];
  const tier = classifyTier(event.magnitude, isJapan(event.lat, event.lng));
  const thirtyYearsAgo = new Date(event.time!.getTime() - 30 * 365.25 * 24 * 3600 * 1000);

  const spatialStats = await db.select({
    total: sql<number>`count(*)::int`,
    m4: sql<number>`count(*) filter (where magnitude >= 4 and magnitude < 5)::int`,
    m5: sql<number>`count(*) filter (where magnitude >= 5 and magnitude < 6)::int`,
    m6: sql<number>`count(*) filter (where magnitude >= 6 and magnitude < 7)::int`,
    m7plus: sql<number>`count(*) filter (where magnitude >= 7)::int`,
    shallow: sql<number>`count(*) filter (where depth_km < 30)::int`,
    mid: sql<number>`count(*) filter (where depth_km >= 30 and depth_km < 70)::int`,
    intermediate: sql<number>`count(*) filter (where depth_km >= 70 and depth_km < 300)::int`,
    deep: sql<number>`count(*) filter (where depth_km >= 300)::int`,
  })
    .from(earthquakes)
    .where(and(
      gte(earthquakes.time, thirtyYearsAgo),
      lte(earthquakes.time, event.time!),
      sql`sqrt(power(lat - ${event.lat}, 2) + power(lng - ${event.lng}, 2)) * 111 < 200`,
    ));

  const s = spatialStats[0];

  let faultRows: any[] = [];
  try {
    const faultResult = await db.execute(sql`
      SELECT id, name_ja, name_en, fault_type, recurrence_years,
             last_activity, estimated_mw, probability_30yr,
             ST_Distance(geom::geography, ST_MakePoint(${event.lng}, ${event.lat})::geography) / 1000 as distance_km
      FROM active_faults
      WHERE geom IS NOT NULL
      ORDER BY geom <-> ST_MakePoint(${event.lng}, ${event.lat})::geometry
      LIMIT 3
    `);
    faultRows = faultResult.rows as any[];
  } catch {
    // PostGIS may be unavailable in some environments.
  }

  const builderInput: BuilderInput = {
    event: {
      id: event.id,
      lat: event.lat,
      lng: event.lng,
      depth_km: event.depth_km,
      magnitude: event.magnitude,
      time: event.time!,
      fault_type: event.fault_type ?? undefined,
      place: event.place ?? undefined,
      place_ja: event.place_ja ?? undefined,
      mag_type: event.mag_type ?? undefined,
    },
    tier: tier as 'S' | 'A' | 'B',
    spatial_stats: {
      total: s.total,
      by_mag: { m4: s.m4, m5: s.m5, m6: s.m6, m7plus: s.m7plus },
      by_depth: {
        shallow_0_30: s.shallow,
        mid_30_70: s.mid,
        intermediate_70_300: s.intermediate,
        deep_300_700: s.deep,
      },
      largest: { mag: 0, date: '', place: '', id: '' },
      avg_per_year: Math.round((s.total / 30) * 10) / 10,
    },
    nearest_faults: faultRows.map(f => ({
      id: f.id,
      name_en: f.name_en ?? '',
      name_ja: f.name_ja ?? '',
      distance_km: Math.round(f.distance_km * 10) / 10,
      estimated_mw: f.estimated_mw,
      fault_type: f.fault_type,
      last_activity: f.last_activity,
      recurrence_years: f.recurrence_years,
      probability_30yr: f.probability_30yr,
    })),
    moment_tensor: event.mt_strike ? {
      type: 'reverse' as const,
      strike: event.mt_strike,
      dip: event.mt_dip!,
      rake: event.mt_rake!,
      nodal_planes: [
        { strike: event.mt_strike, dip: event.mt_dip!, rake: event.mt_rake! },
        { strike: event.mt_strike2 ?? 0, dip: event.mt_dip2 ?? 0, rake: event.mt_rake2 ?? 0 },
      ],
    } : undefined,
  };

  const context = buildContext(builderInput);
  const { analysis, usage } = await callGrok(env, context as any, tier);

  await db.insert(analyses).values({
    event_id: event.id,
    version: 1,
    tier,
    model: 'grok-4-fast',
    prompt_version: 'v1.0.0',
    context: context as any,
    analysis: analysis as any,
    search_tags: (analysis as any).search_index?.tags ?? [],
    search_region: (analysis as any).search_index?.region ?? null,
    is_latest: true,
  });

  console.log(`[analyze] generated event=${event.id} tier=${tier} tokens=${usage.input_tokens}+${usage.output_tokens}`);
  return { status: 'generated', analysis: analysis as unknown };
}

// Client route: cached fetch only
analyzeRoute.post('/', async (c) => {
  const { event_id } = await c.req.json<{ event_id: string }>().catch(() => ({ event_id: '' }));
  if (!event_id) {
    return c.json({ error: 'event_id required' }, 400);
  }

  const db = createDb(c.env.DATABASE_URL);
  const cached = await getLatestAnalysis(db, event_id);
  if (cached) {
    return c.json(cached.analysis);
  }

  return c.json({
    status: 'pending',
    event_id,
    message: 'Analysis is being prepared on the server.',
  }, 202);
});

// Internal route: force generation (ingestion pipeline / ops use)
analyzeRoute.post('/generate', async (c) => {
  const { event_id } = await c.req.json<{ event_id: string }>().catch(() => ({ event_id: '' }));
  if (!event_id) {
    return c.json({ error: 'event_id required' }, 400);
  }

  if (c.env.INTERNAL_API_TOKEN) {
    const token = c.req.header('x-internal-token');
    if (!token || token !== c.env.INTERNAL_API_TOKEN) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  }

  try {
    const result = await generateAndStoreAnalysis(c.env, event_id);
    return c.json({
      status: result.status,
      event_id,
    });
  } catch (err) {
    return c.json({
      error: (err as Error).message,
    }, 500);
  }
});
