/**
 * Contour Projection — Converts an IntensityGrid into GeoJSON features
 * suitable for globe.gl polygonsData using d3-contour.
 *
 * Pure functions only. No side-effects.
 */

import { contours } from 'd3-contour';
import type { IntensityGrid, JmaClass } from '../types';
import { getJmaColor, JMA_THRESHOLDS } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** JMA instrumental-intensity boundary values used as contour thresholds. */
export const CONTOUR_THRESHOLDS = [0.5, 1.5, 2.5, 3.5, 4.5, 5.0, 5.5, 6.0, 6.5];

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/**
 * Convert a grid cell (col, row) to geographic [lng, lat].
 *
 * Grid data is stored row-major with row 0 = latMin (south), so:
 *   lng = lngMin + col × step  where step = 2·radiusDeg / (cols - 1)
 *   lat = latMin + row × step  where step = 2·radiusDeg / (rows - 1)
 *
 * Note: d3-contour pixel row 0 corresponds to data row 0 which is latMin,
 * so latitude increases with row index (south → north).
 */
export function pixelToGeo(
  col: number,
  row: number,
  grid: IntensityGrid,
): [lng: number, lat: number] {
  const rLat = grid.radiusDeg;
  const rLng = grid.radiusLngDeg ?? grid.radiusDeg;
  const lngMin = grid.center.lng - rLng;
  const latMin = grid.center.lat - rLat;
  const lngStep = grid.cols > 1 ? (2 * rLng / (grid.cols - 1)) : 0;
  const latStep = grid.rows > 1 ? (2 * rLat / (grid.rows - 1)) : 0;
  const lng = lngMin + col * lngStep;
  const lat = latMin + row * latStep;
  return [lng, lat];
}

// ---------------------------------------------------------------------------
// JMA classification
// ---------------------------------------------------------------------------

/**
 * Map a continuous JMA instrumental-intensity value to its discrete class.
 *
 * JMA_THRESHOLDS is ordered from highest to lowest; the first match wins.
 */
export function getJmaClass(value: number): JmaClass {
  for (const entry of JMA_THRESHOLDS) {
    if (value >= entry.min) return entry.class;
  }
  return '0';
}

// ---------------------------------------------------------------------------
// GeoJSON Feature generation
// ---------------------------------------------------------------------------

/**
 * Generate GeoJSON Feature[] from an IntensityGrid using d3-contour.
 *
 * Each Feature is a MultiPolygon whose coordinates have been re-projected
 * from grid-pixel space to geographic (lng, lat) space. Properties include
 * the threshold value, the JMA class string, a fill colour from JMA_COLORS,
 * and a fixed opacity of 0.35.
 *
 * @param grid - The intensity grid produced by the GMPE engine.
 * @returns An array of GeoJSON Features ready for globe.gl polygonsData.
 */
export function generateContourFeatures(
  grid: IntensityGrid,
  isColorblind: boolean = false,
): GeoJSON.Feature[] {
  const contourGenerator = contours()
    .size([grid.cols, grid.rows])
    .thresholds(CONTOUR_THRESHOLDS);

  // d3-contour can accept any Array-like, including Float32Array. 
  // No need for expensive Array.from or copy.
  const multiPolygons = contourGenerator(grid.data as any);

  const rLat = grid.radiusDeg;
  const rLng = grid.radiusLngDeg ?? grid.radiusDeg;
  const lngMin = grid.center.lng - rLng;
  const latMin = grid.center.lat - rLat;
  const lngStep = grid.cols > 1 ? (2 * rLng / (grid.cols - 1)) : 0;
  const latStep = grid.rows > 1 ? (2 * rLat / (grid.rows - 1)) : 0;

  return multiPolygons.map((mp) => {
    const jmaClass = getJmaClass(mp.value);

    // Re-project every coordinate from pixel space → geographic space in-place.
    const coordinates = mp.coordinates.map((polygon) =>
      polygon.map((ring) =>
        ring.map(([col, row]) => [
          lngMin + col * lngStep,
          latMin + row * latStep,
        ]),
      ),
    );

    const feature: GeoJSON.Feature = {
      type: 'Feature',
      geometry: {
        type: 'MultiPolygon',
        coordinates: coordinates as any,
      },
      properties: {
        value: mp.value,
        jmaClass,
        color: getJmaColor(jmaClass, isColorblind),
        opacity: 0.35,
      },
    };

    return feature;
  });
}
