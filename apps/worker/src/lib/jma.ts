/**
 * JMA (気象庁) earthquake data poller.
 *
 * Fetches the public earthquake list from JMA BOSAI API and returns
 * parsed earthquake events in our internal format.
 *
 * JMA publishes earthquake information within 1-2 minutes of detection,
 * significantly faster than USGS for Japan-region events.
 */

const JMA_LIST_URL = 'https://www.jma.go.jp/bosai/quake/data/list.json';
const FETCH_TIMEOUT_MS = 10_000;

interface JmaEntry {
  eid: string;
  at: string;       // e.g. "2026-03-05T06:45:00+09:00"
  anm: string;      // area name (Japanese)
  en_anm?: string;  // area name (English) — may be absent
  cod: string;      // ISO 6709: "+42.6+143.0-100000/"
  mag: string;      // magnitude as string
  maxi: string;     // max JMA intensity
  ttl: string;      // title (e.g. "震源・震度情報")
  json: string;     // detail JSON path
}

export interface JmaQuake {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  time: string;       // ISO8601
  place: string;      // English name
  place_ja: string;   // Japanese name
  source: 'jma';
  mag_type: string;
  maxi: string | null;
}

/**
 * Parse JMA's ISO 6709 location code.
 * Format: "+42.6+143.0-100000/" → lat=42.6, lng=143.0, depth=100km
 * The depth value is in meters (negative = below surface).
 */
function parseJmaCod(cod: string): { lat: number; lng: number; depth_km: number } | null {
  if (!cod) return null;
  const match = cod.match(/^([+-][\d.]+)([+-][\d.]+)([+-]\d+)\//);
  if (!match) return null;

  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  const rawDepth = parseInt(match[3], 10);
  const depth_km = Math.abs(rawDepth) / 1000;

  if (isNaN(lat) || isNaN(lng) || isNaN(depth_km)) return null;
  if (lat < 20 || lat > 50 || lng < 120 || lng > 155) return null; // Japan bounds

  return { lat, lng, depth_km: Math.max(0, depth_km) };
}

/**
 * Fetch recent earthquakes from JMA's public API.
 * Returns parsed events with M2.5+ (our minimum threshold).
 */
export async function fetchJmaQuakes(): Promise<JmaQuake[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetch(JMA_LIST_URL, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    if (!resp.ok) {
      throw new Error(`JMA API ${resp.status}`);
    }

    const entries: JmaEntry[] = await resp.json();
    const results: JmaQuake[] = [];

    for (const entry of entries) {
      // Skip entries without location or magnitude
      if (!entry.cod || !entry.mag || entry.mag === '') continue;

      const loc = parseJmaCod(entry.cod);
      if (!loc) continue;

      const magnitude = parseFloat(entry.mag);
      if (isNaN(magnitude) || magnitude < 2.5) continue;

      const time = new Date(entry.at);
      if (isNaN(time.getTime())) continue;

      results.push({
        id: `jma-${entry.eid}`,
        lat: loc.lat,
        lng: loc.lng,
        depth_km: loc.depth_km,
        magnitude,
        time: time.toISOString(),
        place: entry.en_anm ?? entry.anm,
        place_ja: entry.anm,
        source: 'jma',
        mag_type: 'mj',
        maxi: entry.maxi && entry.maxi !== '' ? entry.maxi : null,
      });
    }

    return results;
  } finally {
    clearTimeout(timeout);
  }
}
