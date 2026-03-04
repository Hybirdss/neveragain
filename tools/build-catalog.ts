/**
 * build-catalog.ts — Populate earthquakes table from USGS FDSNWS API
 *
 * Fetches:
 *   1. Japan region (lat 20-50, lng 120-155) M3+ from 1994-present
 *   2. Global M6+ from 1994-present (for comparison/analogs)
 *
 * Deduplicates by USGS event ID, generates PostGIS Points, inserts to Neon.
 *
 * Usage: npx tsx tools/build-catalog.ts
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL required in .env');

const sql = neon(DATABASE_URL);

// ── USGS API ──

const USGS_API = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

interface USGSFeature {
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    magType: string;
    type: string;
    tsunami: number;
  };
  geometry: {
    coordinates: [number, number, number]; // [lng, lat, depth_km]
  };
}

interface USGSResponse {
  features: USGSFeature[];
  metadata: { count: number };
}

async function fetchUSGS(params: Record<string, string>): Promise<USGSFeature[]> {
  const url = new URL(USGS_API);
  url.searchParams.set('format', 'geojson');
  url.searchParams.set('orderby', 'time-asc');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  console.log(`  Fetching: ${url.toString().slice(0, 120)}...`);
  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`USGS API error: ${resp.status} ${resp.statusText}`);

  const data: USGSResponse = await resp.json();
  console.log(`  → ${data.metadata.count} events`);
  return data.features;
}

// ── Fetch in yearly chunks to avoid API limits (20K per request) ──

async function fetchJapanCatalog(): Promise<USGSFeature[]> {
  const all: USGSFeature[] = [];
  const startYear = 1994;
  const endYear = new Date().getFullYear();

  console.log(`\n[Japan M3+] Fetching ${startYear}-${endYear}...`);

  for (let year = startYear; year <= endYear; year++) {
    const start = `${year}-01-01`;
    const end = year === endYear ? new Date().toISOString().slice(0, 10) : `${year + 1}-01-01`;

    try {
      const features = await fetchUSGS({
        starttime: start,
        endtime: end,
        minmagnitude: '3',
        minlatitude: '20',
        maxlatitude: '50',
        minlongitude: '120',
        maxlongitude: '155',
      });
      all.push(...features);
      console.log(`  ${year}: +${features.length} (total: ${all.length})`);
    } catch (err) {
      console.error(`  ${year}: FAILED`, err);
    }

    await sleep(200);
  }

  return all;
}

async function fetchGlobalM6(): Promise<USGSFeature[]> {
  const all: USGSFeature[] = [];
  const startYear = 1994;
  const endYear = new Date().getFullYear();

  console.log(`\n[Global M6+] Fetching ${startYear}-${endYear}...`);

  for (let year = startYear; year <= endYear; year++) {
    const start = `${year}-01-01`;
    const end = year === endYear ? new Date().toISOString().slice(0, 10) : `${year + 1}-01-01`;

    try {
      const features = await fetchUSGS({
        starttime: start,
        endtime: end,
        minmagnitude: '6',
      });
      all.push(...features);
      console.log(`  ${year}: +${features.length} (total: ${all.length})`);
    } catch (err) {
      console.error(`  ${year}: FAILED`, err);
    }

    await sleep(200);
  }

  return all;
}

// ── Insert to DB ──

async function insertBatch(events: USGSFeature[], source: string): Promise<number> {
  let inserted = 0;
  const CONCURRENCY = 10;

  for (let i = 0; i < events.length; i += CONCURRENCY) {
    const batch = events.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async (f) => {
        const [lng, lat, depthKm] = f.geometry.coordinates;
        const depth = Math.abs(depthKm ?? 0);
        const mag = f.properties.mag ?? 0;
        const magType = f.properties.magType || null;
        const place = f.properties.place || null;
        const time = new Date(f.properties.time).toISOString();
        const tsunami = f.properties.tsunami ? true : false;

        await sql`
          INSERT INTO earthquakes (
            id, lat, lng, depth_km, magnitude, mag_type, time,
            place, place_ja, fault_type, source, tsunami, geom
          ) VALUES (
            ${f.id}, ${lat}, ${lng}, ${depth}, ${mag}, ${magType},
            ${time}::timestamptz,
            ${place}, NULL, NULL, ${source}, ${tsunami},
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
          )
          ON CONFLICT (id) DO NOTHING
        `;
      })
    );

    inserted += results.filter(r => r.status === 'fulfilled').length;

    if (i % 2000 === 0 && i > 0) {
      console.log(`  Inserted ${inserted}/${events.length}...`);
    }
  }

  return inserted;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ──

async function main() {
  console.log('=== Seismic Japan Catalog Builder ===\n');

  // Check DB connection
  const connTest = await sql`SELECT NOW() as now`;
  console.log(`DB connected: ${connTest[0].now}`);

  // Check existing count
  const countResult = await sql`SELECT COUNT(*) as count FROM earthquakes`;
  const existing = Number(countResult[0].count);
  console.log(`Existing events: ${existing}`);

  if (existing > 50000) {
    console.log('Catalog already populated. Use --force to rebuild.');
    if (!process.argv.includes('--force')) return;
    console.log('Force rebuild: truncating...');
    await sql`TRUNCATE earthquakes CASCADE`;
  }

  // Fetch data
  const japanEvents = await fetchJapanCatalog();
  const globalEvents = await fetchGlobalM6();

  // Deduplicate (Japan events take priority for source attribution)
  const seen = new Set<string>();
  const dedupedJapan: USGSFeature[] = [];
  const dedupedGlobal: USGSFeature[] = [];

  for (const f of japanEvents) {
    if (f.properties.type !== 'earthquake') continue;
    if (!seen.has(f.id)) {
      seen.add(f.id);
      dedupedJapan.push(f);
    }
  }

  for (const f of globalEvents) {
    if (f.properties.type !== 'earthquake') continue;
    if (!seen.has(f.id)) {
      seen.add(f.id);
      dedupedGlobal.push(f);
    }
  }

  const totalDeduped = dedupedJapan.length + dedupedGlobal.length;
  console.log(`\nDeduplicated: ${totalDeduped} unique events`);
  console.log(`  Japan M3+: ${dedupedJapan.length}`);
  console.log(`  Global M6+ (non-Japan): ${dedupedGlobal.length}`);
  console.log(`  Overlap removed: ${japanEvents.length + globalEvents.length - totalDeduped}`);

  // Insert
  console.log('\nInserting to database...');

  const japanInserted = await insertBatch(dedupedJapan, 'usgs');
  console.log(`  Japan events inserted: ${japanInserted}`);

  const globalInserted = await insertBatch(dedupedGlobal, 'usgs');
  console.log(`  Global events inserted: ${globalInserted}`);

  // Verify
  const stats = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE magnitude >= 5) as m5plus,
      COUNT(*) FILTER (WHERE magnitude >= 6) as m6plus,
      COUNT(*) FILTER (WHERE magnitude >= 7) as m7plus
    FROM earthquakes
  `;

  console.log(`\n=== Catalog Stats ===`);
  console.log(`  Total:  ${stats[0].total}`);
  console.log(`  M5+:    ${stats[0].m5plus}`);
  console.log(`  M6+:    ${stats[0].m6plus}`);
  console.log(`  M7+:    ${stats[0].m7plus}`);
  console.log('\nDone!');
}

main().catch(console.error);
