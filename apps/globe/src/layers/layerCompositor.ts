/**
 * Layer Compositor — Orchestrates all deck.gl layers and the animation loop.
 *
 * Manages the render cycle:
 * 1. Reads state from consoleStore
 * 2. Computes layer props per frame (for animations)
 * 3. Pushes composed layer array to MapEngine
 *
 * Animation budget:
 * - radiusScale/uniform updates: ~0 cost, safe at 60fps
 * - accessor changes (getRadius with updateTriggers): moderate, throttled
 * - data object changes: expensive, only on real data updates
 */

import type { Layer } from '@deck.gl/core';
import type { MapEngine } from '../core/mapEngine';
import { consoleStore } from '../core/store';
import { createEarthquakeLayer } from './earthquakeLayer';
import { createWaveLayers, type WaveSource } from './waveLayer';
import type { EarthquakeEvent } from '../types';

// ── Animation State ────────────────────────────────────────────

let animationFrame = 0;
let lastUpdateTime = 0;
const ACCESSOR_THROTTLE_MS = 100; // throttle accessor-heavy updates

// ── Wave Sources ───────────────────────────────────────────────

function toWaveSources(events: EarthquakeEvent[]): WaveSource[] {
  const now = Date.now();
  const waveCutoff = now - 300_000; // show waves for events < 5 min old

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
  /** Force a full layer rebuild (e.g. on data change) */
  invalidate(): void;
}

export function createLayerCompositor(engine: MapEngine): LayerCompositor {
  let running = false;
  let frameId: number | null = null;
  let cachedEvents: EarthquakeEvent[] = [];
  let cachedWaveSources: WaveSource[] = [];
  let needsFullRebuild = true;

  // Subscribe to data changes
  const unsubEvents = consoleStore.subscribe('events', (events) => {
    cachedEvents = events;
    cachedWaveSources = toWaveSources(events);
    needsFullRebuild = true;
  });

  const unsubSelected = consoleStore.subscribe('selectedEvent', () => {
    needsFullRebuild = true;
  });

  function composeLayers(now: number): Layer[] {
    const layers: Layer[] = [];

    // Pulse phase: smooth sine wave, 2-second period
    const pulsePhase = (Math.sin(now * Math.PI * 2 / 2000) + 1) / 2;

    // 1. Earthquake dots
    const selectedId = consoleStore.get('selectedEvent')?.id ?? null;
    layers.push(
      createEarthquakeLayer({
        events: cachedEvents,
        selectedId,
        pulsePhase,
      }),
    );

    // 2. Wave propagation rings
    const waveLayers = createWaveLayers(cachedWaveSources, now);
    layers.push(...waveLayers);

    return layers;
  }

  function tick(): void {
    if (!running) return;

    const now = performance.now();
    const realNow = Date.now();

    // Always render waves (uniform prop, zero cost)
    // Throttle accessor-heavy layers
    const shouldUpdateAccessors = needsFullRebuild || (now - lastUpdateTime > ACCESSOR_THROTTLE_MS);

    if (shouldUpdateAccessors) {
      lastUpdateTime = now;
      needsFullRebuild = false;

      // Recompute wave sources periodically
      if (animationFrame % 60 === 0) {
        cachedWaveSources = toWaveSources(cachedEvents);
      }
    }

    const layers = composeLayers(realNow);
    engine.setLayers(layers);

    animationFrame++;
    frameId = requestAnimationFrame(tick);
  }

  return {
    start() {
      if (running) return;
      running = true;
      cachedEvents = consoleStore.get('events');
      cachedWaveSources = toWaveSources(cachedEvents);
      needsFullRebuild = true;
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
    },

    invalidate() {
      needsFullRebuild = true;
    },
  };
}
