/**
 * Landslide Risk — Newmark displacement model (Jibson 2007)
 *
 * Combines PGA (from GMPE) and slope angle to estimate Newmark displacement.
 * High displacement → high landslide risk.
 *
 * Feature 5: slope + intensity → landslide risk
 *
 * Reference:
 *   Jibson, R.W. (2007). "Regression models for estimating coseismic
 *   landslide displacement." Engineering Geology, 91(2-4), 209-218.
 */

import type {
  IntensityGrid,
  SlopeGrid,
  LandslideGrid,
  LandslideRisk,
} from '../types';

// ============================================================
// Constants
// ============================================================

const G = 9.81; // gravitational acceleration (m/s²)

/**
 * Displacement thresholds for risk classification (cm)
 * Based on Jibson (2007) recommended values:
 *   < 1 cm:  low risk
 *   1-5 cm:  medium risk
 *   > 5 cm:  high risk
 */
const THRESHOLD_MEDIUM = 1.0;
const THRESHOLD_HIGH = 5.0;

// ============================================================
// JMA Intensity → PGA conversion
// ============================================================

/**
 * Convert JMA instrumental intensity to Peak Ground Acceleration (gal).
 *
 * Inverse of: I = 2.0 * log10(PGA) + 0.94 (Midorikawa et al. 1999)
 * → PGA = 10^((I - 0.94) / 2.0)
 */
export function jmaIntensityToPGA(intensity: number): number {
  if (intensity <= 0) return 0;
  return Math.pow(10, (intensity - 0.94) / 2.0);
}

// ============================================================
// Newmark Displacement
// ============================================================

/**
 * Compute Newmark displacement using Jibson (2007) simplified model.
 *
 * log(Dn) = 0.215 + log((1 - ac/amax)^2.341 × (ac/amax)^-1.438)
 *
 * where:
 *   ac = critical acceleration = tan(slope) * g (gal)
 *   amax = PGA from GMPE (gal)
 *   Dn = Newmark displacement (cm)
 *
 * @param slopeDeg Slope angle in degrees
 * @param pgaGal Peak ground acceleration in gal (cm/s²)
 * @returns Newmark displacement in cm, or 0 if slope is negligible
 */
export function newmarkDisplacement(slopeDeg: number, pgaGal: number): number {
  if (slopeDeg < 1 || pgaGal < 1) return 0;

  // Critical acceleration: threshold to initiate sliding
  const slopeRad = slopeDeg * (Math.PI / 180);
  const ac = Math.tan(slopeRad) * G * 100; // G (m/s²) × 100 → gal (cm/s²)

  // If PGA doesn't exceed critical acceleration, no displacement
  if (pgaGal <= ac) return 0;

  const ratio = ac / pgaGal;

  // Jibson (2007) Equation 6
  const logDn = 0.215 +
    Math.log10(Math.pow(1 - ratio, 2.341) * Math.pow(ratio, -1.438));

  return Math.pow(10, logDn);
}

/**
 * Classify Newmark displacement into risk level.
 */
export function classifyRisk(displacementCm: number): LandslideRisk {
  if (displacementCm >= THRESHOLD_HIGH) return 'high';
  if (displacementCm >= THRESHOLD_MEDIUM) return 'medium';
  return 'low';
}

// ============================================================
// Landslide Grid Computation
// ============================================================

/**
 * Sample slope grid at a geographic point.
 */
function sampleSlope(grid: SlopeGrid, lat: number, lng: number): number {
  const row = Math.round((lat - grid.latMin) / grid.step);
  const col = Math.round((lng - grid.lngMin) / grid.step);

  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) {
    return 0;
  }

  return grid.data[row * grid.cols + col];
}

/**
 * Compute landslide risk grid from intensity grid and slope grid.
 *
 * For each cell in the intensity grid:
 * 1. Convert JMA intensity → PGA (gal)
 * 2. Look up slope at that location
 * 3. Compute Newmark displacement
 * 4. Store in output grid
 *
 * @param intensityGrid Current GMPE intensity grid
 * @param slopeGrid Slope grid (degrees) at 0.1° resolution
 * @returns LandslideGrid with Newmark displacement values
 */
export function computeLandslideGrid(
  intensityGrid: IntensityGrid,
  slopeGrid: SlopeGrid,
): LandslideGrid {
  const { rows, cols, center, radiusDeg } = intensityGrid;
  const lngRadiusDeg = intensityGrid.radiusLngDeg ?? radiusDeg;
  const latMin = center.lat - radiusDeg;
  const lngMin = center.lng - lngRadiusDeg;
  const latStep = (2 * radiusDeg) / (rows - 1);
  const lngStep = (2 * lngRadiusDeg) / (cols - 1);

  const data = new Float32Array(rows * cols);

  for (let r = 0; r < rows; r++) {
    const lat = latMin + r * latStep;
    for (let c = 0; c < cols; c++) {
      const lng = lngMin + c * lngStep;

      const jmaIntensity = intensityGrid.data[r * cols + c];
      const pgaGal = jmaIntensityToPGA(jmaIntensity);
      const slopeDeg = sampleSlope(slopeGrid, lat, lng);

      data[r * cols + c] = newmarkDisplacement(slopeDeg, pgaGal);
    }
  }

  return { data, cols, rows, center, radiusDeg };
}
