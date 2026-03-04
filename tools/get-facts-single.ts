import { neon } from '@neondatabase/serverless';
import fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = neon(DATABASE_URL);

function isJapan(lat: number, lng: number): boolean {
  return lat >= 20 && lat <= 50 && lng >= 120 && lng <= 155;
}
function classifyTier(mag: number, japan: boolean): 'S' | 'A' | 'B' {
  if (japan) return mag >= 7.0 ? 'S' : (mag >= 5.0 ? 'A' : 'B');
  return mag >= 8.0 ? 'S' : (mag >= 6.0 ? 'A' : 'B');
}
function classifyPlate(lat: number, lng: number): string {
  if (lng > 144 && lat > 30) return 'pacific';
  if (lng > 136 && lat < 34) return 'philippine';
  if (lat > 36 && lng < 144) return 'north_american';
  if (lat >= 20 && lat <= 50 && lng >= 120 && lng <= 155) return 'eurasian';
  return 'other';
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
  const ft = (faultType === 'crustal' || faultType === 'interface' || faultType === 'intraslab') ? faultType : 'crustal';
  const faultCorr: Record<string, number> = { crustal: 0.0, interface: -0.02, intraslab: 0.12 };
  const d = faultCorr[ft];
  const X = Math.sqrt(surfDistKm * surfDistKm + depth_km * depth_km);
  const logPgv = 0.58 * mw + 0.0038 * depth_km + d - Math.log10(X + 0.0028 * Math.pow(10, 0.5 * mw)) - 0.002 * X - 1.29;
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
    epicentral_max: Math.round(epicentralMax * 10) / 10, epicentral_max_class: toJmaClass(Math.round(epicentralMax * 10) / 10),
    is_offshore: isOffshore, coast_distance_km: isOffshore ? Math.round(coastDist) : null,
    scale: 'JMA' as const, source: 'gmpe_si_midorikawa_1999' as const,
    confidence: (mag >= 6 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
  };
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
function assessTsunamiRisk(mag: number, depth: number, faultType?: string, lat?: number, lng?: number) {
  const isOffshore = lng !== undefined && lat !== undefined && (lng > 142 || (lat! < 34 && lng > 136) || (lat! > 40 && lng > 140));
  if (!isOffshore) return { risk: 'none' as const, source: 'rule_engine', confidence: 'high' as const, factors: ['inland'] };
  if (mag >= 7.5 && depth < 60) return { risk: 'high' as const, source: 'rule_engine', confidence: 'high' as const, factors: ['M7.5+', 'shallow', 'offshore', ...(faultType === 'interface' ? ['interface'] : [])] };
  if (mag >= 6.5 && depth < 40) return { risk: 'moderate' as const, source: 'rule_engine', confidence: 'medium' as const, factors: ['M6.5+', 'shallow', 'offshore'] };
  if (mag >= 5.5) return { risk: 'low' as const, source: 'rule_engine', confidence: 'medium' as const, factors: ['M5.5+', 'offshore'] };
  return { risk: 'none' as const, source: 'rule_engine', confidence: 'high' as const, factors: ['small_offshore'] };
}
function computeOmori(mainMw: number) {
  const effectiveMw = Math.min(mainMw, 8.0);
  const p = 1.1, c = 0.05, a = -1.67, b = 0.91;
  const bathMax = Math.round((mainMw - 1.2) * 10) / 10;
  function cumRate(mMin: number, t0: number, t1: number): number {
    const coeff = Math.pow(10, a + b * (effectiveMw - mMin));
    if (Math.abs(p - 1) < 0.01) return coeff * Math.log((t1 + c) / (t0 + c));
    return coeff * (Math.pow(t1 + c, 1 - p) - Math.pow(t0 + c, 1 - p)) / (1 - p);
  }
  function cappedLambda(mMin: number, t0: number, t1: number, maxPerDay: number): number {
    const days = t1 - t0;
    const raw = cumRate(mMin, t0, t1);
    return Math.round(Math.min(raw, maxPerDay * days) * 100) / 100;
  }
  function toProb(lambda: number): number {
    return Math.round(Math.min(99, Math.max(0, (1 - Math.exp(-lambda)) * 100)) * 10) / 10;
  }
  const l24h_m4 = cappedLambda(4, 0, 1, 50), l7d_m4 = cappedLambda(4, 0, 7, 50);
  const l24h_m5 = cappedLambda(5, 0, 1, 10), l7d_m5 = cappedLambda(5, 0, 7, 10);
  return {
    omori_params: { p, c, k: Math.round(Math.pow(10, a + b * effectiveMw)), effective_mw: effectiveMw },
    bath_expected_max: bathMax,
    forecast: {
      lambda_24h_m4: l24h_m4, lambda_7d_m4: l7d_m4, lambda_24h_m5: l24h_m5, lambda_7d_m5: l7d_m5,
      p24h_m4plus: toProb(l24h_m4), p7d_m4plus: toProb(l7d_m4), p30d_m4plus: toProb(cappedLambda(4, 0, 30, 50)),
      p24h_m5plus: toProb(l24h_m5), p7d_m5plus: toProb(l7d_m5), p30d_m5plus: toProb(cappedLambda(5, 0, 30, 10)),
      expected_count_7d_m4: Math.round(l7d_m4), expected_count_7d_m5: Math.round(l7d_m5),
    },
    source: 'omori_rj1989', confidence: mainMw >= 6 ? 'medium' as const : 'low' as const,
  };
}
const TRENCHES = [
  { name: 'Japan Trench', segment: 'japan_trench', lat: 38, lng: 144 },
  { name: 'Nankai Trough', segment: 'nankai', lat: 33, lng: 135 },
  { name: 'Ryukyu Trench', segment: 'ryukyu', lat: 27, lng: 128 },
  { name: 'Izu-Bonin Trench', segment: 'izu_bonin', lat: 30, lng: 142 },
];
function findNearestTrench(lat: number, lng: number) {
  let nearest = TRENCHES[0], minDist = Infinity;
  for (const t of TRENCHES) {
    const d = Math.sqrt((lat - t.lat) ** 2 + (lng - t.lng) ** 2) * 111;
    if (d < minDist) { minDist = d; nearest = t; }
  }
  return { name: nearest.name, segment: nearest.segment, distance_km: Math.round(minDist) };
}

async function main() {
  const [event] = await sql`
    SELECT e.id, e.lat, e.lng, e.depth_km, e.magnitude, e.mag_type,
           e.time, e.place, e.place_ja, e.fault_type, e.source,
           e.mt_strike, e.mt_dip, e.mt_rake, e.mt_strike2, e.mt_dip2, e.mt_rake2
    FROM earthquakes e
    LEFT JOIN analyses a ON a.event_id = e.id AND a.is_latest = true
    WHERE a.id IS NULL AND e.magnitude >= 5 AND e.lat >= 20 AND e.lat <= 50 AND e.lng >= 120 AND e.lng <= 155
    ORDER BY e.magnitude DESC, e.time DESC LIMIT 1`;
  if (!event) { console.log("No pending earthquakes found."); return; }

  let faults: any[] = [];
  try { faults = await sql`SELECT id, name_ja, name_en, fault_type, recurrence_years, last_activity, estimated_mw, probability_30yr, ST_Distance(geom::geography, ST_MakePoint(${event.lng}, ${event.lat})::geography) / 1000 as distance_km FROM active_faults WHERE geom IS NOT NULL ORDER BY geom <-> ST_MakePoint(${event.lng}, ${event.lat})::geometry LIMIT 3`; } catch{}

  const eventTime = new Date(event.time);
  const thirtyYearsAgo = new Date(eventTime.getTime() - 30 * 365.25 * 24 * 3600 * 1000);
  const [stats] = await sql`
        SELECT count(*)::int as total,
          count(*) filter (where magnitude >= 4 and magnitude < 5)::int as m4, count(*) filter (where magnitude >= 5 and magnitude < 6)::int as m5, count(*) filter (where magnitude >= 6 and magnitude < 7)::int as m6, count(*) filter (where magnitude >= 7)::int as m7plus,
          count(*) filter (where depth_km < 30)::int as shallow, count(*) filter (where depth_km >= 30 and depth_km < 70)::int as mid, count(*) filter (where depth_km >= 70 and depth_km < 300)::int as intermediate, count(*) filter (where depth_km >= 300)::int as deep
        FROM earthquakes WHERE time >= ${thirtyYearsAgo} AND time <= ${eventTime} AND sqrt(power(lat - ${event.lat}, 2) + power(lng - ${event.lng}, 2)) * 111 < 200`;
  const spatialStats = { total: stats.total, by_mag: { m4: stats.m4, m5: stats.m5, m6: stats.m6, m7plus: stats.m7plus }, by_depth: { shallow: stats.shallow, mid: stats.mid, intermediate: stats.intermediate, deep: stats.deep } };

  const japan = isJapan(event.lat, event.lng);
  const depthClass = classifyDepthClass(event.depth_km);
  const trench = japan ? findNearestTrench(event.lat, event.lng) : null;
  const faultType = event.fault_type || inferFaultType(event.depth_km, event.lat, event.lng);
  const tsunami = assessTsunamiRisk(event.magnitude, event.depth_km, faultType, event.lat, event.lng);
  const aftershocks = computeOmori(event.magnitude);
  const isOffshore = event.lng > 142 || (event.lat < 34 && event.lng > 136) || (event.lat > 40 && event.lng > 140);
  const maxIntensity = computeMaxIntensity(event.magnitude, event.depth_km, faultType, isOffshore);

  const facts = {
    event: { id: event.id, mag: event.magnitude, mag_type: event.mag_type ?? 'mw', depth_km: event.depth_km, lat: event.lat, lon: event.lng, time: eventTime.toISOString(), place_en: event.place ?? '', place_ja: event.place_ja ?? event.place ?? '', source: event.source ?? 'usgs' },
    tectonic: { plate: classifyPlate(event.lat, event.lng), plate_pair: platePair(event.lat, event.lng), boundary_type: classifyBoundary(faultType, event.depth_km), boundary_segment: trench?.segment ?? null, nearest_trench: trench, nearest_fault: faults[0] ? { name_en: faults[0].name_en ?? '', name_ja: faults[0].name_ja ?? '', distance_km: Math.round(faults[0].distance_km * 10) / 10, estimated_mw: faults[0].estimated_mw, fault_type: faults[0].fault_type, recurrence_years: faults[0].recurrence_years, probability_30yr: faults[0].probability_30yr } : null, all_nearby_faults: faults.slice(0, 3).map((f: any) => ({ name_en: f.name_en ?? '', name_ja: f.name_ja ?? '', distance_km: Math.round(f.distance_km * 10) / 10, estimated_mw: f.estimated_mw, fault_type: f.fault_type })), depth_class: depthClass, is_japan: japan },
    mechanism: event.mt_strike != null ? { status: 'available' as const, strike: event.mt_strike, dip: event.mt_dip, rake: event.mt_rake, nodal_planes: [ { strike: event.mt_strike, dip: event.mt_dip, rake: event.mt_rake }, { strike: event.mt_strike2 ?? 0, dip: event.mt_dip2 ?? 0, rake: event.mt_rake2 ?? 0 } ], source: 'gcmt' } : { status: 'missing' as const, source: null },
    tsunami, aftershocks,
    spatial: spatialStats ? { total: spatialStats.total, by_mag: spatialStats.by_mag, by_depth: spatialStats.by_depth, avg_per_year: Math.round((spatialStats.total / 30) * 10) / 10 } : null,
    max_intensity: maxIntensity,
    ground_motion: { gmpe_model: 'Si_Midorikawa_1999', vs30: 400, site_class: 'stiff' },
    sources: { event_source: event.source ?? 'usgs', review_status: 'reviewed', shakemap_available: false, moment_tensor_source: event.mt_strike != null ? 'gcmt' : null },
    uncertainty: { mag_sigma: null as number | null, depth_sigma: null as number | null, location_uncert_km: null as number | null }
  };
  fs.writeFileSync('facts.json', JSON.stringify({tier: classifyTier(event.magnitude, true), facts}, null, 2));
  console.log('Facts written to facts.json');
}
main().catch(console.error);
