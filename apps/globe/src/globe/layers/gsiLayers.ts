/**
 * gsiLayers.ts — GSI (国土地理院) raster tile overlay layers.
 *
 * Layer architecture (bottom → top):
 *   [satellite base]
 *   ── Base map group (mutual exclusive — radio) ──
 *     - Color Relief (relief)         z5–15   opaque
 *     - Slope Map (slopemap)          z3–15   opaque
 *     - Pale Map (pale)               z2–18   opaque
 *   ── Overlay group (stackable) ──
 *     - Admin Boundary (blank)        z5–14   alpha 0.55
 *     - J-SHIS Seismic Hazard         z2–11   alpha 0.55
 *     - Active Fault Map (afm)        z2–16   alpha 0.85
 *
 * Base maps are mutually exclusive: enabling one auto-disables the others.
 * Overlays can stack freely and are always rendered above base maps.
 * All layers are Japan-only (rectangle-clamped).
 * GSI tiles are CORS-enabled — no proxy required.
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globeInstance';
import { store } from '../../store/appState';

// Japan bounding rectangle (matches tile-proxy JAPAN const)
const JAPAN_RECT = Cesium.Rectangle.fromDegrees(122, 20, 154, 46);

// ── Layer categories ────────────────────────────────────────────

// Base maps: mutually exclusive (only one visible at a time)
const BASE_MAP_KEYS = ['gsiRelief', 'gsiSlope', 'gsiPale'] as const;
type BaseMapKey = typeof BASE_MAP_KEYS[number];

// ── Layer state ─────────────────────────────────────────────────

const layerMap: Record<string, Cesium.ImageryLayer | null> = {
  gsiRelief:     null,
  gsiSlope:      null,
  gsiPale:       null,
  adminBoundary: null,
  jshisHazard:   null,
  gsiFaults:     null,
};

// ── Layer configs ───────────────────────────────────────────────
// Order matters: added bottom→top in CesiumJS imageryLayers stack.
// Base maps first, then overlays on top.

interface GsiConfig {
  key: string;
  url: string;
  minZoom: number;
  maxZoom: number;
  alpha: number;
  credit: string;
}

const GSI_CONFIGS: GsiConfig[] = [
  // ── Base maps (mutually exclusive) ──
  {
    key: 'gsiRelief',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png',
    minZoom: 5,
    maxZoom: 15,
    alpha: 1.0,
    credit: '色別標高図: 国土地理院',
  },
  {
    key: 'gsiSlope',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/slopemap/{z}/{x}/{y}.png',
    minZoom: 3,
    maxZoom: 15,
    alpha: 1.0,
    credit: '傾斜量図: 国土地理院',
  },
  {
    key: 'gsiPale',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',
    minZoom: 2,
    maxZoom: 18,
    alpha: 1.0,
    credit: '淡色地図: 国土地理院',
  },
  // ── Overlays (stackable, rendered on top) ──
  {
    key: 'adminBoundary',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png',
    minZoom: 5,
    maxZoom: 14,
    alpha: 0.55,
    credit: '白地図: 国土地理院',
  },
  {
    key: 'jshisHazard',
    url: 'https://www.j-shis.bosai.go.jp/map/api/pshm/Y2024/AVR/TTL_MTTL/meshmap/{z}/{x}/{y}.png',
    minZoom: 2,
    maxZoom: 11,
    alpha: 0.55,
    credit: '地震動予測地図: J-SHIS (NIED)',
  },
  {
    key: 'gsiFaults',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/afm/{z}/{x}/{y}.png',
    minZoom: 2,
    maxZoom: 16,
    alpha: 0.85,
    credit: '活断層図: 国土地理院',
  },
];

// ── Init ────────────────────────────────────────────────────────

export function initGsiLayers(viewer: GlobeInstance): void {
  for (const cfg of GSI_CONFIGS) {
    const provider = new Cesium.UrlTemplateImageryProvider({
      url: cfg.url,
      rectangle: JAPAN_RECT,
      minimumLevel: cfg.minZoom,
      maximumLevel: cfg.maxZoom,
      credit: new Cesium.Credit(cfg.credit, false),
    });

    const imageryLayer = viewer.imageryLayers.addImageryProvider(provider);
    imageryLayer.alpha = cfg.alpha;
    imageryLayer.show = false;

    layerMap[cfg.key] = imageryLayer;
  }
}

// ── Mutual exclusion for base maps ──────────────────────────────

function turnOffOtherBaseMaps(activeKey: BaseMapKey): void {
  const layers = store.get('layers');
  const updates: Partial<Record<BaseMapKey, boolean>> = {};

  for (const key of BASE_MAP_KEYS) {
    if (key !== activeKey && layers[key]) {
      updates[key] = false;
      // Immediately hide the CesiumJS layer
      if (layerMap[key]) layerMap[key]!.show = false;
    }
  }

  if (Object.keys(updates).length > 0) {
    store.set('layers', { ...layers, ...updates });
  }
}

// ── Visibility setters ──────────────────────────────────────────

export function setGsiFaultsVisible(visible: boolean): void {
  if (layerMap.gsiFaults) layerMap.gsiFaults.show = visible;
}

export function setGsiReliefVisible(visible: boolean): void {
  if (layerMap.gsiRelief) layerMap.gsiRelief.show = visible;
  if (visible) turnOffOtherBaseMaps('gsiRelief');
}

export function setGsiSlopeVisible(visible: boolean): void {
  if (layerMap.gsiSlope) layerMap.gsiSlope.show = visible;
  if (visible) turnOffOtherBaseMaps('gsiSlope');
}

export function setGsiPaleVisible(visible: boolean): void {
  if (layerMap.gsiPale) layerMap.gsiPale.show = visible;
  if (visible) turnOffOtherBaseMaps('gsiPale');
}

export function setAdminBoundaryVisible(visible: boolean): void {
  if (layerMap.adminBoundary) layerMap.adminBoundary.show = visible;
}

export function setJshisHazardVisible(visible: boolean): void {
  if (layerMap.jshisHazard) layerMap.jshisHazard.show = visible;
}

// ── Dispose ─────────────────────────────────────────────────────

export function disposeGsiLayers(viewer: GlobeInstance): void {
  for (const key of Object.keys(layerMap)) {
    if (layerMap[key]) {
      viewer.imageryLayers.remove(layerMap[key]!, true);
      layerMap[key] = null;
    }
  }
}
