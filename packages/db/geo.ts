/**
 * Japan Geo Classification — Shared Module
 *
 * Accurate offshore/near-coast/inland classification for earthquake epicenters.
 * Used by: worker analysis pipeline, batch generation tools, facts builder.
 *
 * Algorithm:
 *   1. Parse USGS/JMA place text for geographic keywords (highest confidence)
 *   2. Island zone check for Ryukyu/Ogasawara/Izu archipelagos
 *   3. Geometric fallback: point-in-polygon test on Japan's 4 main island
 *      outlines + haversine distance to nearest coast reference
 */

// ── Types ──

export type LocationType = 'offshore' | 'near_coast' | 'inland';

export interface LocationClassification {
  type: LocationType;
  confidence: 'high' | 'medium';
  coastDistanceKm: number | null;
  reason: string;
}

export interface TsunamiRisk {
  risk: 'high' | 'moderate' | 'low' | 'none';
  source: 'rule_engine';
  confidence: 'high' | 'medium';
  factors: string[];
}

// ── Coastline Reference Points (for distance estimation only) ──

interface CoastRef {
  lat: number;
  lng: number;
  name: string;
}

const COAST_REFS: CoastRef[] = [
  // ── Hokkaido ──
  { lat: 42.5, lng: 145.0, name: 'Hokkaido-E' },
  { lat: 42.0, lng: 143.0, name: 'Hokkaido-SE' },
  { lat: 43.0, lng: 141.0, name: 'Hokkaido-W' },
  { lat: 45.5, lng: 142.0, name: 'Hokkaido-N' },
  { lat: 44.0, lng: 145.0, name: 'Hokkaido-NE' },
  { lat: 43.3, lng: 145.5, name: 'Nemuro' },
  // ── Honshu Pacific coast ──
  { lat: 41.0, lng: 141.5, name: 'Aomori' },
  { lat: 40.5, lng: 141.7, name: 'Hachinohe' },
  { lat: 39.5, lng: 142.0, name: 'Iwate' },
  { lat: 38.3, lng: 141.0, name: 'Sendai' },
  { lat: 38.3, lng: 141.5, name: 'Ishinomaki' },
  { lat: 37.0, lng: 141.0, name: 'Fukushima' },
  { lat: 36.3, lng: 140.8, name: 'Ibaraki' },
  { lat: 35.7, lng: 140.8, name: 'Chiba' },
  { lat: 35.3, lng: 140.0, name: 'Boso-tip' },
  { lat: 35.1, lng: 139.7, name: 'Miura' },
  { lat: 34.6, lng: 138.8, name: 'Izu' },
  { lat: 34.5, lng: 138.2, name: 'Suruga' },
  { lat: 34.7, lng: 137.0, name: 'Enshu' },
  { lat: 33.5, lng: 136.0, name: 'Kii-S' },
  { lat: 33.4, lng: 135.8, name: 'Kii-tip' },
  // ── Honshu Sea of Japan coast ──
  { lat: 41.0, lng: 140.0, name: 'Tsugaru' },
  { lat: 39.8, lng: 140.0, name: 'Akita' },
  { lat: 38.8, lng: 139.5, name: 'Yamagata' },
  { lat: 38.0, lng: 139.0, name: 'Niigata' },
  { lat: 37.5, lng: 137.3, name: 'Noto-tip' },
  { lat: 37.0, lng: 136.7, name: 'Noto-base' },
  { lat: 36.0, lng: 136.0, name: 'Fukui' },
  { lat: 35.5, lng: 134.5, name: 'Tottori' },
  { lat: 35.0, lng: 132.5, name: 'Shimane' },
  { lat: 34.5, lng: 131.0, name: 'Yamaguchi' },
  // ── Shikoku ──
  { lat: 33.3, lng: 134.2, name: 'Muroto' },
  { lat: 32.8, lng: 133.0, name: 'Ashizuri' },
  { lat: 34.3, lng: 134.0, name: 'Takamatsu' },
  { lat: 34.0, lng: 133.0, name: 'Niihama' },
  // ── Kyushu ──
  { lat: 33.0, lng: 131.8, name: 'Oita' },
  { lat: 31.9, lng: 131.5, name: 'Miyazaki' },
  { lat: 31.0, lng: 131.0, name: 'Kagoshima-S' },
  { lat: 33.5, lng: 130.0, name: 'Fukuoka' },
  { lat: 33.0, lng: 129.5, name: 'Nagasaki' },
  { lat: 32.0, lng: 130.0, name: 'Kumamoto' },
  // ── Inland Sea / Channels (denser for accuracy) ──
  { lat: 34.3, lng: 134.5, name: 'Seto-E' },
  { lat: 34.1, lng: 133.5, name: 'Seto-Mid' },
  { lat: 34.3, lng: 132.5, name: 'Onomichi' },
  { lat: 33.9, lng: 132.5, name: 'Imabari' },
  { lat: 33.5, lng: 132.0, name: 'Bungo-Channel' },
  { lat: 34.3, lng: 135.0, name: 'Kii-Channel' },
  // ── Okinawa/Ryukyu ──
  { lat: 26.5, lng: 128.0, name: 'Okinawa-E' },
  { lat: 26.3, lng: 127.5, name: 'Okinawa-W' },
  { lat: 26.7, lng: 127.8, name: 'Okinawa-N' },
  { lat: 24.8, lng: 125.3, name: 'Miyako-E' },
  { lat: 24.8, lng: 125.1, name: 'Miyako-W' },
  { lat: 24.3, lng: 124.2, name: 'Yaeyama-S' },
  { lat: 24.5, lng: 124.0, name: 'Yaeyama-W' },
  { lat: 24.5, lng: 124.4, name: 'Yaeyama-E' },
  { lat: 28.4, lng: 129.5, name: 'Amami-E' },
  { lat: 28.3, lng: 129.3, name: 'Amami-W' },
  { lat: 30.4, lng: 130.5, name: 'Yakushima-E' },
  { lat: 30.3, lng: 130.4, name: 'Yakushima-W' },
];

