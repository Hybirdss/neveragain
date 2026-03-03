/**
 * gsiLayers.ts — GSI (国土地理院) raster tile overlay layers.
 *
 * Adds imagery layers for:
 *   - Active Fault Map (afm)        z2–16
 *   - Color Relief (relief)         z5–15
 *   - Slope Map (slopemap)          z3–15
 *   - Pale Map (pale)               z2–18
 *   - Admin Boundary (blank)        z5–14
 *   - J-SHIS Seismic Hazard         z2–11
 *
 * All layers are Japan-only (rectangle-clamped) and hidden by default.
 * GSI tiles are CORS-enabled — no proxy required.
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globeInstance';

// Japan bounding rectangle (matches tile-proxy JAPAN const)
const JAPAN_RECT = Cesium.Rectangle.fromDegrees(122, 20, 154, 46);

// ── Layer state ─────────────────────────────────────────────────

interface GsiLayerEntry {
  layer: Cesium.ImageryLayer | null;
}

const layers: Record<string, GsiLayerEntry> = {
  gsiFaults:    { layer: null },
  gsiRelief:    { layer: null },
  gsiSlope:     { layer: null },
  gsiPale:      { layer: null },
  adminBoundary: { layer: null },
  jshisHazard:  { layer: null },
};

// ── Layer configs ───────────────────────────────────────────────

interface GsiConfig {
  key: string;
  url: string;
  minZoom: number;
  maxZoom: number;
  alpha: number;
  credit: string;
}

const GSI_CONFIGS: GsiConfig[] = [
  {
    key: 'gsiFaults',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/afm/{z}/{x}/{y}.png',
    minZoom: 2,
    maxZoom: 16,
    alpha: 0.8,
    credit: '活断層図: 国土地理院',
  },
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
    alpha: 0.8,
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
  {
    key: 'adminBoundary',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png',
    minZoom: 5,
    maxZoom: 14,
    alpha: 0.6,
    credit: '白地図: 国土地理院',
  },
  {
    key: 'jshisHazard',
    url: 'https://www.j-shis.bosai.go.jp/map/api/pshm/Y2024/AVR/TTL_MTTL/meshmap/{z}/{x}/{y}.png',
    minZoom: 2,
    maxZoom: 11,
    alpha: 0.7,
    credit: '地震動予測地図: J-SHIS (NIED)',
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
    imageryLayer.show = false; // hidden by default

    layers[cfg.key].layer = imageryLayer;
  }
}

// ── Visibility setters ──────────────────────────────────────────

export function setGsiFaultsVisible(visible: boolean): void {
  if (layers.gsiFaults.layer) layers.gsiFaults.layer.show = visible;
}

export function setGsiReliefVisible(visible: boolean): void {
  if (layers.gsiRelief.layer) layers.gsiRelief.layer.show = visible;
}

export function setGsiSlopeVisible(visible: boolean): void {
  if (layers.gsiSlope.layer) layers.gsiSlope.layer.show = visible;
}

export function setGsiPaleVisible(visible: boolean): void {
  if (layers.gsiPale.layer) layers.gsiPale.layer.show = visible;
}

export function setAdminBoundaryVisible(visible: boolean): void {
  if (layers.adminBoundary.layer) layers.adminBoundary.layer.show = visible;
}

export function setJshisHazardVisible(visible: boolean): void {
  if (layers.jshisHazard.layer) layers.jshisHazard.layer.show = visible;
}

// ── Dispose ─────────────────────────────────────────────────────

export function disposeGsiLayers(viewer: GlobeInstance): void {
  for (const entry of Object.values(layers)) {
    if (entry.layer) {
      viewer.imageryLayers.remove(entry.layer, true);
      entry.layer = null;
    }
  }
}
