/**
 * shakeMapOverlay.ts — USGS ShakeMap MMI contour + fault rupture overlay
 *
 * Renders ShakeMap products on the CesiumJS globe:
 * - MMI isoseismal contours as semi-transparent polygons (USGS color scale)
 * - Fault rupture surface as a red outlined polygon
 *
 * Pattern mirrors isoseismal.ts but uses MMI colors instead of JMA.
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globeInstance';
import type { ShakeMapProducts } from '../../data/shakeMapApi';
import { store } from '../../store/appState';

// ── USGS MMI Color Scale (Design Token Spec §1-2) ───────────────

import { MMI_COLORS } from '../../utils/colorScale';

/** Uniform stroke for all MMI levels — white, subtle. */
const STROKE_COLOR = Cesium.Color.fromCssColorString('rgba(255, 255, 255, 0.4)');
const FILL_OPACITY = 0.35;

/** z-fighting prevention: 100m base + 10m per MMI level above 1. */
function mmiHeight(mmi: number): number {
  return 100 + (mmi - 1) * 10;
}

// ── State ────────────────────────────────────────────────────────

let contourDataSource: Cesium.CustomDataSource | null = null;
let faultDataSource: Cesium.CustomDataSource | null = null;

// ── Public API ───────────────────────────────────────────────────

export function initShakeMapOverlay(viewer: GlobeInstance): void {
  contourDataSource = new Cesium.CustomDataSource('shakemap-contours');
  faultDataSource = new Cesium.CustomDataSource('shakemap-fault');
  viewer.dataSources.add(contourDataSource);
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
  if (contourDataSource) contourDataSource.entities.removeAll();
  if (faultDataSource) faultDataSource.entities.removeAll();
}

export function setShakeMapVisible(visible: boolean): void {
  if (contourDataSource) contourDataSource.show = visible;
  if (faultDataSource) faultDataSource.show = visible;
}

// ── Internal rendering ───────────────────────────────────────────

function renderMmiContours(geojson: GeoJSON.FeatureCollection): void {
  if (!contourDataSource) return;

  // §1-3: Sort features by MMI ascending — low values first, high values paint on top
  const sorted = [...geojson.features].sort((a, b) => {
    const mmiA = Number(a.properties?.value ?? 0);
    const mmiB = Number(b.properties?.value ?? 0);
    return mmiA - mmiB;
  });

  for (const feature of sorted) {
    const geom = feature.geometry;
    if (!geom) continue;

    const mmi = Math.round(Number(feature.properties?.value ?? 0));
    if (mmi < 1 || mmi > 10) continue;

    // §1-2: fill = MMI_COLORS[mmi] with uniform 0.35 opacity
    const fillColor = Cesium.Color.fromCssColorString(MMI_COLORS[mmi] ?? '#FFFFFF').withAlpha(FILL_OPACITY);
    const height = mmiHeight(mmi);

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

      contourDataSource.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions, holes),
          material: fillColor,
          outline: true,
          outlineColor: STROKE_COLOR,
          outlineWidth: 1.0,
          height,
        },
      });
    }
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

        // Fault may have depth (3D coordinates: [lon, lat, depth_km])
        const coords = polygon[0];
        const hasDepth = coords[0]?.length === 3;

        // §1-4: Fault rupture — rgba(220,38,38,0.25) fill, rgba(220,38,38,0.8) outline
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
