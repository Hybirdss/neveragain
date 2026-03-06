/**
 * Pre-generate AI analyses for historical earthquakes.
 *
 * Architecture (v4 — Grok Batch API, 50% discount):
 *   1. Code builds `facts` for all events
 *   2. Submit all requests to xAI Batch API
 *   3. Poll for completion (up to 24h)
 *   4. Retrieve results, merge, store in DB
 *
 * Usage:
 *   DATABASE_URL=... XAI_API_KEY=... npx tsx tools/generate-analyses.ts
 *
 * Options (env):
 *   DRY_RUN, START_FROM, TIER_FILTER, LIMIT, POLL_INTERVAL_S (default 30)
 *   BATCH_ID — resume polling an existing batch
 */

import { neon } from '@neondatabase/serverless';
import {
  ANALYSIS_HINT_SYSTEM_PROMPT,
  ANALYSIS_PROMPT_VERSION,
  buildAnalysisHintUserPrompt,
  buildCanonicalAnalysisFromFacts,
  classifyLocation, inferFaultType as inferFaultTypeShared,
  assessTsunamiRisk as assessTsunamiRiskShared,
  computeMaxIntensity as computeMaxIntensityShared,
  computeOmori as computeOmoriShared,
  normalizeAnalysisHints,
} from '@namazue/db';

const DATABASE_URL = process.env.DATABASE_URL!;
const XAI_API_KEY = process.env.XAI_API_KEY!;

if (!DATABASE_URL) throw new Error('DATABASE_URL required');
if (!XAI_API_KEY) throw new Error('XAI_API_KEY required');

const DRY_RUN = process.env.DRY_RUN === 'true';
const START_FROM = process.env.START_FROM ?? null;
const TIER_FILTER = process.env.TIER_FILTER ?? null;
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;
const POLL_INTERVAL_S = parseInt(process.env.POLL_INTERVAL_S ?? '30', 10);
const RESUME_BATCH_ID = process.env.BATCH_ID ?? null;
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES ?? '5', 10);
const REGEN_MODE = process.env.REGEN === 'true'; // Skip coordinate/time filter, pick up invalidated

