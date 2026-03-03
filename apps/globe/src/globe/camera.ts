/**
 * camera.ts — CesiumJS camera choreography
 *
 * Provides:
 * 1. flyToEarthquake() — magnitude-based camera fly-to
 * 2. Idle auto-rotation (disabled for focus-first UX)
 * 3. User override detection — drag/zoom interrupts choreography
 * 4. Scenario camera path execution (scripted keyframe sequences)
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from './globeInstance';
import { altitudeToMeters } from './globeInstance';
import type { EarthquakeEvent } from '../types';

// ---------------------------------------------------------------------------
// Constants (from CAMERA_CHOREOGRAPHY.md)
// ---------------------------------------------------------------------------

export const CAMERA = {
  INITIAL_LAT: 36,
  INITIAL_LNG: 138,
  INITIAL_ALTITUDE: 2.5,

  IDLE_AUTOROTATE_ENABLED: false,
  IDLE_RPM: 0.3,
  IDLE_RESUME_DELAY_MS: 5000,

  ZOOM_M5: 1.4,
  ZOOM_M6: 1.0,
  ZOOM_M7_PLUS: 0.7,

  PAN_DURATION_GENTLE_MS: 900,
  PAN_DURATION_FAST_MS: 700,
  PAN_DURATION_DRAMATIC_MS: 1200,
  HOLD_DURATION_M7_MS: 2500,
  PULLBACK_DURATION_MS: 1800,
  PULLBACK_ALTITUDE: 2.5,

  OVERRIDE_BUTTON_TIMEOUT_MS: 15000,
} as const;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface FlyParams {
  altitude: number;
  durationMs: number;
}

function getFlyParams(magnitude: number): FlyParams {
  if (magnitude >= 7.0) return { altitude: CAMERA.ZOOM_M7_PLUS, durationMs: CAMERA.PAN_DURATION_DRAMATIC_MS };
  if (magnitude >= 6.0) return { altitude: CAMERA.ZOOM_M6, durationMs: CAMERA.PAN_DURATION_FAST_MS };
  if (magnitude >= 5.0) return { altitude: CAMERA.ZOOM_M5, durationMs: CAMERA.PAN_DURATION_GENTLE_MS };
  return { altitude: CAMERA.INITIAL_ALTITUDE, durationMs: 1000 };
}

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let userHasOverridden = false;
let choreographyActive = false;
let rotationTickHandler: Cesium.Event.RemoveCallback | null = null;
let eventHandler: Cesium.ScreenSpaceEventHandler | null = null;

// ---------------------------------------------------------------------------
// Idle auto-rotate
// ---------------------------------------------------------------------------

function setAutoRotate(viewer: GlobeInstance, enabled: boolean): void {
  // Remove existing rotation handler
  if (rotationTickHandler) {
    rotationTickHandler();
    rotationTickHandler = null;
  }

  if (enabled && CAMERA.IDLE_AUTOROTATE_ENABLED) {
    const radiansPerSecond = (CAMERA.IDLE_RPM * 2 * Math.PI) / 60;
    let lastTime = Date.now();

    rotationTickHandler = viewer.clock.onTick.addEventListener(() => {
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      viewer.scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, -radiansPerSecond * dt);
    });
  }
}

function onUserInteraction(viewer: GlobeInstance): void {
  userHasOverridden = true;
  setAutoRotate(viewer, false);

  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    userHasOverridden = false;
    if (!choreographyActive) {
      setAutoRotate(viewer, true);
    }
  }, CAMERA.IDLE_RESUME_DELAY_MS);
}

// ---------------------------------------------------------------------------
// Helper: fly camera to lat/lng/altitude
// ---------------------------------------------------------------------------

function flyTo(
  viewer: GlobeInstance,
  lat: number,
  lng: number,
  altitude: number,
  durationMs: number,
  onComplete?: () => void,
  pitchDeg: number = -90,
): void {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lng, lat, altitudeToMeters(altitude)),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(pitchDeg),
      roll: 0,
    },
    duration: durationMs / 1000,
    complete: onComplete,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise camera — enable idle auto-rotate and listen for user interaction.
 */
export function initCamera(viewer: GlobeInstance): void {
  // Idle rotation intentionally disabled in the current visual mode.
  if (CAMERA.IDLE_AUTOROTATE_ENABLED) {
    setTimeout(() => {
      if (!userHasOverridden && !choreographyActive) {
        setAutoRotate(viewer, true);
      }
    }, 5000);
  }

  eventHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  const interactionHandler = () => onUserInteraction(viewer);

  eventHandler.setInputAction(interactionHandler, Cesium.ScreenSpaceEventType.LEFT_DOWN);
  eventHandler.setInputAction(interactionHandler, Cesium.ScreenSpaceEventType.RIGHT_DOWN);
  eventHandler.setInputAction(interactionHandler, Cesium.ScreenSpaceEventType.MIDDLE_DOWN);
  eventHandler.setInputAction(interactionHandler, Cesium.ScreenSpaceEventType.WHEEL);
  eventHandler.setInputAction(interactionHandler, Cesium.ScreenSpaceEventType.PINCH_START);
}

