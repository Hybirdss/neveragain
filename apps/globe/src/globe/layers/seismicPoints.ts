/**
 * seismicPoints.ts — Layer 3: Earthquake event points (CesiumJS)
 *
 * Renders EarthquakeEvent[] as billboard sprites on the globe using
 * Cesium BillboardCollection. Epicenter position stays on the surface for
 * reliable picking; depth is encoded by colour band while scale encodes magnitude.
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globeInstance';
import type { EarthquakeEvent } from '../../types';
import { store } from '../../store/appState';
import { getSlabDepthAt } from '../features/slab2Contours';

const MAX_POINTS = 5000;

let billboardCollection: Cesium.BillboardCollection | null = null;
let pointBuffer: EarthquakeEvent[] = [];

/** Historical catalog for underground/LOD view. */
let catalogBuffer: EarthquakeEvent[] = [];
let currentLodLevel: 'far' | 'medium' | 'close' = 'far';
let catalogActive = false;
let cameraChangedRemover: (() => void) | null = null;

/** Store earthquake reference on each billboard for picking. */
const pointEventMap = new WeakMap<Cesium.Billboard, EarthquakeEvent>();

// ── Glow sprite generation ──────────────────────────────────

function makeGlowSprite(color: string, size = 64): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.15, color);
  g.addColorStop(0.5, color + '66');
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

// Depth bands: color, base scale, and data-URL image for Cesium billboards
interface DepthBand {
  maxDepth: number; // upper bound (exclusive for all but last)
  color: string;
  baseScale: number;
  image: string; // data URL
}

const DEPTH_BANDS: DepthBand[] = [
  { maxDepth: 30,  color: '#ff4444', baseScale: 1.0,  image: '' },
  { maxDepth: 70,  color: '#ff7722', baseScale: 0.85, image: '' },
  { maxDepth: 150, color: '#ffaa00', baseScale: 0.70, image: '' },
  { maxDepth: 300, color: '#44aaff', baseScale: 0.55, image: '' },
  { maxDepth: 700, color: '#3355cc', baseScale: 0.40, image: '' },
];

// Generate sprite images once at module load
for (const band of DEPTH_BANDS) {
  band.image = makeGlowSprite(band.color).toDataURL();
}

function getDepthBand(depth_km: number): DepthBand {
  for (const band of DEPTH_BANDS) {
    if (depth_km < band.maxDepth) return band;
  }
  return DEPTH_BANDS[DEPTH_BANDS.length - 1];
}

function magnitudeScale(mag: number): number {
  return Math.max(0.3, Math.pow(10, (mag - 2) / 3.5) * 0.15);
}

/**
 * Check if an earthquake is related to a subduction slab.
 * Returns true if the event depth is within ±30km of the Slab2 depth at its location.
 * Always returns true if no slab data is available (no false negatives).
 */
function isSlabRelated(eq: EarthquakeEvent): boolean {
  const slabDepth = getSlabDepthAt(eq.lat, eq.lng);
  if (isNaN(slabDepth)) return true;
  return Math.abs(eq.depth_km - slabDepth) <= 30;
}

function addBillboard(eq: EarthquakeEvent, show = true): Cesium.Billboard {
  const band = getDepthBand(eq.depth_km);
  const scale = band.baseScale * magnitudeScale(eq.magnitude);
  const bb = billboardCollection!.add({
    // Keep click/selection aligned with the epicenter on the map surface.
    position: Cesium.Cartesian3.fromDegrees(eq.lng, eq.lat, 0),
    image: band.image,
    scale,
    scaleByDistance: new Cesium.NearFarScalar(1e3, 1.5, 1e7, 0.3),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    show,
  });
  pointEventMap.set(bb, eq);
  return bb;
}

function rebuildPoints(): void {
  if (!billboardCollection) return;
  billboardCollection.removeAll();

  for (const eq of pointBuffer) {
    addBillboard(eq);
  }
}

export function initSeismicPoints(viewer: GlobeInstance): void {
  billboardCollection = new Cesium.BillboardCollection({ scene: viewer.scene });
  viewer.scene.primitives.add(billboardCollection);

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
  if (billboardCollection) billboardCollection.removeAll();
}

/** Get the earthquake event associated with a picked billboard. */
export function getEventFromPoint(point: Cesium.Billboard): EarthquakeEvent | undefined {
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
  if (!billboardCollection || !catalogActive) return;
  billboardCollection.removeAll();

  const minMag = currentLodLevel === 'far' ? 5.0 : currentLodLevel === 'medium' ? 4.0 : 3.0;
  const filtered = catalogBuffer
    .filter(eq => eq.magnitude >= minMag)
    .filter(isSlabRelated);
  const capped = filtered.length > MAX_POINTS ? filtered.slice(-MAX_POINTS) : filtered;

  for (const eq of capped) {
    addBillboard(eq);
  }
}