const sql = neon(DATABASE_URL);
const XAI_BASE = 'https://api.x.ai/v1';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${XAI_API_KEY}`,
};

// ═══════════════════════════════════════════════════════════
//  TIER CLASSIFICATION
// ═══════════════════════════════════════════════════════════

function isJapan(lat: number, lng: number): boolean {
  return lat >= 20 && lat <= 50 && lng >= 120 && lng <= 155;
}

function classifyTier(mag: number, japan: boolean): 'S' | 'A' | 'B' {
  if (japan) {
    if (mag >= 7.0) return 'S';
    if (mag >= 5.0) return 'A';
    return 'B';
  }
  if (mag >= 8.0) return 'S';
  if (mag >= 6.0) return 'A';
  return 'B';
}

// ═══════════════════════════════════════════════════════════
//  FACTS BUILDER (code-computed, LLM never touches)
// ═══════════════════════════════════════════════════════════

function classifyPlate(lat: number, lng: number): string {
  if (lat < 20 || lat > 50 || lng < 120 || lng > 155) return 'other';
  if (lng > 144 && lat > 30) return 'pacific';
  if (lng > 136 && lat < 34) return 'philippine';
  if (lat > 36 && lng < 144) return 'north_american';
  return 'eurasian';
}

function classifyBoundary(faultType?: string, depth?: number): string {
  if (faultType === 'interface') return 'subduction_interface';
  if (faultType === 'intraslab') return 'intraslab';
  if (faultType === 'crustal') return (depth ?? 0) > 30 ? 'intraplate_deep' : 'intraplate_shallow';
  return 'unknown';
}

function classifyDepthClass(depth: number): string {
  if (depth < 30) return 'shallow';
  if (depth < 70) return 'mid';
  if (depth < 300) return 'intermediate';
  return 'deep';
}

function platePair(lat: number, lng: number): string {
  const plate = classifyPlate(lat, lng);
  if (plate === 'pacific') return 'Pacific ↔ North American';
  if (plate === 'philippine') return 'Philippine Sea ↔ Eurasian';
  if (plate === 'north_american') return 'North American ↔ Eurasian';
  return 'Unknown';
}

function assessTsunamiRisk(mag: number, depth: number, faultType?: string, lat?: number, lng?: number, place?: string, place_ja?: string, tsunamiFlag?: boolean) {
  return assessTsunamiRiskShared(mag, depth, faultType, lat, lng, place, place_ja, tsunamiFlag);
}

function computeOmori(mainMw: number) {
  return computeOmoriShared(mainMw);
}

// ═══════════════════════════════════════════════════════════
//  GMPE: max_intensity estimation — delegated to @namazue/db
// ═══════════════════════════════════════════════════════════

function computeMaxIntensity(mag: number, depth_km: number, faultType: string, isOffshore: boolean, coastDistKm?: number | null) {
  return computeMaxIntensityShared(mag, depth_km, faultType, isOffshore, coastDistKm);
}

function inferFaultType(depth_km: number, lat: number, lng: number, place?: string, place_ja?: string): string {
  return inferFaultTypeShared(depth_km, lat, lng, place, place_ja);
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

const TRENCHES = [
  { name: 'Japan Trench', segment: 'japan_trench', lat: 38, lng: 144 },
  { name: 'Nankai Trough', segment: 'nankai', lat: 33, lng: 135 },
  { name: 'Ryukyu Trench', segment: 'ryukyu', lat: 27, lng: 128 },
  { name: 'Izu-Bonin Trench', segment: 'izu_bonin', lat: 30, lng: 142 },
];

function findNearestTrench(lat: number, lng: number) {
  let nearest = TRENCHES[0];
  let minDist = Infinity;
  for (const t of TRENCHES) {
    const d = Math.sqrt((lat - t.lat) ** 2 + (lng - t.lng) ** 2) * 111;
    if (d < minDist) { minDist = d; nearest = t; }
  }
  return { name: nearest.name, segment: nearest.segment, distance_km: Math.round(minDist) };
}

function buildFacts(event: any, faults: any[], spatialStats: any) {
  const japan = isJapan(event.lat, event.lng);
  const depthClass = classifyDepthClass(event.depth_km);
  const trench = japan ? findNearestTrench(event.lat, event.lng) : null;
  const faultType = event.fault_type || inferFaultType(event.depth_km, event.lat, event.lng, event.place, event.place_ja);
  const tsunami = assessTsunamiRisk(event.magnitude, event.depth_km, faultType, event.lat, event.lng, event.place, event.place_ja, event.tsunami);
  // Compute aftershocks for: Japan M4+ or global M5+ (was Japan-only before)
  const aftershocks = (japan && event.magnitude >= 4) || (!japan && event.magnitude >= 5)
    ? computeOmori(event.magnitude)
    : null;
  const loc = classifyLocation(event.lat, event.lng, event.place, event.place_ja);
  const isOffshore = loc.type !== 'inland';
  const maxIntensity = computeMaxIntensity(event.magnitude, event.depth_km, faultType, isOffshore, loc.coastDistanceKm);

  return {
    event: {
      id: event.id, mag: event.magnitude, mag_type: event.mag_type ?? 'mw',
      depth_km: event.depth_km, lat: event.lat, lon: event.lng,
      time: new Date(event.time).toISOString(),
      place_en: event.place ?? '', place_ja: event.place_ja ?? event.place ?? '',
      source: event.source ?? 'usgs',
    },
    tectonic: {
      plate: classifyPlate(event.lat, event.lng),
      plate_pair: platePair(event.lat, event.lng),
      boundary_type: classifyBoundary(faultType, event.depth_km),
      boundary_segment: trench?.segment ?? null,
      nearest_trench: trench,
      nearest_fault: faults[0] ? {
        name_en: faults[0].name_en ?? '', name_ja: faults[0].name_ja ?? '',
        distance_km: Math.round(faults[0].distance_km * 10) / 10,
        estimated_mw: faults[0].estimated_mw, fault_type: faults[0].fault_type,
        recurrence_years: faults[0].recurrence_years, probability_30yr: faults[0].probability_30yr,
      } : null,
      all_nearby_faults: faults.slice(0, 3).map((f: any) => ({
        name_en: f.name_en ?? '', name_ja: f.name_ja ?? '',
        distance_km: Math.round(f.distance_km * 10) / 10,
        estimated_mw: f.estimated_mw, fault_type: f.fault_type,
      })),
      depth_class: depthClass, is_japan: japan,
    },
    mechanism: event.mt_strike != null ? {
      status: 'available' as const,
      strike: event.mt_strike, dip: event.mt_dip, rake: event.mt_rake,
      nodal_planes: [
        { strike: event.mt_strike, dip: event.mt_dip, rake: event.mt_rake },
        { strike: event.mt_strike2 ?? 0, dip: event.mt_dip2 ?? 0, rake: event.mt_rake2 ?? 0 },
      ],
      source: 'gcmt',
    } : { status: 'missing' as const, source: null },
    tsunami, aftershocks,
    spatial: spatialStats ? {
      total: spatialStats.total,
      by_mag: spatialStats.by_mag,
      by_depth: spatialStats.by_depth,
      avg_per_year: Math.round((spatialStats.total / 30) * 10) / 10,
    } : null,
    max_intensity: maxIntensity,
    ground_motion: { gmpe_model: 'Si_Midorikawa_1999', vs30: 400, site_class: 'stiff' },
    sources: {
      event_source: event.source ?? 'usgs', review_status: 'reviewed',
      shakemap_available: false,
      moment_tensor_source: event.mt_strike != null ? 'gcmt' : null,
    },
    uncertainty: { mag_sigma: null as number | null, depth_sigma: null as number | null, location_uncert_km: null as number | null },
  };
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════
//  xAI BATCH API helpers
// ═══════════════════════════════════════════════════════════

async function createBatch(name: string): Promise<string> {
  const resp = await fetch(`${XAI_BASE}/batches`, {
    method: 'POST', headers,
    body: JSON.stringify({ name }),
  });
  if (!resp.ok) throw new Error(`Create batch failed: ${resp.status} ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json() as any;
  return data.batch_id;
}

