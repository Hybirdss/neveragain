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

// JMA intensity → RGBA color
// RGB channels: EXACT official JMA colors (気象庁震度階級関連解説表)
// Alpha: reduced for dark-theme overlay — higher intensity = more opaque.
// See docs/current/VISUALIZATION-STANDARDS.md §3 for rationale.
function intensityToColor(jma: number): [number, number, number, number] {
  if (jma >= 6.5) return [153, 0,   153, 100]; // 7:  #990099 — dark magenta
  if (jma >= 6.0) return [204, 0,   0,   90];  // 6+: #cc0000 — dark red
  if (jma >= 5.5) return [255, 51,  0,   80];  // 6-: #ff3300 — red
  if (jma >= 5.0) return [255, 102, 0,   70];  // 5+: #ff6600 — red-orange
  if (jma >= 4.5) return [255, 153, 0,   60];  // 5-: #ff9900 — orange
  if (jma >= 3.5) return [255, 255, 0,   45];  // 4:  #ffff00 — yellow
  if (jma >= 2.5) return [51,  204, 102, 30];  // 3:  #33cc66 — green
  if (jma >= 1.5) return [51,  153, 204, 20];  // 2:  #3399cc — blue
  return                  [102, 153, 204, 12];  // 1:  #6699cc — light blue
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

  // Radius in meters: 70% of grid spacing so cells overlap for smooth field
  const cellRadiusM = (latStep * 111_000) * 0.7;

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

// Pre-allocated pool for animation frames — avoids GC every 50ms.
// Pool grows to fit the largest grid, then stays that size.
let animPool: IntensityPoint[] = [];
let animPoolGrid: IntensityGrid | null = null;

/**
 * Ensure the animation pool has pre-allocated points for this grid.
 * Only reallocates when the grid reference changes.
 */
function ensureAnimPool(grid: IntensityGrid): void {
  if (grid === animPoolGrid) return;
  animPoolGrid = grid;

  const latMin = grid.center.lat - grid.radiusDeg;
  const lngRadDeg = grid.radiusLngDeg ?? grid.radiusDeg;
  const lngMin = grid.center.lng - lngRadDeg;
  const latStep = (2 * grid.radiusDeg) / Math.max(1, grid.rows - 1);
  const lngStep = (2 * lngRadDeg) / Math.max(1, grid.cols - 1);

  // Count qualifying cells
  let count = 0;
  for (let i = 0; i < grid.data.length; i++) {
    if (grid.data[i] >= 0.5) count++;
  }

  // Grow pool if needed (never shrink — avoids repeated alloc for same grid size)
  while (animPool.length < count) {
    animPool.push({
      position: [0, 0],
      color: [0, 0, 0, 0],
      radius: 0,
    });
  }

  // Pre-fill positions (they don't change during animation)
  const cellRadiusM = (latStep * 111_000) * 0.7;
  let idx = 0;
  for (let r = 0; r < grid.rows; r++) {
    const lat = latMin + r * latStep;
    for (let c = 0; c < grid.cols; c++) {
      if (grid.data[r * grid.cols + c] < 0.5) continue;
      const lng = lngMin + c * lngStep;
      const pt = animPool[idx];
      pt.position[0] = lng;
      pt.position[1] = lat;
      pt.radius = cellRadiusM;
      idx++;
    }
  }
}

/**
 * Build points with distance-based alpha modulation for ink-in-water effect.
 * Uses pre-allocated pool — zero allocations per frame.
 */
function gridToAnimatedPoints(
  grid: IntensityGrid,
  epicenter: { lat: number; lng: number },
  revealRadiusKm: number,
): IntensityPoint[] {
  ensureAnimPool(grid);

  const latMin = grid.center.lat - grid.radiusDeg;
  const lngRadDeg = grid.radiusLngDeg ?? grid.radiusDeg;
  const lngMin = grid.center.lng - lngRadDeg;
  const latStep = (2 * grid.radiusDeg) / Math.max(1, grid.rows - 1);
  const lngStep = (2 * lngRadDeg) / Math.max(1, grid.cols - 1);
  const cellRadiusM = (latStep * 111_000) * 0.7;
  const outerEdge = revealRadiusKm + FADE_BAND_KM;
  const cosLat = Math.cos(epicenter.lat * Math.PI / 180);

  let visibleCount = 0;

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
      const pt = animPool[visibleCount];
      pt.position[0] = lng;
      pt.position[1] = lat;
      pt.radius = cellRadiusM;

      // Within reveal radius: full alpha
      if (distKm <= revealRadiusKm) {
        pt.color[0] = baseColor[0];
        pt.color[1] = baseColor[1];
        pt.color[2] = baseColor[2];
        pt.color[3] = baseColor[3];
      } else {
        // Fade band: ease-out alpha falloff
        const t = 1 - (distKm - revealRadiusKm) / FADE_BAND_KM;
        const alpha = t * t;
        pt.color[0] = baseColor[0];
        pt.color[1] = baseColor[1];
        pt.color[2] = baseColor[2];
        pt.color[3] = Math.round(baseColor[3] * alpha);
      }

      visibleCount++;
    }
  }

  // Return a slice view — only visible points (no allocation: slice reuses pool objects)
  return animPool.slice(0, visibleCount);
}

// ── Public API ───────────────────────────────────────────────────

export function createIntensityLayer(
  grid: IntensityGrid | null,
  epicenter?: { lat: number; lng: number },
  revealRadiusKm?: number,
  opacity?: number,
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
    opacity: opacity ?? 1,
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
