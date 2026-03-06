import { describe, expect, it } from 'vitest';

import { buildDefaultBundleDomainOverviews } from '../bundleDomainOverviews';
import type { OpsAsset, OpsAssetExposure, OpsPriority } from '../types';

describe('buildDefaultBundleDomainOverviews', () => {
  it('derives lifeline and built-environment overviews from future asset class families', () => {
    const assets = [
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

    const priorities: OpsPriority[] = [
      {
        id: 'priority-substation',
        assetId: 'tokyo-east-substation',
        severity: 'critical',
        title: 'Verify Tokyo East Substation power posture',
        rationale: 'Kanto power substation posture is critical because strong shaking overlap, grid stability risk.',
      },
      {
        id: 'priority-water',
        assetId: 'toyosu-water',
        severity: 'priority',
        title: 'Verify Toyosu Water Purification Center water posture',
        rationale: 'Kanto water facility posture is priority because moderate shaking overlap, service continuity risk.',
      },
      {
        id: 'priority-buildings',
        assetId: 'marunouchi-core',
        severity: 'watch',
        title: 'Review Marunouchi Core built-environment posture',
        rationale: 'Kanto building cluster posture is watch because moderate shaking overlap, urban structure inspection.',
      },
    ];

    const overviews = buildDefaultBundleDomainOverviews({
      priorities,
      exposures,
      assets,
      trustLevel: 'review',
    });

    expect(overviews.lifelines).toMatchObject({
      metric: '2 lifeline checks queued',
      detail: 'Verify Tokyo East Substation power posture',
      severity: 'critical',
      availability: 'live',
      trust: 'review',
    });
    expect(overviews.lifelines?.counters).toEqual([
      { id: 'checks', label: 'Checks', value: 2, tone: 'critical' },
      { id: 'lifeline-sites', label: 'Lifeline Sites', value: 2, tone: 'critical' },
    ]);
    expect(overviews['built-environment']).toMatchObject({
      metric: '1 urban integrity review queued',
      detail: 'Review Marunouchi Core built-environment posture',
      severity: 'watch',
      availability: 'live',
      trust: 'review',
    });
    expect(overviews['built-environment']?.signals).toEqual([
      { id: 'next-check', label: 'Next Check', value: 'Review Marunouchi Core built-environment posture', tone: 'watch' },
      { id: 'built-environment-region', label: 'Region', value: 'Kanto', tone: 'watch' },
    ]);
  });
});
