/**
 * depthRings.ts — Horizontal translucent reference rings at depth levels
 *
 * Creates dashed circular polylines at 100km, 300km, and 500km depths
 * below the surface, centered around Japan. These serve as visual depth
 * anchors when the globe is in underground (translucent) mode.
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globeInstance';

// ── Configuration ────────────────────────────────────────────────

const CENTER_LAT = 36;
const CENTER_LNG = 138;
const RADIUS_DEG = 4.5; // ~500km radius
const SEGMENTS = 64;

const DEPTH_LEVELS = [100, 300, 500]; // km

const RING_COLOR = Cesium.Color.WHITE.withAlpha(0.12);
const RING_WIDTH = 1.0;

// ── State ────────────────────────────────────────────────────────

let dataSource: Cesium.CustomDataSource | null = null;

// ── Helpers ──────────────────────────────────────────────────────

function createRingPositions(
  centerLat: number,
  centerLng: number,
  radiusDeg: number,
  depthKm: number,
  segments = SEGMENTS,
): Cesium.Cartesian3[] {
  const positions: Cesium.Cartesian3[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const lat = centerLat + radiusDeg * Math.sin(angle);
    const lng = centerLng + radiusDeg * Math.cos(angle);
    positions.push(Cesium.Cartesian3.fromDegrees(lng, lat, -(depthKm * 1000)));
  }
  return positions;
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Initialize depth reference rings layer.
 * Creates dashed rings at 100km, 300km, 500km depths.
 */
export function initDepthRings(viewer: GlobeInstance): void {
  dataSource = new Cesium.CustomDataSource('depth-rings');
  dataSource.show = false; // Hidden by default, shown with slab2
  viewer.dataSources.add(dataSource);

  for (const depthKm of DEPTH_LEVELS) {
    const positions = createRingPositions(CENTER_LAT, CENTER_LNG, RADIUS_DEG, depthKm);

    // Dashed ring polyline
    dataSource.entities.add({
      polyline: {
        positions,
        material: new Cesium.PolylineDashMaterialProperty({
          color: RING_COLOR,
          dashLength: 16,
        }),
        width: RING_WIDTH,
        clampToGround: false,
      },
    });

    // Depth label at the easternmost point of the ring
    const labelLat = CENTER_LAT;
    const labelLng = CENTER_LNG + RADIUS_DEG;
    dataSource.entities.add({
      position: Cesium.Cartesian3.fromDegrees(labelLng, labelLat, -(depthKm * 1000)),
      label: {
        text: `${depthKm} km`,
        font: '9px Inter, sans-serif',
        fillColor: Cesium.Color.fromCssColorString('rgba(255, 255, 255, 0.35)'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -6),
        scaleByDistance: new Cesium.NearFarScalar(5e5, 1.0, 5e6, 0.3),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  }

  console.log('[depthRings] Initialized depth reference rings at 100/300/500 km');
}

/**
 * Toggle visibility of depth reference rings.
 */
export function setDepthRingsVisible(visible: boolean): void {
  if (dataSource) dataSource.show = visible;
}

/**
 * Remove all depth ring entities and release the data source.
 */
export function disposeDepthRings(): void {
  if (dataSource) {
    dataSource.entities.removeAll();
    dataSource = null;
  }
}
