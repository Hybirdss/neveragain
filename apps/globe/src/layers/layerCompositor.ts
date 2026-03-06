/**
 * Layer Compositor — Orchestrates deck.gl layers with proper performance.
 *
 * Architecture:
 *   - Factory layers: registered in layerFactories.ts, auto-managed dirty tracking
 *   - Asset layer: contextual infrastructure markers, tied to seismic posture
 *   - Wave layer: animation-driven overlay, independent of dirty system
 *
 * Performance budget per frame:
 *   TIER 1 — Every frame (~0 cost): push cached layers, visibility check
 *   TIER 2 — Every 50ms: wave ring position update
 *   TIER 3 — On store change: factory rebuild via dirty flags
 *
 * Adding a new layer does NOT require touching this file.
 * Register it in layerFactories.ts instead.
 */

import type { Layer } from '@deck.gl/core';
import type { MapEngine } from '../core/mapEngine';
import { consoleStore } from '../core/store';
import { LAYER_FACTORIES } from './layerFactories';
import { isLayerEffectivelyVisible, type BundleSettings } from './bundleRegistry';
import { createAssetLayers } from './assetLayer';
import { updateWaveData, createWaveLayers, type WaveSource } from './waveLayer';
import { createIntensityLayer } from './intensityLayer';
import type { LayerId } from './layerRegistry';
import type { EarthquakeEvent } from '../types';

// ── Wave Source Extraction ─────────────────────────────────────

function extractWaveSources(events: EarthquakeEvent[]): WaveSource[] {
  const now = Date.now();
  const waveCutoff = now - 300_000;

  return events
    .filter((e) => e.time > waveCutoff && e.magnitude >= 4.0)
    .map((e) => ({
      id: e.id,
      lat: e.lat,
      lng: e.lng,
      depth_km: e.depth_km,
      magnitude: e.magnitude,
      originTime: e.time,
    }));
}

// ── Compositor ─────────────────────────────────────────────────

export interface LayerCompositor {
  start(): void;
  stop(): void;
}

