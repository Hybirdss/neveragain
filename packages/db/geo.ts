/**
 * Japan Geo Classification — Shared Module
 *
 * Accurate offshore/near-coast/inland classification for earthquake epicenters.
 * Used by: worker analysis pipeline, batch generation tools, facts builder.
 *
 * Algorithm:
 *   1. Parse USGS/JMA place text for geographic keywords (highest confidence)
 *   2. Geometric fallback using simplified Japan coastline reference points
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

// ── Coastline Reference Points ──
// Each point represents an approximate coastal location with the direction of the sea.
// seaLng/seaLat offsets indicate which direction is "ocean" from this coast point.

interface CoastRef {
  lat: number;
  lng: number;
  seaLat: number; // direction to sea (latitude offset, normalized)
  seaLng: number; // direction to sea (longitude offset, normalized)
  name: string;
}

const COAST_REFS: CoastRef[] = [
  // ── Pacific coast (sea = east/southeast) ──
  { lat: 42.5, lng: 145.0, seaLat: 0, seaLng: 1, name: 'Hokkaido-Pacific-E' },
  { lat: 42.0, lng: 143.0, seaLat: -1, seaLng: 1, name: 'Hokkaido-Pacific-SE' },
  { lat: 41.0, lng: 141.5, seaLat: 0, seaLng: 1, name: 'Aomori-Pacific' },
  { lat: 39.5, lng: 142.0, seaLat: 0, seaLng: 1, name: 'Iwate' },
  { lat: 38.3, lng: 141.5, seaLat: 0, seaLng: 1, name: 'Miyagi' },
  { lat: 37.0, lng: 141.0, seaLat: 0, seaLng: 1, name: 'Fukushima' },
  { lat: 36.3, lng: 140.8, seaLat: 0, seaLng: 1, name: 'Ibaraki' },
  { lat: 35.7, lng: 140.8, seaLat: 0, seaLng: 1, name: 'Chiba-N' },
  { lat: 35.0, lng: 140.0, seaLat: 0, seaLng: 1, name: 'Boso' },
  { lat: 34.7, lng: 139.0, seaLat: -1, seaLng: 1, name: 'Izu-E' },
  { lat: 34.5, lng: 138.5, seaLat: -1, seaLng: 0, name: 'Suruga' },
  { lat: 34.0, lng: 137.0, seaLat: -1, seaLng: 0, name: 'Enshunada' },
  { lat: 33.5, lng: 136.0, seaLat: -1, seaLng: 0, name: 'Kii-S' },
  { lat: 33.3, lng: 134.0, seaLat: -1, seaLng: 0, name: 'Shikoku-S' },
  { lat: 33.0, lng: 132.5, seaLat: -1, seaLng: 1, name: 'Shikoku-SW' },
  { lat: 32.5, lng: 132.0, seaLat: -1, seaLng: 0, name: 'Hyuganada' },
  { lat: 31.5, lng: 131.5, seaLat: -1, seaLng: 0, name: 'Miyazaki' },
  { lat: 31.0, lng: 131.0, seaLat: -1, seaLng: 0, name: 'Kagoshima-S' },

  // ── Sea of Japan coast (sea = west/northwest) ──
  { lat: 43.0, lng: 141.0, seaLat: 0, seaLng: -1, name: 'Hokkaido-SeaOfJapan' },
  { lat: 41.0, lng: 140.0, seaLat: 0, seaLng: -1, name: 'Tsugaru' },
  { lat: 39.8, lng: 140.0, seaLat: 0, seaLng: -1, name: 'Akita' },
  { lat: 38.8, lng: 139.5, seaLat: 0, seaLng: -1, name: 'Yamagata' },
  { lat: 38.0, lng: 139.0, seaLat: 0, seaLng: -1, name: 'Niigata' },
  { lat: 37.0, lng: 136.7, seaLat: 0, seaLng: -1, name: 'Noto-base' },
  { lat: 37.5, lng: 137.2, seaLat: 0, seaLng: 1, name: 'Noto-tip' },
  { lat: 36.0, lng: 136.0, seaLat: 1, seaLng: -1, name: 'Fukui' },
  { lat: 35.5, lng: 134.5, seaLat: 1, seaLng: 0, name: 'Tottori' },
  { lat: 35.0, lng: 132.5, seaLat: 1, seaLng: 0, name: 'Shimane' },
  { lat: 34.5, lng: 131.0, seaLat: 1, seaLng: -1, name: 'Yamaguchi-N' },

  // ── Kyushu west coast (sea = west) ──
  { lat: 33.5, lng: 130.0, seaLat: 0, seaLng: -1, name: 'Fukuoka-W' },
  { lat: 33.0, lng: 129.5, seaLat: 0, seaLng: -1, name: 'Nagasaki' },
  { lat: 32.0, lng: 130.0, seaLat: 0, seaLng: -1, name: 'Kumamoto-W' },

  // ── Inland sea / channels (near_coast zones) ──
  { lat: 34.3, lng: 134.5, seaLat: -0.5, seaLng: 0.5, name: 'Seto-Inland-E' },
  { lat: 34.0, lng: 133.0, seaLat: -0.5, seaLng: 0, name: 'Seto-Inland-W' },
  { lat: 33.5, lng: 132.0, seaLat: -0.5, seaLng: 0.5, name: 'Bungo-Channel' },
  { lat: 34.3, lng: 135.0, seaLat: -0.5, seaLng: 0, name: 'Kii-Channel' },

  // ── Okinawa/Ryukyu (sea = all around) ──
  { lat: 26.5, lng: 128.0, seaLat: 0, seaLng: 1, name: 'Okinawa' },
  { lat: 24.5, lng: 124.0, seaLat: 0, seaLng: -1, name: 'Miyako' },
];

// ── Place Text Parsing ──

const OFFSHORE_PATTERN = /\boffshore\b|off\s+(the\s+)?(east|west|south|north|se|sw|ne|nw)?\s*coast|沖(?!縄)|海溝/i;
const NEAR_COAST_PATTERN = /near\s+(the\s+)?(\w+\s+)?coast|近海|水道|channel|strait|海峡|灘|湾|sea\s+of\s+japan|日本海|east\s+china\s+sea|東シナ海|半島/i;
const INLAND_PATTERN = /県[北南東西中]部|県.+地方|地方$|市$|区$|町$|村$/i;

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

    // Inland only if NO sea-related keywords
    if (INLAND_PATTERN.test(text) && !OFFSHORE_PATTERN.test(text) && !NEAR_COAST_PATTERN.test(text)) {
      const dist = estimateCoastDistance(lat, lng);
      return {
        type: 'inland',
        confidence: 'high',
        coastDistanceKm: dist,
        reason: `Place text indicates inland: "${text.slice(0, 60)}"`,
      };
    }
  }

  // 2. Geometric fallback
  return classifyByGeometry(lat, lng);
}

/**
 * Estimate distance to nearest coastline reference point (km).
 */
