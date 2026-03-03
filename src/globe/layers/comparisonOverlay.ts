/**
 * Comparison Overlay — Renders GMPE vs J-SHIS hazard difference contours
 *
 * Displays a diverging red-grey-blue overlay:
 *   Red:  GMPE > J-SHIS (stronger than 30yr expectation)
 *   Grey: Similar to expectation
 *   Blue: GMPE < J-SHIS (weaker than expectation)
 *
 * Feature 4: J-SHIS × GMPE comparison view
 */

import * as Cesium from 'cesium';
import { contours } from 'd3-contour';
import type { GlobeInstance } from '../globeInstance';
import type { ComparisonGrid } from '../../types';

// ============================================================
// Constants
// ============================================================

/** Thresholds for "stronger than expected" (positive) contours */
const POS_THRESHOLDS = [0.5, 1.0, 2.0, 3.0];
/** Thresholds for "weaker than expected" (negative) — we negate the grid to use d3-contour */
const NEG_THRESHOLDS = [0.5, 1.0, 2.0, 3.0];

/** Colors for positive (stronger) levels */
const POS_COLORS: Record<number, Cesium.Color> = {
  0.5: Cesium.Color.fromCssColorString('rgba(200, 100, 100, 0.2)'),
  1.0: Cesium.Color.fromCssColorString('rgba(220, 60, 60, 0.3)'),
  2.0: Cesium.Color.fromCssColorString('rgba(240, 30, 30, 0.4)'),
  3.0: Cesium.Color.fromCssColorString('rgba(255, 0, 0, 0.5)'),
};

/** Colors for negative (weaker) levels */
const NEG_COLORS: Record<number, Cesium.Color> = {
  0.5: Cesium.Color.fromCssColorString('rgba(100, 100, 200, 0.2)'),
  1.0: Cesium.Color.fromCssColorString('rgba(60, 60, 220, 0.3)'),
  2.0: Cesium.Color.fromCssColorString('rgba(30, 30, 240, 0.4)'),
  3.0: Cesium.Color.fromCssColorString('rgba(0, 0, 255, 0.5)'),
};

// ============================================================
// State
// ============================================================

let comparisonEntities: Cesium.Entity[] = [];

// ============================================================
// Helpers
// ============================================================

function renderContours(
  viewer: GlobeInstance,
  values: number[],
  cols: number,
  rows: number,
  latMin: number,
  lngMin: number,
  radiusDeg: number,
  thresholds: number[],
  colors: Record<number, Cesium.Color>,
): void {
  const contourGen = contours()
    .size([cols, rows])
    .thresholds(thresholds);

  const multiPolygons = contourGen(values);

  for (const mp of multiPolygons) {
    const color = colors[mp.value];
    if (!color) continue;

    for (const polygon of mp.coordinates) {
      for (const ring of polygon) {
        if (ring.length < 4) continue;

        const positions = ring.map(([col, row]) => {
          const lng = lngMin + col * (2 * radiusDeg / (cols - 1));
          const lat = latMin + row * (2 * radiusDeg / (rows - 1));
          return Cesium.Cartesian3.fromDegrees(lng, lat, 300);
        });

        const entity = viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(positions),
            material: color,
            outline: true,
            outlineColor: color.withAlpha(0.5),
            outlineWidth: 1,
            height: 300,
          },
        });

        comparisonEntities.push(entity);
      }
    }
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Render comparison overlay (diverging red/blue contours).
 */
export function updateComparisonOverlay(
  viewer: GlobeInstance,
  grid: ComparisonGrid,
): void {
  clearComparisonOverlay(viewer);

  const { rows, cols, center, radiusDeg } = grid;
  const latMin = center.lat - radiusDeg;
  const lngMin = center.lng - radiusDeg;

  // Positive values (stronger than expected) → red contours
  const posValues = Array.from(grid.data).map(v => Math.max(0, v));
  renderContours(viewer, posValues, cols, rows, latMin, lngMin, radiusDeg, POS_THRESHOLDS, POS_COLORS);

  // Negative values (weaker than expected) → blue contours (negate to make positive for d3-contour)
  const negValues = Array.from(grid.data).map(v => Math.max(0, -v));
  renderContours(viewer, negValues, cols, rows, latMin, lngMin, radiusDeg, NEG_THRESHOLDS, NEG_COLORS);
}

/**
 * Remove all comparison overlay entities.
 */
export function clearComparisonOverlay(viewer: GlobeInstance): void {
  for (const entity of comparisonEntities) {
    viewer.entities.remove(entity);
  }
  comparisonEntities = [];
}
