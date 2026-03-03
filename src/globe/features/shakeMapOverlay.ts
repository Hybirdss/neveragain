/**
 * shakeMapOverlay.ts — USGS ShakeMap MMI contour + fault rupture overlay
 *
 * Renders ShakeMap products on the CesiumJS globe:
 * - MMI isoseismal contours as terrain-draped GroundPrimitives
 * - Fault rupture surface as Entity polygons (3D surfaces can't use GroundPrimitive)
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globeInstance';
import type { ShakeMapProducts } from '../../data/shakeMapApi';
import { store } from '../../store/appState';
import { MMI_COLORS } from '../../utils/colorScale';

// ── State ────────────────────────────────────────────────────────

let viewerRef: GlobeInstance | null = null;
let contourPrimitives: Cesium.GroundPrimitive[] = [];
let faultDataSource: Cesium.CustomDataSource | null = null;
let contourVisible = true;

// ── Public API ───────────────────────────────────────────────────

export function initShakeMapOverlay(viewer: GlobeInstance): void {
  viewerRef = viewer;
  faultDataSource = new Cesium.CustomDataSource('shakemap-fault');
  viewer.dataSources.add(faultDataSource);
}

export function updateShakeMapOverlay(
  _viewer: GlobeInstance,
  products: ShakeMapProducts,
): void {
  clearShakeMapOverlay();

  if (products.mmiContours) {
    renderMmiContours(products.mmiContours);
  }
  if (products.faultRupture) {
    renderFaultRupture(products.faultRupture);
  }

  // Auto-enable the layer
  const layers = store.get('layers');
  if (!layers.shakeMapContours) {
    store.set('layers', { ...layers, shakeMapContours: true });
  }
}

export function clearShakeMapOverlay(): void {
  if (viewerRef) {
    for (const p of contourPrimitives) {
      viewerRef.scene.groundPrimitives.remove(p);
    }
  }
  contourPrimitives = [];
  if (faultDataSource) faultDataSource.entities.removeAll();
}

export function setShakeMapVisible(visible: boolean): void {
  contourVisible = visible;
  for (const p of contourPrimitives) {
    p.show = visible;
  }
  if (faultDataSource) faultDataSource.show = visible;
}

// ── Internal rendering ───────────────────────────────────────────

const FILL_OPACITY = 0.35;

function renderMmiContours(geojson: GeoJSON.FeatureCollection): void {
  if (!viewerRef) return;

  // Sort features by MMI ascending — low values first, high values paint on top
  const sorted = [...geojson.features].sort((a, b) => {
    const mmiA = Number(a.properties?.value ?? 0);
    const mmiB = Number(b.properties?.value ?? 0);
    return mmiA - mmiB;
  });

  // Group geometry instances by MMI level for batching
  const instancesByMmi = new Map<number, Cesium.GeometryInstance[]>();

  for (const feature of sorted) {
    const geom = feature.geometry;
    if (!geom) continue;

    const mmi = Math.round(Number(feature.properties?.value ?? 0));
    if (mmi < 1 || mmi > 10) continue;

    const cssColor = MMI_COLORS[mmi] ?? '#FFFFFF';
    const color = Cesium.Color.fromCssColorString(cssColor).withAlpha(FILL_OPACITY);
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

      const instance = new Cesium.GeometryInstance({
        geometry: new Cesium.PolygonGeometry({
          polygonHierarchy: new Cesium.PolygonHierarchy(positions, holes),
        }),
        attributes: {
          color: colorAttr,
        },
      });

      if (!instancesByMmi.has(mmi)) {
        instancesByMmi.set(mmi, []);
      }
      instancesByMmi.get(mmi)!.push(instance);
    }
  }

  // Create one GroundPrimitive per MMI level (ordered low-to-high for correct z-order)
  const sortedKeys = [...instancesByMmi.keys()].sort((a, b) => a - b);
  for (const mmi of sortedKeys) {
    const instances = instancesByMmi.get(mmi)!;
    if (instances.length === 0) continue;

    const primitive = new Cesium.GroundPrimitive({
      geometryInstances: instances,
      appearance: new Cesium.PerInstanceColorAppearance({
        flat: true,
        translucent: true,
      }),
      classificationType: Cesium.ClassificationType.TERRAIN,
    });
    primitive.show = contourVisible;
    viewerRef.scene.groundPrimitives.add(primitive);
    contourPrimitives.push(primitive);
  }
}

function renderFaultRupture(geojson: GeoJSON.FeatureCollection): void {
  if (!faultDataSource) return;

  for (const feature of geojson.features) {
    const geom = feature.geometry;
    if (!geom) continue;

    if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
      const polygons: number[][][][] =
        geom.type === 'MultiPolygon'
          ? (geom as GeoJSON.MultiPolygon).coordinates
          : [(geom as GeoJSON.Polygon).coordinates];

      for (const polygon of polygons) {
        if (!polygon[0] || polygon[0].length < 3) continue;

        const coords = polygon[0];
        const hasDepth = coords[0]?.length === 3;

        const faultFill = Cesium.Color.fromCssColorString('rgba(220, 38, 38, 0.25)');
        const faultOutline = Cesium.Color.fromCssColorString('rgba(220, 38, 38, 0.8)');

        if (hasDepth) {
          const degreesHeights = coords.flatMap(([lon, lat, d]) => [lon, lat, -(d ?? 0) * 1000]);
          faultDataSource.entities.add({
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArrayHeights(degreesHeights),
              material: faultFill,
              outline: true,
              outlineColor: faultOutline,
              outlineWidth: 2,
              perPositionHeight: true,
            },
          });
        } else {
          const positions = Cesium.Cartesian3.fromDegreesArray(coords.flat());
          faultDataSource.entities.add({
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(positions),
              material: faultFill,
              outline: true,
              outlineColor: faultOutline,
              outlineWidth: 2,
              height: 100,
            },
          });
        }
      }
    }
  }
}
