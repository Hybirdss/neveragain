/**
 * cinematicSequence.ts — Cinematic camera sequence engine
 *
 * Orchestrates a 14-second cinematic sequence for SNS viral sharing:
 * 1. Tile preloading (camera.setView → requestRender → tilesLoaded)
 * 2. Parallel flyTo + onEnter actions (with configurable delay)
 * 3. Input blocking + skip button
 * 4. Translucency overshoot animation
 * 5. Depth-sequential earthquake reveal
 * 6. Final frame capture via postRender
 *
 * Design principle: last frame first — the OG capture composition
 * drives the entire sequence backward.
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from './globeInstance';
import type { EarthquakeEvent } from '../types';
import { showCinematicOverlay, onSkip, type CinematicOverlayHandle } from '../ui/cinematicOverlay';
import { prepareCinematicReveal, setDepthFilter, clearCinematicReveal } from './layers/seismicPoints';
import { playRumble, playImpact, playDrone, stopAll as stopAudio } from '../audio/cinematicAudio';

// ── Types ────────────────────────────────────────────────────

export interface CinematicStep {
  lat: number;
  lng: number;
  altitude: number;       // meters above WGS84 ellipsoid
  heading?: number;       // degrees (default 0)
  pitch?: number;         // degrees (default -90 = nadir)
  durationMs: number;
  holdMs?: number;
  holdDrift?: number;     // heading drift rate during hold (deg/s, default 0)
  easing?: Cesium.EasingFunction.Callback;

  /** Visual action fired in parallel with flyTo (not after). */
  onEnter?: (viewer: GlobeInstance, overlay: CinematicOverlayHandle) => void | Promise<void>;
  /** Delay before onEnter fires (ms from fly start). Default 0. */
  onEnterDelayMs?: number;

  label?: string;
}

// ── State ────────────────────────────────────────────────────

let skipRequested = false;
let sequenceActive = false;

// ── Public API ───────────────────────────────────────────────

/** Request the current cinematic to skip to end. */
export function skipCinematic(): void {
  skipRequested = true;
}

/** Check if a cinematic is currently running. */
export function isCinematicActive(): boolean {
  return sequenceActive;
}

/**
 * Play a full cinematic sequence.
 * Returns the captured final frame data URL, or null if skipped.
 */
export async function playCinematicSequence(
  viewer: GlobeInstance,
  steps: CinematicStep[],
): Promise<string | null> {
  skipRequested = false;
  sequenceActive = true;

  // 1. Block user input
  viewer.scene.screenSpaceCameraController.enableInputs = false;

  // 2. Loading overlay + tile preload
  const overlay = showCinematicOverlay('loading');
  onSkip(skipCinematic);
  await preloadKeyframes(viewer, steps);

  if (skipRequested) {
    cleanup(viewer, overlay);
    return null;
  }

  overlay.setMode('playing');

  // 3. Execute steps
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (skipRequested) break;

    // Parallel: flyTo + onEnter (with optional delay)
    const flyPromise = step.durationMs > 0
      ? flyToStep(viewer, step)
      : instantStep(viewer, step);

    if (step.onEnter && !skipRequested) {
      if (step.onEnterDelayMs) {
        delay(step.onEnterDelayMs).then(() => {
          if (!skipRequested) step.onEnter!(viewer, overlay);
        });
      } else {
        step.onEnter(viewer, overlay);
      }
    }

    await flyPromise;
    if (skipRequested) break;

    // Hold with optional micro-drift
    if (step.holdMs && !skipRequested) {
      if (step.holdDrift) {
        await holdWithDrift(viewer, step.holdMs, step.holdDrift);
      } else {
        await delay(step.holdMs);
      }
    }
  }

  // 4. Capture final frame (only if not skipped)
  let capturedUrl: string | null = null;
  if (!skipRequested) {
    capturedUrl = await captureFrame(viewer);
  }

  // 5. Cleanup
  cleanup(viewer, overlay);

  return capturedUrl;
}

/**
 * Build the 8-step SNS sequence for an earthquake event.
 * Designed around the final frame: Japan trench + slab + ShakeMap at -45° pitch.
 */
