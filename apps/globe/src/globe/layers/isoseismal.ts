/**
 * isoseismal.ts — Layer 5: Isoseismal contour polygons (CesiumJS)
 *
 * Receives GeoJSON Feature[] (produced by contourProjection.ts) and
 * renders them as terrain-draped GroundPrimitives using the enhanced
 * JMA colour scale for optimal visibility against satellite imagery.
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globeInstance';
import { store } from '../../store/appState';
import { ENHANCED_JMA } from '../../utils/colorScale';

// ── Fallback colors (in case ENHANCED_JMA import is unavailable) ──

const ENHANCED_JMA_FALLBACK: Record<string, { color: string; alpha: number }> = {
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

function getJmaColor(jmaClass: string): { color: string; alpha: number } {
  return ENHANCED_JMA?.[jmaClass] ?? ENHANCED_JMA_FALLBACK[jmaClass] ?? { color: '#666666', alpha: 0.25 };
}

// ── State ─────────────────────────────────────────────────────────

let viewerRef: GlobeInstance | null = null;
let groundPrimitives: Cesium.GroundPrimitive[] = [];
let cachedFeatures: GeoJSON.Feature[] = [];
let layerVisible = true;

// ── Public API ────────────────────────────────────────────────────

export function initIsoseismal(viewer: GlobeInstance): void {
  viewerRef = viewer;
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
  removeAllPrimitives();
}

/** Set visibility of the isoseismal layer. */
export function setIsoseismalVisible(visible: boolean): void {
  layerVisible = visible;
  if (visible && cachedFeatures.length > 0 && groundPrimitives.length === 0) {
    rebuildPolygons();
  } else {
    for (const p of groundPrimitives) {
      p.show = visible;
    }
  }
}

// ── Internal rendering ────────────────────────────────────────────

function removeAllPrimitives(): void {
  if (!viewerRef) return;
  for (const p of groundPrimitives) {
    viewerRef.scene.groundPrimitives.remove(p);
  }
  groundPrimitives = [];
}

function rebuildPolygons(): void {
  if (!viewerRef) return;
  removeAllPrimitives();

  const instances: Cesium.GeometryInstance[] = [];

  for (const feature of cachedFeatures) {
    const geom = feature.geometry;
    if (!geom) continue;

    const jmaClass = (feature.properties?.jmaClass as string) ?? '';
    const { color: cssColor, alpha } = getJmaColor(jmaClass);
    const color = Cesium.Color.fromCssColorString(cssColor).withAlpha(alpha);
    const colorAttr = Cesium.ColorGeometryInstanceAttribute.fromColor(color);

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

      instances.push(new Cesium.GeometryInstance({
        geometry: new Cesium.PolygonGeometry({
          polygonHierarchy: new Cesium.PolygonHierarchy(positions, holes),
        }),
        attributes: {
          color: colorAttr,
        },
      }));
    }
  }

  if (instances.length > 0) {
    const primitive = new Cesium.GroundPrimitive({
      geometryInstances: instances,
      appearance: new Cesium.PerInstanceColorAppearance({
        flat: true,
        translucent: true,
      }),
      classificationType: Cesium.ClassificationType.TERRAIN,
    });
    primitive.show = layerVisible;
    viewerRef.scene.groundPrimitives.add(primitive);
    groundPrimitives.push(primitive);
  }
}
