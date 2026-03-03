/**
 * isoseismal.ts — Layer 5: Isoseismal contour polygons (CesiumJS)
 *
 * Receives GeoJSON Feature[] (produced by contourProjection.ts) and
 * renders them as semi-transparent coloured polygons using Cesium
 * CustomDataSource with the JMA official colour scale at 35% opacity.
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globeInstance';
import { store } from '../../store/appState';

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const JMA_COLORS_ALPHA: Record<string, string> = {
  '0': 'rgba(155, 191, 212, 0.35)',
  '1': 'rgba(102, 153, 204, 0.35)',
  '2': 'rgba(51, 153, 204, 0.35)',
  '3': 'rgba(51, 204, 102, 0.35)',
  '4': 'rgba(255, 255, 0, 0.35)',
  '5-': 'rgba(255, 153, 0, 0.35)',
  '5+': 'rgba(255, 102, 0, 0.35)',
  '6-': 'rgba(255, 51, 0, 0.35)',
  '6+': 'rgba(204, 0, 0, 0.35)',
  '7': 'rgba(153, 0, 153, 0.35)',
};

const JMA_COLORS_STROKE: Record<string, string> = {
  '0': 'rgba(155, 191, 212, 0.70)',
  '1': 'rgba(102, 153, 204, 0.70)',
  '2': 'rgba(51, 153, 204, 0.70)',
  '3': 'rgba(51, 204, 102, 0.70)',
  '4': 'rgba(255, 255, 0, 0.70)',
  '5-': 'rgba(255, 153, 0, 0.70)',
  '5+': 'rgba(255, 102, 0, 0.70)',
  '6-': 'rgba(255, 51, 0, 0.70)',
  '6+': 'rgba(204, 0, 0, 0.70)',
  '7': 'rgba(153, 0, 153, 0.70)',
};

/** Extruded height in meters per JMA class for 3D effect. */
const EXTRUSION_HEIGHTS: Record<string, number> = {
  '0': 500, '1': 1000, '2': 2000, '3': 5000,
  '4': 10000, '5-': 15000, '5+': 20000,
  '6-': 30000, '6+': 40000, '7': 60000,
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let dataSource: Cesium.CustomDataSource | null = null;
let cachedFeatures: GeoJSON.Feature[] = [];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initIsoseismal(viewer: GlobeInstance): void {
  dataSource = new Cesium.CustomDataSource('isoseismal');
  viewer.dataSources.add(dataSource);
}

export function updateIsoseismal(
  _viewer: GlobeInstance,
  features: GeoJSON.Feature[],
): void {
  cachedFeatures = features;
  if (store.get('layers').isoseismalContours) {
    rebuildPolygons();
  }
}

export function getCachedPolygons(): GeoJSON.Feature[] {
  return cachedFeatures;
}

export function clearIsoseismal(_viewer: GlobeInstance): void {
  cachedFeatures = [];
  if (dataSource) dataSource.entities.removeAll();
}

/** Set visibility of the isoseismal layer. */
export function setIsoseismalVisible(visible: boolean): void {
  if (dataSource) {
    dataSource.show = visible;
    if (visible) rebuildPolygons();
  }
}

// ---------------------------------------------------------------------------
// Internal rendering
// ---------------------------------------------------------------------------

function rebuildPolygons(): void {
  if (!dataSource) return;
  dataSource.entities.removeAll();

  for (const feature of cachedFeatures) {
    const geom = feature.geometry;
    if (!geom) continue;

    const jmaClass = (feature.properties?.jmaClass as string) ?? '';
    const fillColor = Cesium.Color.fromCssColorString(JMA_COLORS_ALPHA[jmaClass] || 'rgba(100,100,100,0.35)');
    const outlineColor = Cesium.Color.fromCssColorString(JMA_COLORS_STROKE[jmaClass] || 'rgba(100,100,100,0.70)');
    const extrudedHeight = EXTRUSION_HEIGHTS[jmaClass] || 500;

    const polygons: number[][][][] =
      geom.type === 'MultiPolygon'
        ? (geom as GeoJSON.MultiPolygon).coordinates
        : geom.type === 'Polygon'
          ? [(geom as GeoJSON.Polygon).coordinates]
          : [];

    for (const polygon of polygons) {
      if (!polygon[0] || polygon[0].length < 3) continue;

      const outerRing = polygon[0];
      const positions = Cesium.Cartesian3.fromDegreesArray(outerRing.flat());

      const holes = polygon.slice(1).map(ring =>
        new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(ring.flat()))
      );

      dataSource.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions, holes),
          material: fillColor,
          outline: true,
          outlineColor: outlineColor,
          extrudedHeight: extrudedHeight,
          height: 0,
        },
      });
    }
  }
}
