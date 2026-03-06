/**
 * Impact Intelligence — Core actionable intelligence derived from GMPE,
 * infrastructure catalogs, and real-time vessel data.
 *
 * This module aggregates seismic engine output, infrastructure exposure,
 * tsunami assessment, and response protocol timelines into the numbers
 * that operators actually need to make decisions.
 *
 * All computations are pure functions — no side effects, no DOM access.
 */

import type {
  EarthquakeEvent,
  IntensityGrid,
  JmaClass,
} from '../types';
import { computeGmpe, haversine, toJmaClass } from '../engine/gmpe';
import { MUNICIPALITIES, JAPAN_TOTAL_POPULATION, CATALOGED_POPULATION } from '../data/municipalities';
import { HOSPITALS, type HospitalPosture } from '../layers/hospitalLayer';
import {
  POWER_PLANTS,
  type ScramLikelihood,
} from '../layers/powerLayer';
import { RAIL_ROUTES, type RailRoute } from '../layers/railLayer';
import { computeMaritimeExposure } from '../layers/aisLayer';
import { haversineKm, impactRadiusKm } from '../layers/impactZone';
import type { Vessel } from '../data/aisManager';

// ============================================================
// 1. Peak JMA Intensity
// ============================================================

export interface PeakIntensity {
  /** Continuous JMA instrumental intensity (e.g. 5.8) */
  value: number;
  /** Display class (e.g. '6-') */
  jmaClass: JmaClass;
  /** Location of the peak intensity cell */
  location: { lat: number; lng: number };
}

/**
 * Extract the maximum intensity value and its location from an IntensityGrid.
 */
export function computePeakIntensity(grid: IntensityGrid): PeakIntensity {
  let maxVal = 0;
  let maxIdx = 0;

  for (let i = 0; i < grid.data.length; i++) {
    if (grid.data[i] > maxVal) {
      maxVal = grid.data[i];
      maxIdx = i;
    }
  }

  const row = Math.floor(maxIdx / grid.cols);
  const col = maxIdx % grid.cols;
  const lngRadiusDeg = grid.radiusLngDeg ?? grid.radiusDeg;

  const lat =
    (grid.center.lat - grid.radiusDeg) +
    row * (2 * grid.radiusDeg / (grid.rows - 1));
  const lng =
    (grid.center.lng - lngRadiusDeg) +
    col * (2 * lngRadiusDeg / (grid.cols - 1));

  return {
    value: maxVal,
    jmaClass: toJmaClass(maxVal),
    location: { lat, lng },
  };
}

// ============================================================
// 2. Intensity Area Statistics
// ============================================================

export interface IntensityAreaStats {
  /** km^2 at JMA 4 or higher (intensity >= 3.5) */
  jma4plus: number;
  /** km^2 at JMA 5- or higher (intensity >= 4.5) */
  jma5minus: number;
  /** km^2 at JMA 5+ or higher (intensity >= 5.0) */
  jma5plus: number;
  /** km^2 at JMA 6- or higher (intensity >= 5.5) */
  jma6minus: number;
  /** km^2 at JMA 6+ or higher (intensity >= 6.0) */
  jma6plus: number;
  /** km^2 at JMA 7 (intensity >= 6.5) */
  jma7: number;
}

/**
 * Compute area (km^2) above each JMA intensity threshold from an IntensityGrid.
 *
 * Each grid cell covers approximately:
 *   (latStep_deg * 111 km) * (lngStep_deg * 111 km * cos(lat_rad))
 */
