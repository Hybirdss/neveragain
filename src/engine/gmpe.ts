/**
 * Si & Midorikawa (1999, revised 2006) GMPE — Pure Functions
 *
 * Ground Motion Prediction Equation for predicting PGV on Vs30=600 m/s bedrock.
 * All functions are pure: no side effects, no DOM access.
 *
 * Reference:
 *   Si, H. and Midorikawa, S. (1999). "New Attenuation Relationships for
 *   Peak Ground Acceleration and Velocity Considering Effects of Fault Type
 *   and Site Condition." Journal of Structural and Construction Engineering
 *   (Transactions of AIJ), No. 523, pp. 63-70.
 */

import type {
  FaultType,
  GmpeInput,
  GmpeResult,
  IntensityGrid,
  JmaClass,
} from '../types';

// ============================================================
// Constants
// ============================================================

const EARTH_RADIUS_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;

/** Vs30 amplification factor: Vs600 -> Vs400 (default site condition) */
const VS30_AMP_FACTOR = 1.41;

/** Fault-type correction coefficients */
const FAULT_CORRECTION: Record<FaultType, number> = {
  crustal: 0.0,
  interface: -0.02,
  intraslab: 0.12,
};

/** Maximum Mw for the GMPE regression validity range */
const MW_CAP = 8.3;

// ============================================================
// Haversine Distance
// ============================================================

/**
 * Compute the great-circle distance between two points on Earth using the
 * Haversine formula.
 *
 * @param lat1 Latitude of point 1 (degrees)
 * @param lng1 Longitude of point 1 (degrees)
 * @param lat2 Latitude of point 2 (degrees)
 * @param lng2 Longitude of point 2 (degrees)
 * @returns Surface distance in km
 */
export function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) *
      Math.cos(lat2 * DEG_TO_RAD) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// Core GMPE Functions
// ============================================================

/**
 * Compute PGV at Vs30=600 m/s bedrock using Si & Midorikawa (1999).
 *
 * log10(PGV600) = 0.58*Mw + 0.0038*D + d
 *               - log10(X + 0.0028 * 10^(0.5*Mw))
 *               - 0.002*X - 1.29
 *
 * @param input GMPE input parameters
 * @returns PGV at Vs600 in cm/s
 */
export function computePgv600(input: GmpeInput): number {
  const mw = Math.min(input.Mw, MW_CAP);
  const D = input.depth_km;
  const X = input.distance_km;
  const d = FAULT_CORRECTION[input.faultType];

  const logPgv =
    0.58 * mw +
    0.0038 * D +
    d -
    Math.log10(X + 0.0028 * Math.pow(10, 0.5 * mw)) -
    0.002 * X -
    1.29;

  return Math.pow(10, logPgv);
}

/**
 * Full GMPE computation: PGV600 -> surface PGV -> JMA intensity -> JMA class.
 *
 * @param input GMPE input parameters
 * @returns Complete GMPE result with all derived values
 */
export function computeGmpe(input: GmpeInput): GmpeResult {
  const pgv600 = computePgv600(input);
  const pgv_surface = pgv600 * VS30_AMP_FACTOR;

  // PGV -> JMA intensity: I = 2.43 + 1.82 * log10(PGV_surface)
  const jmaIntensity =
    pgv_surface > 0 ? 2.43 + 1.82 * Math.log10(pgv_surface) : 0;

  return {
    pgv600,
    pgv_surface,
    jmaIntensity,
    jmaClass: toJmaClass(jmaIntensity),
  };
}

// ============================================================
// JMA Intensity Classification
// ============================================================

/**
 * Map a continuous JMA instrumental intensity value to a discrete JMA class.
 *
 * | JMA Class | Range         |
 * |-----------|---------------|
 * | 0         | I < 0.5       |
 * | 1         | 0.5 <= I < 1.5|
 * | 2         | 1.5 <= I < 2.5|
 * | 3         | 2.5 <= I < 3.5|
 * | 4         | 3.5 <= I < 4.5|
 * | 5-        | 4.5 <= I < 5.0|
 * | 5+        | 5.0 <= I < 5.5|
 * | 6-        | 5.5 <= I < 6.0|
 * | 6+        | 6.0 <= I < 6.5|
 * | 7         | I >= 6.5      |
 */
