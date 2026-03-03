/**
 * seismicPoints.ts — Layer 3: Earthquake event points (CesiumJS)
 *
 * Renders EarthquakeEvent[] as 3D points on the globe using
 * Cesium PointPrimitiveCollection. Depth is encoded as negative height
 * (below surface), colour encodes depth, radius encodes magnitude.
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globeInstance';
import type { EarthquakeEvent } from '../../types';
import { depthToColor } from '../../utils/colorScale';
import { store } from '../../store/appState';
import { getSlabDepthAt } from '../features/slab2Contours';

const MAX_POINTS = 5000;

let pointCollection: Cesium.PointPrimitiveCollection | null = null;
let pointBuffer: EarthquakeEvent[] = [];

/** Historical catalog for underground/LOD view. */
let catalogBuffer: EarthquakeEvent[] = [];
let currentLodLevel: 'far' | 'medium' | 'close' = 'far';
let catalogActive = false;
let cameraChangedRemover: (() => void) | null = null;

/** Store earthquake reference on each point for picking. */
const pointEventMap = new WeakMap<Cesium.PointPrimitive, EarthquakeEvent>();

function magnitudeToPixelSize(mag: number): number {
  return Math.max(3, Math.pow(10, (mag - 2) / 3.5) * 4);
}

/** Depth-based alpha: shallow = opaque, deep = translucent. */
function depthToAlpha(depth_km: number): number {
  if (depth_km < 70) return 0.8;
  if (depth_km <= 300) return 0.6;
  return 0.4;
}

/** Create a Cesium.Color from depth color string with depth-based alpha. */
function depthColor(depth_km: number): Cesium.Color {
  return Cesium.Color.fromCssColorString(depthToColor(depth_km)).withAlpha(depthToAlpha(depth_km));
}

/**
 * Check if an earthquake is related to a subduction slab.
 * Returns true if the event depth is within ±30km of the Slab2 depth at its location.
 * Always returns true if no slab data is available (no false negatives).
 */
function isSlabRelated(eq: EarthquakeEvent): boolean {
  const slabDepth = getSlabDepthAt(eq.lat, eq.lng);
  if (isNaN(slabDepth)) return true; // No slab data — don't filter out
  return Math.abs(eq.depth_km - slabDepth) <= 30;
}

