/**
 * viewPresets.ts — Named visual configurations for the globe
 *
 * ViewPresets control which layers are visible and how the globe
 * is rendered (translucency, etc.). They're independent of AppMode
 * (which controls data flow: realtime/timeline/scenario).
 *
 * Any AppMode can be combined with any ViewPreset.
 */

import type { LayerVisibility, ViewPreset } from '../types';
import type { GlobeInstance } from '../globe/globeInstance';
import { setGlobeTranslucency } from '../globe/globeInstance';
import { store } from './appState';

export interface ViewPresetConfig {
  layers: Partial<LayerVisibility>;
  translucent: boolean;
  frontFaceAlpha: number;
}

const VIEW_PRESETS: Record<ViewPreset, ViewPresetConfig> = {
  default: {
    layers: {
      tectonicPlates: true,
      seismicPoints: true,
      waveRings: true,
      isoseismalContours: true,
      shakeMapContours: false,
      slab2Contours: false,
      labels: true,
      crossSection: false,
    },
    translucent: false,
    frontFaceAlpha: 1.0,
  },
  underground: {
    layers: {
      tectonicPlates: true,
      seismicPoints: true,
      waveRings: false,
      isoseismalContours: false,
      shakeMapContours: false,
      slab2Contours: true,
      labels: false,
      crossSection: false,
    },
    translucent: true,
    frontFaceAlpha: 0.55,
  },
  shakemap: {
    layers: {
      tectonicPlates: false,
      seismicPoints: true,
      waveRings: true,
      isoseismalContours: false,
      shakeMapContours: true,
      slab2Contours: false,
      labels: true,
      crossSection: false,
    },
    translucent: false,
    frontFaceAlpha: 1.0,
  },
  crossSection: {
    layers: {
      tectonicPlates: true,
      seismicPoints: true,
      waveRings: false,
      isoseismalContours: false,
      shakeMapContours: false,
      slab2Contours: true,
      labels: false,
      crossSection: true,
    },
    translucent: false,
    frontFaceAlpha: 1.0,
  },
  cinematic: {
    layers: {
      tectonicPlates: false,
      seismicPoints: true,
      waveRings: true,
      isoseismalContours: true,
      shakeMapContours: false,
      slab2Contours: false,
      labels: false,
      crossSection: false,
    },
    translucent: false,
    frontFaceAlpha: 1.0,
  },
};

/**
 * Apply a view preset — sets layer visibility + globe translucency.
 */
export function applyViewPreset(viewer: GlobeInstance, preset: ViewPreset): void {
  const config = VIEW_PRESETS[preset];
  if (!config) return;

  // Merge preset layers with current layers
  const currentLayers = store.get('layers');
  const newLayers: LayerVisibility = { ...currentLayers, ...config.layers };
  store.set('layers', newLayers);

  // Apply translucency
  setGlobeTranslucency(viewer, config.translucent, config.frontFaceAlpha);

  console.log(`[viewPreset] Applied: ${preset}`);
}