export function buildSnsSequence(event: EarthquakeEvent): CinematicStep[] {
  return [
    // a. Globe overview — fast context setting
    {
      lat: 20, lng: 140, altitude: 4_000_000,
      heading: 0, pitch: -90,
      durationMs: 1500,
      easing: Cesium.EasingFunction.EXPONENTIAL_OUT,
      onEnter: () => playRumble(3),
      label: 'Globe overview',
    },
    // b. Approach Japan from Pacific arc
    {
      lat: event.lat + 2, lng: event.lng + 5, altitude: 2_000_000,
      heading: -20, pitch: -70,
      durationMs: 2000,
      easing: Cesium.EasingFunction.SINUSOIDAL_IN_OUT,
      label: 'Pacific approach',
    },
    // c. Zoom in (building level)
    {
      lat: event.lat, lng: event.lng, altitude: 200_000,
      heading: -10, pitch: -60,
      durationMs: 1500,
      easing: Cesium.EasingFunction.CUBIC_IN_OUT,
      label: 'Zoom to epicentre',
    },
    // d. Beat (静) — micro drift keeps it alive
    {
      lat: event.lat, lng: event.lng, altitude: 200_000,
      heading: -10, pitch: -60,
      durationMs: 0,
      holdMs: 500,
      holdDrift: 0.1,
      label: 'Beat',
    },
    // e. Translucency reveal — fly and onEnter in parallel
    {
      lat: event.lat - 0.5, lng: event.lng + 1, altitude: 400_000,
      heading: -12, pitch: -55,
      durationMs: 2000,
      easing: Cesium.EasingFunction.SINUSOIDAL_OUT,
      onEnter: (viewer) => {
        playImpact();
        animateTranslucency(viewer, 0.45, 1800);
        prepareCinematicReveal();
        revealEarthquakesByDepth(2000);
      },
      onEnterDelayMs: 300,
      label: 'Translucency + depth reveal',
    },
    // f. Tilt along trench — slowest, money shot
    {
      lat: event.lat + 1, lng: event.lng + 2.5, altitude: 800_000,
      heading: -15, pitch: -45,
      durationMs: 4000,
      easing: Cesium.EasingFunction.SINUSOIDAL_IN_OUT,
      onEnter: () => playDrone(4),
      label: 'Subduction tilt',
    },
    // g. ShakeMap overlay — quick wrap
    {
      lat: event.lat + 0.5, lng: event.lng + 2, altitude: 900_000,
      heading: -15, pitch: -45,
      durationMs: 1500,
      easing: Cesium.EasingFunction.CUBIC_OUT,
      label: 'ShakeMap overlay',
    },
    // h. Final hold — capture frame
    {
      lat: event.lat + 0.5, lng: event.lng + 2, altitude: 900_000,
      heading: -15, pitch: -45,
      durationMs: 0,
      holdMs: 1000,
      label: 'Final hold + capture',
    },
  ];
}

// ── Tile Preloading ──────────────────────────────────────────

async function preloadKeyframes(
  viewer: GlobeInstance,
  steps: CinematicStep[],
): Promise<void> {
  // Save current camera
  const savedPos = viewer.camera.position.clone();
  const savedHeading = viewer.camera.heading;
  const savedPitch = viewer.camera.pitch;
  const savedRoll = viewer.camera.roll;

  for (const step of steps) {
    if (skipRequested) break;

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        step.lng, step.lat, step.altitude,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(step.heading ?? 0),
        pitch: Cesium.Math.toRadians(step.pitch ?? -90),
        roll: 0,
      },
    });
    viewer.scene.requestRender();
    await waitForTilesLoaded(viewer, 3000);
  }

  // Restore camera
  viewer.camera.setView({
    destination: savedPos,
    orientation: { heading: savedHeading, pitch: savedPitch, roll: savedRoll },
  });
}

function waitForTilesLoaded(
  viewer: GlobeInstance,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    if (viewer.scene.globe.tilesLoaded) {
      resolve();
      return;
    }
    const timeout = setTimeout(resolve, timeoutMs);
    const remove = viewer.scene.globe.tileLoadProgressEvent.addEventListener(
      (remaining: number) => {
        if (remaining === 0) {
          clearTimeout(timeout);
          remove();
          resolve();
        }
      },
    );
  });
}

