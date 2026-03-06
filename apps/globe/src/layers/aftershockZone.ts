/**
 * Aftershock Probability Zone — Gradient concentric circles around M6.0+ epicenters.
 *
 * Empirical basis:
 *   - Zone radius from Wells & Coppersmith (1994) surface rupture length:
 *     log10(SRL_km) = -3.22 + 0.69 * Mw
 *     Table 2A "All fault types" regression.
 *     Reference: Wells, D.L. and Coppersmith, K.J. (1994). BSSA 84(4), 974-1002.
 *   - Aftershock spatial extent scales with rupture length:
 *     Kagan, Y.Y. (2002). "Aftershock zone scaling." BSSA 92(2), 641-655.
 *   - Three tiers: inner (0.5×SRL), middle (1.0×SRL), outer (2.0×SRL)
 *   - Orange-amber tones distinguish from severity-colored impact zone
 *
 * Zero-GC: pre-allocated data pools (3 zone datums + 1 label datum).
 */

import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '../types';

// ── Data types ───────────────────────────────────────────────

interface ZoneDatum {
  position: [number, number];
  radiusMeters: number;
}

interface LabelDatum {
  position: [number, number];
  text: string;
}

// ── Pre-allocated data pools (zero GC) ───────────────────────

const zonePool: ZoneDatum[] = Array.from({ length: 3 }, () => ({
  position: [0, 0],
  radiusMeters: 0,
}));

const labelPool: LabelDatum[] = [{ position: [0, 0], text: '' }];

// ── Zone colors (orange-amber) ──────────────────────────────

const INNER_FILL: [number, number, number, number] = [251, 146, 60, 20];

const MID_FILL: [number, number, number, number] = [251, 146, 60, 12];
const MID_STROKE: [number, number, number, number] = [251, 146, 60, 35];

const OUTER_FILL: [number, number, number, number] = [251, 146, 60, 6];
const OUTER_STROKE: [number, number, number, number] = [251, 146, 60, 20];

const LABEL_COLOR: [number, number, number, number] = [251, 146, 60, 140];
const LABEL_OUTLINE: [number, number, number, number] = [10, 14, 20, 200];

// ── Approximate degrees per km (latitude) ────────────────────
const DEG_PER_KM = 1 / 111;

// ── Layer Construction ──────────────────────────────────────

export function createAfterShockZoneLayers(event: EarthquakeEvent): Layer[] {
  // Only show for M >= 6.0
  if (event.magnitude < 6.0) return [];

  // Wells & Coppersmith 1994 surface rupture length (Table 2A, all fault types)
  const radiusKm = Math.pow(10, -3.22 + 0.69 * event.magnitude);
  const pos: [number, number] = [event.lng, event.lat];

  // Populate zone pool: inner (0.5×SRL), middle (1.0×SRL), outer (2.0×SRL)
  const multipliers = [0.5, 1.0, 2.0];
  for (let i = 0; i < 3; i++) {
    zonePool[i].position = pos;
    zonePool[i].radiusMeters = radiusKm * multipliers[i] * 1000;
  }

  // Label at bottom of middle circle
  const labelOffsetDeg = radiusKm * DEG_PER_KM;
  labelPool[0].position = [event.lng, event.lat - labelOffsetDeg];
  labelPool[0].text = `Aftershock zone \u00B7 ${Math.round(radiusKm)}km`;

  return [
    // Outer zone (low probability) — rendered first (underneath)
    new ScatterplotLayer<ZoneDatum>({
      id: 'aftershock-outer',
      data: [zonePool[2]],
      pickable: false,
      stroked: true,
      filled: true,
      radiusUnits: 'meters',
      lineWidthUnits: 'pixels',
      getPosition: (d) => d.position,
      getRadius: (d) => d.radiusMeters,
      getFillColor: OUTER_FILL,
      getLineColor: OUTER_STROKE,
      getLineWidth: 1,
      updateTriggers: {
        getPosition: [event.lng, event.lat, event.magnitude],
        getRadius: [event.magnitude],
      },
    }),

    // Middle zone (moderate probability)
    new ScatterplotLayer<ZoneDatum>({
      id: 'aftershock-mid',
      data: [zonePool[1]],
      pickable: false,
      stroked: true,
      filled: true,
      radiusUnits: 'meters',
      lineWidthUnits: 'pixels',
      getPosition: (d) => d.position,
      getRadius: (d) => d.radiusMeters,
      getFillColor: MID_FILL,
      getLineColor: MID_STROKE,
      getLineWidth: 1,
      updateTriggers: {
        getPosition: [event.lng, event.lat, event.magnitude],
        getRadius: [event.magnitude],
      },
    }),

    // Inner zone (high probability) — rendered last (on top)
    new ScatterplotLayer<ZoneDatum>({
      id: 'aftershock-inner',
      data: [zonePool[0]],
      pickable: false,
      stroked: false,
      filled: true,
      radiusUnits: 'meters',
      lineWidthUnits: 'pixels',
      getPosition: (d) => d.position,
      getRadius: (d) => d.radiusMeters,
      getFillColor: INNER_FILL,
      getLineWidth: 1,
      updateTriggers: {
        getPosition: [event.lng, event.lat, event.magnitude],
        getRadius: [event.magnitude],
      },
    }),

    // Label
    new TextLayer<LabelDatum>({
      id: 'aftershock-label',
      data: labelPool,
      pickable: false,
      getPosition: (d) => d.position,
      getText: (d) => d.text,
      getSize: 9,
      getColor: LABEL_COLOR,
      fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'top',
      outlineWidth: 2,
      outlineColor: LABEL_OUTLINE,
      updateTriggers: {
        getPosition: [event.lng, event.lat, event.magnitude],
        getText: [event.magnitude],
      },
    }),
  ];
}
