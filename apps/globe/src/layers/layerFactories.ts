/**
 * Layer Factory Registry — Maps LayerId to deck.gl layer factories.
 *
 * Adding a new layer:
 *   1. Add LayerId to layerRegistry.ts
 *   2. Create the deck.gl layer module (e.g., railLayer.ts)
 *   3. Register it here with order, deps, and create function
 *   4. Done — compositor and bundle system handle the rest
 *
 * Order values determine render stacking (low = bottom):
 *   100 intensity     — hazard field (always below everything)
 *   150 heatmap       — seismic density (national/regional zoom only)
 *   200 faults        — tectonic context
 *   250-280 lifelines — rail, power, water, telecom
 *   300 ais           — maritime traffic
 *   350 hospitals     — medical infrastructure
 *   400 earthquakes   — seismic events (most interactive)
 *   500 buildings     — 3D built environment
 *   900 waves         — animation overlay (handled separately)
 */

import type { Layer } from '@deck.gl/core';
import type { ConsoleState } from '../core/store';
import type { LayerId } from './layerRegistry';
import { createEarthquakeLayer } from './earthquakeLayer';
import { createIntensityLayer } from './intensityLayer';
import { createFaultLayer } from './faultLayer';
import { createAisLayers } from './aisLayer';
import { createHospitalLayers } from './hospitalLayer';
import { createRailLayers } from './railLayer';
import { createPowerLayers } from './powerLayer';
import { createSeismicHeatmapLayer } from './heatmapLayer';
import { createPopulationLayers } from './populationLayer';

export interface LayerFactory {
  id: LayerId;
  order: number;
  deps: (keyof ConsoleState)[];
  /** 'zoom' (default): only rebuild on zoom change. 'full': rebuild on every viewport update. */
  viewportMode?: 'zoom' | 'full';
  create(state: ConsoleState): Layer[];
}

function f(def: LayerFactory): LayerFactory { return def; }

export const LAYER_FACTORIES: LayerFactory[] = [
  f({
    id: 'intensity',
    order: 100,
    deps: ['intensityGrid', 'selectedEvent', 'viewport'],
    viewportMode: 'zoom',
    create(state: ConsoleState) {
      const layers: Layer[] = [];
      const intensity = createIntensityLayer(state.intensityGrid);
      if (intensity) layers.push(intensity);
      // Population exposure circles overlay
      layers.push(...createPopulationLayers(state.selectedEvent, state.viewport.zoom));
      return layers;
    },
  }),
  f({
    id: 'heatmap',
    order: 150,
    deps: ['events', 'viewport'],
    viewportMode: 'zoom',
    create(state: ConsoleState) {
      const layer = createSeismicHeatmapLayer(state.events, state.viewport.zoom);
      return layer ? [layer] : [];
    },
  }),
  f({
    id: 'faults',
    order: 200,
    deps: ['faults', 'viewport', 'selectedEvent'],
    create(state: ConsoleState) {
      const selectedId = state.selectedEvent?.id ?? null;
      const layer = createFaultLayer(state.faults, state.viewport.zoom, selectedId);
      return layer ? [layer] : [];
    },
  }),
  f({
    id: 'rail',
    order: 250,
    deps: ['selectedEvent', 'viewport', 'railStatuses', 'sequenceSWaveKm'],
    create(state: ConsoleState) {
      return createRailLayers(state.selectedEvent, state.viewport.zoom, state.railStatuses, state.sequenceSWaveKm);
    },
  }),
  f({
    id: 'power',
    order: 260,
    deps: ['selectedEvent', 'viewport', 'sequenceSWaveKm'],
    create(state: ConsoleState) {
      return createPowerLayers(state.selectedEvent, state.viewport.zoom, state.sequenceSWaveKm);
    },
  }),
  f({
    id: 'ais',
    order: 300,
    deps: ['vessels', 'selectedEvent', 'viewport'],
    viewportMode: 'full',
    create(state: ConsoleState) {
      return createAisLayers(state.vessels, state.selectedEvent, state.viewport);
    },
  }),
  f({
    id: 'hospitals',
    order: 350,
    deps: ['selectedEvent', 'viewport', 'sequenceSWaveKm'],
    create(state: ConsoleState) {
      return createHospitalLayers(state.selectedEvent, state.viewport.zoom, state.sequenceSWaveKm);
    },
  }),
  f({
    id: 'earthquakes',
    order: 400,
    deps: ['events', 'selectedEvent'],
    create(state: ConsoleState) {
      const selectedId = state.selectedEvent?.id ?? null;
      const layer = createEarthquakeLayer(state.events, selectedId);
      return layer ? [layer] : [];
    },
  }),
].sort((a, b) => a.order - b.order);