// ── Camera Helpers ───────────────────────────────────────────

function flyToStep(viewer: GlobeInstance, step: CinematicStep): Promise<void> {
  return new Promise((resolve) => {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        step.lng, step.lat, step.altitude,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(step.heading ?? 0),
        pitch: Cesium.Math.toRadians(step.pitch ?? -90),
        roll: 0,
      },
      duration: step.durationMs / 1000,
      easingFunction: step.easing ?? Cesium.EasingFunction.CUBIC_IN_OUT,
      complete: resolve,
    });
  });
}

function instantStep(viewer: GlobeInstance, step: CinematicStep): Promise<void> {
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
      step.lng, step.lat, step.altitude,
    ),
    orientation: {
      heading: Cesium.Math.toRadians(step.heading ?? 0),
      pitch: Cesium.Math.toRadians(step.pitch ?? -90),
      roll: 0,
    },
  });
  return Promise.resolve();
}

/**
 * Hold for durationMs without any autonomous camera rotation.
 */
function holdWithDrift(
  viewer: GlobeInstance,
  durationMs: number,
  driftDegPerSec: number,
): Promise<void> {
  void viewer;
  void driftDegPerSec;
  return new Promise((resolve) => {
    const start = performance.now();

    function tick(): void {
      if (skipRequested) { resolve(); return; }

      const elapsed = performance.now() - start;

      if (elapsed < durationMs) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}

// ── Visual Animations ────────────────────────────────────────

/**
 * Animate globe translucency with overshoot (1.0 → overshoot → target).
 * 60% of duration: 1.0→overshoot, 40%: overshoot→target.
 */
function animateTranslucency(
  viewer: GlobeInstance,
  targetAlpha: number,
  durationMs: number,
): Promise<void> {
  const overshoot = targetAlpha - 0.15;
  const start = performance.now();

  return new Promise((resolve) => {
    function tick(): void {
      if (skipRequested) {
        viewer.scene.globe.translucency.frontFaceAlpha = targetAlpha;
        resolve();
        return;
      }

      const t = Math.min(1, (performance.now() - start) / durationMs);
      let alpha: number;
      if (t < 0.6) {
        alpha = 1.0 + (overshoot - 1.0) * (t / 0.6);
      } else {
        const t2 = (t - 0.6) / 0.4;
        alpha = overshoot + (targetAlpha - overshoot) * t2;
      }
      viewer.scene.globe.translucency.frontFaceAlpha = alpha;

      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    }

    viewer.scene.globe.translucency.enabled = true;
    viewer.scene.globe.translucency.backFaceAlpha = 1.0;
    requestAnimationFrame(tick);
  });
}

/**
 * Reveal earthquakes shallow→deep over durationMs.
 * Uses pre-added hidden points (.show toggle only — no GC).
 */
function revealEarthquakesByDepth(durationMs: number): Promise<void> {
  const MAX_DEPTH = 700;
  const start = performance.now();

  return new Promise((resolve) => {
    function tick(): void {
      if (skipRequested) {
        setDepthFilter(MAX_DEPTH); // show all
        resolve();
        return;
      }

      const t = Math.min(1, (performance.now() - start) / durationMs);
      setDepthFilter(t * MAX_DEPTH);

      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
}

// ── Frame Capture ────────────────────────────────────────────

function captureFrame(viewer: GlobeInstance): Promise<string> {
  return new Promise((resolve) => {
    const remove = viewer.scene.postRender.addEventListener(() => {
      remove();
      resolve(viewer.scene.canvas.toDataURL('image/jpeg', 0.9));
    });
    viewer.scene.requestRender();
  });
}

// ── Utility ──────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanup(viewer: GlobeInstance, overlay: CinematicOverlayHandle): void {
  viewer.scene.screenSpaceCameraController.enableInputs = true;
  overlay.remove();
  stopAudio();
  clearCinematicReveal();
  sequenceActive = false;
}
