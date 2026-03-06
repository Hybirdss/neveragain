/**
 * Viewport Manager — Zoom tier classification and viewport state tracking.
 *
 * Listens to MapLibre camera events and publishes a stable ViewportState
 * that layers and panels can consume without coupling to the map API.
 */

import type maplibregl from 'maplibre-gl';

// ── Types ──────────────────────────────────────────────────────

export type ZoomTier = 'national' | 'regional' | 'city' | 'district';

export interface ViewportState {
  center: { lat: number; lng: number };
  zoom: number;
  bounds: [west: number, south: number, east: number, north: number];
  tier: ZoomTier;
  pitch: number;
  bearing: number;
}

export type ViewportListener = (state: ViewportState) => void;

export interface ViewportManager {
  getState(): ViewportState;
  subscribe(fn: ViewportListener): () => void;
  dispose(): void;
}

// ── Tier Classification ────────────────────────────────────────

const TIER_THRESHOLDS: { min: number; tier: ZoomTier }[] = [
  { min: 14, tier: 'district' },
  { min: 11, tier: 'city' },
  { min: 8, tier: 'regional' },
  { min: 0, tier: 'national' },
];

export function classifyZoomTier(zoom: number): ZoomTier {
  for (const { min, tier } of TIER_THRESHOLDS) {
    if (zoom >= min) return tier;
  }
  return 'national';
}

// ── Viewport State from Map ────────────────────────────────────

function readViewport(map: maplibregl.Map): ViewportState {
  const center = map.getCenter();
  const zoom = map.getZoom();
  const bounds = map.getBounds();

  return {
    center: { lat: center.lat, lng: center.lng },
    zoom,
    bounds: [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ],
    tier: classifyZoomTier(zoom),
    pitch: map.getPitch(),
    bearing: map.getBearing(),
  };
}

// ── Manager ────────────────────────────────────────────────────

export function createViewportManager(map: maplibregl.Map): ViewportManager {
  let current = readViewport(map);
  const listeners = new Set<ViewportListener>();

  function notify(): void {
    const next = readViewport(map);
    const tierChanged = next.tier !== current.tier;
    current = next;

    // Always notify on moveend for bounds-dependent filtering
    for (const fn of listeners) {
      try {
        fn(current);
      } catch (err) {
        console.error('[ViewportManager] Listener error:', err);
      }
    }

    if (tierChanged) {
      console.debug('[ViewportManager] Tier changed:', current.tier, `z${current.zoom.toFixed(1)}`);
    }
  }

  // moveend fires after pan/zoom/rotate completes — single unified event
  map.on('moveend', notify);

  // Also capture initial load
  map.once('load', () => {
    current = readViewport(map);
  });

  return {
    getState: () => current,
    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    dispose() {
      map.off('moveend', notify);
      listeners.clear();
    },
  };
}
