import { describe, expect, it } from 'vitest';

import { buildOpsPriorities } from '../priorities';
import type { OpsAsset, OpsAssetExposure } from '../types';

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
    id: 'tokyo-shinagawa',
    metro: 'tokyo',
    region: 'kanto',
    class: 'rail_hub',
    name: 'Shinagawa Station',
    lat: 35.6284,
    lng: 139.7387,
    tags: ['rail'],
    minZoomTier: 'regional',
  },
];

describe('buildOpsPriorities', () => {
  it('creates ordered operator checks from the highest exposures', () => {
    const exposures: OpsAssetExposure[] = [
      {
        assetId: 'tokyo-port',
        severity: 'critical',
        score: 91,
        summary: 'Port of Tokyo is in critical posture.',
        reasons: ['strong shaking overlap', 'tsunami posture moderate'],
      },
      {
        assetId: 'tokyo-shinagawa',
        severity: 'priority',
        score: 68,
        summary: 'Shinagawa Station is in priority posture.',
        reasons: ['strong shaking overlap', 'hub inspection priority'],
      },
    ];

    const priorities = buildOpsPriorities({
      assets,
      exposures,
      metro: 'tokyo',
    });

    expect(priorities).toHaveLength(2);
    expect(priorities[0]?.title).toContain('Verify Tokyo port access');
    expect(priorities[1]?.title).toContain('Inspect Shinagawa rail hub');
  });

  it('omits clear exposures from the action list', () => {
    const exposures: OpsAssetExposure[] = [
      {
        assetId: 'tokyo-port',
        severity: 'clear',
        score: 10,
        summary: 'Port of Tokyo is in clear posture.',
        reasons: ['limited shaking overlap'],
      },
    ];

    const priorities = buildOpsPriorities({
      assets,
      exposures,
      metro: 'tokyo',
    });

    expect(priorities).toEqual([]);
  });
});
