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
    });

    expect(priorities).toHaveLength(2);
    expect(priorities[0]?.title).toContain('Verify Port of Tokyo access');
    expect(priorities[1]?.title).toContain('Inspect Shinagawa rail hub');
    expect(priorities[0]?.rationale).toContain('Kanto');
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
    });

    expect(priorities).toEqual([]);
  });

  it('creates operator checks for future lifeline and built-environment classes from shared class metadata', () => {
    const futureAssets = [
      {
        id: 'tokyo-east-substation',
        region: 'kanto',
        class: 'power_substation',
        name: 'Tokyo East Substation',
        lat: 35.65,
        lng: 139.83,
        tags: ['power', 'grid'],
        minZoomTier: 'regional',
      },
      {
        id: 'toyosu-water',
        region: 'kanto',
        class: 'water_facility',
        name: 'Toyosu Water Purification Center',
        lat: 35.64,
        lng: 139.81,
        tags: ['water', 'lifeline'],
        minZoomTier: 'regional',
      },
      {
        id: 'marunouchi-core',
        region: 'kanto',
        class: 'building_cluster',
        name: 'Marunouchi Core',
        lat: 35.68,
        lng: 139.76,
        tags: ['urban', 'buildings'],
        minZoomTier: 'city',
      },
    ] as unknown as OpsAsset[];

    const exposures: OpsAssetExposure[] = [
      {
        assetId: 'tokyo-east-substation',
        severity: 'critical',
        score: 93,
        summary: 'Tokyo East Substation is in critical posture.',
        reasons: ['strong shaking overlap', 'grid stability risk'],
      },
      {
        assetId: 'toyosu-water',
        severity: 'priority',
        score: 66,
        summary: 'Toyosu Water Purification Center is in priority posture.',
        reasons: ['moderate shaking overlap', 'service continuity risk'],
      },
      {
        assetId: 'marunouchi-core',
        severity: 'watch',
        score: 44,
        summary: 'Marunouchi Core is in watch posture.',
        reasons: ['moderate shaking overlap', 'urban structure inspection'],
      },
    ];

    const priorities = buildOpsPriorities({
      assets: futureAssets,
      exposures,
    });

    expect(priorities).toHaveLength(3);
    expect(priorities[0]?.title).toBe('Verify Tokyo East Substation power posture');
    expect(priorities[1]?.title).toBe('Verify Toyosu Water Purification Center water posture');
    expect(priorities[2]?.title).toBe('Review Marunouchi Core built-environment posture');
    expect(priorities[0]?.rationale).toContain('power substation posture');
    expect(priorities[1]?.rationale).toContain('water facility posture');
    expect(priorities[2]?.rationale).toContain('building cluster posture');
  });
});