/** Set visibility of the billboard collection. */
export function setPointsVisible(visible: boolean): void {
  if (billboardCollection) {
    billboardCollection.show = visible;
    if (visible) {
      if (catalogActive) {
        rebuildCatalogPoints();
      } else {
        rebuildPoints();
      }
    }
  }
}

// ── Drill line (surface → hypocenter) ───────────────────────

let drillLineEntity: Cesium.Entity | null = null;
let drillLabelEntity: Cesium.Entity | null = null;
let drillLineViewer: GlobeInstance | null = null;
let drillLineUnsub: (() => void) | null = null;

/**
 * Initialize drill line subscription.
 * When an earthquake is selected, draws a dashed white vertical line
 * from surface to hypocenter with a depth label at the midpoint.
 */
export function initDrillLine(viewer: GlobeInstance): void {
  drillLineViewer = viewer;
  drillLineUnsub = store.subscribe('selectedEvent', (event) => {
    clearDrillLine();
    if (event) {
      showDrillLine(viewer, event);
    }
  });
}

function showDrillLine(viewer: GlobeInstance, event: EarthquakeEvent): void {
  const surfacePos = Cesium.Cartesian3.fromDegrees(event.lng, event.lat, 0);
  const hypoPos = Cesium.Cartesian3.fromDegrees(event.lng, event.lat, -(event.depth_km * 1000));
  const midPos = Cesium.Cartesian3.fromDegrees(event.lng, event.lat, -(event.depth_km * 500));

  drillLineEntity = viewer.entities.add({
    polyline: {
      positions: [surfacePos, hypoPos],
      width: 1.5,
      material: new Cesium.PolylineDashMaterialProperty({
        color: Cesium.Color.WHITE.withAlpha(0.5),
        dashLength: 12,
      }),
      depthFailMaterial: new Cesium.PolylineDashMaterialProperty({
        color: Cesium.Color.WHITE.withAlpha(0.3),
        dashLength: 12,
      }),
    },
  });

  drillLabelEntity = viewer.entities.add({
    position: midPos,
    label: {
      text: `${event.depth_km.toFixed(1)} km`,
      font: '12px monospace',
      fillColor: Cesium.Color.WHITE.withAlpha(0.8),
      outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(12, 0),
      horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new Cesium.NearFarScalar(1e3, 1.0, 5e6, 0.3),
    },
  });
}

function clearDrillLine(): void {
  if (!drillLineViewer) return;
  if (drillLineEntity) {
    drillLineViewer.entities.remove(drillLineEntity);
    drillLineEntity = null;
  }
  if (drillLabelEntity) {
    drillLineViewer.entities.remove(drillLabelEntity);
    drillLabelEntity = null;
  }
}

// ── Search result highlighting ──────────────────────────────

/** Saved original scales so we can restore after highlight clears. */
let originalScales = new Map<Cesium.Billboard, number>();
let highlightActive = false;

/**
 * Highlight search results on the globe.
 * - Pass a Set of event IDs to highlight those points (dim the rest).
 * - Pass null to clear highlighting and restore normal view.
 */
export function highlightSearchResults(eventIds: Set<string> | null): void {
  if (!billboardCollection) return;

  if (!eventIds) {
    // Restore original scales and alpha
    if (highlightActive) {
      for (let i = 0; i < billboardCollection.length; i++) {
        const bb = billboardCollection.get(i);
        const saved = originalScales.get(bb);
        if (saved !== undefined) {
          bb.scale = saved;
        }
        bb.color = Cesium.Color.WHITE;
      }
      originalScales.clear();
      highlightActive = false;
    }
    return;
  }

  // Save originals on first highlight
  if (!highlightActive) {
    originalScales.clear();
    for (let i = 0; i < billboardCollection.length; i++) {
      const bb = billboardCollection.get(i);
      originalScales.set(bb, bb.scale);
    }
  }

  highlightActive = true;

  for (let i = 0; i < billboardCollection.length; i++) {
    const bb = billboardCollection.get(i);
    const eq = pointEventMap.get(bb);
    const isMatch = eq ? eventIds.has(eq.id) : false;
    const baseScale = originalScales.get(bb) ?? bb.scale;

    if (isMatch) {
      bb.scale = baseScale * 1.5;
      bb.color = Cesium.Color.WHITE;
    } else {
      bb.scale = baseScale;
      bb.color = Cesium.Color.WHITE.withAlpha(0.12);
    }
  }
}

export function disposeSeismicPoints(): void {
  if (cameraChangedRemover) {
    cameraChangedRemover();
    cameraChangedRemover = null;
  }
  if (drillLineUnsub) {
    drillLineUnsub();
    drillLineUnsub = null;
  }
  clearDrillLine();
  drillLineViewer = null;
}
