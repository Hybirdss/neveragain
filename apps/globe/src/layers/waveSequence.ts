/**
 * Wave Sequence — 3-second earthquake propagation replay.
 *
 * THE signature visual of namazue.dev.
 *
 * When an operator selects any earthquake (historical or real-time),
 * this replays the P-wave and S-wave propagation as a compressed
 * 3-second sequence with:
 *   - Epicenter flash (white burst + secondary shockwave ring)
 *   - Multi-ring P-wave (cyan, 2 concentric trailing echoes)
 *   - Multi-ring S-wave (amber, 2 echoes) + interior amber wash
 *   - Ground-zero crosshair that persists after flash
 *
 * The S-wave front drives the intensity field reveal and
 * infrastructure cascade timing.
 *
 * Time compression: 40x real speed
 *   P-wave visual: 240 km/s (real: 6 km/s)
 *   S-wave visual: 140 km/s (real: 3.5 km/s)
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';

// ── Compressed propagation speeds ─────────────────────────────
// Base velocities: average upper-crust P and S wave speeds for Japan.
// Vp ≈ 6.0 km/s, Vs ≈ 3.5 km/s — consistent with the JMA one-dimensional
// velocity model (JMA2001) used for earthquake location.
// Reference: Ueno, H. et al. (2002). "Improvement of hypocenter determination
// procedures in the JMA seismic network." QJ Seismol. 65, 123-134.
const TIME_COMPRESSION = 40;
const VP_VISUAL_KMS = 6.0 * TIME_COMPRESSION;   // 240 km/s (real: 6.0 km/s)
const VS_VISUAL_KMS = 3.5 * TIME_COMPRESSION;   // 140 km/s (real: 3.5 km/s)

// ── Sequence timing (ms) ──────────────────────────────────────
const FLASH_DURATION = 320;
const P_START = 120;
const S_START = 380;
const SEQUENCE_DURATION = 3400;
const MAX_RADIUS_KM = 800;

// Echo ring lag distances (km behind the main ring)
const P_ECHO_LAGS = [25, 55];
const S_ECHO_LAGS = [18, 40];

// ── Layer data types ──────────────────────────────────────────
interface RingDatum {
  position: [number, number];
  radiusMeters: number;
  color: [number, number, number, number];
}

interface FlashDatum {
  position: [number, number];
  radius: number;
  color: [number, number, number, number];
}

// ── Sequence State ────────────────────────────────────────────

export interface WaveSequenceState {
  active: boolean;
  startTime: number;
  epicenter: { lat: number; lng: number };
  magnitude: number;
  depth_km: number;
}

export function createInactiveSequence(): WaveSequenceState {
  return { active: false, startTime: 0, epicenter: { lat: 0, lng: 0 }, magnitude: 0, depth_km: 0 };
}

export function startSequence(
  epicenter: { lat: number; lng: number },
  magnitude: number,
  depth_km: number,
): WaveSequenceState {
  return { active: true, startTime: Date.now(), epicenter, magnitude, depth_km };
}

export function isSequenceActive(state: WaveSequenceState, now: number): boolean {
  return state.active && (now - state.startTime) < SEQUENCE_DURATION;
}

/** Current S-wave visual radius in km. Drives intensity reveal + infrastructure cascade. */
export function getSWaveRadiusKm(state: WaveSequenceState, now: number): number {
  if (!state.active) return Infinity;
  const elapsed = now - state.startTime;
  if (elapsed < S_START) return 0;
  const sElapsedSec = (elapsed - S_START) / 1000;
  return Math.min(VS_VISUAL_KMS * sElapsedSec, MAX_RADIUS_KM);
}

/** Sequence progress 0..1. */
export function getSequenceProgress(state: WaveSequenceState, now: number): number {
  if (!state.active) return 1;
  return Math.min(1, (now - state.startTime) / SEQUENCE_DURATION);
}

// ── Helpers ───────────────────────────────────────────────────

function kmToMeters(km: number, depth: number): number {
  return Math.sqrt(km * km + depth * depth) * 1000;
}

function ringAlpha(radiusKm: number, maxAlpha: number, magScale: number): number {
  const fade = Math.max(0, 1 - radiusKm / MAX_RADIUS_KM);
  return Math.round(fade * Math.max(0.3, magScale) * maxAlpha);
}

// ── Pre-allocated data pools ──────────────────────────────────
// Flash: main burst + shockwave ring
const flashPool: FlashDatum[] = Array.from({ length: 2 }, () => ({
  position: [0, 0], radius: 0, color: [0, 0, 0, 0],
}));

// Rings: P main + 2 echoes + S main + 2 echoes = 6
const ringPool: RingDatum[] = Array.from({ length: 6 }, () => ({
  position: [0, 0], radiusMeters: 0, color: [0, 0, 0, 0],
}));

