/**
 * crossSectionLine.ts — Interactive cross-section line drawing on globe
 *
 * Two-click interaction:
 * 1. First click: set start point (marker appears)
 * 2. Second click: set end point, draw line, open cross-section panel
 *
 * Phase 3 additions:
 * - Real-time ghost preview line while drawing
 * - Draggable A/A' markers after line is placed
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globeInstance';
import type { CrossSectionConfig } from '../../ui/crossSection';

// ── State ────────────────────────────────────────────────────────

let handler: Cesium.ScreenSpaceEventHandler | null = null;
let startEntity: Cesium.Entity | undefined;
let endEntity: Cesium.Entity | undefined;
let lineEntity: Cesium.Entity | undefined;
let ghostEntity: Cesium.Entity | undefined;
let startPoint: { lat: number; lng: number } | null = null;
let endPoint: { lat: number; lng: number } | null = null;
let isDrawing = false;

// Drag state
let isDragging = false;
let draggedMarker: 'start' | 'end' | null = null;

// Ghost line cursor position (updated via CallbackProperty)
let ghostCursorCartesian: Cesium.Cartesian3 | null = null;

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
  endPoint = null;
  isDragging = false;
  draggedMarker = null;
  ghostCursorCartesian = null;

  handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
    // Ignore clicks during drag
    if (isDragging) return;

    const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
    if (!cartesian) return;

    const carto = Cesium.Cartographic.fromCartesian(cartesian);
    const lat = Cesium.Math.toDegrees(carto.latitude);
    const lng = Cesium.Math.toDegrees(carto.longitude);

    if (!isDrawing && !endPoint) {
      // First click: set start
      startPoint = { lat, lng };
      isDrawing = true;

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

      // Add ghost preview line
      ghostCursorCartesian = Cesium.Cartesian3.fromDegrees(lng, lat);
      const startCartesian = Cesium.Cartesian3.fromDegrees(lng, lat);
      ghostEntity = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            if (!ghostCursorCartesian) return [];
            return [startCartesian, ghostCursorCartesian];
          }, false) as any,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.WHITE.withAlpha(0.3),
            dashLength: 12,
          }),
          width: 1,
          clampToGround: true,
        },
      });

      // Mouse move handler for ghost line
      handler!.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
        if (!isDrawing) return;
        const c = viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid);
        if (c) ghostCursorCartesian = c;
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    } else if (isDrawing) {
      // Second click: set end, draw line, fire callback
      endPoint = { lat, lng };

      // Remove ghost line
      removeGhost(viewer);

      // Remove ghost mouse move handler (will be replaced by drag handlers)
      handler!.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      // Final line
      lineEntity = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            if (!startPoint || !endPoint) return [];
            return Cesium.Cartesian3.fromDegreesArray([
              startPoint.lng, startPoint.lat,
              endPoint.lng, endPoint.lat,
            ]);
          }, false) as any,
          material: Cesium.Color.WHITE.withAlpha(0.6),
          width: 1.5,
          clampToGround: true,
        },
      });

      // End marker
      endEntity = viewer.entities.add({
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

      // Fire callback
      fireComplete();

      // Set up drag handlers
      setupDragHandlers(viewer);
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

  removeGhost(viewer);

  if (startEntity) {
    viewer.entities.remove(startEntity);
    startEntity = undefined;
  }
  if (endEntity) {
    viewer.entities.remove(endEntity);
    endEntity = undefined;
  }
  if (lineEntity) {
    viewer.entities.remove(lineEntity);
    lineEntity = undefined;
  }
  const existingEnd = viewer.entities.getById('__cross_section_end');
  if (existingEnd) viewer.entities.remove(existingEnd);

  startPoint = null;
  endPoint = null;
  isDrawing = false;
  isDragging = false;
  draggedMarker = null;
  ghostCursorCartesian = null;
  onComplete = null;
}

/**
 * Check if drawing mode is active.
 */
export function isDrawingActive(): boolean {
  return handler !== null;
}

// ── Internal helpers ─────────────────────────────────────────────

function removeGhost(viewer: GlobeInstance): void {
  if (ghostEntity) {
    viewer.entities.remove(ghostEntity);
    ghostEntity = undefined;
  }
  ghostCursorCartesian = null;
}

function fireComplete(): void {
  if (onComplete && startPoint && endPoint) {
    onComplete({
      startPoint: { ...startPoint },
      endPoint: { ...endPoint },
      swathKm: 50,
      maxDepthKm: 700,
    });
  }
}

function setupDragHandlers(viewer: GlobeInstance): void {
  if (!handler) return;

  // LEFT_DOWN: check if a marker is picked
  handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
    const picked = viewer.scene.pick(click.position);
    if (!Cesium.defined(picked) || !picked.id) return;

    const entity = picked.id as Cesium.Entity;
    if (entity === startEntity) {
      draggedMarker = 'start';
    } else if (entity === endEntity) {
      draggedMarker = 'end';
    } else {
      return;
    }

    isDragging = true;
    viewer.scene.screenSpaceCameraController.enableRotate = false;
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

  // MOUSE_MOVE during drag: update marker + line
  handler.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
    if (!isDragging || !draggedMarker) return;

    const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid);
    if (!cartesian) return;

    const carto = Cesium.Cartographic.fromCartesian(cartesian);
    const lat = Cesium.Math.toDegrees(carto.latitude);
    const lng = Cesium.Math.toDegrees(carto.longitude);

    if (draggedMarker === 'start' && startEntity) {
      startPoint = { lat, lng };
      (startEntity.position as any).setValue(Cesium.Cartesian3.fromDegrees(lng, lat));
    } else if (draggedMarker === 'end' && endEntity) {
      endPoint = { lat, lng };
      (endEntity.position as any).setValue(Cesium.Cartesian3.fromDegrees(lng, lat));
    }
    // Line updates automatically via CallbackProperty
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // LEFT_UP: end drag, recalculate
  handler.setInputAction(() => {
    if (!isDragging) return;

    isDragging = false;
    draggedMarker = null;
    viewer.scene.screenSpaceCameraController.enableRotate = true;

    fireComplete();
  }, Cesium.ScreenSpaceEventType.LEFT_UP);
}
