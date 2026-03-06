/**
 * Bearing Lines — Epicenter to Critical Asset directional indicators.
 *
 * Military analysis visualization: straight lines from the epicenter to the
 * top 5 most critical infrastructure assets, annotated with bearing angle
 * and distance labels.
 *
 * Severity color-coding (very faint alpha):
 *   critical  -> red
 *   priority  -> amber
 *   watch     -> blue
 */

import { LineLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '../types';
import type { OpsAssetExposure, OpsSeverity } from '../ops/types';
import { OPS_ASSETS } from '../ops/assetCatalog';
import { haversineKm } from './impactZone';

// ── Types ────────────────────────────────────────────────────

interface BearingLineDatum {
  sourcePosition: [number, number];
  targetPosition: [number, number];
  severity: OpsSeverity;
  label: string;
  midpoint: [number, number];
}

// ── Severity ordering (higher = more severe) ─────────────────

const SEVERITY_RANK: Record<OpsSeverity, number> = {
  critical: 3,
  priority: 2,
  watch: 1,
  clear: 0,
};

// ── Severity colors (very faint alpha) ───────────────────────

const SEVERITY_LINE_COLOR: Record<OpsSeverity, [number, number, number, number]> = {
  critical: [239, 68, 68, 50],
  priority: [251, 191, 36, 40],
  watch: [96, 165, 250, 30],
  clear: [255, 255, 255, 20],
};

// ── Compass direction lookup ─────────────────────────────────

const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE',
  'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW',
] as const;

function toCompassDirection(angleDeg: number): string {
  // angleDeg is 0-360, N=0, E=90, S=180, W=270
  const index = Math.round(angleDeg / 22.5) % 16;
  return COMPASS_POINTS[index];
}

// ── Bearing computation ──────────────────────────────────────

function computeBearing(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const PI = Math.PI;
  const deltaLat = lat2 - lat1;
  const deltaLng = lng2 - lng1;
  const rad = Math.atan2(
    deltaLng * Math.cos(lat1 * PI / 180),
    deltaLat,
  );
  // Convert to degrees, normalize 0-360
  return ((rad * 180 / PI) + 360) % 360;
}

// ── Main Factory ─────────────────────────────────────────────

export function createBearingLineLayers(
  event: EarthquakeEvent,
  exposures: OpsAssetExposure[],
): Layer[] {
  // 1. Filter to non-clear, sort by severity (critical first)
  const nonClear = exposures
    .filter((e) => e.severity !== 'clear')
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  // 2. Take top 5
  const top5 = nonClear.slice(0, 5);
  if (top5.length === 0) return [];

  // 3. Build data by looking up asset positions
  const assetMap = new Map(OPS_ASSETS.map((a) => [a.id, a]));
  const data: BearingLineDatum[] = [];

  for (const exposure of top5) {
    const asset = assetMap.get(exposure.assetId);
    if (!asset) continue;

    // 4. Bearing angle
    const bearing = computeBearing(event.lat, event.lng, asset.lat, asset.lng);
    const compass = toCompassDirection(bearing);

    // 5. Distance
    const distKm = haversineKm(event.lat, event.lng, asset.lat, asset.lng);

    // 6. Label
    const label = `${compass} ${Math.round(bearing)}\u00B0 \u00B7 ${Math.round(distKm)}km`;

    data.push({
      sourcePosition: [event.lng, event.lat],
      targetPosition: [asset.lng, asset.lat],
      severity: exposure.severity,
      label,
      midpoint: [
        (event.lng + asset.lng) / 2,
        (event.lat + asset.lat) / 2,
      ],
    });
  }

  if (data.length === 0) return [];

  return [
    new LineLayer<BearingLineDatum>({
      id: 'bearing-lines',
      data,
      pickable: false,
      getSourcePosition: (d) => d.sourcePosition,
      getTargetPosition: (d) => d.targetPosition,
      getColor: (d) => SEVERITY_LINE_COLOR[d.severity],
      getWidth: 1,
      widthUnits: 'pixels',
      updateTriggers: {
        getSourcePosition: [event.id],
        getTargetPosition: [event.id],
        getColor: [event.id],
      },
    }),
    new TextLayer<BearingLineDatum>({
      id: 'bearing-labels',
      data,
      pickable: false,
      getPosition: (d) => d.midpoint,
      getText: (d) => d.label,
      getSize: 9,
      getColor: [255, 255, 255, 120],
      fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
      getTextAnchor: 'middle' as const,
      getAlignmentBaseline: 'center' as const,
      outlineWidth: 2,
      outlineColor: [10, 14, 20, 200],
      updateTriggers: {
        getPosition: [event.id],
        getText: [event.id],
      },
    }),
  ];
}