function estimateCoastDistance(lat: number, lng: number): number {
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
 * Geometric classification using coastline reference points.
 * For each nearby coast reference, check if epicenter is on the sea side.
 */
function classifyByGeometry(lat: number, lng: number): LocationClassification {
  // Not in Japan region at all — classify as offshore if clearly oceanic
  if (lat < 20 || lat > 50 || lng < 120 || lng > 155) {
    return {
      type: 'offshore',
      confidence: 'medium',
      coastDistanceKm: null,
      reason: 'Outside Japan region',
    };
  }

  // Find closest coast reference points
  const scored: { ref: CoastRef; dist: number; seaSide: boolean }[] = [];

  for (const ref of COAST_REFS) {
    const dist = haversineKm(lat, lng, ref.lat, ref.lng);
    if (dist > 500) continue; // Skip distant refs

    // Check if epicenter is on the sea side of this coast point
    const dLat = lat - ref.lat;
    const dLng = lng - ref.lng;
    // Dot product with sea direction: positive = sea side, negative = land side
    const dot = dLat * ref.seaLat + dLng * ref.seaLng;

    scored.push({ ref, dist, seaSide: dot > 0 });
  }

  if (scored.length === 0) {
    // No nearby coast references — check if in a known ocean region
    // Within Japan's tectonic zone but far from main islands = likely oceanic
    // (Kurils, Bonin/Ogasawara, open Pacific, remote Sea of Japan)
    const nearestCoast = estimateCoastDistance(lat, lng);
    if (nearestCoast > 300) {
      return {
        type: 'offshore',
        confidence: 'medium',
        coastDistanceKm: nearestCoast,
        reason: `Far from any coastline reference (~${nearestCoast}km)`,
      };
    }
    return {
      type: 'inland',
      confidence: 'medium',
      coastDistanceKm: nearestCoast,
      reason: `No nearby coast reference points (~${nearestCoast}km from nearest)`,
    };
  }

  // Sort by distance
  scored.sort((a, b) => a.dist - b.dist);
  const nearest = scored[0];

  // Use the 3 nearest refs for consensus, weighted by proximity
  const topRefs = scored.slice(0, 3);
  const avgDist = Math.round(topRefs.reduce((s, r) => s + r.dist, 0) / topRefs.length);

  // If nearest ref is much closer than others (2x+), trust it directly
  if (topRefs.length >= 2 && topRefs[0].dist * 2 < topRefs[1].dist) {
    const n = topRefs[0];
    if (n.seaSide) {
      return n.dist > 50
        ? { type: 'offshore', confidence: 'medium', coastDistanceKm: Math.round(n.dist), reason: `Sea side of ${n.ref.name} coast (~${Math.round(n.dist)}km)` }
        : { type: 'near_coast', confidence: 'medium', coastDistanceKm: Math.round(n.dist), reason: `Near ${n.ref.name} coast (~${Math.round(n.dist)}km), sea side` };
    }
    return n.dist < 30
      ? { type: 'near_coast', confidence: 'medium', coastDistanceKm: Math.round(n.dist), reason: `Near ${n.ref.name} coast (~${Math.round(n.dist)}km), land side` }
      : { type: 'inland', confidence: 'medium', coastDistanceKm: Math.round(n.dist), reason: `Inland, ~${Math.round(n.dist)}km from ${n.ref.name} coast` };
  }

  const seaSideCount = topRefs.filter(s => s.seaSide).length;

  // Majority sea side (or single ref on sea side)
  if (seaSideCount > topRefs.length / 2) {
    // Majority says sea side
    if (nearest.dist > 50) {
      return {
        type: 'offshore',
        confidence: 'medium',
        coastDistanceKm: Math.round(nearest.dist),
        reason: `Sea side of ${nearest.ref.name} coast (~${Math.round(nearest.dist)}km)`,
      };
    }
    return {
      type: 'near_coast',
      confidence: 'medium',
      coastDistanceKm: Math.round(nearest.dist),
      reason: `Near ${nearest.ref.name} coast (~${Math.round(nearest.dist)}km), sea side`,
    };
  }

  // Majority says land side
  if (nearest.dist < 30) {
    return {
      type: 'near_coast',
      confidence: 'medium',
      coastDistanceKm: Math.round(nearest.dist),
      reason: `Near ${nearest.ref.name} coast (~${Math.round(nearest.dist)}km), land side`,
    };
  }

  return {
    type: 'inland',
    confidence: 'medium',
    coastDistanceKm: avgDist,
    reason: `Inland, ~${avgDist}km from nearest coast (${nearest.ref.name})`,
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
