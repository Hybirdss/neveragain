/**
 * viewPresets.ts — Named visual configurations for the globe
 *
 * ViewPresets control which layers are visible and how the globe
 * is rendered (translucency, etc.). They're independent of AppMode
 * (which controls data flow: realtime/timeline/scenario).
 *
 * Any AppMode can be combined with any ViewPreset.
 */

import * as Cesium from 'cesium';
import type { LayerVisibility, ViewPreset } from '../types';
import type { GlobeInstance } from '../globe/globeInstance';
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
 * Find layers that are currently ON but will be OFF in the new preset.
 */
function findDepartingLayers(
  current: LayerVisibility,
  next: LayerVisibility,
): (keyof LayerVisibility)[] {
  const departing: (keyof LayerVisibility)[] = [];
  for (const key of Object.keys(current) as (keyof LayerVisibility)[]) {
    if (current[key] && !next[key]) departing.push(key);
  }
  return departing;
}

/**
 * Smoothstep-interpolate globe translucency frontFaceAlpha.
 */
function animateTranslucency(
  viewer: GlobeInstance,
  targetAlpha: number,
  durationMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    const startAlpha = viewer.scene.globe.translucency.enabled
      ? viewer.scene.globe.translucency.frontFaceAlpha
      : 1.0;

    if (!viewer.scene.globe.translucency.enabled) {
      viewer.scene.globe.translucency.enabled = true;
      viewer.scene.globe.translucency.backFaceAlpha = 0.0;
    }

    const start = performance.now();
    function tick() {
      const t = Math.min(1, (performance.now() - start) / durationMs);
      const eased = t * t * (3 - 2 * t); // smoothstep
      viewer.scene.globe.translucency.frontFaceAlpha =
        startAlpha + (targetAlpha - startAlpha) * eased;
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
}

/**
 * Apply a view preset — 4-step animated transition:
 *   1. Fade out departing layers
 *   2. Interpolate globe translucency (800ms)
 *   3. Apply remaining layer changes
 *   4. Tilt camera for underground preset
 */
export async function applyViewPreset(viewer: GlobeInstance, preset: ViewPreset): Promise<void> {
  const config = VIEW_PRESETS[preset];
  if (!config) return;

  const currentLayers = store.get('layers');
  const newLayers: LayerVisibility = { ...currentLayers, ...config.layers };

  // Step 1: Fade out departing layers (set off immediately — CSS handles transitions)
  const departing = findDepartingLayers(currentLayers, newLayers);
  if (departing.length > 0) {
    const intermediate = { ...currentLayers };
    for (const key of departing) {
      intermediate[key] = false;
    }
    store.set('layers', intermediate);
  }

  // Step 2: Globe translucency interpolation (800ms)
  if (config.translucent) {
    await animateTranslucency(viewer, config.frontFaceAlpha, 800);
  } else if (viewer.scene.globe.translucency.enabled) {
    await animateTranslucency(viewer, 1.0, 800);
    viewer.scene.globe.translucency.enabled = false;
  }

  // Step 3: Apply remaining layer changes
  store.set('layers', newLayers);

  // Step 4: If going underground, tilt camera
  if (preset === 'underground') {
    const currentPitch = viewer.camera.pitch;
    if (currentPitch < Cesium.Math.toRadians(-60)) {
      viewer.camera.flyTo({
        destination: viewer.camera.position,
        orientation: {
          heading: viewer.camera.heading,
          pitch: Cesium.Math.toRadians(-45),
          roll: 0,
        },
        duration: 1.5,
      });
    }
  }

  console.log(`[viewPreset] Applied: ${preset}`);
}