// S-wave fill: 1 datum
const sFillPool: RingDatum[] = [{ position: [0, 0], radiusMeters: 0, color: [0, 0, 0, 0] }];

// Ground-zero marker
const gzPool: FlashDatum[] = [{ position: [0, 0], radius: 0, color: [0, 0, 0, 0] }];

// ── Layer Construction ────────────────────────────────────────

export function createSequenceLayers(state: WaveSequenceState, now: number): Layer[] {
  if (!state.active) return [];
  const elapsed = now - state.startTime;
  if (elapsed > SEQUENCE_DURATION) return [];

  const layers: Layer[] = [];
  const pos: [number, number] = [state.epicenter.lng, state.epicenter.lat];
  const magScale = Math.min(1, (state.magnitude - 3) / 4);
  const depth = state.depth_km;

  // ── 1. S-wave interior fill ─────────────────────────────────
  // Subtle amber wash expanding with S-wave. Makes the "damage zone" visible.
  if (elapsed > S_START) {
    const sElapsed = (elapsed - S_START) / 1000;
    const sRadiusKm = VS_VISUAL_KMS * sElapsed;
    if (sRadiusKm < MAX_RADIUS_KM && sRadiusKm > 0) {
      const fillAlpha = Math.round(
        Math.max(0, 1 - sRadiusKm / MAX_RADIUS_KM) * Math.max(0.3, magScale) * 20,
      );
      sFillPool[0].position = pos;
      sFillPool[0].radiusMeters = kmToMeters(sRadiusKm, depth);
      sFillPool[0].color = [251, 191, 36, fillAlpha];

      layers.push(new ScatterplotLayer<RingDatum>({
        id: 'wave-seq-s-fill',
        data: sFillPool,
        pickable: false,
        stroked: false,
        filled: true,
        radiusUnits: 'meters',
        getPosition: (d) => d.position,
        getRadius: (d) => d.radiusMeters,
        getFillColor: (d) => d.color,
        updateTriggers: { getRadius: [elapsed], getFillColor: [elapsed] },
      }));
    }
  }

  // ── 2. Epicenter flash ──────────────────────────────────────
  // Two-stage: bright burst (0-200ms) + expanding shockwave ring (0-320ms)
  if (elapsed < FLASH_DURATION) {
    const t = elapsed / FLASH_DURATION;
    let poolIdx = 0;

    // Main burst — white, expanding, fading
    const burstRadius = 14 + t * 50;
    const burstAlpha = Math.round(255 * Math.pow(Math.max(0, 1 - t * 0.85), 2));
    flashPool[poolIdx].position = pos;
    flashPool[poolIdx].radius = burstRadius;
    flashPool[poolIdx].color = [255, 255, 255, burstAlpha];
    poolIdx++;

    // Shockwave ring — larger, dimmer, lags slightly
    if (elapsed > 60) {
      const rt = (elapsed - 60) / (FLASH_DURATION - 60);
      const ringRadius = 30 + rt * 80;
      const ringAlphaVal = Math.round(160 * Math.pow(Math.max(0, 1 - rt), 1.5));
      flashPool[poolIdx].position = pos;
      flashPool[poolIdx].radius = ringRadius;
      flashPool[poolIdx].color = [255, 255, 255, ringAlphaVal];
      poolIdx++;
    }

    // Burst fill
    layers.push(new ScatterplotLayer<FlashDatum>({
      id: 'wave-seq-flash',
      data: flashPool.slice(0, 1),
      pickable: false,
      stroked: false,
      filled: true,
      radiusUnits: 'pixels',
      getPosition: (d) => d.position,
      getRadius: (d) => d.radius,
      getFillColor: (d) => d.color,
      updateTriggers: { getFillColor: [elapsed], getRadius: [elapsed] },
    }));

    // Shockwave ring (stroked)
    if (poolIdx > 1) {
      layers.push(new ScatterplotLayer<FlashDatum>({
        id: 'wave-seq-shockwave',
        data: flashPool.slice(1, 2),
        pickable: false,
        stroked: true,
        filled: false,
        radiusUnits: 'pixels',
        lineWidthUnits: 'pixels',
        getPosition: (d) => d.position,
        getRadius: (d) => d.radius,
        getLineColor: (d) => d.color,
        getLineWidth: 2,
        updateTriggers: { getLineColor: [elapsed], getRadius: [elapsed] },
      }));
    }
  }

  // ── 3. Ground-zero marker ───────────────────────────────────
  // Small pulsing dot at epicenter that persists through the sequence
  if (elapsed > FLASH_DURATION * 0.5) {
    const gzT = Math.min(1, (elapsed - FLASH_DURATION * 0.5) / 500);
    const gzAlpha = Math.round(180 * gzT);
    const gzPulse = 4 + 1.5 * Math.sin(elapsed * 0.006);
    gzPool[0].position = pos;
    gzPool[0].radius = gzPulse;
    gzPool[0].color = [255, 255, 255, gzAlpha];

    layers.push(new ScatterplotLayer<FlashDatum>({
      id: 'wave-seq-gz',
      data: gzPool,
      pickable: false,
      stroked: true,
      filled: true,
      radiusUnits: 'pixels',
      lineWidthUnits: 'pixels',
      getPosition: (d) => d.position,
      getRadius: (d) => d.radius,
      getFillColor: (d) => [d.color[0], d.color[1], d.color[2], Math.round(d.color[3] * 0.4)],
      getLineColor: (d) => d.color,
      getLineWidth: 1.5,
      updateTriggers: { getFillColor: [elapsed], getLineColor: [elapsed], getRadius: [elapsed] },
    }));
  }

  // ── 4. P-wave rings (main + echoes) ─────────────────────────
  if (elapsed > P_START) {
    const pElapsed = (elapsed - P_START) / 1000;
    const pMainKm = VP_VISUAL_KMS * pElapsed;
    let ringIdx = 0;

    // Main P-wave ring
    if (pMainKm > 0 && pMainKm < MAX_RADIUS_KM) {
      const alpha = ringAlpha(pMainKm, 180, magScale);
      ringPool[ringIdx].position = pos;
      ringPool[ringIdx].radiusMeters = kmToMeters(pMainKm, depth);
      ringPool[ringIdx].color = [125, 211, 252, alpha];
      ringIdx++;
    }

    // P-wave echo rings (trailing, dimmer)
    for (let i = 0; i < P_ECHO_LAGS.length; i++) {
      const echoKm = pMainKm - P_ECHO_LAGS[i];
      if (echoKm > 5 && echoKm < MAX_RADIUS_KM) {
        const echoAlpha = ringAlpha(echoKm, 80 - i * 25, magScale);
        ringPool[ringIdx].position = pos;
        ringPool[ringIdx].radiusMeters = kmToMeters(echoKm, depth);
        ringPool[ringIdx].color = [125, 211, 252, echoAlpha];
        ringIdx++;
      }
    }

    if (ringIdx > 0) {
      layers.push(new ScatterplotLayer<RingDatum>({
        id: 'wave-seq-p',
        data: ringPool.slice(0, ringIdx),
        pickable: false,
        stroked: true,
        filled: false,
        radiusUnits: 'meters',
        lineWidthUnits: 'pixels',
        getPosition: (d) => d.position,
        getRadius: (d) => d.radiusMeters,
        getLineColor: (d) => d.color,
        getLineWidth: 1.5,
        updateTriggers: { getRadius: [elapsed], getLineColor: [elapsed] },
      }));
    }
  }

  // ── 5. S-wave rings (main + echoes) ─────────────────────────
  if (elapsed > S_START) {
    const sElapsed = (elapsed - S_START) / 1000;
    const sMainKm = VS_VISUAL_KMS * sElapsed;
    let ringIdx = 3; // Start after P-wave slots in the pool

    // Main S-wave ring
    if (sMainKm > 0 && sMainKm < MAX_RADIUS_KM) {
      const alpha = ringAlpha(sMainKm, 240, magScale);
      ringPool[ringIdx].position = pos;
      ringPool[ringIdx].radiusMeters = kmToMeters(sMainKm, depth);
      ringPool[ringIdx].color = [251, 191, 36, alpha];
      ringIdx++;
    }

    // S-wave echo rings
    for (let i = 0; i < S_ECHO_LAGS.length; i++) {
      const echoKm = sMainKm - S_ECHO_LAGS[i];
      if (echoKm > 5 && echoKm < MAX_RADIUS_KM) {
        const echoAlpha = ringAlpha(echoKm, 100 - i * 30, magScale);
        ringPool[ringIdx].position = pos;
        ringPool[ringIdx].radiusMeters = kmToMeters(echoKm, depth);
        ringPool[ringIdx].color = [251, 191, 36, echoAlpha];
        ringIdx++;
      }
    }

    if (ringIdx > 3) {
      layers.push(new ScatterplotLayer<RingDatum>({
        id: 'wave-seq-s',
        data: ringPool.slice(3, ringIdx),
        pickable: false,
        stroked: true,
        filled: false,
        radiusUnits: 'meters',
        lineWidthUnits: 'pixels',
        getPosition: (d) => d.position,
        getRadius: (d) => d.radiusMeters,
        getLineColor: (d) => d.color,
        getLineWidth: 3,
        updateTriggers: { getRadius: [elapsed], getLineColor: [elapsed] },
      }));
    }
  }

  return layers;
}