export function computeIntensityAreaStats(grid: IntensityGrid): IntensityAreaStats {
  const lngRadiusDeg = grid.radiusLngDeg ?? grid.radiusDeg;
  const latStep = (2 * grid.radiusDeg) / (grid.rows - 1);
  const lngStep = (2 * lngRadiusDeg) / (grid.cols - 1);

  const KM_PER_DEG = 111.0;

  let jma4plus = 0;
  let jma5minus = 0;
  let jma5plus = 0;
  let jma6minus = 0;
  let jma6plus = 0;
  let jma7 = 0;

  for (let row = 0; row < grid.rows; row++) {
    const lat = (grid.center.lat - grid.radiusDeg) + row * latStep;
    const cosLat = Math.cos(lat * Math.PI / 180);
    const cellAreaKm2 = (latStep * KM_PER_DEG) * (lngStep * KM_PER_DEG * cosLat);

    for (let col = 0; col < grid.cols; col++) {
      const intensity = grid.data[row * grid.cols + col];

      if (intensity >= 6.5) {
        jma7 += cellAreaKm2;
        jma6plus += cellAreaKm2;
        jma6minus += cellAreaKm2;
        jma5plus += cellAreaKm2;
        jma5minus += cellAreaKm2;
        jma4plus += cellAreaKm2;
      } else if (intensity >= 6.0) {
        jma6plus += cellAreaKm2;
        jma6minus += cellAreaKm2;
        jma5plus += cellAreaKm2;
        jma5minus += cellAreaKm2;
        jma4plus += cellAreaKm2;
      } else if (intensity >= 5.5) {
        jma6minus += cellAreaKm2;
        jma5plus += cellAreaKm2;
        jma5minus += cellAreaKm2;
        jma4plus += cellAreaKm2;
      } else if (intensity >= 5.0) {
        jma5plus += cellAreaKm2;
        jma5minus += cellAreaKm2;
        jma4plus += cellAreaKm2;
      } else if (intensity >= 4.5) {
        jma5minus += cellAreaKm2;
        jma4plus += cellAreaKm2;
      } else if (intensity >= 3.5) {
        jma4plus += cellAreaKm2;
      }
    }
  }

  return {
    jma4plus: Math.round(jma4plus),
    jma5minus: Math.round(jma5minus),
    jma5plus: Math.round(jma5plus),
    jma6minus: Math.round(jma6minus),
    jma6plus: Math.round(jma6plus),
    jma7: Math.round(jma7),
  };
}

// ============================================================
// 3. Population Exposure
// ============================================================

export interface PopulationExposure {
  /** Population in areas with JMA 7 (intensity >= 6.5) */
  jma7: number;
  /** Population in areas with JMA 6+ or higher (intensity >= 6.0) */
  jma6plus: number;
  /** Population in areas with JMA 6- or higher (intensity >= 5.5) */
  jma6minus: number;
  /** Population in areas with JMA 5+ or higher (intensity >= 5.0) */
  jma5plus: number;
  /** Population in areas with JMA 5- or higher (intensity >= 4.5) */
  jma5minus: number;
  /** Population in areas with JMA 4 or higher (intensity >= 3.5) */
  jma4plus: number;
  /** Total cataloged population assessed */
  catalogedPopulation: number;
  /** Japan total population (2020 census) */
  totalPopulation: number;
  /** Top affected municipalities with their intensity */
  topAffected: {
    name: string;
    nameEn: string;
    population: number;
    intensity: number;
    jmaClass: JmaClass;
  }[];
}

/**
 * Compute population exposure by JMA intensity class.
 *
 * For each municipality in the catalog, compute GMPE intensity at the
 * city hall coordinates and assign the entire municipality population
 * to that intensity class.
 *
 * This is accurate for cities <20km across (intensity variation ~0.5 JMA,
 * within GMPE's own ±1 JMA error margin). Source: Si & Midorikawa (1999).
 *
 * Population data: 令和2年国勢調査 (2020 Census), exact counts.
 */
