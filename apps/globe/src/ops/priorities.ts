import type { OpsAsset, OpsAssetExposure, OpsPriority } from './types';

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
  switch (asset.class) {
    case 'port':
      return `Verify ${asset.name} access`;
    case 'rail_hub':
      return `Inspect ${asset.name.replace(' Station', '')} rail hub`;
    case 'hospital':
      return `Confirm ${asset.name} access posture`;
  }
}

function rationaleFor(asset: OpsAsset, exposure: OpsAssetExposure): string {
  return `${formatRegionLabel(asset.region)} ${asset.class.replace('_', ' ')} posture is ${exposure.severity} because ${exposure.reasons.join(', ')}.`;
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