// ── Japan Land Polygons (simplified, ~15-20km accuracy) ──
// Used for point-in-polygon tests to determine land vs sea.
// Each polygon traces a main island clockwise as [lat, lng] pairs.
// Accuracy within 30km of coast doesn't matter — both "near_coast"
// regardless of which side of the polygon boundary the point falls on.

type LatLng = [number, number];

const HOKKAIDO: LatLng[] = [
  [41.4, 140.1],  // Cape Shirakami (SW tip)
  [42.0, 140.7],  // Hakodate
  [42.0, 141.5],  // Tomakomai
  [42.3, 143.0],  // Obihiro
  [43.0, 144.5],  // Kushiro
  [43.2, 145.3],  // Nemuro west (captures peninsula)
  [43.4, 145.8],  // Cape Nosappu (Nemuro tip)
  [43.6, 145.3],  // Nemuro north
  [44.2, 145.0],  // Shiretoko
  [44.8, 143.2],  // Abashiri/Monbetsu
  [45.5, 142.0],  // Cape Soya
  [44.5, 141.7],  // South of Soya
  [43.3, 140.4],  // Rumoi
  [42.5, 140.0],  // West coast
  [42.1, 140.3],  // Oshima Peninsula west
];

const HONSHU: LatLng[] = [
  // Pacific coast (NE → SW)
  [41.5, 141.0],  // Shimokita
  [40.5, 141.7],  // Hachinohe
  [39.6, 142.1],  // Miyako
  [38.3, 141.5],  // Sendai
  [37.0, 141.0],  // Iwaki
  [36.4, 140.8],  // Ibaraki
  [35.8, 140.9],  // Choshi
  [35.3, 140.0],  // Boso
  [35.1, 139.7],  // Miura
  [35.1, 139.1],  // Odawara
  [34.6, 138.8],  // Izu Peninsula tip
  [34.8, 138.2],  // Shizuoka
  [34.7, 137.0],  // Enshu
  [34.3, 136.5],  // Shima
  [33.5, 136.0],  // Kii east
  [33.4, 135.8],  // Kii south tip
  [33.5, 135.0],  // Kii west
  [34.0, 135.1],  // Wakayama
  // Inland Sea coast (E → W)
  [34.4, 135.0],  // Osaka
  [34.7, 134.8],  // Akashi
  [34.7, 134.0],  // Himeji
  [34.5, 133.5],  // Okayama
  [34.3, 133.0],  // Fukuyama
  [34.2, 132.5],  // Hiroshima
  [34.0, 131.5],  // Yamaguchi south
  [33.9, 131.0],  // Shimonoseki
  // Sea of Japan coast (SW → NE)
  [34.3, 131.0],  // Hagi
  [34.7, 131.5],  // Masuda
  [35.0, 132.2],  // Hamada
  [35.3, 132.7],  // Izumo
  [35.5, 133.5],  // Tottori
  [35.6, 134.5],  // Toyooka
  [35.7, 135.2],  // Tango
  [35.8, 135.7],  // Maizuru
  [36.1, 136.0],  // Tsuruga
  [36.5, 136.6],  // Kanazawa
  [37.0, 136.7],  // Noto base W
  [37.5, 137.3],  // Noto tip
  [37.2, 137.0],  // Noto base E
  [37.8, 138.5],  // Joetsu
  [38.0, 139.0],  // Niigata
  [38.8, 139.5],  // Sakata
  [39.7, 140.0],  // Akita
  [40.5, 140.0],  // Noshiro
  [41.0, 140.2],  // Tsugaru W
  [41.4, 140.5],  // Tsugaru N
];