export function computePopulationExposure(event: EarthquakeEvent): PopulationExposure {
  let jma7 = 0;
  let jma6plus = 0;
  let jma6minus = 0;
  let jma5plus = 0;
  let jma5minus = 0;
  let jma4plus = 0;

  const affected: PopulationExposure['topAffected'] = [];

  for (const city of MUNICIPALITIES) {
    const intensity = computeSiteIntensity(city.lat, city.lng, event);
    if (intensity < 3.5) continue; // Below JMA 4 — not significantly affected

    const pop = city.population;
    const jmaClass = toJmaClass(intensity);

    if (intensity >= 6.5) {
      jma7 += pop;
      jma6plus += pop;
      jma6minus += pop;
      jma5plus += pop;
      jma5minus += pop;
      jma4plus += pop;
    } else if (intensity >= 6.0) {
      jma6plus += pop;
      jma6minus += pop;
      jma5plus += pop;
      jma5minus += pop;
      jma4plus += pop;
    } else if (intensity >= 5.5) {
      jma6minus += pop;
      jma5plus += pop;
      jma5minus += pop;
      jma4plus += pop;
    } else if (intensity >= 5.0) {
      jma5plus += pop;
      jma5minus += pop;
      jma4plus += pop;
    } else if (intensity >= 4.5) {
      jma5minus += pop;
      jma4plus += pop;
    } else {
      jma4plus += pop;
    }

    // Track affected municipalities for detail display
    if (intensity >= 4.5) {
      affected.push({
        name: city.name,
        nameEn: city.nameEn,
        population: pop,
        intensity,
        jmaClass,
      });
    }
  }

  // Sort by intensity descending, then population descending
  affected.sort((a, b) => b.intensity - a.intensity || b.population - a.population);

  return {
    jma7,
    jma6plus,
    jma6minus,
    jma5plus,
    jma5minus,
    jma4plus,
    catalogedPopulation: CATALOGED_POPULATION,
    totalPopulation: JAPAN_TOTAL_POPULATION,
    topAffected: affected.slice(0, 10), // Top 10 most affected
  };
}

// ============================================================
// 4. Infrastructure Impact Summary
// ============================================================

export interface InfraImpactSummary {
  hospitalsCompromised: number;
  hospitalsDisrupted: number;
  hospitalsOperational: number;
  dmatBasesDeployable: number;
  nuclearScramLikely: number;
  nuclearScramPossible: number;
  railLinesSuspended: number;
  railLinesAffected: number;
  vesselsInZone: number;
  /** Passenger + tanker vessels in impact zone */
  vesselsHighPriority: number;
}

/**
 * Compute hospital posture from GMPE intensity at site.
 * Mirrors hospitalLayer.ts computeHospitalPosture logic.
 */
function computeHospitalPosture(intensity: number): HospitalPosture {
  if (intensity < 4.5) return 'operational';
  if (intensity < 5.5) return 'disrupted';
  if (intensity < 6.0) return 'assessment-needed';
  return 'compromised';
}

/**
 * Approximate PGA (gal) from JMA instrumental intensity.
 *
 * Uses the empirical relationship between JMA intensity and peak ground
 * acceleration. The JMA intensity scale is defined as:
 *   I_JMA = 2 * log10(a_filtered) + 0.94
 * where a_filtered is the vector sum of filtered accelerations (not raw PGA).
 *
 * For approximate PGA estimation, we use the inverse:
 *   PGA_approx ≈ 10^((I - 0.94) / 2)
 *
 * This gives values consistent with Midorikawa et al. (1999) empirical
 * PGA-intensity relationship and JMA published intensity-acceleration tables:
 *   JMA 5- (I=4.5): ~105 gal   (JMA range: 80-110)
 *   JMA 6- (I=5.5): ~190 gal   (JMA range: 180-250)
 *   JMA 6+ (I=6.0): ~338 gal   (JMA range: 250-400)
 *
 * Reference: JMA "計測震度の算出方法" (Method of computing instrumental intensity)
 * https://www.data.jma.go.jp/eqev/data/kyoshin/kaisetsu/calc_sindo.html
 *
 * Mirrors powerLayer.ts intensityToPgaGal logic.
 */
function intensityToPgaGal(intensity: number): number {
  if (intensity <= 0) return 0;
  return Math.pow(10, (intensity - 0.94) / 2);
}

