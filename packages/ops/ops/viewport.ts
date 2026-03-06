import type { OpsAsset, ViewportState, ZoomTier } from './types';

const ZOOM_TIER_ORDER: ZoomTier[] = ['national', 'regional', 'city', 'district'];

export function deriveZoomTier(zoom: number): ZoomTier {
  if (zoom < 8) return 'national';
  if (zoom < 11) return 'regional';
  if (zoom < 14) return 'city';
  return 'district';
}

function isTierVisible(minZoomTier: ZoomTier, currentTier: ZoomTier): boolean {
  return ZOOM_TIER_ORDER.indexOf(currentTier) >= ZOOM_TIER_ORDER.indexOf(minZoomTier);
}

function isInsideBounds(asset: OpsAsset, bounds: ViewportState['bounds']): boolean {
  const [west, south, east, north] = bounds;
  return asset.lng >= west && asset.lng <= east && asset.lat >= south && asset.lat <= north;
}

export function filterVisibleOpsAssets(
  assets: OpsAsset[],
  viewport: ViewportState,
): OpsAsset[] {
  return assets.filter((asset) =>
    isInsideBounds(asset, viewport.bounds) && isTierVisible(asset.minZoomTier, viewport.tier),
  );
}
