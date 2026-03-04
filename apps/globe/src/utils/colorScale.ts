/**
 * colorScale.ts — Visual encoding utilities
 *
 * Maps seismic values (JMA intensity, depth, magnitude) to visual
 * properties (colour, radius) for globe and UI rendering.
 */

import { JMA_COLORS, JMA_THRESHOLDS } from '../types';
import type { JmaClass } from '../types';

/**
 * Map a continuous JMA instrumental intensity value to its
 * corresponding JMA colour (HEX string).
 *
 * Thresholds are walked top-down (strongest first) so that the first
 * matching bucket is returned.
 */
export function intensityToColor(intensity: number): string {
  for (const { class: cls, min } of JMA_THRESHOLDS) {
    if (intensity >= min) {
      return JMA_COLORS[cls as JmaClass];
    }
  }
  // Fallback (should not be reached given -Infinity sentinel)
  return JMA_COLORS['0'];
}

/**
 * Map earthquake depth (km) to a colour on a blue-to-red gradient.
 *
 * Shallow (<30 km)  → warm red
 * Medium  (30-100 km) → orange/yellow
 * Deep    (>100 km) → cool blue
 */
export function depthToColor(depth_km: number): string {
  if (depth_km < 30) return '#ff4444';
  if (depth_km < 70) return '#ff7722';
  if (depth_km < 150) return '#ffaa00';
  if (depth_km < 300) return '#44aaff';
  return '#3355cc';
}

/**
 * Convert earthquake magnitude to a pixel radius for point rendering.
 *
 * Uses an exponential scale so that the visual area grows roughly
 * proportional to the energy release (each whole magnitude step ≈ 31.6×
 * energy, but we use a gentler visual exponent for readability).
 *
 * Returns a value in the range [2, 40].
 */
export function magnitudeToRadius(magnitude: number): number {
  const clamped = Math.max(0, Math.min(magnitude, 10));
  // Base 2px at M0, doubling roughly every 2 magnitude units
  const radius = 2 * Math.pow(1.6, clamped);
  return Math.min(radius, 40);
}

/** Enhanced JMA colors for terrain-draped overlays (isoseismal + ShakeMap). */
export const ENHANCED_JMA: Record<string, { color: string; alpha: number }> = {
  '7':  { color: '#cc00cc', alpha: 0.60 },
  '6+': { color: '#dd0000', alpha: 0.55 },
  '6-': { color: '#ff2200', alpha: 0.55 },
  '5+': { color: '#ff6600', alpha: 0.50 },
  '5-': { color: '#ff9900', alpha: 0.45 },
  '4':  { color: '#ffdd00', alpha: 0.40 },
  '3':  { color: '#44cc66', alpha: 0.35 },
  '2':  { color: '#3399cc', alpha: 0.30 },
  '1':  { color: '#6699cc', alpha: 0.25 },
  '0':  { color: '#99bbdd', alpha: 0.20 },
};

// ── USGS MMI Color Scale ────────────────────────────────────────
// Official Modified Mercalli Intensity colours from USGS ShakeMap.
// Flat matte values — no glow, no neon. Used only by shakeMapOverlay.

export const MMI_COLORS: Record<number, string> = {
  1: '#FFFFFF',
  2: '#ACD8E9',
  3: '#7BC8E2',
  4: '#83D0DA',
  5: '#7BC87F',
  6: '#F9F518',
  7: '#FAC611',
  8: '#FA8A11',
  9: '#F7100C',
  10: '#C80F0A',
};

/**
 * Map a numeric MMI value to its USGS colour hex string.
 * Rounds to nearest integer, clamps to [1, 10].
 */
export function mmiToColor(mmi: number): string {
  const clamped = Math.max(1, Math.min(10, Math.round(mmi)));
  return MMI_COLORS[clamped] ?? '#FFFFFF';
}
