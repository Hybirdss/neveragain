/**
 * Earthquake Layer — ScatterplotLayer for seismic events.
 *
 * Performance rules (deck.gl official guidance):
 * - data ref must be STABLE — same array object when data hasn't changed
 * - accessors (getRadius, getColor) must NOT depend on animation state
 * - animation uses radiusScale (uniform prop, ~0 cost at 60fps)
 * - updateTriggers only fire on real data changes (selectedId, data swap)
 *
 * Visual rules:
 * - Size scales with magnitude (exponential)
 * - Color encodes depth: shallow=warm, deep=cool
 * - Selected event: bright ice blue highlight ring
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import type { EarthquakeEvent } from '@namazue/ops/types';

type RGBA = [number, number, number, number];

function depthColor(depth_km: number): RGBA {
  if (depth_km < 30)  return [239, 68, 68, 220];   // shallow: red
  if (depth_km < 70)  return [251, 191, 36, 200];   // mid: amber
  if (depth_km < 150) return [96, 165, 250, 180];   // mid-deep: blue
  if (depth_km < 300) return [125, 211, 252, 160];   // deep: ice blue
  return [148, 163, 184, 140];                       // very deep: slate
}

function magToRadius(mag: number): number {
  return Math.max(4, 3.5 * Math.pow(2, mag - 3));
}

export function createEarthquakeLayer(
  events: EarthquakeEvent[],
  selectedId: string | null,
): ScatterplotLayer<EarthquakeEvent> {
  return new ScatterplotLayer<EarthquakeEvent>({
    id: 'earthquakes',
    data: events,
    pickable: true,
    autoHighlight: true,
    highlightColor: [125, 211, 252, 180],
    stroked: true,
    filled: true,
    radiusUnits: 'pixels',
    lineWidthUnits: 'pixels',
    radiusMinPixels: 4,
    // radiusScale is animated externally by compositor — uniform, ~0 cost
    radiusScale: 1,

    getPosition: (d) => [d.lng, d.lat],
    getRadius: (d) => magToRadius(d.magnitude),

    getFillColor: (d) => {
      if (d.id === selectedId) return [125, 211, 252, 255];
      return depthColor(d.depth_km);
    },

    getLineColor: (d) => {
      if (d.id === selectedId) return [125, 211, 252, 255];
      return [255, 255, 255, 50];
    },

    getLineWidth: (d) => (d.id === selectedId ? 2.5 : 0.5),

    // CRITICAL: only trigger GPU buffer rebuild on actual data changes
    updateTriggers: {
      getFillColor: [selectedId],
      getLineColor: [selectedId],
      getLineWidth: [selectedId],
    },
  });
}