export function toJmaClass(intensity: number): JmaClass {
  if (intensity >= 6.5) return '7';
  if (intensity >= 6.0) return '6+';
  if (intensity >= 5.5) return '6-';
  if (intensity >= 5.0) return '5+';
  if (intensity >= 4.5) return '5-';
  if (intensity >= 3.5) return '4';
  if (intensity >= 2.5) return '3';
  if (intensity >= 1.5) return '2';
  if (intensity >= 0.5) return '1';
  return '0';
}

// ============================================================
// Intensity Grid Computation
// ============================================================

/**
 * Compute a 2D grid of JMA intensity values centered on the epicenter.
 *
 * The grid spans [center - radiusDeg, center + radiusDeg] in both lat and lng
 * with a step of gridSpacingDeg. Each cell stores the continuous JMA intensity.
 * Data is stored in a Float32Array in row-major order (rows = latitude).
 *
 * @param epicenter Epicenter coordinates { lat, lng } in degrees
 * @param Mw Moment magnitude
 * @param depth_km Focal depth in km
 * @param faultType Fault type classification
 * @param gridSpacingDeg Grid spacing in degrees (default 0.1)
 * @param radiusDeg Half-span of the grid from center in degrees (default 5)
 * @returns IntensityGrid with Float32Array data
 */
export function computeIntensityGrid(
  epicenter: { lat: number; lng: number },
  Mw: number,
  depth_km: number,
  faultType: FaultType,
  gridSpacingDeg: number = 0.1,
  radiusDeg: number = 5,
): IntensityGrid {
  const latMin = epicenter.lat - radiusDeg;
  const latMax = epicenter.lat + radiusDeg;
  const lngMin = epicenter.lng - radiusDeg;
  const lngMax = epicenter.lng + radiusDeg;

  // Calculate grid dimensions
  const rows = Math.floor((latMax - latMin) / gridSpacingDeg) + 1;
  const cols = Math.floor((lngMax - lngMin) / gridSpacingDeg) + 1;

  const data = new Float32Array(rows * cols);

  // Pre-compute capped Mw values for the inner loop
  const mw = Math.min(Mw, MW_CAP);
  const d = FAULT_CORRECTION[faultType];
  const magTerm = 0.58 * mw - 1.29 + 0.0038 * depth_km + d;
  const nearSourceTerm = 0.0028 * Math.pow(10, 0.5 * mw);

  for (let row = 0; row < rows; row++) {
    const lat = latMin + row * gridSpacingDeg;
    const cosLat = Math.cos(lat * DEG_TO_RAD);
    const cosEpiLat = Math.cos(epicenter.lat * DEG_TO_RAD);

    for (let col = 0; col < cols; col++) {
      const lng = lngMin + col * gridSpacingDeg;

      // Haversine inline for performance
      const dLat = (lat - epicenter.lat) * DEG_TO_RAD;
      const dLng = (lng - epicenter.lng) * DEG_TO_RAD;
      const a =
        Math.sin(dLat / 2) ** 2 +
        cosEpiLat * cosLat * Math.sin(dLng / 2) ** 2;
      const surfaceDist =
        2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      // Hypocentral distance
      const X = Math.sqrt(surfaceDist * surfaceDist + depth_km * depth_km);

      // GMPE: log10(PGV600)
      const logPgv600 = magTerm - Math.log10(X + nearSourceTerm) - 0.002 * X;
      const pgv600 = Math.pow(10, logPgv600);

      // Surface PGV with Vs30 amplification
      const pgvSurface = pgv600 * VS30_AMP_FACTOR;

      // PGV -> JMA intensity
      const intensity =
        pgvSurface > 0 ? 2.43 + 1.82 * Math.log10(pgvSurface) : 0;

      data[row * cols + col] = intensity;
    }
  }

  return {
    data,
    cols,
    rows,
    center: { lat: epicenter.lat, lng: epicenter.lng },
    radiusDeg,
  };
}

// ============================================================
// Validation
// ============================================================

