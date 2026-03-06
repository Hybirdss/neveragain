/**
 * Map Engine — MapLibre GL JS + Deck.gl initialization
 *
 * Creates the base dark map and mounts Deck.gl's MapboxOverlay
 * with interleaved rendering for proper depth/label ordering.
 */

import maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import type { Layer } from '@deck.gl/core';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined;

const JAPAN_CENTER: [number, number] = [139.69, 35.68];
const DEFAULT_ZOOM = 5.5;
const DEFAULT_PITCH = 0;
const DEFAULT_BEARING = 0;

export interface MapEngine {
  map: maplibregl.Map;
  overlay: MapboxOverlay;
  setLayers(layers: Layer[]): void;
  dispose(): void;
}

function buildStyleUrl(): string {
  // MapTiler Dataviz Dark — optimized for data overlay
  if (MAPTILER_KEY) {
    return `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`;
  }
  // Fallback: Dark Matter (CartoDB/CARTO) — free, dark, clean
  return 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
}

export function createMapEngine(container: HTMLElement): MapEngine {
  const map = new maplibregl.Map({
    container,
    style: buildStyleUrl(),
    center: JAPAN_CENTER,
    zoom: DEFAULT_ZOOM,
    pitch: DEFAULT_PITCH,
    bearing: DEFAULT_BEARING,
    minZoom: 3,
    maxZoom: 18,
    hash: true,
    attributionControl: false,
  });

  // Disable rotation via right-click drag (ops console preference)
  // Users can still rotate via keyboard or touch
  map.dragRotate.disable();

  const overlay = new MapboxOverlay({
    interleaved: true,
    layers: [],
  });

  map.addControl(overlay);

  // Attribution in bottom-right, collapsed
  map.addControl(
    new maplibregl.AttributionControl({ compact: true }),
    'bottom-right',
  );

  function setLayers(layers: Layer[]): void {
    overlay.setProps({ layers });
  }

  function dispose(): void {
    overlay.finalize();
    map.remove();
  }

  return { map, overlay, setLayers, dispose };
}
