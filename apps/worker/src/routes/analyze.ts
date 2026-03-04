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
import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';

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
    .orderBy(desc(analyses.created_at), desc(analyses.id))
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

function derivePlatePair(plate: string): string {
  if (plate === 'pacific') return 'Pacific ↔ North American';
  if (plate === 'philippine') return 'Philippine Sea ↔ Eurasian';
  if (plate === 'north_american') return 'North American ↔ Eurasian';
  return 'Unknown';
}

function classifyRegion(lat: number, lng: number): string {
  if (!isJapan(lat, lng)) {
    if (lng > 100 && lng < 180 && lat > -60 && lat < 60) return 'global_pacific';
    return 'global_other';
  }
  if (lat > 41) return 'hokkaido';
  if (lat > 38) return 'tohoku';
  if (lat > 36) return 'kanto';
  if (lat > 35 && lng < 138) return 'chubu';
  if (lat > 34 && lng < 136) return 'kinki';
  if (lat > 33 && lng < 133) return 'chugoku';
  if (lat > 32 && lng > 132 && lng < 135) return 'shikoku';
  if (lat > 30 && lat <= 34) return 'kyushu';
  return 'okinawa';
}

function inferFaultType(depth_km: number, lat: number, lng: number): string {
  const isOffshore = lng > 142 || (lat < 34 && lng > 136) || (lat > 40 && lng > 140);
  if (isOffshore) {
    if (depth_km < 60) return 'interface';
    if (depth_km >= 60 && depth_km < 200) return 'intraslab';
  }
  if (depth_km < 30) return 'crustal';
  if (depth_km >= 60 && depth_km < 300) return 'intraslab';
  return 'crustal';
}

function toJmaClass(i: number): string {
  if (i >= 6.5) return '7';
  if (i >= 6.0) return '6+';
  if (i >= 5.5) return '6-';
  if (i >= 5.0) return '5+';
  if (i >= 4.5) return '5-';
  if (i >= 3.5) return '4';
  if (i >= 2.5) return '3';
  if (i >= 1.5) return '2';
  if (i >= 0.5) return '1';
  return '0';
}

function gmpeIntensityAt(mw: number, depth_km: number, surfDistKm: number, faultType: string): number {
  const ft = (faultType === 'crustal' || faultType === 'interface' || faultType === 'intraslab')
    ? faultType : 'crustal';
  const faultCorr: Record<string, number> = { crustal: 0.0, interface: -0.02, intraslab: 0.12 };
  const d = faultCorr[ft];
  const X = Math.sqrt(surfDistKm * surfDistKm + depth_km * depth_km);
  const logPgv = 0.58 * mw + 0.0038 * depth_km + d
    - Math.log10(X + 0.0028 * Math.pow(10, 0.5 * mw))
    - 0.002 * X - 1.29;
  const pgv600 = Math.pow(10, logPgv);
  const pgvSurface = pgv600 * 1.41;
  return pgvSurface > 0 ? 2.43 + 1.82 * Math.log10(pgvSurface) : 0;
}

