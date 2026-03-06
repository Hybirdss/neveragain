import { describe, expect, it } from 'vitest';

import type { OpsAsset, ViewportState } from '../types';
import { deriveZoomTier, filterVisibleOpsAssets } from '../viewport';

const assets: OpsAsset[] = [
  {
    id: 'tokyo-port',
    metro: 'tokyo',
    region: 'kanto',
    class: 'port',
    name: 'Port of Tokyo',
    lat: 35.617,
    lng: 139.794,
    tags: ['coastal'],
    minZoomTier: 'national',
  },
  {
    id: 'tokyo-station',
    metro: 'tokyo',
    region: 'kanto',
    class: 'rail_hub',
    name: 'Tokyo Station',
    lat: 35.6812,
    lng: 139.7671,
    tags: ['rail'],
    minZoomTier: 'regional',
  },
  {
    id: 'tokyo-univ-hospital',
    metro: 'tokyo',
    region: 'kanto',
    class: 'hospital',
    name: 'University of Tokyo Hospital',
    lat: 35.7134,
    lng: 139.761,
    tags: ['medical'],
    minZoomTier: 'city',
  },
];

describe('deriveZoomTier', () => {
  it('maps zoom levels into the nationwide viewport tiers', () => {
    expect(deriveZoomTier(6.5)).toBe('national');
    expect(deriveZoomTier(9)).toBe('regional');
    expect(deriveZoomTier(12)).toBe('city');
    expect(deriveZoomTier(15)).toBe('district');
  });
});

describe('filterVisibleOpsAssets', () => {
  it('returns only assets inside bounds that satisfy the current zoom tier', () => {
    const viewport: ViewportState = {
      center: { lat: 35.68, lng: 139.76 },
      zoom: 9.5,
      bounds: [139.6, 35.55, 139.9, 35.75],
      tier: 'regional',
      activeRegion: 'kanto',
    };

    const visible = filterVisibleOpsAssets(assets, viewport);

    expect(visible.map((asset) => asset.id)).toEqual([
      'tokyo-port',
      'tokyo-station',
    ]);
  });
});
