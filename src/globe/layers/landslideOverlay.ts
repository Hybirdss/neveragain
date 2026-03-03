/**
 * Landslide Overlay — Renders landslide risk contours on the globe
 *
 * Uses Cesium entities to display 3-level landslide risk zones
 * (low/medium/high) computed from the Newmark displacement model.
 *
 * Feature 5: slope + intensity → landslide risk visualization
 */

import * as Cesium from 'cesium';
import { contours } from 'd3-contour';
import type { GlobeInstance } from '../globeInstance';
import type { LandslideGrid } from '../../types';

// ============================================================
// Constants
// ============================================================

/** Displacement thresholds for contour levels (cm) */
const CONTOUR_THRESHOLDS = [1.0, 5.0, 15.0];

/** Colors for risk levels */
const RISK_COLORS: Record<number, { color: Cesium.Color; label: string }> = {
  1.0: { color: Cesium.Color.YELLOW.withAlpha(0.25), label: 'Medium Risk' },
  5.0: { color: Cesium.Color.ORANGE.withAlpha(0.35), label: 'High Risk' },
  15.0: { color: Cesium.Color.RED.withAlpha(0.45), label: 'Very High Risk' },
};

// ============================================================
// State
// ============================================================

let landslideEntities: Cesium.Entity[] = [];

// ============================================================
// Public API
// ============================================================

/**
 * Update landslide risk overlay on the globe.
 *
 * Generates contours from the landslide displacement grid
 * and renders them as filled polygons on the globe.
 */
export function updateLandslideOverlay(
  viewer: GlobeInstance,
  grid: LandslideGrid,
): void {
  clearLandslideOverlay(viewer);

  const { rows, cols, center, radiusDeg } = grid;
  const latMin = center.lat - radiusDeg;
  const lngMin = center.lng - radiusDeg;

  // Generate contours using d3-contour
  const contourGen = contours()
    .size([cols, rows])
    .thresholds(CONTOUR_THRESHOLDS);

  const values = Array.from(grid.data);
  const multiPolygons = contourGen(values);

  for (const mp of multiPolygons) {
    const riskConfig = RISK_COLORS[mp.value];
    if (!riskConfig) continue;

    for (const polygon of mp.coordinates) {
      for (const ring of polygon) {
        if (ring.length < 4) continue;

        // Convert pixel coords to geographic
        const positions = ring.map(([col, row]) => {
          const lng = lngMin + col * (2 * radiusDeg / (cols - 1));
          const lat = latMin + row * (2 * radiusDeg / (rows - 1));
          return Cesium.Cartesian3.fromDegrees(lng, lat, 200);
        });

        const entity = viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(positions),
            material: riskConfig.color,
            outline: true,
            outlineColor: riskConfig.color.withAlpha(0.6),
            outlineWidth: 1,
            height: 200,
          },
        });

        landslideEntities.push(entity);
      }
    }
  }
}

/**
 * Remove all landslide overlay entities from the globe.
 */
export function clearLandslideOverlay(viewer: GlobeInstance): void {
  for (const entity of landslideEntities) {
    viewer.entities.remove(entity);
  }
  landslideEntities = [];
}