async function addRequests(batchId: string, requests: any[]): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = await fetch(`${XAI_BASE}/batches/${batchId}/requests`, {
      method: 'POST', headers,
      body: JSON.stringify({ batch_requests: requests }),
    });
    if (resp.ok) return;
    const body = (await resp.text()).slice(0, 200);
    if (resp.status === 500 && body.includes('expired') && attempt < 2) {
      console.log(`\n  Auth expired, retrying (${attempt + 1}/3)...`);
      await sleep(2000);
      continue;
    }
    throw new Error(`Add requests failed: ${resp.status} ${body}`);
  }
}

async function getBatchStatus(batchId: string): Promise<any> {
  const resp = await fetch(`${XAI_BASE}/batches/${batchId}`, { headers });
  if (!resp.ok) throw new Error(`Get batch status failed: ${resp.status}`);
  return resp.json();
}

async function getResults(batchId: string): Promise<any[]> {
  const all: any[] = [];
  let token: string | null = null;

  while (true) {
    const url = new URL(`${XAI_BASE}/batches/${batchId}/results`);
    url.searchParams.set('limit', '100');
    if (token) url.searchParams.set('pagination_token', token);

    const resp = await fetch(url.toString(), { headers });
    if (!resp.ok) throw new Error(`Get results failed: ${resp.status}`);
    const data = await resp.json() as any;

    if (data.results) all.push(...data.results);
    if (data.pagination_token && data.results?.length === 100) {
      token = data.pagination_token;
    } else {
      break;
    }
  }

  return all;
}

// ═══════════════════════════════════════════════════════════
//  BATCH HELPERS: submit → poll → collect → retry failed
// ═══════════════════════════════════════════════════════════

function buildBatchRequest(eventId: string, facts: any, tier: string) {
  return {
    batch_request_id: eventId,
    batch_request: {
      chat_get_completion: {
        model: 'grok-4-1-fast-reasoning',
        messages: [
          { role: 'system', content: ANALYSIS_HINT_SYSTEM_PROMPT },
          { role: 'user', content: buildAnalysisHintUserPrompt(facts, tier) },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      },
    },
  };
}

async function submitBatch(name: string, requests: any[]): Promise<string> {
  const batchId = await createBatch(name);
  console.log(`  Batch created: ${batchId}`);

  const CHUNK_SIZE = 50;
  for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
    const chunk = requests.slice(i, i + CHUNK_SIZE);
    await addRequests(batchId, chunk);
    process.stdout.write(`\r  Submitted: ${Math.min(i + CHUNK_SIZE, requests.length)}/${requests.length}`);
    if (i + CHUNK_SIZE < requests.length) await sleep(500);
  }
  console.log(' ✓');
  return batchId;
}

