/**
 * Layer Compositor — Orchestrates deck.gl layers with proper performance.
 *
 * Architecture:
 *   EVENT-DRIVEN: compositor is IDLE by default (0% CPU).
 *   Renders only when:
 *     (a) A dirty flag is set (store change) -> single frame via requestRender()
 *     (b) Animations are active (waves/intensity/sequence) -> continuous rAF loop
 *     (c) Calm pulse is active -> slow timer (~15fps) for earthquake breathing
 *   When animations end, loop stops automatically.
 *
 *   - Factory layers: registered in layerFactories.ts, auto-managed dirty tracking
 *   - Asset layer: contextual infrastructure markers, tied to seismic posture
 *   - Wave layer: animation-driven overlay for real-time events
 *   - Wave sequence: 3-second propagation replay for selected events
 *   - Calm pulse: slow breathing animation for recent earthquake dots
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
import { createEarthquakeLayer, createEarthquakeGlowLayer, createEarthquakeAgeRingLayer } from './earthquakeLayer';
import { createImpactVisualizationLayers } from './impactVisualization';
import {
  createSequenceLayers,
  getSWaveRadiusKm,
  isSequenceActive,
  startSequence,
  createInactiveSequence,
  type WaveSequenceState,
} from './waveSequence';
import { createDistanceRingLayers } from './distanceRings';
import { createAfterShockZoneLayers } from './aftershockZone';
import { createBearingLineLayers } from './bearingLines';
import { createDmatDeploymentLayers } from './dmatLines';
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

  // Visibility / bundle cache
  let dirtyVisibility = true;
  let cachedVis: Record<LayerId, boolean> = {} as Record<LayerId, boolean>;
  let cachedBundleSettings: BundleSettings = consoleStore.get('bundleSettings');

  // Zoom cache
  let cachedZoom = consoleStore.get('viewport').zoom;

  // Asset layer (contextual markers)
  let assetLayers: Layer[] = [];
  let dirtyAssets = true;

  // Wave animation state (real-time events)
  let waveSources: WaveSource[] = [];
  let lastWaveUpdate = 0;
  const WAVE_UPDATE_INTERVAL = 50;

  // Wave sequence state (selected event replay)
  let sequence: WaveSequenceState = createInactiveSequence();

  // Intensity animation state
  const INTENSITY_SPREAD_SPEED = 250;
  const INTENSITY_ANIM_DURATION = 3000;
  const INTENSITY_ANIM_INTERVAL = 50;
  let intensityAnimStart = 0;
  let intensityAnimEpicenter: { lat: number; lng: number } | null = null;
  let lastIntensityAnimUpdate = 0;

  // Calm pulse state — slow breathing for recent earthquake dots
  const CALM_PULSE_INTERVAL = 66; // ~15fps
  const RECENT_EVENT_WINDOW = 3600_000; // 1 hour
  let calmPulseTimer: ReturnType<typeof setInterval> | null = null;

  // ── Calm Pulse Management ─────────────────────────────────────

  function hasRecentEvents(): boolean {
    const events = consoleStore.get('events');
    const cutoff = Date.now() - RECENT_EVENT_WINDOW;
    return events.some((e) => e.time > cutoff);
  }

  function startCalmPulse(): void {
    if (calmPulseTimer) return;
    calmPulseTimer = setInterval(() => {
      requestRender();
    }, CALM_PULSE_INTERVAL);
  }

  function stopCalmPulse(): void {
    if (calmPulseTimer) {
      clearInterval(calmPulseTimer);
      calmPulseTimer = null;
    }
  }

  function manageCalmPulse(): void {
    const selected = consoleStore.get('selectedEvent');
    const seqRunning = isSequenceActive(sequence, Date.now());

    // Calm pulse for unselected mode with recent events
    // OR slow glow pulse for selected event (impact glow ring breathes)
    const shouldPulse = !seqRunning && (
      (!selected && hasRecentEvents()) || selected != null
    );
    if (shouldPulse) {
      startCalmPulse();
    } else {
      stopCalmPulse();
    }
  }

  // ── Animation state helpers ───────────────────────────────────

  function hasActiveAnimations(): boolean {
    const now = Date.now();
    return waveSources.length > 0 ||
      isSequenceActive(sequence, now) ||
      (intensityAnimEpicenter != null && intensityAnimStart > 0);
  }

  // ── Event-driven render scheduling ────────────────────────────

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

  // Build dep index: storeKey -> factoryIds
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

  // Viewport subscription: zoom-only vs full
  if (viewportZoomFactoryIds.length > 0 || viewportFullFactoryIds.length > 0) {
    unsubs.push(watch('viewport', () => {
      let changed = false;

      if (viewportFullFactoryIds.length > 0) {
        for (const id of viewportFullFactoryIds) dirty.set(id, true);
        changed = true;
      }

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

  // Visibility/bundle changes
  unsubs.push(watch('layerVisibility', () => { dirtyVisibility = true; requestRender(); }));
  unsubs.push(watch('bundleSettings', () => { dirtyVisibility = true; requestRender(); }));

  // Real-time wave sources derived from events
  unsubs.push(
    consoleStore.subscribe('events', (events) => {
      waveSources = extractWaveSources(events);
      manageCalmPulse();
      requestRender();
    }),
  );

  // Selected event -> start wave sequence + intensity animation
  unsubs.push(
    consoleStore.subscribe('selectedEvent', (event) => {
      if (event) {
        // Start the 3-second wave sequence replay
        sequence = startSequence(
          { lat: event.lat, lng: event.lng },
          event.magnitude,
          event.depth_km,
        );
        stopCalmPulse();
        maybeStartIntensityAnim();
      } else {
        sequence = createInactiveSequence();
        intensityAnimStart = 0;
        intensityAnimEpicenter = null;
        manageCalmPulse();
      }
      requestRender();
    }),
  );

  // Intensity grid -> start animation if event selected
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
    consoleStore.subscribe('intensityGrid', (grid) => {
      if (grid && consoleStore.get('selectedEvent')) {
        maybeStartIntensityAnim();
      }
    }),
  );

  // Asset layer depends on exposures, viewport tier, and highlighted asset
  unsubs.push(watch('exposures', () => { dirtyAssets = true; requestRender(); }));
  unsubs.push(watch('viewport', () => { dirtyAssets = true; requestRender(); }));
  unsubs.push(watch('highlightedAssetId', () => { dirtyAssets = true; requestRender(); }));

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

    // ── 1. Factory layers (ordered by factory.order) ──────────────
    const seqActive = isSequenceActive(sequence, now);
    const intensityAnimActive = intensityAnimEpicenter != null && intensityAnimStart > 0;
    const intensityDrivenBySequence = seqActive && intensityAnimActive;

    // Update S-wave radius in store for infrastructure cascade
    if (seqActive) {
      const sKm = getSWaveRadiusKm(sequence, now);
      consoleStore.set('sequenceSWaveKm', sKm);
    } else if (consoleStore.get('sequenceSWaveKm') !== null) {
      consoleStore.set('sequenceSWaveKm', null);
    }

    // Calm pulse: slow breathing for recent earthquake dots
    const calmPulseActive = !seqActive && !consoleStore.get('selectedEvent') && hasRecentEvents();
    const pulseScale = calmPulseActive
      ? 1 + 0.12 * Math.sin(now * 0.0015)
      : 1;

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
      // Intensity handled separately (animation override below)
      if (factory.id === 'intensity' && (intensityAnimActive || intensityDrivenBySequence)) continue;

      // Earthquake layer: add ambient glow behind dots + calm pulse override
      if (factory.id === 'earthquakes') {
        if (isLayerEffectivelyVisible('earthquakes', cachedVis['earthquakes'], cachedBundleSettings)) {
          const state = consoleStore.getState();
          const selectedId = state.selectedEvent?.id ?? null;

          // Age decay rings (behind glow, behind dots)
          const ageRingLayer = createEarthquakeAgeRingLayer(state.events);
          if (ageRingLayer) layers.push(ageRingLayer);

          // Ambient glow halos (behind dots, always present for recent events)
          const glowLayer = createEarthquakeGlowLayer(state.events);
          if (glowLayer) layers.push(glowLayer);

          if (calmPulseActive) {
            // Override with pulsing radiusScale
            layers.push(createEarthquakeLayer(state.events, selectedId, pulseScale));
          } else {
            const cached = cache.get(factory.id);
            if (cached) layers.push(...cached);
          }
        }
        continue;
      }

      if (isLayerEffectivelyVisible(factory.id, cachedVis[factory.id], cachedBundleSettings)) {
        const cached = cache.get(factory.id);
        if (cached) layers.push(...cached);
      }
    }

    // ── 1b. Intensity animation ─────────────────────────────────
    const intensityVisible = isLayerEffectivelyVisible('intensity', cachedVis['intensity'], cachedBundleSettings);

    if (intensityDrivenBySequence) {
      // Wave sequence drives intensity reveal — S-wave front determines visible radius
      const sWaveKm = getSWaveRadiusKm(sequence, now);
      const grid = consoleStore.get('intensityGrid');

      if (grid && sWaveKm < Infinity) {
        if (now - lastIntensityAnimUpdate >= INTENSITY_ANIM_INTERVAL) {
          const animLayer = createIntensityLayer(grid, sequence.epicenter, sWaveKm);
          cache.set('intensity', animLayer ? [animLayer] : []);
          lastIntensityAnimUpdate = now;
        }
        if (intensityVisible) {
          const cached = cache.get('intensity');
          if (cached) layers.push(...cached);
        }
      }
    } else if (intensityAnimActive) {
      // Independent intensity animation (sequence ended or non-sequence trigger)
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
        if (intensityVisible) {
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
        if (intensityVisible) {
          const cached = cache.get('intensity');
          if (cached) layers.push(...cached);
        }
        // Resume calm pulse if appropriate
        manageCalmPulse();
      }
    } else {
      // Static intensity (no animation)
      if (intensityVisible) {
        const cached = cache.get('intensity');
        if (cached) layers.push(...cached);
      }
    }

    // ── 2. Asset markers ────────────────────────────────────────
    if (dirtyAssets) {
      const tier = consoleStore.get('viewport').tier;
      const exposures = consoleStore.get('exposures');
      const highlightId = consoleStore.get('highlightedAssetId');
      assetLayers = createAssetLayers(tier, exposures, highlightId);
      dirtyAssets = false;
    }
    if (cachedBundleSettings.seismic.enabled) {
      layers.push(...assetLayers);
    }

    // ── 3. Impact visualization (glow ring + impact zone + connection arcs) ──
    // Rendered when an event is selected, persists beyond sequence
    const selectedEvent = consoleStore.get('selectedEvent');
    if (selectedEvent) {
      const exposures = consoleStore.get('exposures');
      layers.push(...createImpactVisualizationLayers(selectedEvent, exposures, now));
    }

    // ── 3e. Aftershock probability zone (M6+) ──
    if (selectedEvent && selectedEvent.magnitude >= 6.0) {
      layers.push(...createAfterShockZoneLayers(selectedEvent));
    }

    // ── 3b. Distance rings (concentric range indicators) ──
    if (selectedEvent) {
      layers.push(...createDistanceRingLayers(selectedEvent));
    }

    // ── 3c. Bearing lines (epicenter → critical assets) ──
    if (selectedEvent) {
      const exposures = consoleStore.get('exposures');
      layers.push(...createBearingLineLayers(selectedEvent, exposures));
    }

    // ── 3d. DMAT deployment lines ──
    layers.push(...createDmatDeploymentLayers(selectedEvent));

    // ── 4. Real-time wave overlay ───────────────────────────────
    if (waveSources.length > 0) {
      if (now - lastWaveUpdate >= WAVE_UPDATE_INTERVAL) {
        updateWaveData(waveSources, now);
        lastWaveUpdate = now;
      }
      layers.push(...createWaveLayers());
    }

    // ── 5. Wave sequence layers (flash + P-rings + S-rings + fill) ──
    // Rendered ON TOP of everything for maximum visual impact
    if (seqActive) {
      layers.push(...createSequenceLayers(sequence, now));
    }

    engine.setLayers(layers);

    // ── Animation loop management ───────────────────────────────
    // Full-speed rAF for active animations; calm pulse uses its own slow timer
    if (hasActiveAnimations()) {
      frameId = requestAnimationFrame(tick);
    } else if (seqActive) {
      // Sequence just ended this frame — do final intensity render next frame
      sequence = createInactiveSequence();
      requestRender();
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
      manageCalmPulse();
    },

    stop() {
      running = false;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      stopCalmPulse();
      for (const unsub of unsubs) unsub();
    },
  };
}
