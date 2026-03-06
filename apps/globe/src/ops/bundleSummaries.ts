import type { EarthquakeEvent } from '../types';
import type {
  OperatorBundleDomain,
  OperatorBundleDomainOverview,
  OperatorBundleDomainOverviews,
  OperatorBundleId,
  OperationalOverview,
  OperatorBundleCounter,
  OperatorBundleSignal,
  OperatorBundleSummary,
  OperatorBundleSummaries,
  OperatorBundleTrust,
} from './readModelTypes';
import type { OpsAsset, OpsAssetClass, OpsAssetExposure, OpsSeverity } from './types';
import { getBundleAssetClasses, getOpsAssetClassDefinition } from './assetClassRegistry';

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
  domainOverviews?: OperatorBundleDomainOverviews;
  trustLevel?: Exclude<OperatorBundleTrust, 'pending'>;
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

function summarizeBundleExposure(
  bundleId: Extract<OperatorBundleId, 'lifelines' | 'medical' | 'built-environment'>,
  assets: OpsAsset[],
  exposures: OpsAssetExposure[],
): {
  count: number;
  topSeverity: OpsSeverity;
  topAssets: OpsAsset[];
} {
  const classes = new Set(getBundleAssetClasses(bundleId));
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const matching: Array<{ entry: OpsAssetExposure; asset: OpsAsset }> = [];

  for (const entry of exposures) {
    if (entry.severity === 'clear') continue;
    const asset = assetById.get(entry.assetId);
    if (!asset || !classes.has(asset.class)) continue;
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

function summarizeBundleFamilies(
  bundleId: Extract<OperatorBundleId, 'lifelines' | 'medical' | 'built-environment'>,
  assets: OpsAsset[],
  exposures: OpsAssetExposure[],
): Array<{ assetClass: OpsAssetClass; count: number; tone: OpsSeverity; topAssets: OpsAsset[] }> {
  const classes = new Set(getBundleAssetClasses(bundleId));
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const grouped = new Map<OpsAssetClass, { count: number; tone: OpsSeverity; assets: OpsAsset[] }>();

  for (const entry of exposures) {
    if (entry.severity === 'clear') continue;
    const asset = assetById.get(entry.assetId);
    if (!asset || !classes.has(asset.class)) continue;

    const current = grouped.get(asset.class);
    const existingAssets = current?.assets ?? [];
    grouped.set(asset.class, {
      count: (current?.count ?? 0) + 1,
      tone: current && severityRank(current.tone) > severityRank(entry.severity)
        ? current.tone
        : entry.severity,
      assets: existingAssets.some((candidate) => candidate.id === asset.id)
        ? existingAssets
        : [...existingAssets, asset],
    });
  }

  return [...grouped.entries()].map(([assetClass, value]) => ({
    assetClass,
    count: value.count,
    tone: value.tone,
    topAssets: value.assets.slice(0, 2),
  }));
}

function resolveBundleTrust(
  availability: 'live' | 'planned',
  trustLevel: Exclude<OperatorBundleTrust, 'pending'> | undefined,
): OperatorBundleTrust {
  if (availability === 'planned') {
    return 'pending';
  }

  return trustLevel ?? 'confirmed';
}

function buildCounter(
  id: string,
  label: string,
  value: number,
  tone: OpsSeverity,
): OperatorBundleCounter {
  return { id, label, value, tone };
}

function buildSignal(
  id: string,
  label: string,
  value: string,
  tone: OpsSeverity,
): OperatorBundleSignal {
  return { id, label, value, tone };
}

function buildBundleFamilyCounters(
  families: Array<{ assetClass: OpsAssetClass; count: number; tone: OpsSeverity }>,
): OperatorBundleCounter[] {
  if (families.length <= 1) {
    return [];
  }

  return families.map((family) => {
    const definition = getOpsAssetClassDefinition(family.assetClass);
    return buildCounter(
      definition.counterLabel.toLowerCase().replace(/\s+/g, '-'),
      definition.counterLabel,
      family.count,
      family.tone,
    );
  });
}

function buildBundleDomainMixSignal(
  families: Array<{ assetClass: OpsAssetClass; count: number; tone: OpsSeverity; topAssets: OpsAsset[] }>,
  tone: OpsSeverity,
): OperatorBundleSignal[] {
  if (families.length <= 1) {
    return [];
  }

  return [
    buildSignal(
      'domain-mix',
      'Domain Mix',
      families.map((family) => getOpsAssetClassDefinition(family.assetClass).familyLabel).join(' + '),
      tone,
    ),
  ];
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function buildBundleDomains(
  families: Array<{ assetClass: OpsAssetClass; count: number; tone: OpsSeverity; topAssets: OpsAsset[] }>,
  trust: OperatorBundleTrust,
): OperatorBundleDomain[] {
  return families.map((family) => {
    const definition = getOpsAssetClassDefinition(family.assetClass);
    const focusAssets = joinAssetNames(family.topAssets);
    return {
      id: definition.domainId,
      label: definition.familyLabel,
      metric: `${family.count} ${pluralize(family.count, definition.exposureMetricLabel)} exposed`,
      detail: `${focusAssets} requires operator verification.`,
      severity: family.tone,
      availability: 'live',
      trust,
      counters: [
        buildCounter(
          definition.counterLabel.toLowerCase().replace(/\s+/g, '-'),
          definition.counterLabel,
          family.count,
          family.tone,
        ),
      ],
      signals: [
        buildSignal('focus-assets', 'Focus Assets', focusAssets, family.tone),
      ],
    };
  });
}

function summarizeTopAssets(
  exposures: OpsAssetExposure[],
  assets: OpsAsset[],
  limit: number,
): OpsAsset[] {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));

  return exposures
    .filter((entry) => entry.severity !== 'clear')
    .sort((left, right) =>
      severityRank(right.severity) - severityRank(left.severity) ||
      right.score - left.score,
    )
    .flatMap((entry) => {
      const asset = assetById.get(entry.assetId);
      return asset ? [asset] : [];
    })
    .slice(0, limit);
}

function joinAssetNames(assets: OpsAsset[]): string {
  return assets.map((asset) => asset.name).join(', ');
}

function applyDomainOverview(
  summary: OperatorBundleSummary,
  override: OperatorBundleDomainOverview | undefined,
): OperatorBundleSummary {
  if (!override) {
    return summary;
  }

  return {
    ...summary,
    metric: override.metric,
    detail: override.detail,
    severity: override.severity,
    availability: override.availability,
    trust: override.trust,
    counters: override.counters,
    signals: override.signals,
    domains: override.domains ?? summary.domains,
  };
}

export function buildOperatorBundleSummaries(
  input: BuildOperatorBundleSummariesInput,
): OperatorBundleSummaries {
  const ports = summarizeClassExposure('port', input.assets, input.exposures);
  const lifelines = summarizeBundleExposure('lifelines', input.assets, input.exposures);
  const medical = summarizeBundleExposure('medical', input.assets, input.exposures);
  const builtEnvironment = summarizeBundleExposure('built-environment', input.assets, input.exposures);
  const lifelineFamilies = summarizeBundleFamilies('lifelines', input.assets, input.exposures);
  const builtEnvironmentFamilies = summarizeBundleFamilies('built-environment', input.assets, input.exposures);
  const topAssets = summarizeTopAssets(input.exposures, input.assets, 2);
  const topRegion = formatRegion(input.operationalOverview.topRegion);
  const hasEvent = input.selectedEvent !== null;
  const liveTrust = resolveBundleTrust('live', input.trustLevel);
  const plannedTrust = resolveBundleTrust('planned', input.trustLevel);
  const lifelineDomains = buildBundleDomains(lifelineFamilies, liveTrust);
  const builtEnvironmentDomains = buildBundleDomains(builtEnvironmentFamilies, liveTrust);

  return {
    seismic: applyDomainOverview({
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
      trust: liveTrust,
      counters: [
        buildCounter(
          'affected-assets',
          'Affected',
          input.operationalOverview.nationalAffectedAssetCount,
          input.operationalOverview.topSeverity,
        ),
        buildCounter(
          'visible-assets',
          'Visible',
          input.operationalOverview.visibleAffectedAssetCount,
          input.operationalOverview.topSeverity,
        ),
      ],
      signals: hasEvent && input.operationalOverview.topRegion
        ? [
            buildSignal('focus-region', 'Focus Region', topRegion, input.operationalOverview.topSeverity),
            ...(topAssets.length > 0
              ? [buildSignal('top-assets', 'Top Assets', joinAssetNames(topAssets), input.operationalOverview.topSeverity)]
              : []),
          ]
        : [],
      domains: [],
    }, input.domainOverviews?.seismic),
    maritime: applyDomainOverview({
      bundleId: 'maritime',
      title: 'Maritime',
      metric: input.maritimeOverview
        ? input.maritimeOverview.summary
        : ports.count > 0
          ? `${ports.count} port asset${ports.count === 1 ? '' : 's'} in elevated posture`
          : 'No tracked traffic',
      detail: ports.count > 0
        ? `${ports.topAssets.map((asset) => asset.name).join(' and ')} require coastal verification.`
        : input.maritimeOverview && input.maritimeOverview.totalTracked > 0
          ? input.maritimeOverview.highPriorityTracked > 0
            ? `${input.maritimeOverview.highPriorityTracked} high-priority vessels and ${input.maritimeOverview.underwayCount} underway in current feed.`
            : `${input.maritimeOverview.underwayCount} underway across current coastal traffic.`
          : 'AIS telemetry and coastal shipping posture are standing by.',
      severity: ports.topSeverity,
      availability: 'live',
      trust: liveTrust,
      counters: input.maritimeOverview
        ? [
            buildCounter('tracked', 'Tracked', input.maritimeOverview.totalTracked, 'clear'),
            buildCounter('high-priority', 'High Priority', input.maritimeOverview.highPriorityTracked, 'priority'),
            buildCounter('underway', 'Underway', input.maritimeOverview.underwayCount, 'watch'),
          ]
        : [],
      signals: [
        ...(ports.count > 0
          ? [buildSignal('exposed-ports', 'Exposed Ports', joinAssetNames(ports.topAssets), ports.topSeverity)]
          : []),
        ...(input.maritimeOverview
          ? [buildSignal(
              'traffic-posture',
              'Traffic Posture',
              `${input.maritimeOverview.highPriorityTracked} priority / ${input.maritimeOverview.underwayCount} underway`,
              input.maritimeOverview.highPriorityTracked > 0 ? 'watch' : 'clear',
            )]
          : []),
      ],
      domains: [],
    }, input.domainOverviews?.maritime),
    lifelines: applyDomainOverview({
      bundleId: 'lifelines',
      title: 'Lifelines',
      metric: lifelines.count > 0
        ? `${lifelines.count} lifeline site${lifelines.count === 1 ? '' : 's'} in elevated posture`
        : 'No lifeline corridors in elevated posture',
      detail: lifelines.count > 0
        ? `${lifelines.topAssets.map((asset) => asset.name).join(' and ')} require corridor verification.`
        : 'Rail, power, water, and telecom views are standing by for corridor stress.',
      severity: lifelines.topSeverity,
      availability: lifelines.count > 0 ? 'live' : 'planned',
      trust: lifelines.count > 0 ? liveTrust : plannedTrust,
      counters: lifelines.count > 0
        ? [
            buildCounter('lifeline-sites', 'Lifeline Sites', lifelines.count, lifelines.topSeverity),
            ...buildBundleFamilyCounters(lifelineFamilies),
          ]
        : [],
      signals: lifelines.count > 0
        ? [
            buildSignal('corridor-focus', 'Corridor Focus', joinAssetNames(lifelines.topAssets), lifelines.topSeverity),
            ...buildBundleDomainMixSignal(lifelineFamilies, lifelines.topSeverity),
          ]
        : [],
      domains: lifelineDomains,
    }, input.domainOverviews?.lifelines),
    medical: applyDomainOverview({
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
      trust: medical.count > 0 ? liveTrust : plannedTrust,
      counters: medical.count > 0
        ? [buildCounter('medical-sites', 'Sites', medical.count, medical.topSeverity)]
        : [],
      signals: medical.count > 0
        ? [buildSignal('medical-focus', 'Medical Focus', joinAssetNames(medical.topAssets), medical.topSeverity)]
        : [],
      domains: medical.count > 0
        ? buildBundleDomains(
            summarizeBundleFamilies('medical', input.assets, input.exposures),
            liveTrust,
          )
        : [],
    }, input.domainOverviews?.medical),
    'built-environment': applyDomainOverview({
      bundleId: 'built-environment',
      title: 'Built Environment',
      metric: builtEnvironment.count > 0
        ? `${builtEnvironment.count} building cluster${builtEnvironment.count === 1 ? '' : 's'} in elevated posture`
        : hasEvent
          ? `${topRegion} urban context aligned to current event`
          : 'Urban structural context on standby',
      detail: builtEnvironment.count > 0
        ? `${builtEnvironment.topAssets.map((asset) => asset.name).join(' and ')} require urban integrity review.`
        : hasEvent
          ? 'Built-environment overlays will intensify at city-tier as structural layers come online.'
          : 'City-tier built-environment overlays will activate once an operator focus event is selected.',
      severity: builtEnvironment.count > 0 ? builtEnvironment.topSeverity : input.operationalOverview.topSeverity,
      availability: builtEnvironment.count > 0 ? 'live' : 'planned',
      trust: builtEnvironment.count > 0 ? liveTrust : plannedTrust,
      counters: builtEnvironment.count > 0
        ? [
            buildCounter('building-clusters', 'Building Clusters', builtEnvironment.count, builtEnvironment.topSeverity),
            ...buildBundleFamilyCounters(builtEnvironmentFamilies),
          ]
        : [],
      signals: builtEnvironment.count > 0
        ? [
            buildSignal('urban-focus', 'Urban Focus', joinAssetNames(builtEnvironment.topAssets), builtEnvironment.topSeverity),
            ...buildBundleDomainMixSignal(builtEnvironmentFamilies, builtEnvironment.topSeverity),
          ]
        : hasEvent
          ? [buildSignal('activation-tier', 'Activation Tier', 'City-tier on operator focus', 'watch')]
          : [],
      domains: builtEnvironmentDomains,
    }, input.domainOverviews?.['built-environment']),
  };
}
