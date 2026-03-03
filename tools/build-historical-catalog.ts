/**
 * build-historical-catalog.ts — Fetch 30-year Japan M3+ catalog from USGS
 *
 * Fetches earthquake data from the USGS FDSNWS Event API in yearly chunks,
 * converts to compact EarthquakeEvent format, and writes a single JSON file.
 *
 * Output: public/data/historical-catalog.json
 *
 * Usage: npx tsx tools/build-historical-catalog.ts
 *
 * Note: Requires network access to USGS API. Takes several minutes due to
 * rate limiting and ~30 yearly requests.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'data');
const OUTPUT_FILE = join(OUTPUT_DIR, 'historical-catalog.json');

// ── Types ────────────────────────────────────────────────────────

type FaultType = 'crustal' | 'interface' | 'intraslab';

interface CatalogEvent {
  id: string;
  lat: number;
  lng: number;
  depth: number;
  mag: number;
  time: number;
  place: string;
  faultType: FaultType;
}

// ── USGS API ─────────────────────────────────────────────────────

const USGS_BASE_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

const JAPAN_BBOX = {
  minlatitude: 24,
  maxlatitude: 46,
  minlongitude: 122,
  maxlongitude: 150,
} as const;

const START_YEAR = 1994;
const END_YEAR = 2024;
const MIN_MAGNITUDE = 3;
const LIMIT_PER_REQUEST = 20000;
const REQUEST_DELAY_MS = 1500; // polite delay between requests

// ── Fault type classification ────────────────────────────────────
// Mirrors src/data/usgsApi.ts classifyFaultType()

const PLATE_BOUNDARY_SEGMENTS = [
  { latMin: 34, latMax: 42, lngMin: 140, lngMax: 146 }, // Japan Trench
  { latMin: 30, latMax: 35, lngMin: 131, lngMax: 140 }, // Nankai Trough
  { latMin: 33, latMax: 36, lngMin: 138, lngMax: 142 }, // Sagami Trough
  { latMin: 24, latMax: 31, lngMin: 125, lngMax: 132 }, // Ryukyu Trench
  { latMin: 42, latMax: 46, lngMin: 144, lngMax: 150 }, // Kuril-Kamchatka
];

function isNearPlateBoundary(lat: number, lng: number): boolean {
  return PLATE_BOUNDARY_SEGMENTS.some(
    (seg) =>
      lat >= seg.latMin &&
      lat <= seg.latMax &&
      lng >= seg.lngMin &&
      lng <= seg.lngMax,
  );
}

function classifyFaultType(depthKm: number, lat: number, lng: number): FaultType {
  if (depthKm > 60) return 'intraslab';
  if (depthKm <= 60 && isNearPlateBoundary(lat, lng)) return 'interface';
  return 'crustal';
}

// ── USGS GeoJSON types ───────────────────────────────────────────

interface USGSFeature {
  type: 'Feature';
  properties: {
    mag: number;
    place: string;
    time: number;
    tsunami: number;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number, number]; // [lng, lat, depth_km]
  };
  id: string;
}

interface USGSResponse {
  type: 'FeatureCollection';
  features: USGSFeature[];
  metadata?: {
    count: number;
  };
}

// ── Fetch helpers ────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchYear(year: number): Promise<CatalogEvent[]> {
  const starttime = `${year}-01-01`;
  const endtime = `${year + 1}-01-01`;

  const params = new URLSearchParams({
    format: 'geojson',
    starttime,
    endtime,
    minlatitude: String(JAPAN_BBOX.minlatitude),
    maxlatitude: String(JAPAN_BBOX.maxlatitude),
    minlongitude: String(JAPAN_BBOX.minlongitude),
    maxlongitude: String(JAPAN_BBOX.maxlongitude),
    minmagnitude: String(MIN_MAGNITUDE),
    limit: String(LIMIT_PER_REQUEST),
    orderby: 'time',
  });

  const url = `${USGS_BASE_URL}?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const resp = await fetch(url, { signal: controller.signal });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }

    const data: USGSResponse = await resp.json();
    const count = data.features.length;

    if (count >= LIMIT_PER_REQUEST) {
      console.warn(`  [warn] Year ${year}: hit limit (${count} events). Some events may be missing.`);
    }

    return data.features.map((f) => {
      const [lng, lat, depth] = f.geometry.coordinates;
      return {
        id: f.id,
        lat: parseFloat(lat.toFixed(4)),
        lng: parseFloat(lng.toFixed(4)),
        depth: parseFloat(depth.toFixed(1)),
        mag: parseFloat(f.properties.mag.toFixed(1)),
        time: f.properties.time,
        place: f.properties.place || '',
        faultType: classifyFaultType(depth, lat, lng),
      };
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error(`  [error] Year ${year}: request timed out`);
    } else {
      console.error(`  [error] Year ${year}:`, (err as Error).message);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ── Main ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Building historical earthquake catalog...');
  console.log(`  Range: ${START_YEAR}-${END_YEAR}, M>=${MIN_MAGNITUDE}`);
  console.log(`  Bounding box: ${JSON.stringify(JAPAN_BBOX)}`);
  console.log('');

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const allEvents: CatalogEvent[] = [];

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    process.stdout.write(`  Fetching ${year}... `);
    const events = await fetchYear(year);
    allEvents.push(...events);
    console.log(`${events.length} events (total: ${allEvents.length})`);

    // Polite delay between requests
    if (year < END_YEAR) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  // Sort by time descending (most recent first)
  allEvents.sort((a, b) => b.time - a.time);

  // Deduplicate by id
  const seen = new Set<string>();
  const deduped = allEvents.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  console.log('');
  console.log(`Total events: ${deduped.length} (${allEvents.length - deduped.length} duplicates removed)`);

  // Summary by fault type
  const byType: Record<FaultType, number> = { crustal: 0, interface: 0, intraslab: 0 };
  for (const e of deduped) byType[e.faultType]++;
  console.log(`  Crustal:   ${byType.crustal}`);
  console.log(`  Interface: ${byType.interface}`);
  console.log(`  Intraslab: ${byType.intraslab}`);

  writeFileSync(OUTPUT_FILE, JSON.stringify(deduped));
  const sizeMb = (Buffer.byteLength(JSON.stringify(deduped)) / (1024 * 1024)).toFixed(1);
  console.log(`\nWritten to ${OUTPUT_FILE} (${sizeMb} MB)`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
