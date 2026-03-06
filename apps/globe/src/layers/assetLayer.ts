/**
 * Asset Layer — Infrastructure markers on the map.
 *
 * Shows ports, rail hubs, and hospitals from the ops asset catalog.
 * Markers are colored by current severity (clear/watch/priority/critical).
 * Visibility controlled by zoom tier (minZoomTier per asset).
 */

import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import { OPS_ASSETS } from '../ops/assetCatalog';
import type { OpsAsset, OpsAssetExposure, OpsSeverity, ZoomTier } from '../ops/types';

type RGBA = [number, number, number, number];

const SEVERITY_COLORS: Record<OpsSeverity, RGBA> = {
  clear: [110, 231, 183, 140],    // calm green
  watch: [96, 165, 250, 180],     // cool blue
  priority: [251, 191, 36, 220],  // amber
  critical: [239, 68, 68, 240],   // red
};

const CLASS_RADIUS: Record<OpsAsset['class'], number> = {
  port: 8,
  rail_hub: 6,
  hospital: 5,
};

const ZOOM_TIER_ORDER: ZoomTier[] = ['national', 'regional', 'city', 'district'];

function tierIndex(tier: ZoomTier): number {
  return ZOOM_TIER_ORDER.indexOf(tier);
}

interface AssetDatum extends OpsAsset {
  severity: OpsSeverity;
}

export function createAssetLayers(
  currentTier: ZoomTier,
  exposures: OpsAssetExposure[],
): Layer[] {
  const exposureMap = new Map(exposures.map((e) => [e.assetId, e]));
  const currentIdx = tierIndex(currentTier);

  const visible: AssetDatum[] = OPS_ASSETS
    .filter((a) => tierIndex(a.minZoomTier) <= currentIdx)
    .map((a) => ({
      ...a,
      severity: exposureMap.get(a.id)?.severity ?? 'clear',
    }));

  if (visible.length === 0) return [];

  const layers: Layer[] = [];

  // Marker dots
  layers.push(new ScatterplotLayer<AssetDatum>({
    id: 'asset-markers',
    data: visible,
    pickable: true,
    stroked: true,
    filled: true,
    radiusUnits: 'pixels',
    lineWidthUnits: 'pixels',
    getPosition: (d) => [d.lng, d.lat],
    getRadius: (d) => CLASS_RADIUS[d.class],
    getFillColor: (d) => SEVERITY_COLORS[d.severity],
    getLineColor: [255, 255, 255, 80],
    getLineWidth: 1,
    updateTriggers: {
      getFillColor: [exposures],
    },
  }));

  // Labels — only at regional zoom or closer
  if (currentIdx >= 1) {
    layers.push(new TextLayer<AssetDatum>({
      id: 'asset-labels',
      data: visible,
      pickable: false,
      getPosition: (d) => [d.lng, d.lat],
      getText: (d) => d.name,
      getSize: 11,
      getColor: [226, 232, 240, 180],
      getTextAnchor: 'start',
      getAlignmentBaseline: 'center',
      getPixelOffset: [12, 0],
      fontFamily: 'Noto Sans JP, system-ui, sans-serif',
      fontWeight: 500,
      outlineWidth: 2,
      outlineColor: [10, 14, 20, 200],
    }));
  }

  return layers;
}
