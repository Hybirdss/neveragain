/**
 * Test facts quality for specific events.
 * Generates facts using the fixed pipeline and validates them.
 *
 * Usage: DATABASE_URL=... npx tsx tools/test-facts-quality.ts
 */

import { neon } from '@neondatabase/serverless';
import {
  classifyLocation, inferFaultType as inferFaultTypeShared,
  assessTsunamiRisk as assessTsunamiRiskShared,
  computeMaxIntensity as computeMaxIntensityShared,
} from '@namazue/db';

const DATABASE_URL = process.env.DATABASE_URL!;
if (!DATABASE_URL) throw new Error('DATABASE_URL required');
const sql = neon(DATABASE_URL);

function isJapan(lat: number, lng: number): boolean {
  return lat >= 20 && lat <= 50 && lng >= 120 && lng <= 155;
}
function classifyBoundary(faultType?: string, depth?: number): string {
  if (faultType === 'interface') return 'subduction_interface';
  if (faultType === 'intraslab') return 'intraslab';
  if (faultType === 'crustal') return (depth ?? 0) > 30 ? 'intraplate_deep' : 'intraplate_shallow';
  return 'unknown';
}
function inferFaultType(d: number, lat: number, lng: number, p?: string, pj?: string) {
  return inferFaultTypeShared(d, lat, lng, p, pj);
}
function assessTsunamiRisk(m: number, d: number, ft?: string, lat?: number, lng?: number, p?: string, pj?: string, tf?: boolean) {
  return assessTsunamiRiskShared(m, d, ft, lat, lng, p, pj, tf);
}
function computeMaxIntensity(mag: number, depth_km: number, faultType: string, isOffshore: boolean, coastDistKm?: number | null) {
  return computeMaxIntensityShared(mag, depth_km, faultType, isOffshore, coastDistKm);
}

// Test events covering different error categories
const TEST_EVENT_IDS = [
  // Japan offshore — was misclassified as inland
  'us6000rmea',     // M6.8 122 km E of Yamada, Japan (offshore Iwate)
  'usp000gcjg',     // M7.0 107 km E of Namie, Japan (offshore Fukushima)
  // USGS tsunami flag contradiction
  'us20003k7a',     // M8.3 Chile — USGS tsunami=true
  // Global major event
  'official20041226005853450_30', // M9.1 Sumatra 2004
  // Japan inland — should stay inland
  'usp000hvnu',     // Kumamoto? (check)
  // Japan near-coast
  'us6000jk2t',     // check
];

interface ValidationResult {
  eventId: string;
  place: string;
  magnitude: number;
  depth: number;
  lat: number;
  lng: number;
  usgsTsunamiFlag: boolean;
  location: { type: string; confidence: string; coastDistanceKm: number | null; reason: string };
  faultType: string;
  tsunami: { risk: string; factors: string[] };
  maxIntensity: { value: number; class: string; is_offshore: boolean };
  issues: string[];
}