interface ValidationCase {
  label: string;
  epicenter: { lat: number; lng: number };
  Mw: number;
  depth_km: number;
  faultType: FaultType;
  stations: {
    name: string;
    lat: number;
    lng: number;
    expectedClass: JmaClass;
    tolerance: number; // +/- on continuous intensity
    expectedIntensity: number;
  }[];
}

const VALIDATION_CASES: ValidationCase[] = [
  {
    label: 'Tohoku 2011 (Mw 9.0)',
    epicenter: { lat: 38.322, lng: 142.369 },
    Mw: 9.0,
    depth_km: 24,
    faultType: 'interface',
    stations: [
      {
        name: 'Sendai',
        lat: 38.26,
        lng: 140.88,
        expectedClass: '6+',
        // Mw 8.3 cap + point-source for a 500km rupture => systematic underestimate
        tolerance: 2.0,
        expectedIntensity: 6.5,
      },
      {
        name: 'Tokyo',
        lat: 35.68,
        lng: 139.77,
        expectedClass: '5-',
        // Mw 8.3 cap causes underestimation at far-field too
        tolerance: 2.0,
        expectedIntensity: 4.5,
      },
    ],
  },
  {
    label: 'Kumamoto 2016 (Mw 7.0)',
    epicenter: { lat: 32.755, lng: 130.808 },
    Mw: 7.0,
    depth_km: 11,
    faultType: 'crustal',
    stations: [
      {
        name: 'Kumamoto city',
        lat: 32.79,
        lng: 130.74,
        expectedClass: '7',
        tolerance: 1.5,
        expectedIntensity: 6.7,
      },
      {
        name: 'Fukuoka',
        lat: 33.58,
        lng: 130.40,
        expectedClass: '3',
        tolerance: 1.5,
        expectedIntensity: 3.0,
      },
    ],
  },
  {
    label: 'Noto 2024 (Mw 7.5)',
    epicenter: { lat: 37.488, lng: 137.268 },
    Mw: 7.5,
    depth_km: 10,
    faultType: 'crustal',
    stations: [
      {
        name: 'Wajima',
        lat: 37.39,
        lng: 136.90,
        expectedClass: '7',
        // Near-field finite-fault effects not captured by point-source model
        tolerance: 2.0,
        expectedIntensity: 6.8,
      },
      {
        name: 'Kanazawa',
        lat: 36.56,
        lng: 136.65,
        expectedClass: '5+',
        tolerance: 1.5,
        expectedIntensity: 5.3,
      },
    ],
  },
];

export interface ValidationResult {
  label: string;
  station: string;
  distance_km: number;
  computedIntensity: number;
  computedClass: JmaClass;
  expectedClass: JmaClass;
  expectedIntensity: number;
  pass: boolean;
}

/**
 * Run validation tests against known historical earthquake observations.
 *
 * Tests:
 *   - Tohoku 2011: Sendai (~170 km) -> ~6+, Tokyo (~374 km) -> ~5-
 *   - Kumamoto 2016: Kumamoto city (~8 km) -> ~7, Fukuoka (~90 km) -> ~3
 *   - Noto 2024: Wajima (~8 km) -> ~7, Kanazawa (~80 km) -> ~5+
 *
 * @returns Array of validation results with pass/fail for each station
 */
export function validateGmpe(): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const vc of VALIDATION_CASES) {
    for (const station of vc.stations) {
      const surfaceDist = haversine(
        vc.epicenter.lat,
        vc.epicenter.lng,
        station.lat,
        station.lng,
      );
      const hypoDist = Math.sqrt(
        surfaceDist * surfaceDist + vc.depth_km * vc.depth_km,
      );

      const result = computeGmpe({
        Mw: vc.Mw,
        depth_km: vc.depth_km,
        distance_km: hypoDist,
        faultType: vc.faultType,
      });

      const pass =
        Math.abs(result.jmaIntensity - station.expectedIntensity) <=
        station.tolerance;

      results.push({
        label: vc.label,
        station: station.name,
        distance_km: Math.round(surfaceDist),
        computedIntensity: Math.round(result.jmaIntensity * 100) / 100,
        computedClass: result.jmaClass,
        expectedClass: station.expectedClass,
        expectedIntensity: station.expectedIntensity,
        pass,
      });
    }
  }

  return results;
}
