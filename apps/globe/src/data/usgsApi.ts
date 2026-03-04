/**
 * usgsApi.ts — USGS Earthquake Catalog API client
 *
 * Fetches historical earthquake data from the FDSNWS Event service,
 * filters to the Japan bounding box, and converts USGS GeoJSON
 * features into the application's EarthquakeEvent model.
 */

import type { EarthquakeEvent, FaultType } from '../types';

// ── Japan bounding box ──────────────────────────────────────────
const JAPAN_BBOX = {
  minLat: 24,
  maxLat: 46,
  minLng: 122,
  maxLng: 150,
} as const;

const USGS_BASE_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const REQUEST_TIMEOUT_MS = 10_000;

// ── USGS GeoJSON shape (minimal typing for what we consume) ─────
interface USGSFeature {
  type: 'Feature';
  properties: {
    mag: number;
    place: string;
    time: number;
    url: string;
    tsunami: number;
    sig: number;
    magType: string;
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
}

// ── Fault-type classification ───────────────────────────────────

/** Known plate-boundary segments near Japan (simplified). */
const PLATE_BOUNDARY_SEGMENTS: Array<{
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}> = [
    // Japan Trench (Pacific–North American)
    { latMin: 34, latMax: 42, lngMin: 140, lngMax: 146 },
    // Nankai Trough (Philippine Sea–Eurasian)
    { latMin: 30, latMax: 35, lngMin: 131, lngMax: 140 },
    // Sagami Trough
    { latMin: 33, latMax: 36, lngMin: 138, lngMax: 142 },
    // Ryukyu Trench
    { latMin: 24, latMax: 31, lngMin: 125, lngMax: 132 },
    // Kuril–Kamchatka Trench
    { latMin: 42, latMax: 46, lngMin: 144, lngMax: 150 },
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

/**
 * Classify fault type from depth and location:
 *   - depth > 60 km → intraslab
 *   - depth ≤ 60 km AND near a known plate boundary → interface
 *     (subduction interface events extend to ~60 km along the slab)
 *   - else → crustal
 */
export function classifyFaultType(
  depth_km: number,
  lat: number,
  lng: number,
): FaultType {
  if (depth_km > 60) return 'intraslab';
  if (depth_km <= 60 && isNearPlateBoundary(lat, lng)) return 'interface';
  return 'crustal';
}

// ── USGS feature → EarthquakeEvent ──────────────────────────────

/** Convert a single USGS GeoJSON feature to an EarthquakeEvent. */
export function toEarthquakeEvent(feature: USGSFeature): EarthquakeEvent {
  const [lng, lat, depth] = feature.geometry.coordinates;
  return {
    id: feature.id,
    lat,
    lng,
    depth_km: depth,
    magnitude: feature.properties.mag,
    time: feature.properties.time,
    faultType: classifyFaultType(depth, lat, lng),
    tsunami: feature.properties.tsunami === 1,
    place: { text: feature.properties.place },
  };
}

// ── Public API ───────────────────────────────────────────────────

export interface HistoricalQuery {
  starttime: string; // ISO 8601 date
  endtime: string;   // ISO 8601 date
  minmagnitude?: number;
}

/**
 * Fetch historical earthquakes from the USGS Catalog API,
 * scoped to the Japan bounding box.
 *
 * Uses AbortController with a 10-second timeout. On network or
 * parsing failure the promise resolves to an empty array (errors
 * are logged to the console).
 */
export async function fetchHistoricalQuakes(
  query: HistoricalQuery,
): Promise<EarthquakeEvent[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      format: 'geojson',
      orderby: 'time',
      limit: '2000',
      minlatitude: String(JAPAN_BBOX.minLat),
      maxlatitude: String(JAPAN_BBOX.maxLat),
      minlongitude: String(JAPAN_BBOX.minLng),
      maxlongitude: String(JAPAN_BBOX.maxLng),
      starttime: query.starttime,
      endtime: query.endtime,
    });

    if (query.minmagnitude !== undefined) {
      params.set('minmagnitude', String(query.minmagnitude));
    }

    const url = `${USGS_BASE_URL}?${params.toString()}`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`USGS API responded with status ${response.status}`);
    }

    const data: USGSResponse = await response.json();
    return data.features.map(toEarthquakeEvent);
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('[usgsApi] Request timed out after', REQUEST_TIMEOUT_MS, 'ms');
    } else {
      console.error('[usgsApi] Failed to fetch historical quakes:', error);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}