const SHIKOKU: LatLng[] = [
  [34.3, 134.5],  // Naruto (NE)
  [33.8, 134.7],  // East coast
  [33.3, 134.2],  // Cape Muroto
  [32.8, 133.0],  // Cape Ashizuri
  [33.3, 132.3],  // SW coast
  [33.6, 132.0],  // Bungo Channel
  [33.9, 132.7],  // Matsuyama
  [34.2, 133.5],  // Niihama
  [34.4, 134.0],  // Takamatsu
];

const KYUSHU: LatLng[] = [
  [33.9, 131.0],  // Kitakyushu (NE)
  [33.5, 131.6],  // Oita
  [33.0, 131.8],  // Saiki
  [32.7, 132.0],  // Nobeoka
  [31.9, 131.5],  // Miyazaki
  [31.3, 131.2],  // Shibushi
  [30.7, 131.0],  // Cape Sata
  [31.3, 130.3],  // Kagoshima
  [32.0, 130.0],  // Kumamoto/Amakusa
  [32.7, 129.7],  // Nagasaki
  [33.2, 129.5],  // Sasebo
  [33.5, 129.8],  // Karatsu
  [33.6, 130.4],  // Fukuoka
];

const MAIN_ISLAND_POLYGONS: LatLng[][] = [HOKKAIDO, HONSHU, SHIKOKU, KYUSHU];

/**
 * Ray-casting point-in-polygon test.
 * Counts how many times a ray from the point to the right crosses the polygon boundary.
 * Odd count = inside, even count = outside.
 */
