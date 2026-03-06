import type {
  OperatorBundleDomainOverview,
  OperatorBundleDomainOverviews,
  OperatorBundleTrust,
} from './readModelTypes';
import type { OpsAsset, OpsAssetClass, OpsAssetExposure, OpsPriority, OpsRegion, OpsSeverity } from './types';

function severityRank(severity: OpsSeverity): number {
  switch (severity) {
    case 'critical': return 3;
    case 'priority': return 2;
    case 'watch': return 1;
    case 'clear': return 0;
  }
}

function formatRegion(region: OpsRegion | null): string {
  if (!region) {
    return 'Japan';
  }

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

function getAssetMap(assets: OpsAsset[]): Map<string, OpsAsset> {
  return new Map(assets.map((asset) => [asset.id, asset]));
}

function selectRelevantPriorities(
  priorities: OpsPriority[],
  assetMap: Map<string, OpsAsset>,
  classes: OpsAssetClass[],
): OpsPriority[] {
  return priorities.filter((priority) => {
    if (!priority.assetId) {
      return false;
    }

    const asset = assetMap.get(priority.assetId);
    return asset ? classes.includes(asset.class) : false;
  });
}

function countRelevantExposures(
  exposures: OpsAssetExposure[],
  assetMap: Map<string, OpsAsset>,
  classes: OpsAssetClass[],
): number {
  return exposures.filter((exposure) => {
    if (exposure.severity === 'clear') {
      return false;
    }

    const asset = assetMap.get(exposure.assetId);
    return asset ? classes.includes(asset.class) : false;
  }).length;
}

function pickRegion(
  priorities: OpsPriority[],
  assetMap: Map<string, OpsAsset>,
): OpsRegion | null {
  const first = priorities.find((priority) => priority.assetId && assetMap.has(priority.assetId));
  return first?.assetId ? assetMap.get(first.assetId)?.region ?? null : null;
}

function buildOverview(input: {
  priorities: OpsPriority[];
  exposures: OpsAssetExposure[];
  assets: OpsAsset[];
  classes: OpsAssetClass[];
  metricLabel: string;
  counterLabel: string;
  regionSignalId: string;
  trust: Exclude<OperatorBundleTrust, 'pending'>;
}): OperatorBundleDomainOverview | undefined {
  const assetMap = getAssetMap(input.assets);
  const relevantPriorities = selectRelevantPriorities(input.priorities, assetMap, input.classes);

  if (relevantPriorities.length === 0) {
    return undefined;
  }

  const topPriority = relevantPriorities
    .slice()
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity))[0] ?? relevantPriorities[0];

  if (!topPriority) {
    return undefined;
  }

  const affectedCount = countRelevantExposures(input.exposures, assetMap, input.classes);
  const region = formatRegion(pickRegion(relevantPriorities, assetMap));
  const plural = relevantPriorities.length === 1 ? '' : 's';

  return {
    metric: `${relevantPriorities.length} ${input.metricLabel}${plural} queued`,
    detail: topPriority.title,
    severity: topPriority.severity,
    availability: 'live',
    trust: input.trust,
    counters: [
      { id: 'checks', label: 'Checks', value: relevantPriorities.length, tone: topPriority.severity },
      { id: input.counterLabel.toLowerCase().replace(/\s+/g, '-'), label: input.counterLabel, value: affectedCount, tone: topPriority.severity },
    ],
    signals: [
      { id: 'next-check', label: 'Next Check', value: topPriority.title, tone: topPriority.severity },
      { id: input.regionSignalId, label: 'Region', value: region, tone: topPriority.severity },
    ],
  };
}

export function buildDefaultBundleDomainOverviews(input: {
  priorities: OpsPriority[];
  exposures: OpsAssetExposure[];
  assets: OpsAsset[];
  trustLevel: Exclude<OperatorBundleTrust, 'pending'>;
}): OperatorBundleDomainOverviews {
  return {
    lifelines: buildOverview({
      priorities: input.priorities,
      exposures: input.exposures,
      assets: input.assets,
      classes: ['rail_hub'],
      metricLabel: 'corridor check',
      counterLabel: 'Rail Hubs',
      regionSignalId: 'lifeline-region',
      trust: input.trustLevel,
    }),
    medical: buildOverview({
      priorities: input.priorities,
      exposures: input.exposures,
      assets: input.assets,
      classes: ['hospital'],
      metricLabel: 'medical access check',
      counterLabel: 'Sites',
      regionSignalId: 'medical-region',
      trust: input.trustLevel,
    }),
  };
}