/**
 * Estimate SCRAM (automatic reactor shutdown) likelihood from PGA.
 *
 * Japanese nuclear plants have seismic automatic shutdown systems (地震感知器)
 * that trigger reactor trip when observed ground acceleration exceeds a
 * design-specific setpoint.
 *
 * Historical SCRAM trigger levels (NRA 原子力規制委員会):
 *   - Pre-2006 (S1 design basis): ~120 gal horizontal at reactor building base
 *   - Post-2006 (Ss design basis): 450-993 gal depending on plant
 *     (e.g., Sendai: 620 gal, Ohi: 856 gal, Mihama: 993 gal)
 *   - Actual seismic SCRAM setpoints are typically lower than Ss, around
 *     120-200 gal for most plants.
 *
 * Historical events:
 *   - 2007 NCO earthquake: Kashiwazaki-Kariwa, 680 gal observed, all 7 units tripped
 *   - 2011 Tohoku: Onagawa, ~540 gal observed, safe automatic shutdown
 *   - 2016 Kumamoto: Sendai, ~8 gal observed (distant), no SCRAM
 *
 * Reference: NRA "新規制基準の概要" (Overview of New Regulatory Requirements);
 * each plant's "設置変更許可申請書" (Installation Change Permit Application)
 * documents the specific Ss and SCRAM setpoint values.
 *
 * The thresholds below are conservative approximations for the visualization.
 * Actual SCRAM decisions depend on plant-specific setpoints and observed
 * acceleration at the reactor building, not at the free-field surface.
 *
 * Mirrors powerLayer.ts computeScramLikelihood logic.
 */
function computeScramLikelihood(
  pgaGal: number,
  status: 'operating' | 'shutdown' | 'decommissioning',
): ScramLikelihood {
  if (status !== 'operating') return 'none';
  if (pgaGal >= 200) return 'certain';
  if (pgaGal >= 120) return 'likely';
  if (pgaGal >= 80) return 'possible';
  if (pgaGal >= 40) return 'unlikely';
  return 'none';
}

/**
 * Check if a rail route is affected by the earthquake using impact radius.
 * Mirrors railLayer.ts isRouteAffected logic.
 */
function isRouteAffected(route: RailRoute, event: EarthquakeEvent): boolean {
  const radius = impactRadiusKm(event.magnitude, event.depth_km, event.faultType);
  return route.path.some(([lng, lat]) =>
    haversineKm(lat, lng, event.lat, event.lng) <= radius,
  );
}

/**
 * Compute the GMPE intensity at a specific site given an earthquake event.
 * Returns clamped non-negative JMA intensity.
 */
function computeSiteIntensity(
  siteLat: number,
  siteLng: number,
  event: EarthquakeEvent,
): number {
  const surfaceDist = haversine(event.lat, event.lng, siteLat, siteLng);
  const hypo = Math.sqrt(surfaceDist * surfaceDist + event.depth_km * event.depth_km);
  const result = computeGmpe({
    Mw: event.magnitude,
    depth_km: event.depth_km,
    distance_km: Math.max(hypo, 3), // Minimum 3 km to avoid near-field singularity
    faultType: event.faultType,
  });
  return Math.max(0, result.jmaIntensity);
}

/**
 * Compute aggregate infrastructure impact from an earthquake event.
 *
 * Assesses hospitals, nuclear plants, rail lines, and maritime vessels
 * using the same GMPE and impact zone logic as the layer modules.
 */