async function pollUntilDone(batchId: string): Promise<void> {
  console.log(`  Polling batch: ${batchId}`);
  console.log(`  Resume command: BATCH_ID=${batchId}\n`);

  let lastDone = 0;
  let stuckCount = 0;
  const MAX_STUCK = 10; // Give up after 10 polls with no progress (~5 min)

  while (true) {
    const status = await getBatchStatus(batchId);
    const st = status.state ?? status;
    const { num_requests = 0, num_success = 0, num_error = 0, num_pending = 0 } = st;
    const done = num_success + num_error + (st.num_cancelled ?? 0);
    const pct = num_requests > 0 ? ((done / num_requests) * 100).toFixed(1) : '0';

    process.stdout.write(`\r  [${pct}%] ${done}/${num_requests} (✓${num_success} ✗${num_error} pending:${num_pending})   `);

    if (num_pending === 0 && done >= num_requests && num_requests > 0) {
      console.log('\n  Batch complete!');
      return;
    }

    // Detect stuck batches (no progress for MAX_STUCK polls)
    if (done === lastDone) {
      stuckCount++;
      if (stuckCount >= MAX_STUCK) {
        console.log(`\n  Batch stalled (${num_pending} stuck pending). Proceeding with available results.`);
        return;
      }
    } else {
      stuckCount = 0;
      lastDone = done;
    }

    await sleep(POLL_INTERVAL_S * 1000);
  }
}