function rebuildPoints(): void {
  if (!pointCollection) return;
  pointCollection.removeAll();

  for (const eq of pointBuffer) {
    const pt = pointCollection.add({
      position: Cesium.Cartesian3.fromDegrees(eq.lng, eq.lat, -(eq.depth_km * 1000)),
      pixelSize: magnitudeToPixelSize(eq.magnitude),
      color: depthColor(eq.depth_km),
      scaleByDistance: new Cesium.NearFarScalar(1e3, 1.5, 1e7, 0.3),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
    pointEventMap.set(pt, eq);
  }
}

export function initSeismicPoints(viewer: GlobeInstance): void {
  pointCollection = new Cesium.PointPrimitiveCollection();
  viewer.scene.primitives.add(pointCollection);

  // LOD: update point density when camera moves (not every frame)
  cameraChangedRemover = viewer.camera.changed.addEventListener(() => {
    if (!catalogActive) return;
    const height = viewer.camera.positionCartographic.height;
    const altitude = height / 6_371_000;
    const newLod: typeof currentLodLevel =
      altitude > 2.0 ? 'far' : altitude > 0.5 ? 'medium' : 'close';
    if (newLod !== currentLodLevel) {
      currentLodLevel = newLod;
      rebuildCatalogPoints();
    }
  });
  // Increase change threshold to avoid excessive recalculations
  viewer.camera.percentageChanged = 0.1;
}

export function updateSeismicPoints(
  _viewer: GlobeInstance,
  events: EarthquakeEvent[],
): void {
  pointBuffer = events.length > MAX_POINTS ? events.slice(-MAX_POINTS) : [...events];
  if (store.get('layers').seismicPoints) {
    rebuildPoints();
  }
}

export function getCachedPoints(): EarthquakeEvent[] {
  return pointBuffer;
}

export function addSeismicPoint(
  _viewer: GlobeInstance,
  event: EarthquakeEvent,
): void {
  if (pointBuffer.length >= MAX_POINTS) {
    pointBuffer.shift();
  }
  pointBuffer.push(event);
  if (store.get('layers').seismicPoints) {
    rebuildPoints();
  }
}

export function clearSeismicPoints(_viewer: GlobeInstance): void {
  pointBuffer = [];
  if (pointCollection) pointCollection.removeAll();
}

/** Get the earthquake event associated with a picked point primitive. */
export function getEventFromPoint(point: Cesium.PointPrimitive): EarthquakeEvent | undefined {
  return pointEventMap.get(point);
}

/**
 * Load 30-year historical catalog for underground/LOD view.
 * Points are filtered by camera altitude (LOD).
 */
export function setHistoricalCatalog(events: EarthquakeEvent[]): void {
  catalogBuffer = events;
}

/**
 * Enable/disable catalog mode (underground view with LOD filtering).
 */
export function setCatalogActive(active: boolean): void {
  catalogActive = active;
  if (active) {
    rebuildCatalogPoints();
  } else {
    // Restore normal point buffer
    if (store.get('layers').seismicPoints) rebuildPoints();
  }
}

function rebuildCatalogPoints(): void {
  if (!pointCollection || !catalogActive) return;
  pointCollection.removeAll();

  const minMag = currentLodLevel === 'far' ? 5.0 : currentLodLevel === 'medium' ? 4.0 : 3.0;
  const filtered = catalogBuffer
    .filter(eq => eq.magnitude >= minMag)
    .filter(isSlabRelated);
  const capped = filtered.length > MAX_POINTS ? filtered.slice(-MAX_POINTS) : filtered;

  for (const eq of capped) {
    const pt = pointCollection.add({
      position: Cesium.Cartesian3.fromDegrees(eq.lng, eq.lat, -(eq.depth_km * 1000)),
      pixelSize: magnitudeToPixelSize(eq.magnitude),
      color: depthColor(eq.depth_km),
      scaleByDistance: new Cesium.NearFarScalar(1e3, 1.5, 1e7, 0.3),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
    pointEventMap.set(pt, eq);
  }
}

// ── Cinematic depth filter ──────────────────────────────────

/** Points pre-added with show:false for cinematic depth reveal. */
let cinematicPoints: { eq: EarthquakeEvent; pt: Cesium.PointPrimitive }[] = [];

/**
 * Prepare cinematic depth reveal: add all catalog points hidden.
 * Call once before the reveal animation starts.
 */
export function prepareCinematicReveal(): void {
  if (!pointCollection) return;
  // Clear normal points, add catalog with show:false
  pointCollection.removeAll();
  cinematicPoints = [];

  const minMag = currentLodLevel === 'far' ? 5.0 : currentLodLevel === 'medium' ? 4.0 : 3.0;
  const filtered = catalogBuffer.filter(eq => eq.magnitude >= minMag);
  const capped = filtered.length > MAX_POINTS ? filtered.slice(-MAX_POINTS) : filtered;

  for (const eq of capped) {
    const pt = pointCollection.add({
      position: Cesium.Cartesian3.fromDegrees(eq.lng, eq.lat, -(eq.depth_km * 1000)),
      pixelSize: magnitudeToPixelSize(eq.magnitude),
      color: depthColor(eq.depth_km),
      scaleByDistance: new Cesium.NearFarScalar(1e3, 1.5, 1e7, 0.3),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      show: false,
    });
    cinematicPoints.push({ eq, pt });
  }
}

/**
 * Show only points with depth <= maxDepthKm.
 * O(n) .show toggle — no object creation/destruction.
 */
export function setDepthFilter(maxDepthKm: number): void {
  for (const { eq, pt } of cinematicPoints) {
    pt.show = eq.depth_km <= maxDepthKm;
  }
}

/**
 * End cinematic reveal mode and restore normal catalog view.
 */
export function clearCinematicReveal(): void {
  cinematicPoints = [];
  if (catalogActive) {
    rebuildCatalogPoints();
  } else {
    rebuildPoints();
  }
}

/** Set visibility of the point collection. */
export function setPointsVisible(visible: boolean): void {
  if (pointCollection) {
    pointCollection.show = visible;
    if (visible) {
      if (catalogActive) {
        rebuildCatalogPoints();
      } else {
        rebuildPoints();
      }
    }
  }
}

export function disposeSeismicPoints(): void {
  if (cameraChangedRemover) {
    cameraChangedRemover();
    cameraChangedRemover = null;
  }
}
