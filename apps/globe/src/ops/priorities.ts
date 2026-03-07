import type { OpsAsset, OpsAssetExposure, OpsPriority } from './types';
import { buildPriorityRationale, buildPriorityTitle } from './operatorLocale';

export function buildOpsPriorities(input: {
  assets: OpsAsset[];
  exposures: OpsAssetExposure[];
}): OpsPriority[] {
  const assetById = new Map(input.assets.map((asset) => [asset.id, asset]));
  const priorities: OpsPriority[] = [];

  for (const exposure of input.exposures) {
    if (exposure.severity === 'clear') {
      continue;
    }

    const asset = assetById.get(exposure.assetId);
    if (!asset) {
      continue;
    }

    priorities.push({
      id: `priority-${asset.id}`,
      assetId: asset.id,
      severity: exposure.severity,
      title: buildPriorityTitle(asset),
      rationale: buildPriorityRationale({
        region: asset.region,
        assetClass: asset.class,
        severity: exposure.severity,
        reasons: exposure.reasons,
      }),
    });

    if (priorities.length === 3) {
      break;
    }
  }

  return priorities;
}
