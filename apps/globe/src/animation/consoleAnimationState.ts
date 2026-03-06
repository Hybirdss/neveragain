import type { EarthquakeEvent } from '@namazue/ops/types';

export interface WaveAnimationSource {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  originTime: number;
}

export interface IntensityAnimationFrameInput {
  now: number;
  startAt: number;
  epicenter: { lat: number; lng: number } | null;
  durationMs?: number;
  spreadSpeedKmPerSec?: number;
}

export interface IntensityAnimationFrame {
  epicenter: { lat: number; lng: number };
  revealRadiusKm: number;
  completed: boolean;
}

const DEFAULT_WAVE_SOURCE_WINDOW_MS = 300_000;
const DEFAULT_INTENSITY_DURATION_MS = 3_000;
const DEFAULT_INTENSITY_SPREAD_SPEED_KM_PER_SEC = 250;

export function extractWaveAnimationSources(
  events: EarthquakeEvent[],
  now: number = Date.now(),
  waveCutoffMs: number = DEFAULT_WAVE_SOURCE_WINDOW_MS,
): WaveAnimationSource[] {
  const waveCutoff = now - waveCutoffMs;

  return events
    .filter((event) => event.time > waveCutoff && event.magnitude >= 4.0)
    .map((event) => ({
      id: event.id,
      lat: event.lat,
      lng: event.lng,
      depth_km: event.depth_km,
      magnitude: event.magnitude,
      originTime: event.time,
    }));
}

export function deriveIntensityAnimationFrame(
  input: IntensityAnimationFrameInput,
): IntensityAnimationFrame | null {
  if (!input.epicenter || input.startAt <= 0) {
    return null;
  }

  const durationMs = input.durationMs ?? DEFAULT_INTENSITY_DURATION_MS;
  const spreadSpeedKmPerSec =
    input.spreadSpeedKmPerSec ?? DEFAULT_INTENSITY_SPREAD_SPEED_KM_PER_SEC;
  const elapsed = Math.max(0, input.now - input.startAt);
  const clampedElapsed = Math.min(elapsed, durationMs);

  return {
    epicenter: input.epicenter,
    revealRadiusKm: (clampedElapsed / 1000) * spreadSpeedKmPerSec,
    completed: elapsed >= durationMs,
  };
}
