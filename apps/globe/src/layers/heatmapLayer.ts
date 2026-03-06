/**
 * Seismic Heatmap Layer — Earthquake density visualization at national/regional zoom.
 *
 * Shows where seismic activity concentrates across Japan.
 * Only renders at z4-z7 (national/regional overview) to avoid clutter
 * at city-level zoom where individual events are more useful.
 *
 * Makes the map feel alive in calm mode by revealing activity patterns.
 */

import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '../types';

/** Dark console color range: transparent -> deep blue -> white hot */
const COLOR_RANGE: [number, number, number, number][] = [
  [10, 20, 40, 0],       // transparent for low density
  [30, 60, 120, 60],     // deep blue
  [60, 100, 180, 100],   // medium blue
  [120, 180, 240, 140],  // light blue
  [200, 220, 255, 160],  // near-white blue
  [255, 255, 255, 180],  // white hot
];

export function createSeismicHeatmapLayer(
  events: EarthquakeEvent[],
  zoom: number,
): Layer | null {
  if (zoom > 7 || events.length === 0) return null;

  return new HeatmapLayer<EarthquakeEvent>({
    id: 'seismic-heatmap',
    data: events,
    pickable: false,
    getPosition: (d) => [d.lng, d.lat],
    getWeight: (d) => Math.pow(2, d.magnitude - 3),
    radiusPixels: 60,
    intensity: 1,
    threshold: 0.05,
    colorRange: COLOR_RANGE,
    opacity: 0.4,
    aggregation: 'SUM',
  });
}
