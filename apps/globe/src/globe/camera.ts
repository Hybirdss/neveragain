/**
 * camera.ts — CesiumJS camera choreography
 *
 * Provides:
 * 1. flyToEarthquake() — magnitude-based camera fly-to
 * 2. User override detection — drag/zoom interrupts choreography
 * 3. Scenario camera path execution (scripted keyframe sequences)
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from './globeInstance';
import type { EarthquakeEvent } from '../types';

// ---------------------------------------------------------------------------
// Constants — altitudes in meters (CesiumJS native)
// ---------------------------------------------------------------------------

export const CAMERA = {
  INITIAL_LAT: 36,
  INITIAL_LNG: 138,

  IDLE_RESUME_DELAY_MS: 5000,

  // Altitude in meters — closer = more dramatic
  ZOOM_M7_PLUS: 150_000,    // 150 km — dramatic close-up
  ZOOM_M6:      350_000,    // 350 km — regional
  ZOOM_M5:      600_000,    // 600 km — wide regional
  ZOOM_DEFAULT: 1_200_000,  // 1200 km — area view

  PAN_DURATION_GENTLE_MS: 1200,
  PAN_DURATION_FAST_MS: 900,
  PAN_DURATION_DRAMATIC_MS: 1500,
  HOLD_DURATION_M7_MS: 2500,
  PULLBACK_DURATION_MS: 1800,
  PULLBACK_ALTITUDE: 2_000_000, // 2000 km pullback

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
  return { altitude: CAMERA.ZOOM_DEFAULT, durationMs: CAMERA.PAN_DURATION_GENTLE_MS };
}

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let userHasOverridden = false;
let eventHandler: Cesium.ScreenSpaceEventHandler | null = null;

function onUserInteraction(): void {
  userHasOverridden = true;

  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    userHasOverridden = false;
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
  // When pitch is not straight-down (-90°), offset the camera position
  // so the look-at point (screen center) lands on the target lat/lng.
  let cameraLat = lat;
  if (pitchDeg > -90) {
    const nadirAngleRad = (90 + pitchDeg) * Math.PI / 180;
    const offsetM = altitude * Math.tan(nadirAngleRad);
    cameraLat = lat - offsetM / 111_320; // heading=0 → offset south
  }

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lng, cameraLat, altitude),
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
 * Initialise camera and listen for user interaction.
 */
export function initCamera(viewer: GlobeInstance): void {
  eventHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  const interactionHandler = () => onUserInteraction();

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

  flyTo(viewer, event.lat, event.lng, altitude, durationMs, () => {
    if (event.magnitude >= 7.0) {
      // M7+: hold, then pullback
      setTimeout(() => {
        if (!userHasOverridden) {
          flyTo(viewer, event.lat, event.lng, CAMERA.PULLBACK_ALTITUDE, CAMERA.PULLBACK_DURATION_MS, undefined, -76);
        }
      }, CAMERA.HOLD_DURATION_M7_MS);
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
  userHasOverridden = false;

  for (const keyframe of path) {
    if (userHasOverridden) break;

    await new Promise<void>((resolve) => {
      flyTo(viewer, keyframe.lat, keyframe.lng, keyframe.altitude, keyframe.durationMs, resolve);
    });

    if (keyframe.holdMs) await delay(keyframe.holdMs);
    if (userHasOverridden) break;
  }

}

// ---------------------------------------------------------------------------
// Predefined scenario paths
// ---------------------------------------------------------------------------

export const NANKAI_CAMERA_PATH: ScenarioCameraPath = [
  { lat: 33.0, lng: 137.0, altitude: 2_500_000, durationMs: 0, label: 'Initial: Japan overview' },
  { lat: 33.0, lng: 137.0, altitude: 800_000, durationMs: 2000, holdMs: 1000, label: 'Zoom: Nankai Trough' },
  { lat: 33.5, lng: 135.5, altitude: 300_000, durationMs: 1500, holdMs: 3000, label: 'Rupture start' },
  { lat: 34.0, lng: 137.0, altitude: 500_000, durationMs: 5000, label: 'Track rupture propagation' },
  { lat: 35.0, lng: 137.0, altitude: 1_500_000, durationMs: 3000, holdMs: 5000, label: 'Wide-area damage view' },
  { lat: 36.0, lng: 138.0, altitude: 2_500_000, durationMs: 3000, label: 'Pullback' },
];

export const TOHOKU_CAMERA_PATH: ScenarioCameraPath = [
  { lat: 38.3, lng: 142.4, altitude: 2_500_000, durationMs: 0, label: 'Initial: Tohoku offshore' },
  { lat: 38.3, lng: 142.4, altitude: 300_000, durationMs: 2000, holdMs: 2000, label: 'Epicentre zoom' },
  { lat: 38.0, lng: 141.0, altitude: 800_000, durationMs: 3000, holdMs: 3000, label: 'Track to Sendai' },
  { lat: 36.0, lng: 140.0, altitude: 1_500_000, durationMs: 4000, holdMs: 3000, label: 'Reach Tokyo' },
  { lat: 37.0, lng: 140.0, altitude: 2_500_000, durationMs: 3000, label: 'Pullback' },
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
  if (eventHandler) {
    eventHandler.destroy();
    eventHandler = null;
  }
  userHasOverridden = false;
}