export function createLayerCompositor(engine: MapEngine): LayerCompositor {
  let running = false;
  let frameId: number | null = null;

  // Factory layer cache and dirty tracking
  const dirty = new Map<LayerId, boolean>();
  const cache = new Map<LayerId, Layer[]>();

  // Asset layer (contextual markers, not factory-managed)
  let assetLayers: Layer[] = [];
  let dirtyAssets = true;

  // Wave animation state
  let waveSources: WaveSource[] = [];
  let lastWaveUpdate = 0;
  const WAVE_UPDATE_INTERVAL = 50;

  // Intensity ink-in-water animation state
  const INTENSITY_SPREAD_SPEED = 250;      // km/s (visual, not physical)
  const INTENSITY_ANIM_DURATION = 3000;    // ms
  const INTENSITY_ANIM_INTERVAL = 50;      // ms between updates
  let intensityAnimStart = 0;
  let intensityAnimEpicenter: { lat: number; lng: number } | null = null;
  let lastIntensityAnimUpdate = 0;

  // ── Store subscriptions ─────────────────────────────────────

  const unsubs: (() => void)[] = [];

  // Helper: subscribe to a store key with a value-ignoring callback.
  // Avoids TypeScript generic inference issues with dynamic keyof unions.
  function watch(key: string, fn: () => void): () => void {
    return (consoleStore as any).subscribe(key, fn);
  }

  // Build dep index: storeKey → factoryIds
  const depIndex = new Map<string, LayerId[]>();
  for (const factory of LAYER_FACTORIES) {
    for (const dep of factory.deps) {
      if (!depIndex.has(dep as string)) depIndex.set(dep as string, []);
      depIndex.get(dep as string)!.push(factory.id);
    }
  }

  // Auto-subscribe: each unique dep key marks its factories dirty
  for (const [key, factoryIds] of depIndex) {
    unsubs.push(watch(key, () => {
      for (const id of factoryIds) dirty.set(id, true);
    }));
  }

  // Special: wave sources derived from events
  unsubs.push(
    consoleStore.subscribe('events', (events) => {
      waveSources = extractWaveSources(events);
    }),
  );

  // Special: intensity ink-in-water animation triggers
  function maybeStartIntensityAnim(): void {
    const event = consoleStore.get('selectedEvent');
    const grid = consoleStore.get('intensityGrid');
    if (event && grid) {
      intensityAnimStart = Date.now();
      intensityAnimEpicenter = { lat: event.lat, lng: event.lng };
      lastIntensityAnimUpdate = 0;
    }
  }

  unsubs.push(
    consoleStore.subscribe('selectedEvent', (event) => {
      if (event) {
        // Event selected — start animation if grid is already available
        maybeStartIntensityAnim();
      } else {
        // Deselected — clear animation state
        intensityAnimStart = 0;
        intensityAnimEpicenter = null;
      }
    }),
  );

  unsubs.push(
    consoleStore.subscribe('intensityGrid', (grid) => {
      // Grid arrived (possibly after event selection) — start animation
      if (grid && consoleStore.get('selectedEvent')) {
        maybeStartIntensityAnim();
      }
    }),
  );

  // Special: asset layer depends on exposures and viewport tier
  unsubs.push(watch('exposures', () => { dirtyAssets = true; }));
  unsubs.push(watch('viewport', () => { dirtyAssets = true; }));

  // ── Render loop ─────────────────────────────────────────────

  function tick(): void {
    if (!running) return;

    const now = Date.now();
    const layers: Layer[] = [];
    const vis: Record<LayerId, boolean> = consoleStore.get('layerVisibility');
    const bundleSettings: BundleSettings = consoleStore.get('bundleSettings');

    // 1. Factory layers (ordered by factory.order)
    for (const factory of LAYER_FACTORIES) {
      if (dirty.get(factory.id)) {
        cache.set(factory.id, factory.create(consoleStore.getState()));
        dirty.set(factory.id, false);
      }
      if (isLayerEffectivelyVisible(factory.id, vis[factory.id], bundleSettings)) {
        const cached = cache.get(factory.id);
        if (cached) layers.push(...cached);
      }
    }

    // 1b. Intensity ink-in-water animation override (TIER 2: 50ms interval)
    if (intensityAnimEpicenter && intensityAnimStart > 0) {
      const elapsed = now - intensityAnimStart;
      if (elapsed < INTENSITY_ANIM_DURATION) {
        // Only rebuild every INTENSITY_ANIM_INTERVAL ms
        if (now - lastIntensityAnimUpdate >= INTENSITY_ANIM_INTERVAL) {
          const revealRadiusKm = (elapsed / 1000) * INTENSITY_SPREAD_SPEED;
          const grid = consoleStore.get('intensityGrid');
          if (grid) {
            const animLayer = createIntensityLayer(grid, intensityAnimEpicenter, revealRadiusKm);
            cache.set('intensity', animLayer ? [animLayer] : []);
            lastIntensityAnimUpdate = now;
          }
        }
      } else {
        // Animation complete — final full render (no animation params)
        dirty.set('intensity', true);
        intensityAnimStart = 0;
        intensityAnimEpicenter = null;
        lastIntensityAnimUpdate = 0;
      }
    }

    // 2. Asset markers (tied to seismic bundle posture)
    if (dirtyAssets) {
      const tier = consoleStore.get('viewport').tier;
      const exposures = consoleStore.get('exposures');
      assetLayers = createAssetLayers(tier, exposures);
      dirtyAssets = false;
    }
    if (bundleSettings.seismic.enabled) {
      layers.push(...assetLayers);
    }

    // 3. Wave animation overlay (TIER 2: 50ms update interval)
    if (waveSources.length > 0) {
      if (now - lastWaveUpdate >= WAVE_UPDATE_INTERVAL) {
        updateWaveData(waveSources, now);
        lastWaveUpdate = now;
      }
      layers.push(...createWaveLayers());
    }

    engine.setLayers(layers);
    frameId = requestAnimationFrame(tick);
  }

  return {
    start() {
      if (running) return;
      running = true;

      // Initialize from current store
      waveSources = extractWaveSources(consoleStore.get('events'));

      // Mark all factories dirty for initial render
      for (const factory of LAYER_FACTORIES) {
        dirty.set(factory.id, true);
      }
      dirtyAssets = true;
      lastWaveUpdate = 0;

      tick();
    },

    stop() {
      running = false;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      for (const unsub of unsubs) unsub();
    },
  };
}
