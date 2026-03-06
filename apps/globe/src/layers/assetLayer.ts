/**
 * Asset Layer — Infrastructure icon markers on the map.
 *
 * Shows operator assets from the ops asset catalog.
 * Each asset class has a distinct icon shape (Lucide-based).
 * Color encodes severity (clear/watch/priority/critical).
 * Visibility controlled by zoom tier (minZoomTier per asset).
 *
 * Shape = type (anchor, cross, zap, etc.)
 * Color = state (green → blue → amber → red)
 */

import { IconLayer, TextLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import { OPS_ASSETS } from '../ops/assetCatalog';
import type { OpsAsset, OpsAssetExposure, OpsSeverity, ZoomTier } from '../ops/types';
import { ICON_ATLAS_URL, ICON_MAPPING, ASSET_ICON_SIZE } from './iconAtlas';

type RGBA = [number, number, number, number];

const SEVERITY_COLORS: Record<OpsSeverity, RGBA> = {
  clear: [110, 231, 183, 160],    // calm green
  watch: [96, 165, 250, 200],     // cool blue
  priority: [251, 191, 36, 220],  // amber
  critical: [239, 68, 68, 240],   // red
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
  highlightedAssetId: string | null = null,
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

  // Highlight glow ring for panel-hovered asset
  if (highlightedAssetId) {
    const highlighted = visible.find((d) => d.id === highlightedAssetId);
    if (highlighted) {
      layers.push(new ScatterplotLayer({
        id: 'asset-highlight-glow',
        data: [highlighted],
        pickable: false,
        radiusUnits: 'pixels',
        getPosition: (d: AssetDatum) => [d.lng, d.lat],
        getRadius: 28,
        stroked: true,
        filled: true,
        getFillColor: [125, 211, 252, 40],
        getLineColor: [125, 211, 252, 120],
        getLineWidth: 2,
        updateTriggers: {
          getPosition: [highlightedAssetId],
        },
      }));
    }
  }

  // Infrastructure icon markers
  layers.push(new IconLayer<AssetDatum>({
    id: 'asset-markers',
    data: visible,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 80],
    iconAtlas: ICON_ATLAS_URL,
    iconMapping: ICON_MAPPING,
    getIcon: (d) => d.class,
    getPosition: (d) => [d.lng, d.lat],
    getSize: (d) => ASSET_ICON_SIZE[d.class],
    sizeUnits: 'pixels',
    sizeMinPixels: 10,
    getColor: (d) => SEVERITY_COLORS[d.severity],
    updateTriggers: {
      getColor: [exposures],
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
      getPixelOffset: [14, 0],
      fontFamily: 'Noto Sans JP, system-ui, sans-serif',
      fontWeight: 500,
      outlineWidth: 2,
      outlineColor: [10, 14, 20, 200],
    }));
  }

  return layers;
}
