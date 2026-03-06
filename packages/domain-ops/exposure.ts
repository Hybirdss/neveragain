import type { IntensityGrid, OpsAssetExposure, TsunamiAssessment } from '@namazue/kernel';

import { getOpsAssetClassDefinition } from './assetClassRegistry.ts';
import type { OpsAsset } from './types.ts';

export type { OpsAsset } from './types.ts';

function sampleGrid(grid: IntensityGrid, lat: number, lng: number): number {
  const latMin = grid.center.lat - grid.radiusDeg;
  const lngRadiusDeg = grid.radiusLngDeg ?? grid.radiusDeg;
  const lngMin = grid.center.lng - lngRadiusDeg;
  const latStep = (2 * grid.radiusDeg) / (grid.rows - 1);
  const lngStep = (2 * lngRadiusDeg) / (grid.cols - 1);

  const row = Math.round((lat - latMin) / latStep);
  const col = Math.round((lng - lngMin) / lngStep);

  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) {
    return 0;
  }

  return grid.data[row * grid.cols + col];
}

function tsunamiBonus(asset: OpsAsset, tsunamiAssessment: TsunamiAssessment | null): number {
  if (!tsunamiAssessment) return 0;

  const definition = getOpsAssetClassDefinition(asset.class);
  const isCoastalAsset = definition.tsunamiSensitive === true || asset.tags.includes('coastal');
  if (!isCoastalAsset) return 0;

  switch (tsunamiAssessment.risk) {
    case 'high':
      return 28;
    case 'moderate':
      return 20;
    case 'low':
      return 8;
    default:
      return 0;
  }
}

function classWeight(asset: OpsAsset, intensity: number): number {
  const definition = getOpsAssetClassDefinition(asset.class);

  return intensity * definition.exposureWeight
    + definition.thresholdRules.reduce(
      (bonus, rule) => bonus + (intensity >= rule.minIntensity ? rule.bonus : 0),
      0,
    );
}

function toSeverity(score: number): OpsAssetExposure['severity'] {
  if (score >= 80) return 'critical';
  if (score >= 55) return 'priority';
  if (score >= 28) return 'watch';
  return 'clear';
}

function buildReasons(
  asset: OpsAsset,
  intensity: number,
  tsunamiAssessment: TsunamiAssessment | null,
): string[] {
  const reasons: string[] = [];
  const definition = getOpsAssetClassDefinition(asset.class);

  if (intensity >= 5) {
    reasons.push('strong shaking overlap');
  } else if (intensity >= 3.5) {
    reasons.push('moderate shaking overlap');
  } else {
    reasons.push('limited shaking overlap');
  }

  if ((definition.tsunamiSensitive === true || asset.tags.includes('coastal')) && tsunamiAssessment && tsunamiAssessment.risk !== 'none') {
    reasons.push(`tsunami posture ${tsunamiAssessment.risk}`);
  }

  for (const rule of definition.thresholdRules) {
    if (intensity >= rule.minIntensity) {
      reasons.push(rule.reason);
    }
  }

  return reasons;
}

export function buildAssetExposures(input: {
  grid: IntensityGrid;
  assets: OpsAsset[];
  tsunamiAssessment: TsunamiAssessment | null;
}): OpsAssetExposure[] {
  const exposures = input.assets.map((asset) => {
    const intensity = sampleGrid(input.grid, asset.lat, asset.lng);
    const score = classWeight(asset, intensity) + tsunamiBonus(asset, input.tsunamiAssessment);
    const severity = toSeverity(score);
    const reasons = buildReasons(asset, intensity, input.tsunamiAssessment);

    return {
      assetId: asset.id,
      severity,
      score: Math.round(score * 10) / 10,
      summary: `${asset.name} is in ${severity} posture.`,
      reasons,
    } satisfies OpsAssetExposure;
  });

  return exposures.sort((a, b) => b.score - a.score);
}
