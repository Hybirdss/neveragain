/**
 * Layer Compositor — Orchestrates deck.gl layers with proper performance.
 *
 * Architecture:
 *   EVENT-DRIVEN: compositor is IDLE by default (0% CPU).
 *   Renders only when:
 *     (a) A dirty flag is set (store change) → single frame via requestRender()
 *     (b) Animations are active (waves/intensity) → continuous rAF loop
 *   When animations end, loop stops automatically.
 *
 *   - Factory layers: registered in layerFactories.ts, auto-managed dirty tracking
 *   - Asset layer: contextual infrastructure markers, tied to seismic posture
 *   - Wave layer: animation-driven overlay, independent of dirty system
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
  let renderRequested = false;

  // Factory layer cache and dirty tracking
  const dirty = new Map<LayerId, boolean>();
  const cache = new Map<LayerId, Layer[]>();
  let anyFactoryDirty = false;

  // Visibility / bundle cache — avoid re-reading store every frame
  let dirtyVisibility = true;
  let cachedVis: Record<LayerId, boolean> = {} as Record<LayerId, boolean>;
  let cachedBundleSettings: BundleSettings = consoleStore.get('bundleSettings');

  // Zoom cache — viewport changes only dirty factories when zoom actually changes
  let cachedZoom = consoleStore.get('viewport').zoom;

  // Asset layer (contextual markers, not factory-managed)
  let assetLayers: Layer[] = [];
  let dirtyAssets = true;

  // Wave animation state
  let waveSources: WaveSource[] = [];
  let lastWaveUpdate = 0;
  const WAVE_UPDATE_INTERVAL = 50;

  // Intensity ink-in-water animation state
  const INTENSITY_SPREAD_SPEED = 250;
  const INTENSITY_ANIM_DURATION = 3000;
  const INTENSITY_ANIM_INTERVAL = 50;
  let intensityAnimStart = 0;
  let intensityAnimEpicenter: { lat: number; lng: number } | null = null;
  let lastIntensityAnimUpdate = 0;

  // ── Animation state helpers ───────────────────────────────────

  function hasActiveAnimations(): boolean {
    return waveSources.length > 0 ||
      (intensityAnimEpicenter != null && intensityAnimStart > 0);
  }

  // ── Event-driven render scheduling ────────────────────────────
  // Palantir pattern: request a single render frame. If animations
  // are active, the tick loop runs continuously. If not, only the
  // requested frame executes then stops.

  function requestRender(): void {
    if (!running) return;
    if (renderRequested || frameId !== null) return;
    renderRequested = true;
    frameId = requestAnimationFrame(tick);
  }

  // ── Store subscriptions ─────────────────────────────────────

  const unsubs: (() => void)[] = [];

  function watch(key: string, fn: () => void): () => void {
    return (consoleStore as any).subscribe(key, fn);
  }

  // Build dep index: storeKey → factoryIds
  // Viewport is split: zoom-only factories skip rebuilds on pan,
  // full-viewport factories (e.g. AIS with bounds filtering) rebuild on every viewport change.
  const depIndex = new Map<string, LayerId[]>();
  const viewportZoomFactoryIds: LayerId[] = [];
  const viewportFullFactoryIds: LayerId[] = [];
  for (const factory of LAYER_FACTORIES) {
    for (const dep of factory.deps) {
      if (dep === 'viewport') {
        if (factory.viewportMode === 'full') {
          viewportFullFactoryIds.push(factory.id);
        } else {
          viewportZoomFactoryIds.push(factory.id);
        }
        continue;
      }
      if (!depIndex.has(dep as string)) depIndex.set(dep as string, []);
      depIndex.get(dep as string)!.push(factory.id);
    }
  }

  // Auto-subscribe: each unique dep key marks its factories dirty AND requests render
  for (const [key, factoryIds] of depIndex) {
    unsubs.push(watch(key, () => {
      for (const id of factoryIds) dirty.set(id, true);
      anyFactoryDirty = true;
      requestRender();
    }));
  }

  // Viewport subscription: zoom-only factories skip pan, full-viewport factories always rebuild
  if (viewportZoomFactoryIds.length > 0 || viewportFullFactoryIds.length > 0) {
    unsubs.push(watch('viewport', () => {
      let changed = false;

      // Full-viewport factories always rebuild (e.g. AIS needs bounds for filtering)
      if (viewportFullFactoryIds.length > 0) {
        for (const id of viewportFullFactoryIds) dirty.set(id, true);
        changed = true;
      }

      // Zoom-only factories only rebuild when zoom actually changes
      const newZoom = consoleStore.get('viewport').zoom;
      if (Math.abs(newZoom - cachedZoom) >= 0.01) {
        cachedZoom = newZoom;
        for (const id of viewportZoomFactoryIds) dirty.set(id, true);
        changed = true;
      }

      if (changed) {
        anyFactoryDirty = true;
        requestRender();
      }
    }));
  }

  // Visibility/bundle changes: mark visibility dirty + request render
  unsubs.push(watch('layerVisibility', () => { dirtyVisibility = true; requestRender(); }));
  unsubs.push(watch('bundleSettings', () => { dirtyVisibility = true; requestRender(); }));

  // Special: wave sources derived from events
  unsubs.push(
    consoleStore.subscribe('events', (events) => {
      waveSources = extractWaveSources(events);
      requestRender();
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
      requestRender();
    }
  }

  unsubs.push(
    consoleStore.subscribe('selectedEvent', (event) => {
      if (event) {
        maybeStartIntensityAnim();
      } else {
        intensityAnimStart = 0;
        intensityAnimEpicenter = null;
      }
    }),
  );

  unsubs.push(
    consoleStore.subscribe('intensityGrid', (grid) => {
      if (grid && consoleStore.get('selectedEvent')) {
        maybeStartIntensityAnim();
      }
    }),
  );

  // Special: asset layer depends on exposures and viewport tier
  unsubs.push(watch('exposures', () => { dirtyAssets = true; requestRender(); }));
  unsubs.push(watch('viewport', () => { dirtyAssets = true; requestRender(); }));

  // ── Render loop ─────────────────────────────────────────────

  function tick(): void {
    if (!running) return;
    frameId = null;
    renderRequested = false;

    const now = Date.now();
    const layers: Layer[] = [];

    // Refresh visibility cache only when changed
    if (dirtyVisibility) {
      cachedVis = consoleStore.get('layerVisibility');
      cachedBundleSettings = consoleStore.get('bundleSettings');
      dirtyVisibility = false;
    }

    // 1. Factory layers (ordered by factory.order)
    const intensityAnimActive = intensityAnimEpicenter != null && intensityAnimStart > 0;

    if (anyFactoryDirty) {
      for (const factory of LAYER_FACTORIES) {
        if (dirty.get(factory.id)) {
          cache.set(factory.id, factory.create(consoleStore.getState()));
          dirty.set(factory.id, false);
        }
      }
      anyFactoryDirty = false;
    }

    for (const factory of LAYER_FACTORIES) {
      if (factory.id === 'intensity' && intensityAnimActive) continue;
      if (isLayerEffectivelyVisible(factory.id, cachedVis[factory.id], cachedBundleSettings)) {
        const cached = cache.get(factory.id);
        if (cached) layers.push(...cached);
      }
    }

    // 1b. Intensity ink-in-water animation override
    if (intensityAnimActive) {
      const elapsed = now - intensityAnimStart;
      if (elapsed < INTENSITY_ANIM_DURATION) {
        if (now - lastIntensityAnimUpdate >= INTENSITY_ANIM_INTERVAL) {
          const revealRadiusKm = (elapsed / 1000) * INTENSITY_SPREAD_SPEED;
          const grid = consoleStore.get('intensityGrid');
          if (grid) {
            const animLayer = createIntensityLayer(grid, intensityAnimEpicenter!, revealRadiusKm);
            cache.set('intensity', animLayer ? [animLayer] : []);
            lastIntensityAnimUpdate = now;
          }
        }
        if (isLayerEffectivelyVisible('intensity', cachedVis['intensity'], cachedBundleSettings)) {
          const cached = cache.get('intensity');
          if (cached) layers.push(...cached);
        }
      } else {
        // Animation complete — final full render
        dirty.set('intensity', true);
        intensityAnimStart = 0;
        intensityAnimEpicenter = null;
        lastIntensityAnimUpdate = 0;
        cache.set('intensity', LAYER_FACTORIES.find((f) => f.id === 'intensity')!.create(consoleStore.getState()));
        dirty.set('intensity', false);
        if (isLayerEffectivelyVisible('intensity', cachedVis['intensity'], cachedBundleSettings)) {
          const cached = cache.get('intensity');
          if (cached) layers.push(...cached);
        }
      }
    }

    // 2. Asset markers
    if (dirtyAssets) {
      const tier = consoleStore.get('viewport').tier;
      const exposures = consoleStore.get('exposures');
      assetLayers = createAssetLayers(tier, exposures);
      dirtyAssets = false;
    }
    if (cachedBundleSettings.seismic.enabled) {
      layers.push(...assetLayers);
    }

    // 3. Wave animation overlay
    if (waveSources.length > 0) {
      if (now - lastWaveUpdate >= WAVE_UPDATE_INTERVAL) {
        updateWaveData(waveSources, now);
        lastWaveUpdate = now;
      }
      layers.push(...createWaveLayers());
    }

    engine.setLayers(layers);

    // Continue rAF only if animations are running.
    // Otherwise, compositor goes idle until next requestRender().
    if (hasActiveAnimations()) {
      frameId = requestAnimationFrame(tick);
    }
  }

  return {
    start() {
      if (running) return;
      running = true;

      waveSources = extractWaveSources(consoleStore.get('events'));

      for (const factory of LAYER_FACTORIES) {
        dirty.set(factory.id, true);
      }
      anyFactoryDirty = true;
      dirtyAssets = true;
      dirtyVisibility = true;
      lastWaveUpdate = 0;

      requestRender();
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
