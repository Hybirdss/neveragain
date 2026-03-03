/**
 * waveRings.ts — Layer 4: P-wave and S-wave ring animations (CesiumJS)
 *
 * When an earthquake occurs, two expanding rings are spawned at the
 * epicentre — a fast cyan P-wave and a slower crimson S-wave.
 * Rings use Cesium Entity + EllipseGraphics with CallbackProperty
 * for smooth per-frame radius animation.
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globeInstance';
import type { EarthquakeEvent } from '../../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WAVE_SPEEDS = {
  P_WAVE_DEG_PER_SEC: 3.09,
  S_WAVE_DEG_PER_SEC: 1.80,
} as const;

/** Approximate meters per degree at equator. */
const METERS_PER_DEG = 111_320;

/** Maximum angular radius (degrees) before ring is removed. */
const MAX_RADIUS_DEG = 90;

// ---------------------------------------------------------------------------
// Internal ring type
// ---------------------------------------------------------------------------

interface WaveRing {
  lat: number;
  lng: number;
  speedDegPerSec: number;
  color: Cesium.Color;
  strokeWidth: number;
  createdAt: number;
  entity: Cesium.Entity;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let activeRings: WaveRing[] = [];
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
let viewerRef: GlobeInstance | null = null;

// ---------------------------------------------------------------------------
// Ring creation
// ---------------------------------------------------------------------------

/** Number of segments for the ring polyline circle. */
const RING_SEGMENTS = 64;

/** Precomputed unit circle (cos, sin) pairs. */
const UNIT_CIRCLE: Array<[number, number]> = [];
for (let i = 0; i <= RING_SEGMENTS; i++) {
  const angle = (2 * Math.PI * i) / RING_SEGMENTS;
  UNIT_CIRCLE.push([Math.cos(angle), Math.sin(angle)]);
}

function createRingEntity(
  viewer: GlobeInstance,
  lat: number,
  lng: number,
  speedDegPerSec: number,
  color: Cesium.Color,
  strokeWidth: number,
  createdAt: number,
): WaveRing {
  const speedMetersPerSec = speedDegPerSec * METERS_PER_DEG;

  // Precompute ENU transform once per ring (epicenter doesn't move)
  const center = Cesium.Cartesian3.fromDegrees(lng, lat);
  const enuTransform = Cesium.Transforms.eastNorthUpToFixedFrame(center);
  const enuScratch = new Cesium.Cartesian3();

  // Reusable positions array — mutate in place to reduce GC
  const positions: Cesium.Cartesian3[] = UNIT_CIRCLE.map(() => new Cesium.Cartesian3());

  // Use a polyline circle instead of EllipseGraphics to avoid
  // the semiMajorAxis >= semiMinorAxis DeveloperError from Cesium's
  // dual getValue() calls on dynamic ellipses.
  const positionsCb = new Cesium.CallbackProperty(() => {
    const elapsed = (Date.now() - createdAt) / 1000;
    const radius = Math.max(100, elapsed * speedMetersPerSec);
    for (let i = 0; i < UNIT_CIRCLE.length; i++) {
      const [cx, cy] = UNIT_CIRCLE[i];
      enuScratch.x = radius * cx;
      enuScratch.y = radius * cy;
      enuScratch.z = 0;
      Cesium.Matrix4.multiplyByPoint(enuTransform, enuScratch, positions[i]);
    }
    return positions;
  }, false);

  const entity = viewer.entities.add({
    polyline: {
      positions: positionsCb as unknown as Cesium.Property,
      material: color,
      width: strokeWidth,
      clampToGround: true,
    },
  });

  return { lat, lng, speedDegPerSec, color, strokeWidth, createdAt, entity };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initWaveRings(viewer: GlobeInstance): void {
  viewerRef = viewer;
  startCleanup();
}

export function spawnWaveRings(
  viewer: GlobeInstance,
  event: EarthquakeEvent,
): void {
  const now = Date.now();

  // P-wave: neon cyan
  activeRings.push(createRingEntity(
    viewer, event.lat, event.lng,
    WAVE_SPEEDS.P_WAVE_DEG_PER_SEC,
    Cesium.Color.fromCssColorString('rgba(0, 240, 255, 0.7)'),
    1.5, now,
  ));

  // S-wave: vivid crimson
  activeRings.push(createRingEntity(
    viewer, event.lat, event.lng,
    WAVE_SPEEDS.S_WAVE_DEG_PER_SEC,
    Cesium.Color.fromCssColorString('rgba(255, 26, 51, 0.8)'),
    3.5, now,
  ));
}

export function getCachedRings(): WaveRing[] {
  return activeRings;
}

export function clearWaveRings(viewer: GlobeInstance): void {
  for (const ring of activeRings) {
    viewer.entities.remove(ring.entity);
  }
  activeRings = [];
}

export function disposeWaveRings(): void {
  if (cleanupTimer !== null) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  if (viewerRef) {
    clearWaveRings(viewerRef);
  }
  activeRings = [];
  viewerRef = null;
}

/** Set visibility of all wave ring entities. */
export function setRingsVisible(visible: boolean): void {
  for (const ring of activeRings) {
    ring.entity.show = visible;
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

function startCleanup(): void {
  if (cleanupTimer !== null) return;

  cleanupTimer = setInterval(() => {
    if (!viewerRef) return;
    const now = Date.now();
    const before = activeRings.length;

    const expired = activeRings.filter((ring) => {
      const lifetimeMs = (MAX_RADIUS_DEG / ring.speedDegPerSec) * 1000;
      return now - ring.createdAt >= lifetimeMs;
    });

    for (const ring of expired) {
      viewerRef.entities.remove(ring.entity);
    }

    activeRings = activeRings.filter((ring) => {
      const lifetimeMs = (MAX_RADIUS_DEG / ring.speedDegPerSec) * 1000;
      return now - ring.createdAt < lifetimeMs;
    });

    void before; // suppress unused
  }, 1000);
}
