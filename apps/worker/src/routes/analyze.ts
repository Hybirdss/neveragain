/**
 * Analysis routes
 *
 * Client flow:
 *   POST /api/analyze { event_id }
 *   - Returns cached analysis if already generated
 *   - Otherwise returns an immediate canonical analysis built from facts
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
import { checkRateLimit } from '../lib/rateLimit.ts';
import { prepareAnalysisForDelivery } from '../lib/analysisDelivery.ts';
import { isJapanEvent, planAnalyzeCacheMiss } from '../lib/analyzeOnMiss.ts';
import {
  analyses, earthquakes, classifyLocation,
  inferFaultType as inferFaultTypeGeo,
  computeMaxIntensity as computeMaxIntensityShared,
  ANALYSIS_PROMPT_VERSION,
  buildCanonicalAnalysisFromFacts,
} from '@namazue/db';
import type { AnalysisTier, BuilderInput } from '@namazue/db';
import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';

export const analyzeRoute = new Hono<{ Bindings: Env }>();

interface AnalysisCacheRow {
  analysis: unknown;
  context?: unknown;
}

interface BuiltAnalysisSnapshot {
  event: typeof earthquakes.$inferSelect;
  tier: AnalysisTier;
  facts: Record<string, unknown>;
  storedModel: string;
  usage: { input_tokens: number; output_tokens: number };
  analysis: unknown;
}

async function getLatestAnalysis(
  db: ReturnType<typeof createDb>,
  eventId: string,
): Promise<AnalysisCacheRow | null> {
  const rows = await db.select({
    analysis: analyses.analysis,
    context: analyses.context,
    magnitude: earthquakes.magnitude,
    depth_km: earthquakes.depth_km,
    lat: earthquakes.lat,
    lng: earthquakes.lng,
    place: earthquakes.place,
    place_ja: earthquakes.place_ja,
  })
    .from(analyses)
    .innerJoin(earthquakes, eq(earthquakes.id, analyses.event_id))
    .where(and(
      eq(analyses.event_id, eventId),
      eq(analyses.is_latest, true),
    ))
    .orderBy(desc(analyses.created_at), desc(analyses.id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    analysis: prepareAnalysisForDelivery(row.analysis, {
      magnitude: row.magnitude,
      depth_km: row.depth_km,
      lat: row.lat,
      lng: row.lng,
      place: row.place,
      place_ja: row.place_ja,
    }),
    context: row.context,
  };
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

function derivePlatePair(plate: string): string {
  if (plate === 'pacific') return 'Pacific ↔ North American';
  if (plate === 'philippine') return 'Philippine Sea ↔ Eurasian';
  if (plate === 'north_american') return 'North American ↔ Eurasian';
  return 'Unknown';
}

function buildMomentTensor(event: typeof earthquakes.$inferSelect): BuilderInput['moment_tensor'] {
  if (
    event.mt_strike === null || event.mt_dip === null || event.mt_rake === null
  ) {
    return undefined;
  }

  const secondaryStrike = event.mt_strike2 ?? event.mt_strike;
  const secondaryDip = event.mt_dip2 ?? event.mt_dip;
  const secondaryRake = event.mt_rake2 ?? event.mt_rake;

  return {
    type: 'reverse',
    strike: event.mt_strike,
    dip: event.mt_dip,
    rake: event.mt_rake,
    nodal_planes: [
      { strike: event.mt_strike, dip: event.mt_dip, rake: event.mt_rake },
      { strike: secondaryStrike, dip: secondaryDip, rake: secondaryRake },
    ],
  };
}

function inferFaultType(depth_km: number, lat: number, lng: number, place?: string, place_ja?: string): string {
  return inferFaultTypeGeo(depth_km, lat, lng, place, place_ja);
}

function computeMaxIntensity(mag: number, depth_km: number, faultType: string, isOffshore: boolean, coastDistKm?: number | null) {
  return computeMaxIntensityShared(mag, depth_km, faultType, isOffshore, coastDistKm);
}

function buildModelNotes(facts: any) {
  const assumptions: string[] = [
    'Si & Midorikawa (1999) GMPE used for intensity estimation (point-source model)',
    `Vs30 assumed ${facts.ground_motion.vs30} m/s (stiff soil, generic site)`,
    'Reasenberg & Jones (1989) generic parameters for aftershock forecast',
  ];
  if (facts.event?.mag >= 8.0)
    assumptions.push('GMPE extrapolated beyond calibration range (M8+) — intensity may be underestimated');
  if (facts.event?.depth_km > 300)
    assumptions.push(`Deep event (${facts.event.depth_km}km) — GMPE outside calibration range (designed for <300km)`);
  if (!facts.tectonic?.is_japan)
    assumptions.push('Japan-specific GMPE applied to non-Japan region — intensity estimates are approximate');
  if (facts.tectonic?.boundary_type?.startsWith('subduction'))
    assumptions.push('Subduction interface geometry inferred from depth + location heuristics');
  if (facts.max_intensity?.is_offshore)
    assumptions.push(`Coastal intensity estimated at ${facts.max_intensity.coast_distance_km}km from epicenter`);

  const unknowns: string[] = [];
  if (facts.mechanism.status === 'missing') unknowns.push('Moment tensor not yet available');
  if (!facts.sources.shakemap_available) unknowns.push('ShakeMap not available');
  unknowns.push('Actual site amplification varies by local geology');
  if (facts.tectonic.nearest_fault === null) unknowns.push('Nearest active fault not determined');

  const what_will_update: string[] = [];
  if (facts.mechanism.status === 'missing') what_will_update.push('v2: Moment tensor → mechanism update');
  if (!facts.sources.shakemap_available) what_will_update.push('v3: ShakeMap → observed intensity');
  what_will_update.push('v4: Field survey → damage refinement');

  return { assumptions, unknowns, what_will_update };
}

async function buildAnalysisSnapshot(
  env: Env,
  eventId: string,
  options?: { allowAiHints?: boolean },
): Promise<BuiltAnalysisSnapshot> {
  const db = createDb(env.DATABASE_URL);
  const allowAiHints = options?.allowAiHints ?? true;

  const events = await db.select()
    .from(earthquakes)
    .where(eq(earthquakes.id, eventId))
    .limit(1);

  if (events.length === 0) {
    throw new Error(`Event not found: ${eventId}`);
  }

  const event = events[0];
  const eventTime = event.time ?? new Date();
  const tier = classifyTier(event.magnitude, isJapanEvent(event.lat, event.lng));
  const thirtyYearsAgo = new Date(eventTime.getTime() - 30 * 365.25 * 24 * 3600 * 1000);

  // 200km radius ÷ 111 km/° ≈ 1.8°. Bbox pre-filter uses indexed lat/lng columns,
  // then the Cartesian distance check refines to the actual circle.
  const degRadius = 1.8;
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
      lte(earthquakes.time, eventTime),
      gte(earthquakes.lat, event.lat - degRadius),
      lte(earthquakes.lat, event.lat + degRadius),
      gte(earthquakes.lng, event.lng - degRadius),
      lte(earthquakes.lng, event.lng + degRadius),
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
      time: eventTime,
      fault_type: event.fault_type ?? undefined,
      place: event.place ?? undefined,
      place_ja: event.place_ja ?? undefined,
      mag_type: event.mag_type ?? undefined,
      tsunami: event.tsunami ?? undefined,
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
    nearest_faults: faultRows.map((f) => ({
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
    moment_tensor: buildMomentTensor(event),
  };

  const context = buildContext(builderInput);

  const faultType = event.fault_type ?? inferFaultType(event.depth_km, event.lat, event.lng, event.place ?? undefined, event.place_ja ?? undefined);
  const loc = classifyLocation(event.lat, event.lng, event.place ?? undefined, event.place_ja ?? undefined);
  const isOffshore = loc.type !== 'inland';
  const maxIntensity = computeMaxIntensity(event.magnitude, event.depth_km, faultType, isOffshore, loc.coastDistanceKm);

  const facts = {
    event: context.basic,
    tectonic: {
      plate: context.tectonic.plate,
      plate_pair: derivePlatePair(context.tectonic.plate),
      boundary_type: context.tectonic.boundary_type,
      nearest_trench: context.tectonic.nearest_trench,
      nearest_fault: context.tectonic.nearest_active_fault,
      depth_class: context.basic.depth_km < 30 ? 'shallow' : context.basic.depth_km < 70 ? 'mid' : context.basic.depth_km < 300 ? 'intermediate' : 'deep',
      is_japan: isJapanEvent(event.lat, event.lng),
    },
    mechanism: context.mechanism
      ? { status: 'available' as const, strike: context.mechanism.strike, dip: context.mechanism.dip, rake: context.mechanism.rake, source: 'gcmt' }
      : { status: 'missing' as const, source: null },
    max_intensity: maxIntensity,
    tsunami: context.impact?.tsunami ?? { risk: 'none', source: 'rule_engine', factors: [], confidence: 'high' },
    aftershocks: context.aftershock_stats,
    spatial: context.spatial.nearby_30yr_stats,
    ground_motion: { gmpe_model: 'Si_Midorikawa_1999', vs30: context.tectonic.vs30, site_class: context.tectonic.soil_class },
    sources: { event_source: 'usgs', review_status: 'reviewed', shakemap_available: false, moment_tensor_source: context.mechanism ? 'gcmt' : null },
    uncertainty: { mag_sigma: null, depth_sigma: null, location_uncert_km: null },
  };

  let grokHints: unknown = undefined;
  let usage = { input_tokens: 0, output_tokens: 0 };
  let storedModel = 'deterministic-fallback';

  if (allowAiHints && env.XAI_API_KEY) {
    storedModel = 'grok-4.1-fast-reasoning';
    try {
      const result = await callGrok(env, facts as any, tier);
      grokHints = result.analysis;
      usage = result.usage;
    } catch (err) {
      storedModel = 'deterministic-fallback';
      console.warn(`[analyze] ${event.id} AI hint generation failed, using deterministic fallback`);
      console.warn(err);
    }
  }

  const mergedAnalysis = buildCanonicalAnalysisFromFacts({
    event_id: event.id,
    tier,
    model: storedModel,
    facts,
    hints: grokHints,
    model_notes: buildModelNotes(facts),
    event: {
      magnitude: event.magnitude,
      depth_km: event.depth_km,
      lat: event.lat,
      lng: event.lng,
      place: event.place ?? undefined,
      place_ja: event.place_ja ?? undefined,
    },
  });

  return {
    event,
    tier,
    facts: facts as Record<string, unknown>,
    storedModel,
    usage,
    analysis: mergedAnalysis as unknown,
  };
}

async function buildDeterministicAnalysis(
  env: Env,
  eventId: string,
): Promise<unknown> {
  const built = await buildAnalysisSnapshot(env, eventId, { allowAiHints: false });
  return built.analysis;
}

export async function generateAndStoreAnalysis(
  env: Env,
  eventId: string,
  triggerReason: string = 'initial',
): Promise<{ status: 'cached' | 'generated' | 'skipped'; analysis: unknown | null }> {
  const db = createDb(env.DATABASE_URL);

  // Cache check: skip if already generated (unless re-analysis trigger)
  const cached = await getLatestAnalysis(db, eventId);
  if (cached && (triggerReason === 'initial' || triggerReason === 'backfill')) {
    return { status: 'cached', analysis: cached.analysis };
  }

  // Magnitude revision: verify actual change ≥0.3 before regenerating
  if (triggerReason === 'mag_revision' && cached) {
    const evRows = await db.select({ magnitude: earthquakes.magnitude })
      .from(earthquakes).where(eq(earthquakes.id, eventId)).limit(1);
    const currentMag = evRows[0]?.magnitude ?? 0;
    const cachedMag = (cached.context as any)?.event?.mag
      ?? (cached.analysis as any)?.facts?.event?.mag
      ?? 0;
    if (Math.abs(currentMag - cachedMag) < 0.3) {
      return { status: 'skipped', analysis: cached.analysis };
    }
  }

  // KV mutex: prevent duplicate concurrent LLM calls for same event
  const lockKey = `anlk:${eventId}`;
  if (env.RATE_LIMIT) {
    const lock = await env.RATE_LIMIT.get(lockKey);
    if (lock) {
      console.log(`[analyze] ${eventId} already in progress, skipping`);
      return { status: 'skipped', analysis: cached?.analysis ?? null };
    }
    await env.RATE_LIMIT.put(lockKey, '1', { expirationTtl: 60 });
  }

  try {
  const built = await buildAnalysisSnapshot(env, eventId, { allowAiHints: true });

  await db.update(analyses)
    .set({ is_latest: false })
    .where(and(
      eq(analyses.event_id, built.event.id),
      eq(analyses.is_latest, true),
    ));

  await db.insert(analyses).values({
    event_id: built.event.id,
    version: 4,
    tier: built.tier,
    model: built.storedModel,
    prompt_version: ANALYSIS_PROMPT_VERSION,
    context: built.facts as any,
    analysis: built.analysis as any,
    search_tags: (built.analysis as any).search_index.tags,
    search_region: (built.analysis as any).search_index.region,
    is_latest: true,
    trigger_reason: triggerReason,
  });

  console.log(`[analyze] generated event=${built.event.id} tier=${built.tier} reason=${triggerReason} tokens=${built.usage.input_tokens}+${built.usage.output_tokens}`);
  return { status: 'generated', analysis: built.analysis };

  } finally {
    // Release KV mutex
    if (env.RATE_LIMIT) {
      await env.RATE_LIMIT.delete(lockKey).catch(() => {});
    }
  }
}

// Client route: DB-backed fetch or immediate canonical analysis
analyzeRoute.post('/', async (c) => {
  // Rate limit before any work. analyze=10/hr guards against LLM cost abuse.
  const ip = c.req.header('cf-connecting-ip') ?? '0.0.0.0';
  const rl = await checkRateLimit(c.env.RATE_LIMIT, ip, 'analyze');
  if (!rl.allowed) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  const { event_id } = await c.req.json<{ event_id: string }>().catch(() => ({ event_id: '' }));
  if (!event_id) {
    return c.json({ error: 'event_id required' }, 400);
  }

  const db = createDb(c.env.DATABASE_URL);
  const cached = await getLatestAnalysis(db, event_id);
  if (cached) {
    return c.json(cached.analysis);
  }

  // No cached analysis — return an immediate canonical analysis for every event.
  const events = await db.select({
    magnitude: earthquakes.magnitude,
    lat: earthquakes.lat,
    lng: earthquakes.lng,
  })
    .from(earthquakes)
    .where(eq(earthquakes.id, event_id))
    .limit(1);

  const ev = events[0];
  if (!ev) {
    return c.json({ error: 'Event not found' }, 404);
  }

  const missPlan = planAnalyzeCacheMiss(ev);
  if (missPlan === 'generate-and-store') {
    try {
      const result = await generateAndStoreAnalysis(c.env, event_id);
      if (result.analysis) {
        return c.json(result.analysis);
      }
    } catch (err) {
      console.error(`[analyze] realtime generation failed for ${event_id}:`, err);
    }
  }

  try {
    const analysis = await buildDeterministicAnalysis(c.env, event_id);
    return c.json(analysis);
  } catch (err) {
    console.error(`[analyze] deterministic fallback failed for ${event_id}:`, err);
    return c.json({ error: 'Could not prepare analysis' }, 500);
  }
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