/**
 * Fly the camera to an earthquake's epicentre.
 * Altitude and duration are determined by magnitude.
 * For M7+ events, a zoom → hold → pullback sequence is played.
 */
export function flyToEarthquake(viewer: GlobeInstance, event: EarthquakeEvent): void {
  // Reset user override when a new event is explicitly selected
  userHasOverridden = false;

  const { altitude, durationMs } = getFlyParams(event.magnitude);
  choreographyActive = true;
  setAutoRotate(viewer, false);

  flyTo(viewer, event.lat, event.lng, altitude, durationMs, () => {
    if (event.magnitude >= 7.0) {
      // M7+: hold, then pullback
      setTimeout(() => {
        if (!userHasOverridden) {
          flyTo(viewer, event.lat, event.lng, CAMERA.PULLBACK_ALTITUDE, CAMERA.PULLBACK_DURATION_MS, () => {
            choreographyActive = false;
            if (!userHasOverridden) setAutoRotate(viewer, true);
          }, -76);
        } else {
          choreographyActive = false;
        }
      }, CAMERA.HOLD_DURATION_M7_MS);
    } else {
      setTimeout(() => {
        choreographyActive = false;
        if (!userHasOverridden) setAutoRotate(viewer, true);
      }, 2000);
    }
  }, -68);
}

// ---------------------------------------------------------------------------
// Scenario camera paths
// ---------------------------------------------------------------------------

export interface CameraKeyframe {
  lat: number;
  lng: number;
  altitude: number;
  durationMs: number;
  holdMs?: number;
  label?: string;
}

export type ScenarioCameraPath = CameraKeyframe[];

/**
 * Execute a scripted camera path (array of keyframes).
 */
export async function executeCameraPath(
  viewer: GlobeInstance,
  path: ScenarioCameraPath,
): Promise<void> {
  choreographyActive = true;
  setAutoRotate(viewer, false);

  for (const keyframe of path) {
    if (userHasOverridden) break;

    await new Promise<void>((resolve) => {
      flyTo(viewer, keyframe.lat, keyframe.lng, keyframe.altitude, keyframe.durationMs, resolve);
    });

    if (keyframe.holdMs) await delay(keyframe.holdMs);
    if (userHasOverridden) break;
  }

  choreographyActive = false;
  if (!userHasOverridden) setAutoRotate(viewer, true);
}

// ---------------------------------------------------------------------------
// Predefined scenario paths
// ---------------------------------------------------------------------------

export const NANKAI_CAMERA_PATH: ScenarioCameraPath = [
  { lat: 33.0, lng: 137.0, altitude: 2.5, durationMs: 0, label: 'Initial: Japan overview' },
  { lat: 33.0, lng: 137.0, altitude: 1.5, durationMs: 2000, holdMs: 1000, label: 'Zoom: Nankai Trough' },
  { lat: 33.5, lng: 135.5, altitude: 1.0, durationMs: 1500, holdMs: 3000, label: 'Rupture start' },
  { lat: 34.0, lng: 137.0, altitude: 1.2, durationMs: 5000, label: 'Track rupture propagation' },
  { lat: 35.0, lng: 137.0, altitude: 2.0, durationMs: 3000, holdMs: 5000, label: 'Wide-area damage view' },
  { lat: 36.0, lng: 138.0, altitude: 2.5, durationMs: 3000, label: 'Pullback' },
];

export const TOHOKU_CAMERA_PATH: ScenarioCameraPath = [
  { lat: 38.3, lng: 142.4, altitude: 2.5, durationMs: 0, label: 'Initial: Tohoku offshore' },
  { lat: 38.3, lng: 142.4, altitude: 1.0, durationMs: 2000, holdMs: 2000, label: 'Epicentre zoom' },
  { lat: 38.0, lng: 141.0, altitude: 1.5, durationMs: 3000, holdMs: 3000, label: 'Track to Sendai' },
  { lat: 36.0, lng: 140.0, altitude: 2.0, durationMs: 4000, holdMs: 3000, label: 'Reach Tokyo' },
  { lat: 37.0, lng: 140.0, altitude: 2.5, durationMs: 3000, label: 'Pullback' },
];

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resetUserOverride(): void {
  userHasOverridden = false;
}

export function disposeCamera(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (rotationTickHandler) {
    rotationTickHandler();
    rotationTickHandler = null;
  }
  if (eventHandler) {
    eventHandler.destroy();
    eventHandler = null;
  }
  choreographyActive = false;
  userHasOverridden = false;
}