/** Collect results → store successes → return failed event IDs */
async function collectAndStore(
  batchId: string,
  factsMap: Map<string, { facts: any; tier: string }>,
): Promise<{ stored: number; failedIds: string[] }> {
  const results = await getResults(batchId);
  console.log(`  Retrieved ${results.length} results`);

  let stored = 0;
  const failedIds: string[] = [];

  for (const result of results) {
    const eventId = result.batch_request_id;
    const entry = factsMap.get(eventId);
    if (!entry) { failedIds.push(eventId); continue; }

    try {
      let hints: unknown = undefined;
      let model = 'grok-4.1-fast-reasoning-batch';
      if (result.batch_result?.error) {
        model = 'deterministic-fallback';
      }
      const completion = result.batch_result?.response?.chat_get_completion;
      const raw = completion?.choices?.[0]?.message?.content;
      if (raw) {
        try {
          hints = normalizeAnalysisHints(typeof raw === 'string' ? JSON.parse(raw) : raw);
        } catch {
          model = 'deterministic-fallback';
        }
      } else {
        model = 'deterministic-fallback';
      }
      const analysis = buildCanonicalAnalysisFromFacts({
        event_id: eventId,
        tier: entry.tier,
        model,
        facts: entry.facts,
        hints,
        model_notes: buildModelNotes(entry.facts),
        event: {
          magnitude: entry.facts.event.mag,
          depth_km: entry.facts.event.depth_km,
          lat: entry.facts.event.lat,
          lng: entry.facts.event.lon,
          place: entry.facts.event.place_en,
          place_ja: entry.facts.event.place_ja,
        },
      });

      await sql`
        INSERT INTO analyses (event_id, version, tier, model, prompt_version, context, analysis, search_tags, search_region, is_latest)
        VALUES (
          ${eventId}, 4, ${entry.tier}, ${model}, ${ANALYSIS_PROMPT_VERSION},
          ${JSON.stringify(entry.facts)}::jsonb, ${JSON.stringify(analysis)}::jsonb,
          ${analysis.search_index?.tags ?? []},
          ${analysis.search_index?.region ?? null},
          true
        )
      `;
      stored++;
      if (stored % 100 === 0) process.stdout.write(`\r  Stored: ${stored}/${results.length}`);
    } catch (err: any) {
      failedIds.push(eventId);
      if (failedIds.length <= 10) console.error(`\n  ✗ ${eventId}: ${(err.message ?? '').slice(0, 80)}`);
    }
  }

  return { stored, failedIds };
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log('=== Namazue Pre-generation v4 (Grok Batch API — 50% off) ===');
  console.log('  Model: grok-4-1-fast-reasoning');
  console.log(`  Poll: ${POLL_INTERVAL_S}s | Max retries: ${MAX_RETRIES}`);
  if (DRY_RUN) console.log('  ** DRY RUN **');

  // ── Resume mode: just poll + collect an existing batch ──
  if (RESUME_BATCH_ID) {
    console.log(`\n  Resuming batch: ${RESUME_BATCH_ID}`);
    await pollUntilDone(RESUME_BATCH_ID);
    console.log('\n  Collecting results...');
    // Build a minimal factsMap from DB for merging
    const results = await getResults(RESUME_BATCH_ID);
    console.log(`  Retrieved ${results.length} results`);
    let stored = 0, errors = 0;
    for (const result of results) {
      const eventId = result.batch_request_id;
      try {
        const completion = result.batch_result?.response?.chat_get_completion;
        const raw = completion?.choices?.[0]?.message?.content;

        // Check if already stored
        const [existing] = await sql`SELECT id FROM analyses WHERE event_id = ${eventId} AND is_latest = true`;
        if (existing) { stored++; continue; }

        // Get event data and build facts on the fly
        const [event] = await sql`
          SELECT id, lat, lng, depth_km, magnitude, mag_type, time, place, place_ja,
                 fault_type, source, mt_strike, mt_dip, mt_rake, mt_strike2, mt_dip2, mt_rake2, tsunami
          FROM earthquakes WHERE id = ${eventId}`;
        if (!event) { errors++; continue; }

        let faults: any[] = [];
        try { faults = await sql`SELECT name_ja, name_en, fault_type, recurrence_years, estimated_mw, probability_30yr, ST_Distance(geom::geography, ST_MakePoint(${event.lng}, ${event.lat})::geography)/1000 as distance_km FROM active_faults WHERE geom IS NOT NULL ORDER BY geom <-> ST_MakePoint(${event.lng}, ${event.lat})::geometry LIMIT 3`; } catch {}

        const eventTime = new Date(event.time);
        const thirtyYearsAgo = new Date(eventTime.getTime() - 30 * 365.25 * 24 * 3600 * 1000);
        const [stats] = await sql`
          SELECT count(*)::int as total,
            count(*) filter (where magnitude >= 4 and magnitude < 5)::int as m4,
            count(*) filter (where magnitude >= 5 and magnitude < 6)::int as m5,
            count(*) filter (where magnitude >= 6 and magnitude < 7)::int as m6,
            count(*) filter (where magnitude >= 7)::int as m7plus,
            count(*) filter (where depth_km < 30)::int as shallow,
            count(*) filter (where depth_km >= 30 and depth_km < 70)::int as mid,
            count(*) filter (where depth_km >= 70 and depth_km < 300)::int as intermediate,
            count(*) filter (where depth_km >= 300)::int as deep
          FROM earthquakes
          WHERE time >= ${thirtyYearsAgo} AND time <= ${eventTime}
            AND sqrt(power(lat - ${event.lat}, 2) + power(lng - ${event.lng}, 2)) * 111 < 200
        `;
        const spatialStats = {
          total: stats.total,
          by_mag: { m4: stats.m4, m5: stats.m5, m6: stats.m6, m7plus: stats.m7plus },
          by_depth: { shallow: stats.shallow, mid: stats.mid, intermediate: stats.intermediate, deep: stats.deep },
        };
        const facts = buildFacts(event, faults, spatialStats);
        const tier = classifyTier(event.magnitude, isJapan(event.lat, event.lng));
        let hints: unknown = undefined;
        let model = 'grok-4.1-fast-reasoning-batch';
        if (result.batch_result?.error) {
          model = 'deterministic-fallback';
        }
        if (raw) {
          try {
            hints = normalizeAnalysisHints(typeof raw === 'string' ? JSON.parse(raw) : raw);
          } catch {
            model = 'deterministic-fallback';
          }
        } else {
          model = 'deterministic-fallback';
        }
        const analysis = buildCanonicalAnalysisFromFacts({
          event_id: eventId,
          tier,
          model,
          facts,
          hints,
          model_notes: buildModelNotes(facts),
          event: {
            magnitude: facts.event.mag,
            depth_km: facts.event.depth_km,
            lat: facts.event.lat,
            lng: facts.event.lon,
            place: facts.event.place_en,
            place_ja: facts.event.place_ja,
          },
        });

        await sql`INSERT INTO analyses (event_id, version, tier, model, prompt_version, context, analysis, search_tags, search_region, is_latest) VALUES (${eventId}, 4, ${tier}, ${model}, ${ANALYSIS_PROMPT_VERSION}, ${JSON.stringify(facts)}::jsonb, ${JSON.stringify(analysis)}::jsonb, ${analysis.search_index?.tags ?? []}, ${analysis.search_index?.region ?? null}, true)`;
        stored++;
        if (stored % 50 === 0) process.stdout.write(`\r  Stored: ${stored}`);
      } catch (err: any) {
        errors++;
        if (errors <= 10) console.error(`\n  ✗ ${eventId}: ${(err.message ?? '').slice(0, 80)}`);
      }
    }
    console.log(`\n  Resume complete: ✓${stored} stored, ✗${errors} errors`);
    return;
  }

  // ── Phase 0: Query pending events ──
  // Default: M5+ all time + M4+ within 3 years (no geographic filter)
  // REGEN=true: M4+ all time (for re-generating invalidated analyses)
  const events: any[] = REGEN_MODE
    ? await sql`
        SELECT e.id, e.lat, e.lng, e.depth_km, e.magnitude, e.mag_type,
               e.time, e.place, e.place_ja, e.fault_type, e.source,
               e.mt_strike, e.mt_dip, e.mt_rake,
               e.mt_strike2, e.mt_dip2, e.mt_rake2,
               e.tsunami
        FROM earthquakes e
        LEFT JOIN analyses a ON a.event_id = e.id AND a.is_latest = true
        WHERE a.id IS NULL AND e.magnitude >= 4
        ORDER BY e.magnitude DESC, e.time DESC
      `
    : await sql`
        SELECT e.id, e.lat, e.lng, e.depth_km, e.magnitude, e.mag_type,
               e.time, e.place, e.place_ja, e.fault_type, e.source,
               e.mt_strike, e.mt_dip, e.mt_rake,
               e.mt_strike2, e.mt_dip2, e.mt_rake2,
               e.tsunami
        FROM earthquakes e
        LEFT JOIN analyses a ON a.event_id = e.id AND a.is_latest = true
        WHERE a.id IS NULL
          AND (e.magnitude >= 5 OR (e.magnitude >= 4 AND e.time >= NOW() - INTERVAL '3 years'))
        ORDER BY e.magnitude DESC, e.time DESC
      `;

  let filtered = events;
  if (START_FROM) {
    const idx = filtered.findIndex((e: any) => e.id === START_FROM);
    if (idx >= 0) { filtered = filtered.slice(idx); console.log(`  Resume from ${START_FROM} (skipped ${idx})`); }
  }
  if (TIER_FILTER) {
    filtered = filtered.filter((e: any) => classifyTier(e.magnitude, isJapan(e.lat, e.lng)) === TIER_FILTER);
  }
  if (LIMIT) filtered = filtered.slice(0, LIMIT);

  const tiers = { S: 0, A: 0, B: 0 };
  for (const e of filtered) tiers[classifyTier(e.magnitude, isJapan(e.lat, e.lng))]++;
  console.log(`\n  Total pending: ${events.length}`);
  console.log(`  Processing: ${filtered.length} (S:${tiers.S} A:${tiers.A} B:${tiers.B})`);

  if (DRY_RUN || filtered.length === 0) return;

  // ── Phase 1: Build facts for all events ──
  console.log('\n── Phase 1: Building facts ──');
  const factsMap = new Map<string, { facts: any; tier: string }>();
  const CONCURRENCY = 20;

  for (let i = 0; i < filtered.length; i += CONCURRENCY) {
    const chunk = filtered.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (event: any) => {
      const tier = classifyTier(event.magnitude, isJapan(event.lat, event.lng));
      let faults: any[] = [];
      try {
        faults = await sql`
          SELECT id, name_ja, name_en, fault_type, recurrence_years,
                 last_activity, estimated_mw, probability_30yr,
                 ST_Distance(geom::geography, ST_MakePoint(${event.lng}, ${event.lat})::geography) / 1000 as distance_km
          FROM active_faults WHERE geom IS NOT NULL
          ORDER BY geom <-> ST_MakePoint(${event.lng}, ${event.lat})::geometry LIMIT 3
        `;
      } catch { /* PostGIS unavailable */ }

      const eventTime = new Date(event.time);
      const thirtyYearsAgo = new Date(eventTime.getTime() - 30 * 365.25 * 24 * 3600 * 1000);
      const [stats] = await sql`
        SELECT count(*)::int as total,
          count(*) filter (where magnitude >= 4 and magnitude < 5)::int as m4,
          count(*) filter (where magnitude >= 5 and magnitude < 6)::int as m5,
          count(*) filter (where magnitude >= 6 and magnitude < 7)::int as m6,
          count(*) filter (where magnitude >= 7)::int as m7plus,
          count(*) filter (where depth_km < 30)::int as shallow,
          count(*) filter (where depth_km >= 30 and depth_km < 70)::int as mid,
          count(*) filter (where depth_km >= 70 and depth_km < 300)::int as intermediate,
          count(*) filter (where depth_km >= 300)::int as deep
        FROM earthquakes
        WHERE time >= ${thirtyYearsAgo} AND time <= ${eventTime}
          AND sqrt(power(lat - ${event.lat}, 2) + power(lng - ${event.lng}, 2)) * 111 < 200
      `;

      const spatialStats = {
        total: stats.total,
        by_mag: { m4: stats.m4, m5: stats.m5, m6: stats.m6, m7plus: stats.m7plus },
        by_depth: { shallow: stats.shallow, mid: stats.mid, intermediate: stats.intermediate, deep: stats.deep },
      };

      const facts = buildFacts(event, faults, spatialStats);
      factsMap.set(event.id, { facts, tier });
    }));
    process.stdout.write(`\r  Facts: ${Math.min(i + CONCURRENCY, filtered.length)}/${filtered.length}`);
  }
  console.log(' ✓');

  // ── Phase 2+3+4: Submit → Poll → Collect → Retry loop ──
  // Split into sub-batches of BATCH_SIZE to avoid auth context expiration
  const BATCH_SIZE = 2000;
  let pendingIds = [...factsMap.keys()];
  let totalStored = 0;
  let round = 0;

  while (pendingIds.length > 0 && round < MAX_RETRIES) {
    round++;

    // Split into sub-batches
    const subBatches: string[][] = [];
    for (let i = 0; i < pendingIds.length; i += BATCH_SIZE) {
      subBatches.push(pendingIds.slice(i, i + BATCH_SIZE));
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  Round ${round}/${MAX_RETRIES}: ${pendingIds.length} events in ${subBatches.length} sub-batch(es)`);
    console.log('═'.repeat(50));

    const allFailedIds: string[] = [];

    for (let sb = 0; sb < subBatches.length; sb++) {
      const subIds = subBatches[sb];
      console.log(`\n  Sub-batch ${sb + 1}/${subBatches.length}: ${subIds.length} events`);

      const requests = subIds.map(id => {
        const { facts, tier } = factsMap.get(id)!;
        return buildBatchRequest(id, facts, tier);
      });

      // Submit
      const batchId = await submitBatch(
        `namazue-v4-r${round}-sb${sb + 1}-${subIds.length}`,
        requests,
      );

      // Poll
      await pollUntilDone(batchId);

      // Collect & store
      console.log('\n  Collecting results...');
      const { stored, failedIds } = await collectAndStore(batchId, factsMap);
      totalStored += stored;
      allFailedIds.push(...failedIds.filter(id => factsMap.has(id)));

      console.log(`\n  Sub-batch ${sb + 1}: ✓${stored} stored, ✗${failedIds.length} failed`);
      console.log(`  Cumulative: ${totalStored}/${factsMap.size} (${((totalStored / factsMap.size) * 100).toFixed(1)}%)`);
    }

    pendingIds = allFailedIds;

    if (pendingIds.length > 0 && round < MAX_RETRIES) {
      const waitSec = 30 * round;
      console.log(`\n  Waiting ${waitSec}s before retry...`);
      await sleep(waitSec * 1000);
    }
  }

  if (pendingIds.length > 0) {
    console.log(`\n⚠ ${pendingIds.length} events still failed after ${MAX_RETRIES} rounds.`);
    console.log('  Failed IDs saved to /tmp/namazue-failed-ids.json');
    const { writeFileSync } = await import('fs');
    writeFileSync('/tmp/namazue-failed-ids.json', JSON.stringify(pendingIds, null, 2));
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  FINAL: ${totalStored}/${factsMap.size} stored (${((totalStored / factsMap.size) * 100).toFixed(1)}%)`);
  console.log('═'.repeat(50));
}

main().catch(console.error);
