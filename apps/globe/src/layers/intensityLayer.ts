/**
 * Intensity Layer — GMPE intensity field as colored grid dots.
 *
 * Converts the IntensityGrid (Float32Array) to point data
 * and renders it as semi-transparent filled circles via ScatterplotLayer.
 * Each grid cell becomes a dot whose color follows the JMA scale.
 *
 * Animation mode ("ink-in-water"):
 * When epicenter + revealRadiusKm are provided, cells fade in based on
 * distance from epicenter — producing an outward-spreading reveal effect.
 * Cells within revealRadiusKm: full alpha. Cells near the edge: smooth
 * fade over a 30km band. Cells beyond: invisible.
 *
 * Performance: grid is only recomputed when selectedEvent changes,
 * NOT every frame. Data array is cached (except during animation).
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import type { IntensityGrid } from '../types';

interface IntensityPoint {
  position: [number, number];
  color: [number, number, number, number];
  radius: number;
}

// JMA intensity → RGBA color (dark theme, restrained opacity)
function intensityToColor(jma: number): [number, number, number, number] {
  if (jma >= 6.5) return [150, 0,   80,  140]; // 7: dark magenta
  if (jma >= 6.0) return [200, 0,   0,   130]; // 6+: deep red
  if (jma >= 5.5) return [239, 50,  0,   120]; // 6-: red
  if (jma >= 5.0) return [255, 100, 0,   110]; // 5+: red-orange
  if (jma >= 4.5) return [255, 160, 0,   100]; // 5-: orange
  if (jma >= 3.5) return [255, 220, 0,   80];  // 4: yellow
  if (jma >= 2.5) return [80,  200, 100, 60];  // 3: green
  if (jma >= 1.5) return [60,  130, 200, 40];  // 2: blue
  return                  [40,  80,  140, 25];  // 1: dim blue
}

// ── Static (non-animated) cache ─────────────────────────────────

let cachedPoints: IntensityPoint[] = [];
let cachedGridRef: IntensityGrid | null = null;

function gridToPoints(grid: IntensityGrid): IntensityPoint[] {
  if (grid === cachedGridRef) return cachedPoints;
  cachedGridRef = grid;

  const points: IntensityPoint[] = [];
  const latMin = grid.center.lat - grid.radiusDeg;
  const lngRadDeg = grid.radiusLngDeg ?? grid.radiusDeg;
  const lngMin = grid.center.lng - lngRadDeg;
  const latStep = (2 * grid.radiusDeg) / Math.max(1, grid.rows - 1);
  const lngStep = (2 * lngRadDeg) / Math.max(1, grid.cols - 1);

  // Radius in meters: half the grid spacing (in degrees → meters)
  const cellRadiusM = (latStep * 111_000) / 2;

  for (let r = 0; r < grid.rows; r++) {
    const lat = latMin + r * latStep;
    for (let c = 0; c < grid.cols; c++) {
      const intensity = grid.data[r * grid.cols + c];
      if (intensity < 0.5) continue; // skip below JMA 1
      const lng = lngMin + c * lngStep;
      points.push({
        position: [lng, lat],
        color: intensityToColor(intensity),
        radius: cellRadiusM,
      });
    }
  }

  cachedPoints = points;
  return points;
}

// ── Animated (ink-in-water) point builder ────────────────────────

const FADE_BAND_KM = 30; // smooth fade band at the reveal edge

/**
 * Build points with distance-based alpha modulation for ink-in-water effect.
 * NOT cached — called every 50ms during animation.
 */
function gridToAnimatedPoints(
  grid: IntensityGrid,
  epicenter: { lat: number; lng: number },
  revealRadiusKm: number,
): IntensityPoint[] {
  const points: IntensityPoint[] = [];
  const latMin = grid.center.lat - grid.radiusDeg;
  const lngRadDeg = grid.radiusLngDeg ?? grid.radiusDeg;
  const lngMin = grid.center.lng - lngRadDeg;
  const latStep = (2 * grid.radiusDeg) / Math.max(1, grid.rows - 1);
  const lngStep = (2 * lngRadDeg) / Math.max(1, grid.cols - 1);
  const cellRadiusM = (latStep * 111_000) / 2;

  const outerEdge = revealRadiusKm + FADE_BAND_KM;
  const cosLat = Math.cos(epicenter.lat * Math.PI / 180);

  for (let r = 0; r < grid.rows; r++) {
    const lat = latMin + r * latStep;
    const dLatKm = (lat - epicenter.lat) * 111;
    for (let c = 0; c < grid.cols; c++) {
      const intensity = grid.data[r * grid.cols + c];
      if (intensity < 0.5) continue; // skip below JMA 1

      const lng = lngMin + c * lngStep;
      const dLngKm = (lng - epicenter.lng) * 111 * cosLat;
      const distKm = Math.sqrt(dLatKm * dLatKm + dLngKm * dLngKm);

      // Beyond outer edge: invisible
      if (distKm > outerEdge) continue;

      const baseColor = intensityToColor(intensity);

      // Within reveal radius: full alpha (as computed by intensityToColor)
      if (distKm <= revealRadiusKm) {
        points.push({
          position: [lng, lat],
          color: baseColor,
          radius: cellRadiusM,
        });
      } else {
        // In the fade band: smooth alpha falloff
        const t = 1 - (distKm - revealRadiusKm) / FADE_BAND_KM;
        // Ease-out for organic ink feel
        const alpha = t * t;
        points.push({
          position: [lng, lat],
          color: [baseColor[0], baseColor[1], baseColor[2], Math.round(baseColor[3] * alpha)],
          radius: cellRadiusM,
        });
      }
    }
  }

  return points;
}

// ── Public API ───────────────────────────────────────────────────

export function createIntensityLayer(
  grid: IntensityGrid | null,
  epicenter?: { lat: number; lng: number },
  revealRadiusKm?: number,
): ScatterplotLayer<IntensityPoint> | null {
  if (!grid) return null;

  const isAnimated = epicenter != null && revealRadiusKm != null;
  const points = isAnimated
    ? gridToAnimatedPoints(grid, epicenter, revealRadiusKm)
    : gridToPoints(grid);

  if (points.length === 0) return null;

  // Use a unique trigger value during animation so deck.gl sees data changes
  const animTrigger = isAnimated ? revealRadiusKm : grid;

  return new ScatterplotLayer<IntensityPoint>({
    id: 'intensity-field',
    data: points,
    pickable: false,
    stroked: false,
    filled: true,
    radiusUnits: 'meters',
    getPosition: (d) => d.position,
    getRadius: (d) => d.radius,
    getFillColor: (d) => d.color,
    updateTriggers: {
      getPosition: [animTrigger],
      getFillColor: [animTrigger],
      getRadius: [animTrigger],
    },
  });
}
