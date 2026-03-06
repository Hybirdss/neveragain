/**
 * seed-faults.ts — Populate active_faults table from GEM Global Active Faults
 *
 * Downloads GEM Global Active Faults GeoJSON from GitHub,
 * filters for Japan region (lat 20-50, lng 120-155),
 * and inserts into Neon active_faults table with PostGIS LineString geometries.
 *
 * Data source: GEM Foundation, CC BY-SA 4.0
 * https://github.com/GEMScienceTools/gem-global-active-faults
 *
 * Usage: npx tsx tools/seed-faults.ts
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL required in .env');

const sql = neon(DATABASE_URL);

const GEM_URL = 'https://raw.githubusercontent.com/GEMScienceTools/gem-global-active-faults/master/geojson/gem_active_faults.geojson';

// Japan bounding box (generous to include offshore faults)
const JAPAN_BOUNDS = {
  latMin: 20, latMax: 50,
  lngMin: 120, lngMax: 155,
};

interface GEMProperties {
  fid?: string;
  name?: string;
  name_ja?: string;
  catalog_id?: string;
  exposure_id?: string;
  slip_type?: string;        // 'Reverse' | 'Normal' | 'Strike-Slip' | 'Blind Thrust'
  net_slip_rate_min?: number;
  net_slip_rate_max?: number;
  net_slip_rate_pref?: number;
  average_dip?: string;
  average_rake?: string;
  length_min?: number;
  length_max?: number;
  length_pref?: number;
  upper_sm_depth_min?: number;
  upper_sm_depth_max?: number;
  lower_sm_depth_min?: number;
  lower_sm_depth_max?: number;
  recurrence_interval_min?: number;
  recurrence_interval_max?: number;
  recurrence_interval_pref?: number;
  last_movement?: string;
  [key: string]: unknown;
}

interface GEMFeature {
  type: 'Feature';
  properties: GEMProperties;
  geometry: {
    type: string;
    coordinates: number[][] | number[][][];
  };
}

interface GEMCollection {
  type: 'FeatureCollection';
  features: GEMFeature[];
}

function isInJapanRegion(feature: GEMFeature): boolean {
  const coords = feature.geometry.type === 'MultiLineString'
    ? (feature.geometry.coordinates as number[][][]).flat()
    : feature.geometry.coordinates as number[][];

  return coords.some(([lng, lat]) =>
    lat >= JAPAN_BOUNDS.latMin && lat <= JAPAN_BOUNDS.latMax &&
    lng >= JAPAN_BOUNDS.lngMin && lng <= JAPAN_BOUNDS.lngMax
  );
}

function mapSlipType(gemType?: string): string | null {
  if (!gemType) return null;
  const lower = gemType.toLowerCase();
  if (lower.includes('reverse') || lower.includes('thrust')) return 'reverse';
  if (lower.includes('normal')) return 'normal';
  if (lower.includes('strike')) return 'strike_slip';
  return lower;
}

function parseTupleValue(val?: string | number | null): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  // GEM format: "(value,,)" or "(min,pref,max)"
  const match = String(val).match(/\(([^,)]+)/);
  if (match) return parseFloat(match[1]) || null;
  const num = parseFloat(String(val));
  return isNaN(num) ? null : num;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calcFaultLength(feature: GEMFeature): number | null {
  const coords = feature.geometry.type === 'MultiLineString'
    ? (feature.geometry.coordinates as number[][][]).flat()
    : feature.geometry.coordinates as number[][];
  if (coords.length < 2) return null;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineKm(coords[i-1][1], coords[i-1][0], coords[i][1], coords[i][0]);
  }
  return Math.round(total * 10) / 10;
}

function estimateMw(lengthKm?: number | null): number | null {
  if (!lengthKm || lengthKm <= 0) return null;
  // Wells & Coppersmith (1994): Mw = 5.08 + 1.16 * log10(L)
  return Math.round((5.08 + 1.16 * Math.log10(lengthKm)) * 10) / 10;
}

// REMOVED: estimateProb30yr() — was using simplified Poisson P=1-exp(-30/R)
// which is NOT the official HERP method (BPT model with elapsed time).
// 30-year probabilities must come from HERP official evaluations only.
// For faults without HERP evaluation, probability is null (displayed as "未評価").

// REMOVED: estimateRecurrence() — was using brain-made displacement/slipRate
// which produced nonsensical values (e.g. 428510 years).
// Recurrence intervals must come from GEM data or HERP paleoseismic assessments.

function coordsToWKT(feature: GEMFeature): string {
  if (feature.geometry.type === 'MultiLineString') {
    const firstLine = (feature.geometry.coordinates as number[][][])[0];
    return `LINESTRING(${firstLine.map(([lng, lat]) => `${lng} ${lat}`).join(', ')})`;
  }
  const coords = feature.geometry.coordinates as number[][];
  return `LINESTRING(${coords.map(([lng, lat]) => `${lng} ${lat}`).join(', ')})`;
}

async function main() {
  console.log('=== Active Fault Seeder ===\n');

  // Check connection
  const connTest = await sql`SELECT NOW() as now`;
  console.log(`DB connected: ${connTest[0].now}`);

  // Check existing
  const existing = await sql`SELECT COUNT(*) as count FROM active_faults`;
  console.log(`Existing faults: ${existing[0].count}`);

  if (Number(existing[0].count) > 0 && !process.argv.includes('--force')) {
    console.log('Faults already seeded. Use --force to rebuild.');
    return;
  }

  if (process.argv.includes('--force')) {
    await sql`TRUNCATE active_faults`;
    console.log('Truncated active_faults table.');
  }

  // Download GEM data
  console.log('\nDownloading GEM Global Active Faults...');
  const resp = await fetch(GEM_URL);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);

  const data: GEMCollection = await resp.json();
  console.log(`Total faults globally: ${data.features.length}`);

  // Filter Japan region
  const japanFaults = data.features.filter(isInJapanRegion);
  console.log(`Japan region faults: ${japanFaults.length}`);

  // Insert
  let inserted = 0;
  const BATCH_SIZE = 20;

  for (let i = 0; i < japanFaults.length; i += BATCH_SIZE) {
    const batch = japanFaults.slice(i, i + BATCH_SIZE);

    for (const f of batch) {
      const p = f.properties;
      const id = String(p.catalog_id || p.fid || `gem_${i}_${inserted}`);
      const faultType = mapSlipType(p.slip_type);
      const lengthKm = calcFaultLength(f) ?? parseTupleValue(p.length_pref) ?? parseTupleValue(p.length_max) ?? null;
      const slipRate = parseTupleValue(p.net_slip_rate as string | undefined);
      // Recurrence: only from GEM data (no brain-made estimates)
      const recurrence = parseTupleValue(p.recurrence_interval_pref) ?? parseTupleValue(p.recurrence_interval_max) ?? null;
      const mw = estimateMw(lengthKm);
      // Probability: null for GEM faults — only HERP evaluations are authoritative
      const prob30 = null;
      const wkt = coordsToWKT(f);

      try {
        await sql`
          INSERT INTO active_faults (
            name_ja, name_en, fault_type,
            recurrence_years, last_activity, estimated_mw,
            probability_30yr, length_km, slip_rate, source, geom
          ) VALUES (
            ${p.name ?? null},
            ${p.name ?? null},
            ${faultType},
            ${recurrence},
            ${p.last_movement ?? null},
            ${mw},
            ${prob30},
            ${lengthKm},
            ${slipRate},
            ${'gem:' + id},
            ST_GeomFromText(${wkt}, 4326)
          )
        `;
        inserted++;
      } catch (err) {
        console.error(`  Failed to insert ${id}:`, (err as Error).message?.slice(0, 100));
      }
    }

    if (i % 100 === 0 && i > 0) {
      console.log(`  Inserted ${inserted}/${japanFaults.length}...`);
    }
  }

  console.log(`\nInserted: ${inserted} faults`);

  // Stats
  const stats = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE fault_type = 'reverse') as reverse,
      COUNT(*) FILTER (WHERE fault_type = 'normal') as normal,
      COUNT(*) FILTER (WHERE fault_type = 'strike_slip') as strike_slip,
      COUNT(*) FILTER (WHERE estimated_mw IS NOT NULL) as has_mw,
      COUNT(*) FILTER (WHERE probability_30yr IS NOT NULL) as has_prob
    FROM active_faults
  `;

  console.log('\n=== Fault Stats ===');
  console.log(`  Total:        ${stats[0].total}`);
  console.log(`  Reverse:      ${stats[0].reverse}`);
  console.log(`  Normal:       ${stats[0].normal}`);
  console.log(`  Strike-slip:  ${stats[0].strike_slip}`);
  console.log(`  Has Mw est:   ${stats[0].has_mw}`);
  console.log(`  Has 30yr P:   ${stats[0].has_prob}`);
  console.log('\nDone!');
}

main().catch(console.error);
