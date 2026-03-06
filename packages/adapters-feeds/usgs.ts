import {
  type EarthquakeFeedRecord,
  isWithinJapanFeedBounds,
  toIsoTimestamp,
} from './earthquakes.ts';

const USGS_FEED_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson';
const FETCH_TIMEOUT_MS = 15_000;

export interface UsgsFeedFeature {
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
    coordinates: [number, number, number];
  };
}

interface UsgsFeedResponse {
  features: UsgsFeedFeature[];
}

export function normalizeUsgsFeature(feature: UsgsFeedFeature): EarthquakeFeedRecord | null {
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 3) {
    return null;
  }

  const [lng, lat, rawDepthKm] = coordinates;
  const magnitude = feature.properties?.mag;
  const time = toIsoTimestamp(feature.properties?.time);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isWithinJapanFeedBounds(lat, lng)) {
    return null;
  }
  if (!Number.isFinite(magnitude) || magnitude < 2.5) {
    return null;
  }
  if (!time || feature.properties?.status === 'deleted') {
    return null;
  }

  return {
    id: feature.id,
    lat,
    lng,
    depth_km: Number.isFinite(rawDepthKm) ? Math.max(0, rawDepthKm) : 0,
    magnitude,
    time,
    place: feature.properties?.place ?? '',
    place_ja: null,
    source: 'usgs',
    mag_type: feature.properties?.magType ?? 'ml',
    tsunami: feature.properties?.tsunami === 1,
    data_status: feature.properties?.status ?? 'automatic',
    maxi: null,
  };
}

export async function fetchUsgsEarthquakeFeed(
  fetchImpl: typeof fetch = fetch,
): Promise<EarthquakeFeedRecord[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetchImpl(USGS_FEED_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!resp.ok) {
      throw new Error(`USGS API ${resp.status}`);
    }

    const data = await resp.json() as UsgsFeedResponse;
    if (!Array.isArray(data.features)) {
      return [];
    }

    return data.features
      .map((feature) => normalizeUsgsFeature(feature))
      .filter((record): record is EarthquakeFeedRecord => record !== null);
  } finally {
    clearTimeout(timeout);
  }
}
