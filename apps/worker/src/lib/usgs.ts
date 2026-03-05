/**
 * USGS server-side earthquake poller.
 *
 * Fetches the USGS 7-day M2.5+ GeoJSON feed and returns parsed events
 * for Japan region ingestion into the DB.
 */

const USGS_FEED_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson';
const FETCH_TIMEOUT_MS = 15_000;

interface USGSFeature {
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    tsunami: number;
    magType: string;
    status: string;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number, number]; // [lng, lat, depth_km]
  };
}

export interface UsgsQuake {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  time: string;
  place: string;
  source: 'usgs';
  mag_type: string;
  tsunami: boolean;
  data_status: string;
}

function isJapanRegion(lat: number, lng: number): boolean {
  return lat >= 20 && lat <= 50 && lng >= 120 && lng <= 155;
}

/**
 * Fetch recent Japan-region earthquakes from USGS weekly feed.
 * Returns M2.5+ events within Japan bbox.
 */
export async function fetchUsgsQuakes(): Promise<UsgsQuake[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetch(USGS_FEED_URL, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    if (!resp.ok) {
      throw new Error(`USGS API ${resp.status}`);
    }

    const data = await resp.json() as { features: USGSFeature[] };
    if (!Array.isArray(data.features)) return [];

    const results: UsgsQuake[] = [];

    for (const f of data.features) {
      const [lng, lat, depth] = f.geometry.coordinates;
      if (!isJapanRegion(lat, lng)) continue;
      if (!Number.isFinite(f.properties.mag) || f.properties.mag < 2.5) continue;
      if (f.properties.status === 'deleted') continue;

      results.push({
        id: f.id,
        lat,
        lng,
        depth_km: Math.max(0, depth),
        magnitude: f.properties.mag,
        time: new Date(f.properties.time).toISOString(),
        place: f.properties.place ?? '',
        source: 'usgs',
        mag_type: f.properties.magType ?? 'ml',
        tsunami: f.properties.tsunami === 1,
        data_status: f.properties.status ?? 'automatic',
      });
    }

    return results;
  } finally {
    clearTimeout(timeout);
  }
}