function pointInPolygon(lat: number, lng: number, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    if (((yi > lat) !== (yj > lat)) &&
        (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Check if a point is on one of Japan's 4 main islands
 * (Hokkaido, Honshu, Shikoku, Kyushu).
 */
function isOnMainIsland(lat: number, lng: number): boolean {
  for (const poly of MAIN_ISLAND_POLYGONS) {
    if (pointInPolygon(lat, lng, poly)) return true;
  }
  return false;
}

// ── Place Text Parsing ──

const OFFSHORE_PATTERN = /\boffshore\b|off\s+(the\s+)?(east|west|south|north|se|sw|ne|nw)?\s*coast|沖(?!縄)|海溝/i;
const NEAR_COAST_PATTERN = /near\s+(the\s+)?(\w+\s+)?coast|近海|水道|channel|strait|海峡|灘|湾|sea\s+of\s+japan|日本海|east\s+china\s+sea|東シナ海|半島/i;
// USGS directional place text: "south of X", "47 km SSE of Nago", "79 km E of Naze"
// All 16 compass points (uppercase, USGS convention) + full cardinal names (case-insensitive)
const USGS_DIRECTIONAL_PATTERN = /(?:\d+\s*km\s+)?(?:[Ss]outh|[Nn]orth|[Ee]ast|[Ww]est|NNE|NE|ENE|ESE|SE|SSE|SSW|SW|WSW|WNW|NW|NNW|[NSEW])\s+of\s+/;
const INLAND_PATTERN = /県[北南東西中]部|県.+地方|地方$|市$|区$|町$|村$/i;

// ── Island / Archipelago Zones ──
// These zones are small islands surrounded by ocean. "inland" is impossible.
// Any epicenter in these bounding boxes defaults to near_coast/offshore.

interface IslandZone {
  name: string;
  latMin: number; latMax: number;
  lngMin: number; lngMax: number;
}

const ISLAND_ZONES: IslandZone[] = [
  // Ryukyu chain: Okinawa, Miyako, Yaeyama, Amami
  { name: 'Ryukyu', latMin: 23.0, latMax: 30.0, lngMin: 122.0, lngMax: 132.0 },
  // Ogasawara (Bonin) islands
  { name: 'Ogasawara', latMin: 24.0, latMax: 28.0, lngMin: 140.0, lngMax: 143.0 },
  // Izu islands (south of Tokyo)
  { name: 'Izu-Islands', latMin: 30.0, latMax: 34.5, lngMin: 138.5, lngMax: 141.0 },
];

function isInIslandZone(lat: number, lng: number): IslandZone | null {
  for (const zone of ISLAND_ZONES) {
    if (lat >= zone.latMin && lat <= zone.latMax &&
        lng >= zone.lngMin && lng <= zone.lngMax) {
      return zone;
    }
  }
  return null;
}

/**
 * Classify earthquake epicenter as offshore, near-coast, or inland.
 *
 * Uses USGS/JMA place text as primary signal (highest accuracy),
 * with geometric fallback using Japan coastline reference points.
 */
export function classifyLocation(
  lat: number,
  lng: number,
  place?: string,
  place_ja?: string,
): LocationClassification {
  const text = `${place ?? ''} ${place_ja ?? ''}`.trim();

  // 1. Text-based classification (highest confidence)
  if (text) {
    if (OFFSHORE_PATTERN.test(text)) {
      const dist = estimateCoastDistance(lat, lng);
      return {
        type: 'offshore',
        confidence: 'high',
        coastDistanceKm: dist,
        reason: `Place text indicates offshore: "${text.slice(0, 60)}"`,
      };
    }

    if (NEAR_COAST_PATTERN.test(text)) {
      const dist = estimateCoastDistance(lat, lng);
      return {
        type: 'near_coast',
        confidence: 'high',
        coastDistanceKm: dist,
        reason: `Place text indicates near-coast: "${text.slice(0, 60)}"`,
      };
    }

    // USGS directional text like "south of Miyakojima" or "47 km SSE of Nago"
    // These indicate the epicenter is relative to a place, likely offshore or near-coast
    if (USGS_DIRECTIONAL_PATTERN.test(text)) {
      const dist = estimateCoastDistance(lat, lng);
      // For non-Japan events, dist is null — classify as offshore (safe default)
      const type = (dist != null && dist <= 50) ? 'near_coast' : 'offshore';
      return {
        type,
        confidence: 'medium',
        coastDistanceKm: dist,
        reason: `USGS directional place text (${type}): "${text.slice(0, 60)}"`,
      };
    }

    // Inland only if NO sea-related keywords AND not in an island zone
    if (INLAND_PATTERN.test(text) && !OFFSHORE_PATTERN.test(text) && !NEAR_COAST_PATTERN.test(text)) {
      // Island zones can never be "inland"
      const island = isInIslandZone(lat, lng);
      if (island) {
        const dist = estimateCoastDistance(lat, lng);
        return {
          type: 'near_coast',
          confidence: 'medium',
          coastDistanceKm: dist,
          reason: `Island zone (${island.name}) — cannot be inland: "${text.slice(0, 60)}"`,
        };
      }
      const dist = estimateCoastDistance(lat, lng);
      return {
        type: 'inland',
        confidence: 'high',
        coastDistanceKm: dist,
        reason: `Place text indicates inland: "${text.slice(0, 60)}"`,
      };
    }
  }

  // 2. Island zone check before geometric fallback
  const island = isInIslandZone(lat, lng);
  if (island) {
    const dist = estimateCoastDistance(lat, lng);
    const type = (dist != null && dist > 50) ? 'offshore' : 'near_coast';
    return {
      type,
      confidence: 'medium',
      coastDistanceKm: dist,
      reason: `Island zone (${island.name}), ~${dist ?? '?'}km from nearest coast ref`,
    };
  }

  // 3. Geometric fallback
  return classifyByGeometry(lat, lng);
}

/**
 * Estimate distance to nearest coastline reference point (km).
 * Returns null for non-Japan events (coast refs are Japan-specific).
 */
function estimateCoastDistance(lat: number, lng: number): number | null {
  // Coast refs are Japan-specific — nonsensical for distant events
  if (lat < 20 || lat > 50 || lng < 120 || lng > 155) return null;
  let minDist = Infinity;
  for (const ref of COAST_REFS) {
    const d = haversineKm(lat, lng, ref.lat, ref.lng);
    if (d < minDist) minDist = d;
  }
  return Math.round(minDist);
}

/**
 * Haversine distance in km.
 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Geometric classification using land polygons + coast distance.
 *
 * No sea-direction vectors — uses point-in-polygon for definitive land/sea
 * determination, combined with haversine distance to coast reference points.
 *
 * The polygon has ~15-20km accuracy, but this doesn't matter:
 * points within 30km of coast are classified as "near_coast" regardless
 * of which side of the polygon boundary they fall on.
 */
function classifyByGeometry(lat: number, lng: number): LocationClassification {
  // Not in Japan region at all
  if (lat < 20 || lat > 50 || lng < 120 || lng > 155) {
    return {
      type: 'offshore',
      confidence: 'medium',
      coastDistanceKm: null,
      reason: 'Outside Japan region',
    };
  }

  // We're in Japan region (checked above), so coast distance is always available
  const dist = estimateCoastDistance(lat, lng)!;
  const onLand = isOnMainIsland(lat, lng);

  if (onLand) {
    // On a main island: inland or near_coast depending on distance
    if (dist < 30) {
      return {
        type: 'near_coast',
        confidence: 'medium',
        coastDistanceKm: dist,
        reason: `On main island, near coast (~${dist}km)`,
      };
    }
    return {
      type: 'inland',
      confidence: 'medium',
      coastDistanceKm: dist,
      reason: `On main island, ~${dist}km from coast`,
    };
  }

  // Not on a main island polygon: at sea
  if (dist <= 50) {
    return {
      type: 'near_coast',
      confidence: 'medium',
      coastDistanceKm: dist,
      reason: `At sea, near coast (~${dist}km)`,
    };
  }

  return {
    type: 'offshore',
    confidence: 'medium',
    coastDistanceKm: dist,
    reason: `Offshore, ~${dist}km from coast`,
  };
}

// ── Fault Type Inference ──

/**
 * Infer fault type from depth, location, and place text.
 * Uses classifyLocation for offshore detection instead of crude rectangles.
 */
export function inferFaultType(
  depth_km: number,
  lat: number,
  lng: number,
  place?: string,
  place_ja?: string,
): string {
  const loc = classifyLocation(lat, lng, place, place_ja);
  const isOffshore = loc.type === 'offshore' || loc.type === 'near_coast';

  if (isOffshore) {
    if (depth_km < 60) return 'interface';
    if (depth_km >= 60 && depth_km < 200) return 'intraslab';
  }
  if (depth_km < 30) return 'crustal';
  if (depth_km >= 60 && depth_km < 300) return 'intraslab';
  return 'crustal';
}

// ── Tsunami Risk Assessment ──

/**
 * Assess tsunami risk from earthquake parameters.
 * Uses classifyLocation for accurate offshore detection.
 * Respects USGS tsunami flag as authoritative override.
 *
 * Rules (simplified from JMA criteria):
 * - M7.5+ shallow (<60km) offshore reverse fault → high
 * - M6.5+ shallow (<40km) offshore → moderate
 * - M5.5+ offshore or near_coast → low
 * - USGS tsunami=true overrides to at least "low"
 * - Otherwise → none
 */
export function assessTsunamiRisk(
  magnitude: number,
  depth_km: number,
  faultType?: string,
  lat?: number,
  lng?: number,
  place?: string,
  place_ja?: string,
  usgsTsunamiFlag?: boolean,
): TsunamiRisk {
  if (lat === undefined || lng === undefined) {
    return { risk: 'none', source: 'rule_engine', confidence: 'medium', factors: ['Location unknown'] };
  }

  // Deep events (>300km) cannot generate tsunamis — no seafloor displacement at these depths
  if (depth_km > 300) {
    const factors = [`Deep earthquake (${depth_km}km) — no seafloor displacement possible`];
    if (usgsTsunamiFlag === true) {
      factors.push('Note: USGS tsunami advisory was issued despite deep focus');
    }
    return { risk: 'none', source: 'rule_engine', confidence: 'high', factors };
  }

  const loc = classifyLocation(lat, lng, place, place_ja);
  const factors: string[] = [];
  const distStr = loc.coastDistanceKm !== null ? ` (~${loc.coastDistanceKm}km from coast)` : '';

  if (loc.type === 'inland') {
    // Even for inland, if USGS flags tsunami, respect it
    if (usgsTsunamiFlag === true) {
      return {
        risk: 'low',
        source: 'rule_engine',
        confidence: 'medium',
        factors: [`USGS tsunami advisory issued`, `Inland epicenter${distStr}`],
      };
    }
    return {
      risk: 'none',
      source: 'rule_engine',
      confidence: loc.confidence,
      factors: [`Inland epicenter${distStr}`],
    };
  }

  const locLabel = loc.type === 'offshore'
    ? `Offshore epicenter${distStr}`
    : `Near-coast epicenter${distStr}`;
  factors.push(locLabel);

  if (magnitude >= 7.5 && depth_km < 60) {
    factors.push(`Large magnitude (M${magnitude})`);
    factors.push(`Shallow depth (${depth_km}km)`);
    if (faultType === 'interface') {
      factors.push('Subduction interface mechanism');
    }
    return { risk: 'high', source: 'rule_engine', confidence: 'high', factors };
  }

  if (magnitude >= 6.5 && depth_km < 40) {
    factors.push(`Moderate magnitude (M${magnitude})`);
    factors.push(`Shallow depth (${depth_km}km)`);
    return { risk: 'moderate', source: 'rule_engine', confidence: 'medium', factors };
  }

  if (magnitude >= 5.5) {
    factors.push(`Magnitude M${magnitude}`);
    return { risk: 'low', source: 'rule_engine', confidence: 'medium', factors };
  }

  // M5.0-5.5 shallow offshore — low risk (JMA would still assess)
  if (magnitude >= 5.0 && depth_km < 70) {
    factors.push(`Magnitude M${magnitude}`);
    factors.push(`Shallow depth (${depth_km}km)`);
    return { risk: 'low', source: 'rule_engine', confidence: 'medium', factors };
  }

  // Small event but USGS flagged tsunami
  if (usgsTsunamiFlag === true) {
    factors.push('USGS tsunami advisory issued');
    return { risk: 'low', source: 'rule_engine', confidence: 'medium', factors };
  }

  return { risk: 'none', source: 'rule_engine', confidence: 'high', factors: [`Small ${loc.type} event${distStr}`] };
}

// ── JMA Intensity Scale ──

export function toJmaClass(i: number): string {
  if (i >= 6.5) return '7';
  if (i >= 6.0) return '6+';
  if (i >= 5.5) return '6-';
  if (i >= 5.0) return '5+';
  if (i >= 4.5) return '5-';
  if (i >= 3.5) return '4';
  if (i >= 2.5) return '3';
  if (i >= 1.5) return '2';
  if (i >= 0.5) return '1';
  return '0';
}

// ── GMPE: Si & Midorikawa (1999) ──

/**
 * Point-source PGV estimation using Si & Midorikawa (1999) GMPE.
 * Calibrated for Japan events up to ~M8; extrapolation beyond is approximate.
 */
export function gmpeIntensityAt(mw: number, depth_km: number, surfDistKm: number, faultType: string): number {
  const ft = (faultType === 'crustal' || faultType === 'interface' || faultType === 'intraslab')
    ? faultType : 'crustal';
  const faultCorr: Record<string, number> = { crustal: 0.0, interface: -0.02, intraslab: 0.12 };
  const d = faultCorr[ft];
  const X = Math.sqrt(surfDistKm * surfDistKm + depth_km * depth_km);
  const logPgv = 0.58 * mw + 0.0038 * depth_km + d
    - Math.log10(X + 0.0028 * Math.pow(10, 0.5 * mw))
    - 0.002 * X - 1.29;
  const pgv600 = Math.pow(10, logPgv);
  const pgvSurface = pgv600 * 1.41;
  return pgvSurface > 0 ? 2.43 + 1.82 * Math.log10(pgvSurface) : 0;
}

export interface MaxIntensityResult {
  value: number;
  class: string;
  epicentral_max: number;
  epicentral_max_class: string;
  is_offshore: boolean;
  coast_distance_km: number | null;
  scale: 'JMA';
  source: 'gmpe_si_midorikawa_1999';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Compute maximum JMA intensity from earthquake parameters.
 *
 * Changes from old code:
 * - Mw cap raised from 8.3 to 9.5 (allows M9+ differentiation)
 * - Confidence set to 'low' for M8+ or depth > 300km (outside GMPE calibration range)
 * - Optional coastDistanceKm for more accurate offshore intensity
 */
export function computeMaxIntensity(
  mag: number, depth_km: number, faultType: string, isOffshore: boolean,
  coastDistanceKm?: number | null,
): MaxIntensityResult {
  const mw = Math.min(mag, 9.5);
  const distances = [1, 5, 10, 20, 30, 50, 75, 100, 150, 200, 300];
  let epicentralMax = 0;
  for (const d of distances) {
    const i = gmpeIntensityAt(mw, depth_km, d, faultType);
    if (i > epicentralMax) epicentralMax = i;
  }

  const coastDist = isOffshore
    ? (coastDistanceKm != null ? coastDistanceKm : Math.max(30, Math.min(80, depth_km * 0.5)))
    : 0;
  const coastI = isOffshore ? gmpeIntensityAt(mw, depth_km, coastDist, faultType) : epicentralMax;
  const reportedValue = isOffshore ? coastI : epicentralMax;
  const rounded = Math.round(reportedValue * 10) / 10;

  let confidence: 'high' | 'medium' | 'low';
  if (mag >= 8.0 || depth_km > 300) confidence = 'low';
  else if (mag >= 6.0) confidence = 'medium';
  else confidence = 'low';

  return {
    value: rounded, class: toJmaClass(rounded),
    epicentral_max: Math.round(epicentralMax * 10) / 10,
    epicentral_max_class: toJmaClass(Math.round(epicentralMax * 10) / 10),
    is_offshore: isOffshore, coast_distance_km: isOffshore ? Math.round(coastDist) : null,
    scale: 'JMA', source: 'gmpe_si_midorikawa_1999',
    confidence,
  };
}

// ── Aftershock: Modified Omori + Bath's Law ──

export interface OmoriResult {
  omori_params: { p: number; c: number; k: number; effective_mw: number };
  bath_expected_max: number;
  forecast: {
    lambda_24h_m4: number; lambda_7d_m4: number;
    lambda_24h_m5: number; lambda_7d_m5: number;
    p24h_m4plus: number; p7d_m4plus: number; p30d_m4plus: number;
    p24h_m5plus: number; p7d_m5plus: number; p30d_m5plus: number;
    expected_count_7d_m4: number; expected_count_7d_m5: number;
  };
  source: 'omori_rj1989';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Compute aftershock forecast using modified Omori law + Bath's law.
 *
 * Fix from old code: removed effectiveMw = Math.min(mainMw, 8.0) cap.
 * Now uses actual Mw directly (Reasenberg & Jones 1989 parameters).
 */
export function computeOmori(mainMw: number): OmoriResult {
  const p = 1.1, c = 0.05, a = -1.67, b = 0.91;
  const bathMax = Math.round((mainMw - 1.2) * 10) / 10;

  function cumRate(mMin: number, t0: number, t1: number): number {
    const coeff = Math.pow(10, a + b * (mainMw - mMin));
    if (Math.abs(p - 1) < 0.01) return coeff * Math.log((t1 + c) / (t0 + c));
    return coeff * (Math.pow(t1 + c, 1 - p) - Math.pow(t0 + c, 1 - p)) / (1 - p);
  }

  function cappedLambda(mMin: number, t0: number, t1: number, maxPerDay: number): number {
    const days = t1 - t0;
    const raw = cumRate(mMin, t0, t1);
    return Math.round(Math.min(raw, maxPerDay * days) * 100) / 100;
  }

  function toProb(lambda: number): number {
    return Math.round(Math.min(99, Math.max(0, (1 - Math.exp(-lambda)) * 100)) * 10) / 10;
  }

  const l24h_m4 = cappedLambda(4, 0, 1, 50), l7d_m4 = cappedLambda(4, 0, 7, 50);
  const l24h_m5 = cappedLambda(5, 0, 1, 10), l7d_m5 = cappedLambda(5, 0, 7, 10);

  return {
    omori_params: { p, c, k: Math.round(Math.pow(10, a + b * mainMw)), effective_mw: mainMw },
    bath_expected_max: bathMax,
    forecast: {
      lambda_24h_m4: l24h_m4, lambda_7d_m4: l7d_m4,
      lambda_24h_m5: l24h_m5, lambda_7d_m5: l7d_m5,
      p24h_m4plus: toProb(l24h_m4), p7d_m4plus: toProb(l7d_m4),
      p30d_m4plus: toProb(cappedLambda(4, 0, 30, 50)),
      p24h_m5plus: toProb(l24h_m5), p7d_m5plus: toProb(l7d_m5),
      p30d_m5plus: toProb(cappedLambda(5, 0, 30, 10)),
      expected_count_7d_m4: Math.round(l7d_m4), expected_count_7d_m5: Math.round(l7d_m5),
    },
    source: 'omori_rj1989',
    confidence: mainMw >= 6 ? 'medium' : 'low',
  };
}
