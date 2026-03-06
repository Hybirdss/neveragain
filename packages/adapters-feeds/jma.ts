import {
  type EarthquakeFeedRecord,
  isWithinJapanFeedBounds,
  toIsoTimestamp,
} from './earthquakes.ts';

const JMA_LIST_URL = 'https://www.jma.go.jp/bosai/quake/data/list.json';
const FETCH_TIMEOUT_MS = 10_000;

export interface JmaListEntry {
  eid: string;
  at: string;
  anm: string;
  en_anm?: string;
  cod: string;
  mag: string;
  maxi: string;
  ttl: string;
  json: string;
}

export function parseJmaLocationCode(
  cod: string,
): { lat: number; lng: number; depth_km: number } | null {
  if (!cod) return null;

  const match = cod.match(/^([+-][\d.]+)([+-][\d.]+)([+-]\d+)\//);
  if (!match) {
    return null;
  }

  const lat = Number.parseFloat(match[1]);
  const lng = Number.parseFloat(match[2]);
  const rawDepth = Number.parseInt(match[3], 10);
  const depth_km = Math.abs(rawDepth) / 1000;

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(depth_km)) {
    return null;
  }
  if (!isWithinJapanFeedBounds(lat, lng)) {
    return null;
  }

  return { lat, lng, depth_km: Math.max(0, depth_km) };
}

export function normalizeJmaEntry(entry: JmaListEntry): EarthquakeFeedRecord | null {
  if (!entry.cod || !entry.mag) {
    return null;
  }

  const location = parseJmaLocationCode(entry.cod);
  if (!location) {
    return null;
  }

  const magnitude = Number.parseFloat(entry.mag);
  const time = toIsoTimestamp(entry.at);
  if (!Number.isFinite(magnitude) || magnitude < 2.5 || !time) {
    return null;
  }

  return {
    id: `jma-${entry.eid}`,
    lat: location.lat,
    lng: location.lng,
    depth_km: location.depth_km,
    magnitude,
    time,
    place: entry.en_anm ?? entry.anm,
    place_ja: entry.anm,
    source: 'jma',
    mag_type: 'mj',
    tsunami: false,
    data_status: 'automatic',
    maxi: entry.maxi && entry.maxi !== '' ? entry.maxi : null,
  };
}

export async function fetchJmaEarthquakeFeed(
  fetchImpl: typeof fetch = fetch,
): Promise<EarthquakeFeedRecord[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetchImpl(JMA_LIST_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!resp.ok) {
      throw new Error(`JMA API ${resp.status}`);
    }

    const entries = await resp.json() as JmaListEntry[];
    if (!Array.isArray(entries)) {
      return [];
    }

    const deduped = new Map<string, EarthquakeFeedRecord>();
    for (const entry of entries) {
      const record = normalizeJmaEntry(entry);
      if (record) {
        deduped.set(record.id, record);
      }
    }

    return [...deduped.values()];
  } finally {
    clearTimeout(timeout);
  }
}