export function computeInfraImpact(
  event: EarthquakeEvent,
  vessels: Vessel[],
): InfraImpactSummary {
  // ── Hospitals ──
  let hospitalsCompromised = 0;
  let hospitalsDisrupted = 0;
  let hospitalsOperational = 0;
  let dmatBasesDeployable = 0;

  for (const h of HOSPITALS) {
    const intensity = computeSiteIntensity(h.lat, h.lng, event);
    const posture = computeHospitalPosture(intensity);

    if (posture === 'compromised') {
      hospitalsCompromised++;
    } else if (posture === 'disrupted' || posture === 'assessment-needed') {
      hospitalsDisrupted++;
    } else {
      hospitalsOperational++;
    }

    // DMAT base that is operational can deploy teams
    if (h.dmat && posture === 'operational') {
      dmatBasesDeployable++;
    }
  }

  // ── Nuclear Plants ──
  let nuclearScramLikely = 0;
  let nuclearScramPossible = 0;

  const nuclearPlants = POWER_PLANTS.filter((p) => p.type === 'nuclear');
  for (const plant of nuclearPlants) {
    const intensity = computeSiteIntensity(plant.lat, plant.lng, event);
    const pgaGal = intensityToPgaGal(intensity);
    const scram = computeScramLikelihood(pgaGal, plant.status);

    if (scram === 'likely' || scram === 'certain') {
      nuclearScramLikely++;
    } else if (scram === 'possible') {
      nuclearScramPossible++;
    }
  }

  // ── Rail Lines ──
  let railLinesSuspended = 0;
  let railLinesAffected = 0;

  for (const route of RAIL_ROUTES) {
    if (isRouteAffected(route, event)) {
      // Shinkansen has UrEDAS auto-stop — suspended immediately
      if (route.type === 'shinkansen') {
        railLinesSuspended++;
      } else {
        railLinesAffected++;
      }
    }
  }

  // ── Maritime ──
  const exposure = computeMaritimeExposure(vessels, event);

  return {
    hospitalsCompromised,
    hospitalsDisrupted,
    hospitalsOperational,
    dmatBasesDeployable,
    nuclearScramLikely,
    nuclearScramPossible,
    railLinesSuspended,
    railLinesAffected,
    vesselsInZone: exposure.totalInZone,
    vesselsHighPriority: exposure.passengerCount + exposure.tankerCount,
  };
}

// ============================================================
// 4. Tsunami ETA at Major Ports
// ============================================================

export interface TsunamiETA {
  portName: string;
  portNameJa: string;
  distanceKm: number;
  /** Approximate arrival time in minutes from earthquake origin */
  estimatedMinutes: number;
  lat: number;
  lng: number;
}

const MAJOR_PORTS = [
  { name: 'Tokyo Bay', nameJa: '東京湾', lat: 35.45, lng: 139.80 },
  { name: 'Yokohama', nameJa: '横浜港', lat: 35.44, lng: 139.65 },
  { name: 'Osaka Bay', nameJa: '大阪湾', lat: 34.60, lng: 135.20 },
  { name: 'Kobe', nameJa: '神戸港', lat: 34.68, lng: 135.20 },
  { name: 'Nagoya', nameJa: '名古屋港', lat: 35.05, lng: 136.88 },
  { name: 'Hakata', nameJa: '博多港', lat: 33.60, lng: 130.40 },
  { name: 'Sendai', nameJa: '仙台港', lat: 38.27, lng: 141.00 },
  { name: 'Niigata', nameJa: '新潟港', lat: 37.95, lng: 139.05 },
  { name: 'Kagoshima', nameJa: '鹿児島港', lat: 31.60, lng: 130.57 },
  { name: 'Naha', nameJa: '那覇港', lat: 26.22, lng: 127.67 },
] as const;

/**
 * Blended tsunami propagation speed (km/h).
 *
 * Deep ocean: sqrt(g * 4000m) ~ 198 m/s ~ 713 km/h
 * Continental shelf: sqrt(g * 200m) ~ 44 m/s ~ 160 km/h
 * Blended estimate for rough ETA: 500 km/h
 */
const TSUNAMI_SPEED_KMH = 500;

/**
 * Determine whether an event warrants tsunami ETA computation.
 */
function hasTsunamiRisk(event: EarthquakeEvent): boolean {
  if (event.tsunami) return true;
  if (event.magnitude >= 7.0 && event.faultType !== 'crustal') return true;
  return false;
}

