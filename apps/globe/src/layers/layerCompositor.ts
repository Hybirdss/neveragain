/**
 * Layer Compositor — Orchestrates deck.gl layers with proper performance.
 *
 * Performance budget per frame:
 *
 *   TIER 1 — Every frame (~0 cost):
 *     radiusScale, opacity, currentTime (uniform props)
 *
 *   TIER 2 — Every 50ms (wave animation):
 *     updateWaveData() — recomputes ring positions/opacity
 *     Creates new layer instances with new data refs
 *
 *   TIER 3 — On data change only:
 *     Earthquake data swap, selected event change
 *     Triggers GPU buffer rebuild via updateTriggers
 *
 * Rules:
 *   - NEVER change data ref unless data actually changed
 *   - NEVER put animation state in accessors
 *   - Accessor functions must be PURE and STABLE
 */

import type { Layer } from '@deck.gl/core';
import type { MapEngine } from '../core/mapEngine';
import { consoleStore } from '../core/store';
import { createEarthquakeLayer } from './earthquakeLayer';
import { updateWaveData, createWaveLayers, type WaveSource } from './waveLayer';
import { createAssetLayers } from './assetLayer';
import { createIntensityLayer } from './intensityLayer';
import { createFaultLayer } from './faultLayer';
import { createAisLayers } from './aisLayer';
import type { ActiveFault, EarthquakeEvent, IntensityGrid } from '../types';
import type { Vessel } from '../data/aisManager';
import type { OpsAssetExposure } from '../ops/types';

// ── Wave Source Extraction ─────────────────────────────────────

function extractWaveSources(events: EarthquakeEvent[]): WaveSource[] {
  const now = Date.now();
  // Show waves for events in last 5 minutes (or selected event regardless)
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

  // Cached state — only changes on store updates
  let eventData: EarthquakeEvent[] = [];
  let selectedId: string | null = null;
  let waveSources: WaveSource[] = [];
  let exposures: OpsAssetExposure[] = [];
  let intensityGrid: IntensityGrid | null = null;
  let faults: ActiveFault[] = [];
  let vessels: Vessel[] = [];
  let selectedEvent: EarthquakeEvent | null = null;

  // Layer instances — only recreated when needed
  let earthquakeLayer: Layer | null = null;
  let assetLayers: Layer[] = [];
  let intensityLayer: Layer | null = null;
  let faultLayer: Layer | null = null;
  let aisLayers: Layer[] = [];
  let dirtyEarthquake = true;
  let dirtyAssets = true;
  let dirtyIntensity = true;
  let dirtyFaults = true;
  let dirtyAis = true;

  // Timing
  let lastWaveUpdate = 0;
  const WAVE_UPDATE_INTERVAL = 50; // ms — smooth enough for wave expansion

  // ── Store subscriptions ──────────────────────────────────────

  const unsubEvents = consoleStore.subscribe('events', (events) => {
    eventData = events;
    waveSources = extractWaveSources(events);
    dirtyEarthquake = true;
  });

  const unsubSelected = consoleStore.subscribe('selectedEvent', (event) => {
    selectedId = event?.id ?? null;
    selectedEvent = event;
    dirtyEarthquake = true;
    dirtyAis = true; // impact zone highlighting
  });

  const unsubExposures = consoleStore.subscribe('exposures', (exp) => {
    exposures = exp;
    dirtyAssets = true;
  });

  const unsubViewport = consoleStore.subscribe('viewport', () => {
    dirtyAssets = true;
  });

  const unsubIntensity = consoleStore.subscribe('intensityGrid', (grid) => {
    intensityGrid = grid;
    dirtyIntensity = true;
  });

  const unsubFaults = consoleStore.subscribe('faults', (f) => {
    faults = f;
    dirtyFaults = true;
  });

  const unsubVessels = consoleStore.subscribe('vessels', (v) => {
    vessels = v;
    dirtyAis = true;
  });

  // ── Render loop ──────────────────────────────────────────────

  function tick(): void {
    if (!running) return;

    const now = Date.now();
    const layers: Layer[] = [];

    // Layer visibility from store
    const vis = consoleStore.get('layerVisibility');

    // Layer order (bottom to top):
    // 1. Faults  2. Intensity  3. AIS  4. Earthquakes  5. Assets  6. Waves

    if (dirtyFaults) {
      faultLayer = createFaultLayer(faults);
      dirtyFaults = false;
    }
    if (faultLayer && vis.faults) {
      layers.push(faultLayer);
    }

    if (dirtyIntensity) {
      intensityLayer = createIntensityLayer(intensityGrid);
      dirtyIntensity = false;
    }
    if (intensityLayer && vis.intensity) {
      layers.push(intensityLayer);
    }

    if (dirtyAis) {
      aisLayers = createAisLayers(vessels, selectedEvent);
      dirtyAis = false;
    }
    if (vis.ais) {
      layers.push(...aisLayers);
    }

    if (dirtyEarthquake) {
      earthquakeLayer = createEarthquakeLayer(eventData, selectedId);
      dirtyEarthquake = false;
    }
    if (earthquakeLayer && vis.earthquakes) {
      layers.push(earthquakeLayer);
    }

    if (dirtyAssets) {
      const tier = consoleStore.get('viewport').tier;
      assetLayers = createAssetLayers(tier, exposures);
      dirtyAssets = false;
    }
    if (vis.earthquakes) {
      layers.push(...assetLayers);
    }

    // TIER 2: Update wave ring positions at 50ms intervals
    if (waveSources.length > 0) {
      if (now - lastWaveUpdate >= WAVE_UPDATE_INTERVAL) {
        updateWaveData(waveSources, now);
        lastWaveUpdate = now;
      }
      layers.push(...createWaveLayers());
    }

    // Push to GPU
    engine.setLayers(layers);
    frameId = requestAnimationFrame(tick);
  }

  return {
    start() {
      if (running) return;
      running = true;
      eventData = consoleStore.get('events');
      selectedId = consoleStore.get('selectedEvent')?.id ?? null;
      waveSources = extractWaveSources(eventData);
      exposures = consoleStore.get('exposures');
      intensityGrid = consoleStore.get('intensityGrid');
      faults = consoleStore.get('faults');
      vessels = consoleStore.get('vessels');
      selectedEvent = consoleStore.get('selectedEvent');
      dirtyEarthquake = true;
      dirtyAssets = true;
      dirtyIntensity = true;
      dirtyFaults = true;
      dirtyAis = true;
      lastWaveUpdate = 0;
      tick();
    },

    stop() {
      running = false;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      unsubEvents();
      unsubSelected();
      unsubExposures();
      unsubViewport();
      unsubIntensity();
      unsubFaults();
      unsubVessels();
    },
  };
}
