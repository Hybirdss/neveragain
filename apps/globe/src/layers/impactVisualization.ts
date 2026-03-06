/**
 * Impact Visualization — Selected event overlay layers.
 *
 * Three visual elements that make earthquake analysis feel like intelligence:
 *
 *   1. Glow Ring — Large, pulsing ice-blue circle behind the selected
 *      earthquake dot. Makes the selection impossible to miss.
 *
 *   2. Impact Zone — Dashed circle at the earthquake's estimated impact
 *      radius. Shows the spatial extent of potential damage.
 *
 *   3. Connection Arcs — Severity-colored lines from epicenter to each
 *      affected infrastructure asset. The "web of impact" that makes
 *      the analysis visible. THIS is what makes it Palantir-grade.
 */

import { ScatterplotLayer, ArcLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '../types';
import type { OpsAssetExposure, OpsSeverity } from '../ops/types';
import { OPS_ASSETS } from '../ops/assetCatalog';
import { impactRadiusKm } from './impactZone';

type RGBA = [number, number, number, number];

// ── Severity Arc Colors ───────────────────────────────────────

const ARC_COLORS: Record<OpsSeverity, RGBA> = {
  critical: [239, 68, 68, 180],
  priority: [251, 191, 36, 140],
  watch: [96, 165, 250, 100],
  clear: [148, 163, 184, 40],
};

// ── Glow Ring Data ────────────────────────────────────────────

interface GlowDatum {
  position: [number, number];
  radius: number;
  color: RGBA;
}

const glowPool: GlowDatum[] = [
  { position: [0, 0], radius: 0, color: [0, 0, 0, 0] },
  { position: [0, 0], radius: 0, color: [0, 0, 0, 0] },
];

// ── Impact Zone Data ──────────────────────────────────────────

interface ZoneDatum {
  position: [number, number];
  radiusMeters: number;
  color: RGBA;
}

const zonePool: ZoneDatum[] = [
  { position: [0, 0], radiusMeters: 0, color: [0, 0, 0, 0] },
];

// ── Connection Arc Data ───────────────────────────────────────

interface ArcDatum {
  sourcePosition: [number, number];
  targetPosition: [number, number];
  sourceColor: RGBA;
  targetColor: RGBA;
}

/**
 * Create all impact visualization layers for the selected event.
 *
 * @param event - Selected earthquake
 * @param exposures - Current asset exposures
 * @param now - Current timestamp (for pulse animation)
 */
export function createImpactVisualizationLayers(
  event: EarthquakeEvent,
  exposures: OpsAssetExposure[],
  now: number,
): Layer[] {
  const layers: Layer[] = [];
  const pos: [number, number] = [event.lng, event.lat];

  // ── 1. Glow Ring — Pulsing selection highlight ────────────────
  // Two concentric rings: inner (brighter) + outer (dimmer, larger)
  const pulse = Math.sin(now * 0.003) * 0.5 + 0.5; // 0..1, ~2s cycle

  // Inner glow
  const innerRadius = 28 + pulse * 6;
  const innerAlpha = Math.round(60 + pulse * 30);
  glowPool[0].position = pos;
  glowPool[0].radius = innerRadius;
  glowPool[0].color = [125, 211, 252, innerAlpha];

  // Outer glow
  const outerRadius = 48 + pulse * 10;
  const outerAlpha = Math.round(20 + pulse * 15);
  glowPool[1].position = pos;
  glowPool[1].radius = outerRadius;
  glowPool[1].color = [125, 211, 252, outerAlpha];

  layers.push(new ScatterplotLayer<GlowDatum>({
    id: 'impact-glow',
    data: glowPool,
    pickable: false,
    stroked: false,
    filled: true,
    radiusUnits: 'pixels',
    getPosition: (d) => d.position,
    getRadius: (d) => d.radius,
    getFillColor: (d) => d.color,
    updateTriggers: { getRadius: [now], getFillColor: [now] },
  }));

  // ── 2. Impact Zone — Dashed boundary circle ───────────────────
  const impactKm = impactRadiusKm(event.magnitude, event.depth_km, event.faultType);
  const impactMeters = impactKm * 1000;

  // Zone severity: based on magnitude
  let zoneColor: RGBA;
  if (event.magnitude >= 7.0) zoneColor = [239, 68, 68, 50];
  else if (event.magnitude >= 5.5) zoneColor = [251, 191, 36, 40];
  else zoneColor = [96, 165, 250, 30];

  zonePool[0].position = pos;
  zonePool[0].radiusMeters = impactMeters;
  zonePool[0].color = zoneColor;

  // Filled zone (very faint background tint)
  layers.push(new ScatterplotLayer<ZoneDatum>({
    id: 'impact-zone-fill',
    data: zonePool,
    pickable: false,
    stroked: false,
    filled: true,
    radiusUnits: 'meters',
    getPosition: (d) => d.position,
    getRadius: (d) => d.radiusMeters,
    getFillColor: (d) => d.color,
    updateTriggers: { getFillColor: [event.id] },
  }));

  // Zone boundary ring (stroked)
  layers.push(new ScatterplotLayer<ZoneDatum>({
    id: 'impact-zone-ring',
    data: zonePool,
    pickable: false,
    stroked: true,
    filled: false,
    radiusUnits: 'meters',
    lineWidthUnits: 'pixels',
    getPosition: (d) => d.position,
    getRadius: (d) => d.radiusMeters,
    getLineColor: (d) => [d.color[0], d.color[1], d.color[2], d.color[3] * 2] as RGBA,
    getLineWidth: 1.5,
    updateTriggers: { getLineColor: [event.id] },
  }));

  // ── 3. Connection Arcs — Epicenter to affected infrastructure ──
  // Only show arcs for non-clear exposures
  const affectedExposures = exposures.filter((e) => e.severity !== 'clear');

  if (affectedExposures.length > 0) {
    const assetMap = new Map(OPS_ASSETS.map((a) => [a.id, a]));

    const arcData: ArcDatum[] = [];
    for (const expo of affectedExposures) {
      const asset = assetMap.get(expo.assetId);
      if (!asset) continue;

      const sevColor = ARC_COLORS[expo.severity];
      // Source color slightly dimmer than target (visual direction: epicenter -> asset)
      const srcColor: RGBA = [sevColor[0], sevColor[1], sevColor[2], Math.round(sevColor[3] * 0.5)];

      arcData.push({
        sourcePosition: pos,
        targetPosition: [asset.lng, asset.lat],
        sourceColor: srcColor,
        targetColor: sevColor,
      });
    }

    if (arcData.length > 0) {
      layers.push(new ArcLayer<ArcDatum>({
        id: 'impact-arcs',
        data: arcData,
        pickable: false,
        getSourcePosition: (d) => d.sourcePosition,
        getTargetPosition: (d) => d.targetPosition,
        getSourceColor: (d) => d.sourceColor,
        getTargetColor: (d) => d.targetColor,
        getWidth: 1.5,
        greatCircle: true,
        updateTriggers: {
          getSourceColor: [event.id],
          getTargetColor: [exposures],
        },
      }));
    }
  }

  return layers;
}