/**
 * Compute estimated tsunami arrival times at Japan's 10 major ports.
 *
 * Only computed for events with tsunami risk (event.tsunami === true
 * or M >= 7.0 with non-crustal fault type).
 *
 * Results are sorted by arrival time (nearest first).
 */
export function computeTsunamiETAs(event: EarthquakeEvent): TsunamiETA[] {
  if (!hasTsunamiRisk(event)) return [];

  const etas: TsunamiETA[] = MAJOR_PORTS.map((port) => {
    const distanceKm = haversine(event.lat, event.lng, port.lat, port.lng);
    const estimatedMinutes = (distanceKm / TSUNAMI_SPEED_KMH) * 60;

    return {
      portName: port.name,
      portNameJa: port.nameJa,
      distanceKm: Math.round(distanceKm),
      estimatedMinutes: Math.round(estimatedMinutes),
      lat: port.lat,
      lng: port.lng,
    };
  });

  // Sort by arrival time (nearest first)
  etas.sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);

  return etas;
}

// ============================================================
// 5. Response Protocol Timeline
// ============================================================

export interface ResponseMilestone {
  /** Minutes after earthquake origin */
  minutesAfter: number;
  label: string;
  labelJa: string;
  description: string;
  /** True if this event's magnitude/conditions warrant this response */
  triggered: boolean;
}

/**
 * Compute Japan's post-earthquake response protocol milestones.
 *
 * Timings based on documented government response protocols and
 * observed performance in historical earthquakes:
 *
 *   T+0s   UrEDAS: Nakamura, Y. (1988). "On the Urgent Earthquake Detection
 *           and Alarm System (UrEDAS)." Proc. 9th WCEE. Triggers at M≥4.0
 *           within 1-3 seconds via P-wave detection.
 *   T+3m   JMA 震度速報: JMA operational target is <3 minutes for automatic
 *           seismic intensity report. Observed: 2011 Tohoku, first report at
 *           14:49 JST (~3 min after origin).
 *   T+5m   NHK: Emergency broadcast within 3-5 minutes. 2011 Tohoku: NHK
 *           broke programming at 14:49 JST (~3 min).
 *   T+10m  Tsunami warning: JMA target <3 min for major tsunami warnings.
 *           2011 Tohoku: first tsunami warning at 14:49 (3 min). 10 min is
 *           conservative for updated warnings with magnitude revision.
 *   T+15m  DMAT: MHLW "DMAT活動要領" (DMAT Activity Guidelines) specifies
 *           standby notification within 15-30 minutes for major earthquakes.
 *   T+30m  FDMA: 消防庁防災業務計画 requires HQ establishment within 30 min
 *           for events with expected JMA 6+ intensity.
 *   T+60m  SDF: 2016 Kumamoto: SDF dispatch ordered ~45 min after mainshock.
 *           2011 Tohoku: immediate dispatch under 災害派遣要請.
 *   T+90m  Wide-area transport: 広域医療搬送計画 activates 1-2 hours after
 *           confirmation of catastrophic damage.
 *   T+180m Cabinet: 2011 Tohoku: Emergency cabinet meeting at 15:37 (~1.5h).
 *           2016 Kumamoto: ~2 hours. 3 hours is the statutory upper bound.
 *   T+360m International: 2011 Tohoku: International rescue teams arrived
 *           within 24h, but formal request issued within ~6 hours.
 *
 * Each milestone has a magnitude threshold that determines whether
 * the response protocol is triggered for this specific event.
 */
