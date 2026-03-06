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
    deps: ['intensityGrid'],
    create(state: ConsoleState) {
      const layer = createIntensityLayer(state.intensityGrid);
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
    deps: ['selectedEvent', 'viewport'],
    create(state: ConsoleState) {
      return createRailLayers(state.selectedEvent, state.viewport.zoom);
    },
  }),
  f({
    id: 'power',
    order: 260,
    deps: ['selectedEvent', 'viewport'],
    create(state: ConsoleState) {
      return createPowerLayers(state.selectedEvent, state.viewport.zoom);
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
    deps: ['selectedEvent', 'viewport'],
    create(state: ConsoleState) {
      return createHospitalLayers(state.selectedEvent, state.viewport.zoom);
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