async function main() {
  console.log('=== Facts Quality Test ===\n');

  // Query a mix of events: some from the audit failures, some random
  const events: any[] = await sql`
    SELECT e.id, e.lat, e.lng, e.depth_km, e.magnitude, e.mag_type,
           e.time, e.place, e.place_ja, e.fault_type, e.source, e.tsunami,
           e.mt_strike, e.mt_dip, e.mt_rake
    FROM earthquakes e
    WHERE e.id = ANY(${[
      // offshore Japan that were wrongly inland
      'us6000rmea', 'usp000gcjg', 'us6000ruc4',
      // USGS tsunami flag events
      'us20003k7a', 'us2000ahv0',
      // Big global events
      'official20041226005853450_30', 'official20100227063411530_30',
      // 2024 Noto (inland, M7.6)
      'us6000m0xl',
      // Random M5-6 Japan events for baseline
      'us6000m6kz', 'us6000kzne',
    ]})
    ORDER BY e.magnitude DESC
  `;

  console.log(`Found ${events.length} test events\n`);

  const results: ValidationResult[] = [];

  for (const e of events) {
    const loc = classifyLocation(e.lat, e.lng, e.place, e.place_ja);
    const ft = e.fault_type || inferFaultType(e.depth_km, e.lat, e.lng, e.place, e.place_ja);
    const isOffshore = loc.type !== 'inland';
    const tsunami = assessTsunamiRisk(e.magnitude, e.depth_km, ft, e.lat, e.lng, e.place, e.place_ja, e.tsunami);
    const maxI = computeMaxIntensity(e.magnitude, e.depth_km, ft, isOffshore, loc.coastDistanceKm);

    const issues: string[] = [];

    // Validation checks
    // 1. Tsunami risk vs USGS flag
    if (e.tsunami === true && tsunami.risk === 'none') {
      issues.push('CRITICAL: USGS tsunami=true but risk=none');
    }

    // 2. Offshore M5.5+ should have tsunami risk
    if (isOffshore && e.magnitude >= 5.5 && tsunami.risk === 'none') {
      issues.push('WARN: Offshore M5.5+ with no tsunami risk');
    }

    // 3. Location sanity
    if (e.place && /offshore|沖|off.*coast/i.test(e.place + ' ' + (e.place_ja ?? '')) && loc.type === 'inland') {
      issues.push('CRITICAL: Place text says offshore but classified as inland');
    }
    if (e.place && /県[北南東西中]部/.test(e.place_ja ?? '') && loc.type === 'offshore') {
      issues.push('WARN: Japanese prefecture interior but classified as offshore');
    }

    // 4. Intensity sanity
    if (e.magnitude >= 7.0 && isJapan(e.lat, e.lng) && maxI.value < 3.0) {
      issues.push(`WARN: M${e.magnitude} Japan event with JMA intensity ${maxI.value}`);
    }

    // 5. Fault type sanity
    if (ft === 'interface' && loc.type === 'inland' && e.depth_km < 30) {
      issues.push('WARN: interface fault type for shallow inland event');
    }

    results.push({
      eventId: e.id,
      place: (e.place ?? '') + (e.place_ja ? ` (${e.place_ja})` : ''),
      magnitude: e.magnitude,
      depth: e.depth_km,
      lat: e.lat,
      lng: e.lng,
      usgsTsunamiFlag: e.tsunami ?? false,
      location: loc,
      faultType: ft,
      tsunami: { risk: tsunami.risk, factors: tsunami.factors },
      maxIntensity: { value: maxI.value, class: maxI.class, is_offshore: maxI.is_offshore },
      issues,
    });
  }

  // Print results
  let passCount = 0;
  let failCount = 0;

  for (const r of results) {
    const status = r.issues.length === 0 ? '✓ PASS' : '✗ FAIL';
    if (r.issues.length === 0) passCount++;
    else failCount++;

    console.log(`${'─'.repeat(70)}`);
    console.log(`${status} | M${r.magnitude} ${r.place.slice(0, 55)}`);
    console.log(`  Coords: (${r.lat}, ${r.lng}) depth=${r.depth}km | USGS tsunami: ${r.usgsTsunamiFlag}`);
    console.log(`  Location: ${r.location.type} (${r.location.confidence}) — ${r.location.reason}`);
    console.log(`  Fault type: ${r.faultType} | Boundary: ${classifyBoundary(r.faultType, r.depth)}`);
    console.log(`  Tsunami: risk=${r.tsunami.risk} | factors: ${r.tsunami.factors.join(', ')}`);
    console.log(`  Max intensity: JMA ${r.maxIntensity.class} (${r.maxIntensity.value}) | is_offshore: ${r.maxIntensity.is_offshore}`);
    if (r.issues.length > 0) {
      for (const issue of r.issues) {
        console.log(`  ⚠ ${issue}`);
      }
    }
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`RESULTS: ${passCount} passed, ${failCount} failed out of ${results.length} events`);
}

main().catch(console.error);
