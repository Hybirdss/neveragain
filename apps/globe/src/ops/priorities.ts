import type { LaunchMetro } from './types';
import type { OpsAsset, OpsAssetExposure, OpsPriority } from './types';

function titleForAsset(asset: OpsAsset): string {
  switch (asset.class) {
    case 'port':
      return `Verify ${asset.metro === 'tokyo' ? 'Tokyo' : 'Osaka'} port access`;
    case 'rail_hub':
      return `Inspect ${asset.name.replace(' Station', '')} rail hub`;
    case 'hospital':
      return `Confirm ${asset.name} access posture`;
  }
}

function rationaleFor(asset: OpsAsset, exposure: OpsAssetExposure, metro: LaunchMetro): string {
  const metroLabel = metro === 'tokyo' ? 'Tokyo' : 'Osaka';
  return `${metroLabel} ${asset.class.replace('_', ' ')} posture is ${exposure.severity} because ${exposure.reasons.join(', ')}.`;
}

export function buildOpsPriorities(input: {
  assets: OpsAsset[];
  exposures: OpsAssetExposure[];
  metro: LaunchMetro;
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
      title: titleForAsset(asset),
      rationale: rationaleFor(asset, exposure, input.metro),
    });

    if (priorities.length === 3) {
      break;
    }
  }

  return priorities;
}
