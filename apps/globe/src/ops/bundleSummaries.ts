import type { EarthquakeEvent } from '../types';
import type {
  OperationalOverview,
  OperatorBundleSummaries,
} from './readModelTypes';
import type { OpsAsset, OpsAssetClass, OpsAssetExposure, OpsSeverity } from './types';

export interface MaritimeTelemetryOverview {
  totalTracked: number;
  highPriorityTracked: number;
  underwayCount: number;
  anchoredCount: number;
  summary: string;
}

interface BuildOperatorBundleSummariesInput {
  selectedEvent: EarthquakeEvent | null;
  assets: OpsAsset[];
  exposures: OpsAssetExposure[];
  operationalOverview: OperationalOverview;
  maritimeOverview?: MaritimeTelemetryOverview | null;
}

function severityRank(severity: OpsSeverity): number {
  switch (severity) {
    case 'critical': return 3;
    case 'priority': return 2;
    case 'watch': return 1;
    case 'clear': return 0;
  }
}

function formatRegion(region: OpsAsset['region'] | null): string {
  if (!region) return 'Japan';

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

function summarizeClassExposure(
  assetClass: OpsAssetClass,
  assets: OpsAsset[],
  exposures: OpsAssetExposure[],
): {
  count: number;
  topSeverity: OpsSeverity;
  topAssets: OpsAsset[];
} {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const matching: Array<{ entry: OpsAssetExposure; asset: OpsAsset }> = [];

  for (const entry of exposures) {
    if (entry.severity === 'clear') continue;
    const asset = assetById.get(entry.assetId);
    if (!asset || asset.class !== assetClass) continue;
    matching.push({ entry, asset });
  }

  matching
    .sort((left, right) =>
      severityRank(right.entry.severity) - severityRank(left.entry.severity) ||
      right.entry.score - left.entry.score,
    );

  return {
    count: matching.length,
    topSeverity: matching[0]?.entry.severity ?? 'clear',
    topAssets: matching.slice(0, 2).map((entry) => entry.asset),
  };
}

export function buildOperatorBundleSummaries(
  input: BuildOperatorBundleSummariesInput,
): OperatorBundleSummaries {
  const ports = summarizeClassExposure('port', input.assets, input.exposures);
  const rail = summarizeClassExposure('rail_hub', input.assets, input.exposures);
  const medical = summarizeClassExposure('hospital', input.assets, input.exposures);
  const topRegion = formatRegion(input.operationalOverview.topRegion);
  const hasEvent = input.selectedEvent !== null;

  return {
    seismic: {
      bundleId: 'seismic',
      title: 'Seismic',
      metric: input.operationalOverview.nationalAffectedAssetCount > 0
        ? `${input.operationalOverview.nationalAffectedAssetCount} assets in elevated posture`
        : 'No elevated nationwide posture',
      detail: input.operationalOverview.topRegion
        ? `Primary operational pressure centered on ${topRegion}.`
        : 'National seismic truth is standing by for the next significant event.',
      severity: input.operationalOverview.topSeverity,
      availability: 'live',
    },
    ...(input.maritimeOverview || ports.count > 0
      ? {
          maritime: {
            bundleId: 'maritime' as const,
            title: 'Maritime',
            metric: input.maritimeOverview
              ? input.maritimeOverview.summary
              : `${ports.count} port asset${ports.count === 1 ? '' : 's'} in elevated posture`,
            detail: ports.count > 0
              ? `${ports.topAssets.map((asset) => asset.name).join(' and ')} require coastal verification.`
              : 'Coastal shipping and port posture are standing by.',
            severity: ports.topSeverity,
            availability: 'live' as const,
          },
        }
      : {}),
    lifelines: {
      bundleId: 'lifelines',
      title: 'Lifelines',
      metric: rail.count > 0
        ? `${rail.count} rail hub${rail.count === 1 ? '' : 's'} in elevated posture`
        : 'No lifeline corridors in elevated posture',
      detail: rail.count > 0
        ? `${rail.topAssets.map((asset) => asset.name).join(' and ')} require corridor verification.`
        : 'Rail, power, water, and telecom views are standing by for corridor stress.',
      severity: rail.topSeverity,
      availability: rail.count > 0 ? 'live' : 'planned',
    },
    medical: {
      bundleId: 'medical',
      title: 'Medical',
      metric: medical.count > 0
        ? `${medical.count} medical site${medical.count === 1 ? '' : 's'} in elevated posture`
        : 'No medical access posture shift',
      detail: medical.count > 0
        ? `${medical.topAssets.map((asset) => asset.name).join(' and ')} require hospital access verification.`
        : 'Medical access and hospital readiness are standing by.',
      severity: medical.topSeverity,
      availability: medical.count > 0 ? 'live' : 'planned',
    },
    'built-environment': {
      bundleId: 'built-environment',
      title: 'Built Environment',
      metric: hasEvent
        ? `${topRegion} urban context aligned to current event`
        : 'Urban structural context on standby',
      detail: hasEvent
        ? 'Built-environment overlays will intensify at city-tier as structural layers come online.'
        : 'City-tier built-environment overlays will activate once an operator focus event is selected.',
      severity: input.operationalOverview.topSeverity,
      availability: 'planned',
    },
  };
}