export function computeResponseTimeline(event: EarthquakeEvent): ResponseMilestone[] {
  const M = event.magnitude;
  const tsunamiRisk = hasTsunamiRisk(event);

  return [
    {
      minutesAfter: 0,
      label: 'UrEDAS auto-stop (Shinkansen)',
      labelJa: 'UrEDAS自動停止（新幹線）',
      description: 'Earthquake Early Warning triggers automatic Shinkansen braking within seconds',
      triggered: M >= 4.0,
    },
    {
      minutesAfter: 3,
      label: 'JMA preliminary seismic intensity',
      labelJa: 'JMA震度速報',
      description: 'Japan Meteorological Agency issues initial seismic intensity report',
      triggered: true, // Always issued
    },
    {
      minutesAfter: 5,
      label: 'NHK earthquake bulletin',
      labelJa: 'NHK地震速報',
      description: 'National broadcaster interrupts programming with earthquake details',
      triggered: M >= 4.0,
    },
    {
      minutesAfter: 10,
      label: 'Tsunami advisory/warning',
      labelJa: '津波注意報/警報',
      description: 'JMA issues tsunami advisory or warning based on epicenter and magnitude',
      triggered: tsunamiRisk,
    },
    {
      minutesAfter: 15,
      label: 'DMAT standby activation',
      labelJa: 'DMAT待機要請',
      description: 'Disaster Medical Assistance Teams placed on standby across affected regions',
      triggered: M >= 6.0,
    },
    {
      minutesAfter: 30,
      label: 'FDMA disaster response HQ',
      labelJa: '消防庁災害対策本部',
      description: 'Fire and Disaster Management Agency establishes disaster response headquarters',
      triggered: M >= 6.0,
    },
    {
      minutesAfter: 60,
      label: 'SDF dispatch decision',
      labelJa: '自衛隊派遣決定',
      description: 'Self-Defense Forces dispatch decision for disaster relief operations',
      triggered: M >= 6.5,
    },
    {
      minutesAfter: 90,
      label: 'Wide-area medical transport',
      labelJa: '広域医療搬送',
      description: 'Activation of wide-area medical transport for critically injured patients',
      triggered: M >= 7.0,
    },
    {
      minutesAfter: 180,
      label: 'Cabinet emergency meeting',
      labelJa: '閣議（緊急災害対策）',
      description: 'Cabinet convenes emergency meeting for disaster countermeasures',
      triggered: M >= 7.0,
    },
    {
      minutesAfter: 360,
      label: 'International assistance request',
      labelJa: '国際救援要請',
      description: 'Government evaluates and potentially requests international disaster assistance',
      triggered: M >= 7.5,
    },
  ];
}

// ============================================================
// 6. Main Aggregate Export
// ============================================================

export interface ImpactIntelligence {
  peakIntensity: PeakIntensity | null;
  populationExposure: PopulationExposure | null;
  areaStats: IntensityAreaStats | null;
  infraSummary: InfraImpactSummary | null;
  tsunamiETAs: TsunamiETA[];
  responseTimeline: ResponseMilestone[];
}

/**
 * Compute the full impact intelligence picture from an earthquake event,
 * intensity grid, and current vessel positions.
 *
 * This is the single entry point that aggregates all sub-computations
 * into the actionable intelligence operators need.
 */
export function computeImpactIntelligence(input: {
  event: EarthquakeEvent | null;
  grid: IntensityGrid | null;
  vessels: Vessel[];
}): ImpactIntelligence {
  const { event, grid, vessels } = input;

  // No event selected — return empty intelligence
  if (!event) {
    return {
      peakIntensity: null,
      populationExposure: null,
      areaStats: null,
      infraSummary: null,
      tsunamiETAs: [],
      responseTimeline: [],
    };
  }

  // Peak intensity and area stats require an intensity grid
  const peakIntensity = grid ? computePeakIntensity(grid) : null;
  const areaStats = grid ? computeIntensityAreaStats(grid) : null;

  // Population exposure — computed from GMPE at each municipality
  const populationExposure = computePopulationExposure(event);

  // Infrastructure impact is computed directly from the event + catalogs
  const infraSummary = computeInfraImpact(event, vessels);

  // Tsunami ETAs — only for events with tsunami risk
  const tsunamiETAs = computeTsunamiETAs(event);

  // Response protocol timeline
  const responseTimeline = computeResponseTimeline(event);

  return {
    peakIntensity,
    populationExposure,
    areaStats,
    infraSummary,
    tsunamiETAs,
    responseTimeline,
  };
}
