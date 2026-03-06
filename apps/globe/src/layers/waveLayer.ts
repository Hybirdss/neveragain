/**
 * Wave Layer — P-wave and S-wave propagation rings.
 *
 * THE signature visual of namazue.dev.
 * When an earthquake occurs, concentric rings expand from the epicenter:
 *   - P-wave: thin cyan ring, moves fast (6 km/s)
 *   - S-wave: thick amber ring, moves slower (3.5 km/s)
 *   - Both fade as they expand
 *
 * Uses ScatterplotLayer with stroke-only rendering.
 * radiusScale animation is virtually free at 60fps (uniform prop).
 */

import { ScatterplotLayer } from '@deck.gl/layers';

// ── Constants ──────────────────────────────────────────────────

const VP_KM_S = 6.0;   // P-wave velocity
const VS_KM_S = 3.5;   // S-wave velocity
const KM_PER_DEG = 111; // approximate

const MAX_RADIUS_KM = 800;  // stop expanding after this
const FADE_START_KM = 300;  // start fading at this radius

// ── Types ──────────────────────────────────────────────────────

export interface WaveSource {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  originTime: number; // Unix ms
}

interface WaveRing {
  position: [number, number];
  radius: number; // degrees
  opacity: number;
}

// ── Wave State Computation ─────────────────────────────────────

function computeWaveRing(
  source: WaveSource,
  velocityKmS: number,
  elapsedSec: number,
): WaveRing | null {
  if (elapsedSec <= 0) return null;

  // Surface distance traveled
  const surfaceKm = velocityKmS * elapsedSec;
  if (surfaceKm > MAX_RADIUS_KM) return null;

  // Account for depth: wave starts underground
  const totalKm = Math.sqrt(surfaceKm * surfaceKm + source.depth_km * source.depth_km);
  const radiusDeg = totalKm / KM_PER_DEG;

  // Fade out as ring expands
  let opacity = 1.0;
  if (surfaceKm > FADE_START_KM) {
    opacity = Math.max(0, 1 - (surfaceKm - FADE_START_KM) / (MAX_RADIUS_KM - FADE_START_KM));
  }
  // Also scale opacity with magnitude (bigger eq = more visible ring)
  const magScale = Math.min(1, (source.magnitude - 3) / 4); // M3=0, M7=1
  opacity *= Math.max(0.3, magScale);

  return {
    position: [source.lng, source.lat],
    radius: radiusDeg,
    opacity,
  };
}

// ── Layer Factory ──────────────────────────────────────────────

export function createWaveLayers(
  sources: WaveSource[],
  currentTime: number,
): ScatterplotLayer[] {
  const layers: ScatterplotLayer[] = [];

  for (const source of sources) {
    const elapsedSec = (currentTime - source.originTime) / 1000;
    if (elapsedSec < 0 || elapsedSec > MAX_RADIUS_KM / VS_KM_S + 10) continue;

    // P-wave ring
    const pRing = computeWaveRing(source, VP_KM_S, elapsedSec);
    if (pRing) {
      layers.push(
        new ScatterplotLayer({
          id: `wave-p-${source.id}`,
          data: [pRing],
          pickable: false,
          stroked: true,
          filled: false,
          radiusUnits: 'common',
          lineWidthUnits: 'pixels',

          getPosition: (d: WaveRing) => d.position,
          getRadius: (d: WaveRing) => d.radius * KM_PER_DEG * 1000, // meters
          getLineColor: (d: WaveRing) => [125, 211, 252, Math.round(d.opacity * 160)], // cyan
          getLineWidth: 1.5,

          updateTriggers: {
            getRadius: [elapsedSec],
            getLineColor: [elapsedSec],
          },

        }),
      );
    }

    // S-wave ring
    const sRing = computeWaveRing(source, VS_KM_S, elapsedSec);
    if (sRing) {
      layers.push(
        new ScatterplotLayer({
          id: `wave-s-${source.id}`,
          data: [sRing],
          pickable: false,
          stroked: true,
          filled: false,
          radiusUnits: 'common',
          lineWidthUnits: 'pixels',

          getPosition: (d: WaveRing) => d.position,
          getRadius: (d: WaveRing) => d.radius * KM_PER_DEG * 1000,
          getLineColor: (d: WaveRing) => [251, 191, 36, Math.round(d.opacity * 200)], // amber
          getLineWidth: 3,

          updateTriggers: {
            getRadius: [elapsedSec],
            getLineColor: [elapsedSec],
          },
        }),
      );
    }
  }

  return layers;
}
