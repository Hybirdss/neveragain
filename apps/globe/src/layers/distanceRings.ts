/**
 * Distance Range Rings — Concentric distance indicators from epicenter.
 *
 * Military/intelligence map style: faint white stroked rings at
 * 25, 50, 100, 200, 500 km with distance labels placed North.
 *
 * Zero-GC: pre-allocated data pools, same pattern as waveSequence.ts.
 */

import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '../types';

// ── Ring distances (km) ──────────────────────────────────────
const RING_DISTANCES_KM = [25, 50, 100, 200, 500];

// ── Approximate degrees per km (latitude) ────────────────────
const DEG_PER_KM = 1 / 111;

// ── Data types ───────────────────────────────────────────────
interface RingDatum {
  position: [number, number];
  radiusMeters: number;
}

interface LabelDatum {
  position: [number, number];
  text: string;
}

// ── Pre-allocated data pools (zero GC) ───────────────────────
const ringPool: RingDatum[] = Array.from({ length: RING_DISTANCES_KM.length }, () => ({
  position: [0, 0],
  radiusMeters: 0,
}));

const labelPool: LabelDatum[] = Array.from({ length: RING_DISTANCES_KM.length }, () => ({
  position: [0, 0],
  text: '',
}));

// ── Ring colors: faint white, 500km slightly brighter ────────
const INNER_COLOR: [number, number, number, number] = [255, 255, 255, 25];
const OUTER_COLOR: [number, number, number, number] = [255, 255, 255, 35];
const LABEL_COLOR: [number, number, number, number] = [255, 255, 255, 30];

// ── Layer Construction ───────────────────────────────────────

export function createDistanceRingLayers(event: EarthquakeEvent): Layer[] {
  const pos: [number, number] = [event.lng, event.lat];

  // Populate ring pool
  for (let i = 0; i < RING_DISTANCES_KM.length; i++) {
    const km = RING_DISTANCES_KM[i];
    ringPool[i].position = pos;
    ringPool[i].radiusMeters = km * 1000;
  }

  // Populate label pool (offset North by ring radius in degrees)
  for (let i = 0; i < RING_DISTANCES_KM.length; i++) {
    const km = RING_DISTANCES_KM[i];
    const offsetDeg = km * DEG_PER_KM;
    labelPool[i].position = [event.lng, event.lat + offsetDeg];
    labelPool[i].text = `${km} km`;
  }

  const outerIdx = RING_DISTANCES_KM.length - 1;

  return [
    new ScatterplotLayer<RingDatum>({
      id: 'distance-rings',
      data: ringPool,
      pickable: false,
      stroked: true,
      filled: false,
      radiusUnits: 'meters',
      lineWidthUnits: 'pixels',
      getPosition: (d) => d.position,
      getRadius: (d) => d.radiusMeters,
      getLineColor: (_d, { index }) =>
        index === outerIdx ? OUTER_COLOR : INNER_COLOR,
      getLineWidth: 1,
      updateTriggers: {
        getPosition: [event.lng, event.lat],
        getRadius: [event.lng, event.lat],
        getLineColor: [event.lng, event.lat],
      },
    }),
    new TextLayer<LabelDatum>({
      id: 'distance-ring-labels',
      data: labelPool,
      pickable: false,
      getPosition: (d) => d.position,
      getText: (d) => d.text,
      getSize: 9,
      getColor: LABEL_COLOR,
      fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'bottom',
      updateTriggers: {
        getPosition: [event.lng, event.lat],
        getText: [event.lng, event.lat],
      },
    }),
  ];
}
