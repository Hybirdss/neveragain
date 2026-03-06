/**
 * Map Engine — MapLibre GL JS + Deck.gl initialization
 *
 * Base map: Protomaps PMTiles (self-hosted on R2, $0/mo)
 * Fallback: CARTO Dark Matter (free, no key)
 */

import maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import type { Layer, PickingInfo } from '@deck.gl/core';
import { Protocol } from 'pmtiles';
import protoLayers from 'protomaps-themes-base';

// PMTiles URL: https URL to .pmtiles file on R2 (without pmtiles:// prefix)
const PMTILES_URL = import.meta.env.VITE_PMTILES_URL as string | undefined;

// Register PMTiles protocol once
const pmtilesProtocol = new Protocol();
maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);

const JAPAN_CENTER: [number, number] = [139.69, 35.68];
const DEFAULT_ZOOM = 5.5;
const DEFAULT_PITCH = 0;
const DEFAULT_BEARING = 0;

export type PickHandler = (info: PickingInfo) => void;
export type TooltipHandler = (info: PickingInfo) => string | { html: string; style?: Record<string, string> } | null;

export interface MapEngine {
  map: maplibregl.Map;
  overlay: MapboxOverlay;
  setLayers(layers: Layer[]): void;
  onClick(handler: PickHandler): void;
  setTooltip(handler: TooltipHandler): void;
  dispose(): void;
}

function buildStyle(): maplibregl.StyleSpecification | string {
  if (PMTILES_URL) {
    const url = PMTILES_URL.startsWith('pmtiles://')
      ? PMTILES_URL
      : `pmtiles://${PMTILES_URL}`;

    return {
      version: 8,
      glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
      sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/dark',
      sources: {
        protomaps: {
          type: 'vector',
          url,
          attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> © <a href="https://protomaps.com">Protomaps</a>',
        },
      },
      layers: protoLayers('protomaps', 'dark', 'ja'),
    } as maplibregl.StyleSpecification;
  }

  // Fallback: CARTO Dark Matter (free, no key required)
  return 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
}

export function createMapEngine(container: HTMLElement): MapEngine {
  const map = new maplibregl.Map({
    container,
    style: buildStyle(),
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

  let clickHandler: PickHandler | null = null;
  let tooltipHandler: TooltipHandler | null = null;

  const overlay = new MapboxOverlay({
    interleaved: true,
    pickingRadius: 8,
    layers: [],
    onClick: (info) => {
      if (clickHandler) clickHandler(info as PickingInfo);
    },
    getTooltip: (info) => {
      if (tooltipHandler) return tooltipHandler(info as PickingInfo);
      return null;
    },
  } as ConstructorParameters<typeof MapboxOverlay>[0]);

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
    maplibregl.removeProtocol('pmtiles');
    overlay.finalize();
    map.remove();
  }

  function onClick(handler: PickHandler): void {
    clickHandler = handler;
  }

  function setTooltip(handler: TooltipHandler): void {
    tooltipHandler = handler;
  }

  return { map, overlay, setLayers, onClick, setTooltip, dispose };
}
