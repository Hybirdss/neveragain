import type { OpsAsset, OpsAssetExposure, OpsPriority } from './types';
import { getOpsAssetClassDefinition } from './assetClassRegistry';

function formatRegionLabel(region: OpsAsset['region']): string {
  switch (region) {
    case 'hokkaido': return 'Hokkaido';
    case 'tohoku': return 'Tohoku';
    case 'kanto': return 'Kanto';
    case 'chubu': return 'Chubu';
    case 'kansai': return 'Kansai';
    case 'chugoku': return 'Chugoku';
    case 'shikoku': return 'Shikoku';
    case 'kyushu': return 'Kyushu';
  }
}

function titleForAsset(asset: OpsAsset): string {
  return getOpsAssetClassDefinition(asset.class).priorityTitle(asset);
}

function rationaleFor(asset: OpsAsset, exposure: OpsAssetExposure): string {
  const definition = getOpsAssetClassDefinition(asset.class);
  return `${formatRegionLabel(asset.region)} ${definition.label} posture is ${exposure.severity} because ${exposure.reasons.join(', ')}.`;
}

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
      title: titleForAsset(asset),
      rationale: rationaleFor(asset, exposure),
    });

    if (priorities.length === 3) {
      break;
    }
  }

  return priorities;
}
