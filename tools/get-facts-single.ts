import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import {
  classifyLocation, inferFaultType as inferFaultTypeShared,
  assessTsunamiRisk as assessTsunamiRiskShared,
  computeMaxIntensity as computeMaxIntensityShared,
  computeOmori as computeOmoriShared,
} from '@namazue/db';

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
function computeMaxIntensity(mag: number, depth_km: number, faultType: string, isOffshore: boolean, coastDistKm?: number | null) {
  return computeMaxIntensityShared(mag, depth_km, faultType, isOffshore, coastDistKm);
}
function inferFaultType(depth_km: number, lat: number, lng: number, place?: string, place_ja?: string): string {
  return inferFaultTypeShared(depth_km, lat, lng, place, place_ja);
}
function assessTsunamiRisk(mag: number, depth: number, faultType?: string, lat?: number, lng?: number, place?: string, place_ja?: string, tsunamiFlag?: boolean) {
  return assessTsunamiRiskShared(mag, depth, faultType, lat, lng, place, place_ja, tsunamiFlag);
}
function computeOmori(mainMw: number) {
  return computeOmoriShared(mainMw);
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
           e.mt_strike, e.mt_dip, e.mt_rake, e.mt_strike2, e.mt_dip2, e.mt_rake2,
           e.tsunami
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
  const faultType = event.fault_type || inferFaultType(event.depth_km, event.lat, event.lng, event.place, event.place_ja);
  const tsunami = assessTsunamiRisk(event.magnitude, event.depth_km, faultType, event.lat, event.lng, event.place, event.place_ja, event.tsunami);
  const aftershocks = computeOmori(event.magnitude);
  const loc = classifyLocation(event.lat, event.lng, event.place, event.place_ja);
  const isOffshore = loc.type !== 'inland';
  const maxIntensity = computeMaxIntensity(event.magnitude, event.depth_km, faultType, isOffshore, loc.coastDistanceKm);

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
