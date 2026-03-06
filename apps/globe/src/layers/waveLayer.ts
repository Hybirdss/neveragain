/**
 * Wave Layer — P-wave and S-wave propagation rings.
 *
 * THE signature visual of namazue.dev.
 *
 * Performance approach:
 * - ONE ScatterplotLayer for P-wave rings, ONE for S-wave rings
 * - Stable data arrays (only rebuild when wave sources change)
 * - Ring expansion via radiusScale uniform (virtually free at 60fps)
 * - Fading via getLineColor with updateTriggers only on data change
 *
 * The trick: each ring datum stores its radius at the CURRENT elapsed time.
 * Since all rings from the same source share the same scale factor,
 * we pre-compute radii and update the data array only when needed.
 */

import { ScatterplotLayer } from '@deck.gl/layers';

const VP_KM_S = 6.0;
const VS_KM_S = 3.5;
const MAX_RADIUS_KM = 800;
const FADE_START_KM = 300;

export interface WaveSource {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  originTime: number;
}

interface WaveRingDatum {
  position: [number, number];
  radiusMeters: number;
  color: [number, number, number, number];
}

function computeRing(
  source: WaveSource,
  velocityKmS: number,
  elapsedSec: number,
  baseColor: [number, number, number],
  maxAlpha: number,
): WaveRingDatum | null {
  if (elapsedSec <= 0) return null;
  const surfaceKm = velocityKmS * elapsedSec;
  if (surfaceKm > MAX_RADIUS_KM) return null;

  const totalKm = Math.sqrt(surfaceKm * surfaceKm + source.depth_km * source.depth_km);
  const radiusMeters = totalKm * 1000;

  let opacity = 1.0;
  if (surfaceKm > FADE_START_KM) {
    opacity = Math.max(0, 1 - (surfaceKm - FADE_START_KM) / (MAX_RADIUS_KM - FADE_START_KM));
  }
  const magScale = Math.min(1, (source.magnitude - 3) / 4);
  opacity *= Math.max(0.3, magScale);

  return {
    position: [source.lng, source.lat],
    radiusMeters,
    color: [baseColor[0], baseColor[1], baseColor[2], Math.round(opacity * maxAlpha)],
  };
}

// Pre-allocated arrays to avoid GC pressure
let pWaveData: WaveRingDatum[] = [];
let sWaveData: WaveRingDatum[] = [];

/**
 * Recompute wave ring data for current time.
 * Called at controlled intervals (not every frame).
 */
export function updateWaveData(sources: WaveSource[], currentTime: number): void {
  const pRings: WaveRingDatum[] = [];
  const sRings: WaveRingDatum[] = [];

  for (const source of sources) {
    const elapsedSec = (currentTime - source.originTime) / 1000;
    if (elapsedSec < 0 || elapsedSec > MAX_RADIUS_KM / VS_KM_S + 10) continue;

    const p = computeRing(source, VP_KM_S, elapsedSec, [125, 211, 252], 160);
    if (p) pRings.push(p);

    const s = computeRing(source, VS_KM_S, elapsedSec, [251, 191, 36], 220);
    if (s) sRings.push(s);
  }

  pWaveData = pRings;
  sWaveData = sRings;
}

/**
 * Create the two wave layers. Call after updateWaveData().
 */
export function createWaveLayers(): ScatterplotLayer[] {
  const layers: ScatterplotLayer[] = [];

  if (pWaveData.length > 0) {
    layers.push(new ScatterplotLayer<WaveRingDatum>({
      id: 'wave-p',
      data: pWaveData,
      pickable: false,
      stroked: true,
      filled: false,
      radiusUnits: 'meters',
      lineWidthUnits: 'pixels',
      getPosition: (d) => d.position,
      getRadius: (d) => d.radiusMeters,
      getLineColor: (d) => d.color,
      getLineWidth: 1.5,
      updateTriggers: {
        getRadius: [pWaveData],
        getLineColor: [pWaveData],
      },
    }));
  }

  if (sWaveData.length > 0) {
    layers.push(new ScatterplotLayer<WaveRingDatum>({
      id: 'wave-s',
      data: sWaveData,
      pickable: false,
      stroked: true,
      filled: false,
      radiusUnits: 'meters',
      lineWidthUnits: 'pixels',
      getPosition: (d) => d.position,
      getRadius: (d) => d.radiusMeters,
      getLineColor: (d) => d.color,
      getLineWidth: 3,
      updateTriggers: {
        getRadius: [sWaveData],
        getLineColor: [sWaveData],
      },
    }));
  }

  return layers;
}
