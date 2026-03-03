/**
 * Wave Propagation — Pure functions for P/S wave front calculation.
 *
 * Computes the apparent surface radius of seismic wave fronts,
 * accounting for focal depth via the Pythagorean depth correction:
 *   r_surface = sqrt((V * dt)^2 - h^2)
 *
 * Converts km distances to globe degrees using the 111.19 km/deg factor.
 */

import type { WaveState, WaveConfig } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: WaveConfig = {
  vpKmPerSec: 6.0,
  vsKmPerSec: 3.5,
};

/** Approximate km per degree of arc on Earth's surface. */
const KM_PER_DEG = 111.19;

// ---------------------------------------------------------------------------
// Core: updateWaveState
// ---------------------------------------------------------------------------

/**
 * Compute the current wave state for a given earthquake at a given instant.
 *
 * @param epicenter  - {lat, lng} of the epicenter (degrees)
 * @param depth_km   - Focal depth in kilometres
 * @param originTime - Earthquake origin time (Unix ms)
 * @param now        - Current / simulated time (Unix ms)
 * @param config     - Optional wave velocity overrides
 * @returns The current WaveState snapshot
 */
export function updateWaveState(
  epicenter: { lat: number; lng: number },
  depth_km: number,
  originTime: number,
  now: number,
  config?: Partial<WaveConfig>,
): WaveState {
  const cfg: WaveConfig = { ...DEFAULT_CONFIG, ...config };
  const elapsedSec = Math.max(0, (now - originTime) / 1000);

  return {
    epicenter,
    depth_km,
    pWaveRadiusDeg: apparentRadiusDeg(cfg.vpKmPerSec, elapsedSec, depth_km),
    sWaveRadiusDeg: apparentRadiusDeg(cfg.vsKmPerSec, elapsedSec, depth_km),
    elapsedSec,
  };
}

// ---------------------------------------------------------------------------
// Arrival-time helpers
// ---------------------------------------------------------------------------

/**
 * Time (in seconds) for the P-wave to arrive at a given epicentral distance.
 *
 * Uses the hypocentral ray-path:
 *   t = sqrt(distance_km^2 + depth_km^2) / Vp
 */
export function pWaveArrivalTime(
  depth_km: number,
  distanceKm: number,
  config?: Partial<WaveConfig>,
): number {
  const vp = config?.vpKmPerSec ?? DEFAULT_CONFIG.vpKmPerSec;
  const hypo = Math.sqrt(distanceKm ** 2 + depth_km ** 2);
  return hypo / vp;
}

/**
 * Time (in seconds) for the S-wave to arrive at a given epicentral distance.
 *
 * Uses the hypocentral ray-path:
 *   t = sqrt(distance_km^2 + depth_km^2) / Vs
 */
export function sWaveArrivalTime(
  depth_km: number,
  distanceKm: number,
  config?: Partial<WaveConfig>,
): number {
  const vs = config?.vsKmPerSec ?? DEFAULT_CONFIG.vsKmPerSec;
  const hypo = Math.sqrt(distanceKm ** 2 + depth_km ** 2);
  return hypo / vs;
}

// ---------------------------------------------------------------------------
// Active-check helper
// ---------------------------------------------------------------------------

/**
 * Determine whether each wave front is still within the visible area.
 *
 * @param waveState     - Current wave state snapshot
 * @param maxRadiusDeg  - Maximum display radius (degrees)
 * @returns Flags indicating whether each wave is still active (radius > 0 and
 *          within the max display radius).
 */
export function isWaveActive(
  waveState: WaveState,
  maxRadiusDeg: number,
): { pActive: boolean; sActive: boolean } {
  return {
    pActive: waveState.pWaveRadiusDeg > 0 && waveState.pWaveRadiusDeg < maxRadiusDeg,
    sActive: waveState.sWaveRadiusDeg > 0 && waveState.sWaveRadiusDeg < maxRadiusDeg,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Apparent surface radius in degrees.
 *
 * Depth correction: the 3-D spherical wave front of radius V*dt must travel
 * past the focal depth before it intersects the surface. The intersection
 * circle has radius sqrt((V*dt)^2 - h^2) in km, converted to degrees.
 */
function apparentRadiusDeg(
  v_km_s: number,
  dt_s: number,
  depth_km: number,
): number {
  const traveled = v_km_s * dt_s;
  if (traveled <= depth_km) return 0;
  const surfaceKm = Math.sqrt(traveled ** 2 - depth_km ** 2);
  return surfaceKm / KM_PER_DEG;
}
