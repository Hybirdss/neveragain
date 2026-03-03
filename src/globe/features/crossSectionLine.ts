/**
 * crossSectionLine.ts — Interactive cross-section line drawing on globe
 *
 * Two-click interaction:
 * 1. First click: set start point (marker appears)
 * 2. Second click: set end point, draw line, open cross-section panel
 *
 * The line is rendered as a Cesium polyline entity on the globe surface.
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globeInstance';
import type { CrossSectionConfig } from '../../ui/crossSection';

// ── State ────────────────────────────────────────────────────────

let handler: Cesium.ScreenSpaceEventHandler | null = null;
let startEntity: Cesium.Entity | undefined;
let lineEntity: Cesium.Entity | undefined;
let startPoint: { lat: number; lng: number } | null = null;
let isDrawing = false;

type OnLineComplete = (config: CrossSectionConfig) => void;
let onComplete: OnLineComplete | null = null;

// ── Public API ───────────────────────────────────────────────────

/**
 * Enable cross-section line drawing mode.
 * User clicks twice on the globe to define start and end points.
 */
export function enableCrossSectionDrawing(
  viewer: GlobeInstance,
  callback: OnLineComplete,
): void {
  disableCrossSectionDrawing(viewer);

  onComplete = callback;
  isDrawing = false;
  startPoint = null;

  handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
    const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
    if (!cartesian) return;

    const carto = Cesium.Cartographic.fromCartesian(cartesian);
    const lat = Cesium.Math.toDegrees(carto.latitude);
    const lng = Cesium.Math.toDegrees(carto.longitude);

    if (!isDrawing) {
      // First click: set start
      startPoint = { lat, lng };
      isDrawing = true;

      // §2-4: Start marker — WHITE, pixelSize 6
      startEntity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lng, lat),
        point: {
          pixelSize: 6,
          color: Cesium.Color.WHITE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: 'A',
          font: 'bold 12px Inter, sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(12, -12),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    } else {
      // Second click: set end, draw line, fire callback
      const endPoint = { lat, lng };

      // §2-4: Profile line — WHITE alpha 0.6, solid, 1.5px, clampToGround
      lineEntity = viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([
            startPoint!.lng, startPoint!.lat,
            lng, lat,
          ]),
          material: Cesium.Color.WHITE.withAlpha(0.6),
          width: 1.5,
          clampToGround: true,
        },
      });

      // §2-4: End marker — WHITE, pixelSize 6, Inter 12px Bold
      viewer.entities.add({
        id: '__cross_section_end',
        position: Cesium.Cartesian3.fromDegrees(lng, lat),
        point: {
          pixelSize: 6,
          color: Cesium.Color.WHITE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: "A'",
          font: 'bold 12px Inter, sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(12, -12),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });

      isDrawing = false;

      // Fire callback with config
      if (onComplete && startPoint) {
        onComplete({
          startPoint,
          endPoint,
          swathKm: 50,
          maxDepthKm: 700,
        });
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

/**
 * Disable cross-section drawing mode and clean up entities.
 */
export function disableCrossSectionDrawing(viewer: GlobeInstance): void {
  if (handler) {
    handler.destroy();
    handler = null;
  }

  // Remove cross-section entities
  if (startEntity) {
    viewer.entities.remove(startEntity);
    startEntity = undefined;
  }
  if (lineEntity) {
    viewer.entities.remove(lineEntity);
    lineEntity = undefined;
  }
  const endEntity = viewer.entities.getById('__cross_section_end');
  if (endEntity) viewer.entities.remove(endEntity);

  startPoint = null;
  isDrawing = false;
  onComplete = null;
}

/**
 * Check if drawing mode is active.
 */
export function isDrawingActive(): boolean {
  return handler !== null;
}