function computeMaxIntensity(mag: number, depth_km: number, faultType: string, isOffshore: boolean) {
  const mw = Math.min(mag, 8.3);
  const distances = [1, 5, 10, 20, 30, 50, 75, 100, 150, 200, 300];
  let epicentralMax = 0;
  for (const d of distances) {
    const i = gmpeIntensityAt(mw, depth_km, d, faultType);
    if (i > epicentralMax) epicentralMax = i;
  }
  const coastDist = isOffshore ? Math.max(30, Math.min(80, depth_km * 0.5)) : 0;
  const coastI = isOffshore ? gmpeIntensityAt(mw, depth_km, coastDist, faultType) : epicentralMax;
  const reportedValue = isOffshore ? coastI : epicentralMax;
  const rounded = Math.round(reportedValue * 10) / 10;
  return {
    value: rounded, class: toJmaClass(rounded),
    epicentral_max: Math.round(epicentralMax * 10) / 10,
    epicentral_max_class: toJmaClass(Math.round(epicentralMax * 10) / 10),
    is_offshore: isOffshore, coast_distance_km: isOffshore ? Math.round(coastDist) : null,
    scale: 'JMA' as const, source: 'gmpe_si_midorikawa_1999' as const,
    confidence: (mag >= 6 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
  };
}

function buildModelNotes(facts: any) {
  const assumptions: string[] = [
    'Si & Midorikawa (1999) GMPE used for intensity estimation',
    `Vs30 assumed ${facts.ground_motion.vs30} m/s (stiff soil, generic site)`,
    'Reasenberg & Jones (1989) generic parameters for aftershock forecast',
  ];
  if (facts.tectonic.boundary_type.startsWith('subduction'))
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
  const eventTime = event.time ?? new Date();
  const tier = classifyTier(event.magnitude, isJapan(event.lat, event.lng));
  const thirtyYearsAgo = new Date(eventTime.getTime() - 30 * 365.25 * 24 * 3600 * 1000);

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
    moment_tensor: buildMomentTensor(event),
  };

  const context = buildContext(builderInput);

  // Build v4 facts block from context (code-computed, LLM never touches)
  const faultType = event.fault_type ?? inferFaultType(event.depth_km, event.lat, event.lng);
  const isOffshore = event.lng > 142 || (event.lat < 34 && event.lng > 136) || (event.lat > 40 && event.lng > 140);
  const maxIntensity = computeMaxIntensity(event.magnitude, event.depth_km, faultType, isOffshore);

  const facts = {
    event: context.basic,
    tectonic: {
      plate: context.tectonic.plate,
      plate_pair: derivePlatePair(context.tectonic.plate),
      boundary_type: context.tectonic.boundary_type,
      nearest_trench: context.tectonic.nearest_trench,
      nearest_fault: context.tectonic.nearest_active_fault,
      depth_class: context.basic.depth_km < 30 ? 'shallow' : context.basic.depth_km < 70 ? 'mid' : context.basic.depth_km < 300 ? 'intermediate' : 'deep',
      is_japan: isJapan(event.lat, event.lng),
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

  const { analysis: narrative, usage } = await callGrok(env, facts as any, tier);

  // Merge facts + Grok narrative into v4 analysis
  const grok = narrative as any;
  const pub = grok.public ?? {};
  const exp = grok.expert ?? {};
  const si = grok.search_index ?? {};

  const mergedAnalysis = {
    event_id: event.id,
    tier,
    version: 4,
    generated_at: new Date().toISOString(),
    model: 'grok-4.1-fast-reasoning',

    facts: {
      max_intensity: facts.max_intensity,
      tsunami: facts.tsunami,
      aftershocks: facts.aftershocks,
      mechanism: facts.mechanism,
      tectonic: facts.tectonic,
      spatial: facts.spatial,
      ground_motion: facts.ground_motion,
      sources: facts.sources,
      uncertainty: facts.uncertainty,
    },

    interpretations: (grok.interpretations ?? []).map((interp: any) => ({
      claim: interp.claim ?? '',
      summary: interp.summary ?? { ja: '', ko: '', en: '' },
      basis: interp.basis ?? [],
      confidence: interp.confidence ?? 'low',
      type: interp.type ?? 'tectonic_context',
    })),

    dashboard: {
      headline: grok.headline ?? grok.dashboard?.headline ?? { ja: '', ko: '', en: '' },
      one_liner: grok.one_liner ?? grok.dashboard?.one_liner ?? { ja: '', ko: '', en: '' },
    },

    public: {
      why: pub.why ?? { ja: '', ko: '', en: '' },
      why_refs: pub.why_refs ?? [],
      aftershock_note: pub.aftershock_note ?? { ja: '', ko: '', en: '' },
      aftershock_note_refs: pub.aftershock_note_refs ?? [],
      do_now: (pub.do_now ?? []).map((item: any) => ({
        action: item.action ?? { ja: '', ko: '', en: '' },
        urgency: item.urgency ?? 'preparedness',
      })),
      faq: (pub.faq ?? []).map((item: any) => ({
        q: item.q ?? { ja: '', ko: '', en: '' },
        a: item.a ?? { ja: '', ko: '', en: '' },
        a_refs: item.a_refs ?? [],
      })),
    },

    expert: {
      tectonic_summary: exp.tectonic_summary ?? { ja: '', ko: '', en: '' },
      tectonic_summary_refs: exp.tectonic_summary_refs ?? [],
      mechanism_note: exp.mechanism_note ?? null,
      mechanism_note_refs: exp.mechanism_note_refs ?? null,
      depth_analysis: exp.depth_analysis ?? null,
      depth_analysis_refs: exp.depth_analysis_refs ?? null,
      coulomb_note: exp.coulomb_note ?? null,
      coulomb_note_refs: exp.coulomb_note_refs ?? null,
      sequence: {
        classification: exp.sequence?.classification ?? 'independent',
        confidence: exp.sequence?.confidence ?? 'low',
        reasoning: exp.sequence?.reasoning ?? { ja: '', ko: '', en: '' },
        reasoning_refs: exp.sequence?.reasoning_refs ?? [],
      },
      seismic_gap: {
        is_gap: exp.seismic_gap?.is_gap ?? false,
        note: exp.seismic_gap?.note ?? null,
      },
      historical_comparison: exp.historical_comparison ?? null,
      notable_features: (exp.notable_features ?? []).map((nf: any) => ({
        feature: nf.feature ?? { ja: '', ko: '', en: '' },
        claim: nf.claim ?? { ja: '', ko: '', en: '' },
        because: nf.because ?? { ja: '', ko: '', en: '' },
        because_refs: nf.because_refs ?? [],
        implication: nf.implication ?? { ja: '', ko: '', en: '' },
      })),
      model_notes: buildModelNotes(facts),
    },

    search_index: {
      tags: (si.tags ?? []).filter((t: any) => typeof t === 'string'),
      region: si.region ?? classifyRegion(event.lat, event.lng),
      categories: {
        plate: facts.tectonic.plate,
        boundary: facts.tectonic.boundary_type,
        region: si.region ?? classifyRegion(event.lat, event.lng),
        depth_class: facts.tectonic.depth_class,
        damage_level: si.damage_level ?? 'none',
        tsunami_generated: facts.tsunami.risk !== 'none',
        has_foreshocks: si.has_foreshocks ?? false,
        is_in_seismic_gap: exp.seismic_gap?.is_gap ?? false,
      },
      region_keywords: si.region_keywords ?? { ja: [], ko: [], en: [] },
    },
  };

  await db.update(analyses)
    .set({ is_latest: false })
    .where(and(
      eq(analyses.event_id, event.id),
      eq(analyses.is_latest, true),
    ));

  await db.insert(analyses).values({
    event_id: event.id,
    version: 4,
    tier,
    model: 'grok-4.1-fast-reasoning',
    prompt_version: 'v4.0.0',
    context: facts as any,
    analysis: mergedAnalysis as any,
    search_tags: mergedAnalysis.search_index.tags,
    search_region: mergedAnalysis.search_index.region,
    is_latest: true,
  });

  console.log(`[analyze] generated event=${event.id} tier=${tier} tokens=${usage.input_tokens}+${usage.output_tokens}`);
  return { status: 'generated', analysis: mergedAnalysis as unknown };
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
