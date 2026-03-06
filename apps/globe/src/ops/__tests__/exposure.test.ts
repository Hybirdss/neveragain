import { describe, expect, it } from 'vitest';

import type { IntensityGrid, TsunamiAssessment } from '../../types';
import { buildAssetExposures } from '../exposure';
import type { OpsAsset } from '../types';

function makeUniformGrid(value: number): IntensityGrid {
  return {
    data: new Float32Array([
      value, value, value,
      value, value, value,
      value, value, value,
    ]),
    cols: 3,
    rows: 3,
    center: { lat: 35.62, lng: 139.79 },
    radiusDeg: 0.2,
  };
}

const MODERATE_TSUNAMI: TsunamiAssessment = {
  risk: 'moderate',
  confidence: 'high',
  factors: ['Coastal offshore event'],
  locationType: 'near_coast',
  coastDistanceKm: 12,
  faultType: 'interface',
};

const NO_TSUNAMI: TsunamiAssessment = {
  risk: 'none',
  confidence: 'high',
  factors: [],
  locationType: 'inland',
  coastDistanceKm: 80,
  faultType: 'crustal',
};

describe('buildAssetExposures', () => {
  it('elevates a coastal port when shaking and tsunami posture overlap', () => {
    const assets: OpsAsset[] = [
      {
        id: 'tokyo-port',
        metro: 'tokyo',
        class: 'port',
        name: 'Port of Tokyo',
        lat: 35.617,
        lng: 139.794,
        tags: ['coastal'],
      },
    ];

    const exposures = buildAssetExposures({
      grid: makeUniformGrid(5.3),
      assets,
      tsunamiAssessment: MODERATE_TSUNAMI,
    });

    expect(exposures[0]).toMatchObject({
      assetId: 'tokyo-port',
      severity: 'critical',
    });
    expect(exposures[0]?.reasons.join(' ')).toContain('tsunami');
  });

  it('keeps a low-shaking hospital in clear posture', () => {
    const assets: OpsAsset[] = [
      {
        id: 'tokyo-hospital',
        metro: 'tokyo',
        class: 'hospital',
        name: 'Tokyo Hospital',
        lat: 35.617,
        lng: 139.794,
        tags: ['medical'],
      },
    ];

    const exposures = buildAssetExposures({
      grid: makeUniformGrid(2.0),
      assets,
      tsunamiAssessment: NO_TSUNAMI,
    });

    expect(exposures[0]).toMatchObject({
      assetId: 'tokyo-hospital',
      severity: 'clear',
    });
  });

  it('sorts higher-impact assets ahead of lower-impact ones', () => {
    const assets: OpsAsset[] = [
      {
        id: 'tokyo-port',
        metro: 'tokyo',
        class: 'port',
        name: 'Port of Tokyo',
        lat: 35.617,
        lng: 139.794,
        tags: ['coastal'],
      },
      {
        id: 'tokyo-hospital',
        metro: 'tokyo',
        class: 'hospital',
        name: 'Tokyo Hospital',
        lat: 35.617,
        lng: 139.794,
        tags: ['medical'],
      },
    ];

    const exposures = buildAssetExposures({
      grid: makeUniformGrid(4.8),
      assets,
      tsunamiAssessment: MODERATE_TSUNAMI,
    });

    expect(exposures[0]?.assetId).toBe('tokyo-port');
    expect(exposures[1]?.assetId).toBe('tokyo-hospital');
  });
});
