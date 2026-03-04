/**
 * layerToggle.ts — Subscribe to store.layers and toggle Cesium layer visibility.
 *
 * Uses each layer module's setVisible function for clean show/hide toggling.
 * Cesium uses .show property instead of data array swapping.
 */

import { store } from '../../store/appState';
import type { GlobeInstance } from '../globeInstance';
import type { LayerVisibility } from '../../types';
import { setPointsVisible } from './seismicPoints';
import { setRingsVisible } from './waveRings';
import { setIsoseismalVisible } from './isoseismal';
import { setPlatesVisible } from './tectonicPlates';
import { setShakeMapVisible } from '../features/shakeMapOverlay';
import { setSlab2Visible } from '../features/slab2Contours';
import { setPlateauVisible } from '../features/plateauBuildings';
import { setDepthRingsVisible } from '../features/depthRings';
import { setLabelsVisible } from './labels';
import {
  setGsiFaultsVisible,
  setGsiReliefVisible,
  setGsiSlopeVisible,
  setGsiPaleVisible,
  setAdminBoundaryVisible,
  setJshisHazardVisible,
} from './gsiLayers';

function applyVisibility(_viewer: GlobeInstance, layers: LayerVisibility): void {
  setPlatesVisible(layers.tectonicPlates);
  setPointsVisible(layers.seismicPoints);
  setRingsVisible(layers.waveRings);
  setIsoseismalVisible(layers.isoseismalContours);
  setShakeMapVisible(layers.shakeMapContours);
  setSlab2Visible(layers.slab2Contours);
  setDepthRingsVisible(layers.slab2Contours);
  setPlateauVisible(layers.plateauBuildings);
  setLabelsVisible(layers.labels);
  setGsiFaultsVisible(layers.gsiFaults);
  setGsiReliefVisible(layers.gsiRelief);
  setGsiSlopeVisible(layers.gsiSlope);
  setGsiPaleVisible(layers.gsiPale);
  setAdminBoundaryVisible(layers.adminBoundary);
  setJshisHazardVisible(layers.jshisHazard);
}

let unsubscribe: (() => void) | null = null;

/**
 * Wire up a store subscription so that changes to `store.layers`
 * toggle the corresponding Cesium layer visibility.
 */
export function initLayerToggle(viewer: GlobeInstance): void {
  applyVisibility(viewer, store.get('layers'));

  unsubscribe = store.subscribe('layers', (layers: LayerVisibility) => {
    applyVisibility(viewer, layers);
  });
}

export function disposeLayerToggle(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
