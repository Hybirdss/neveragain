import type {
  EarthquakeEvent,
  PrefectureImpact,
  TsunamiAssessment,
} from '../types';
import {
  analyzeEventRevisionHistory,
  type CanonicalEventEnvelope,
  type CanonicalEventSource,
} from '../data/eventEnvelope';
import type {
  EventTruth,
  OperatorBundleDomainOverviews,
  OperationalOverview,
  OpsSnapshot,
  RealtimeStatus,
  ServiceReadModel,
  SystemHealthSummary,
} from './readModelTypes';
import type { OpsAsset, OpsAssetExposure, OpsPriority, OpsRegion, OpsSeverity, ViewportState } from './types';
import { filterVisibleOpsAssets } from './viewport';
import type { SelectedOperationalFocusReason } from './eventSelection';
import {
  buildOperatorBundleSummaries,
  type MaritimeTelemetryOverview,
} from './bundleSummaries';
import { buildDefaultBundleDomainOverviews } from './bundleDomainOverviews';
import {
  formatElevatedAssetSummary,
  formatSourceLabel,
  operatorText,
} from './operatorLocale';

export interface BuildServiceReadModelInput {
  selectedEvent: EarthquakeEvent | null;
  selectedEventEnvelope?: CanonicalEventEnvelope | null;
  selectedEventRevisionHistory?: CanonicalEventEnvelope[];
  selectionReason?: SelectedOperationalFocusReason | null;
  tsunamiAssessment: TsunamiAssessment | null;
  impactResults: PrefectureImpact[] | null;
  assets: OpsAsset[];
  viewport?: ViewportState | null;
  exposures: OpsAssetExposure[];
  priorities: OpsPriority[];
  maritimeOverview?: MaritimeTelemetryOverview | null;
  domainOverviews?: OperatorBundleDomainOverviews;
  freshnessStatus: RealtimeStatus;
}

function buildSystemHealth(
  freshnessStatus: RealtimeStatus,
  eventTruth: EventTruth | null,
): SystemHealthSummary {
  const flags: string[] = [];

  if (freshnessStatus.source !== 'server') {
    flags.push('fallback-feed');
  }
  if (freshnessStatus.state === 'stale') {
    flags.push('stale-feed');
  }
  if (eventTruth?.hasConflictingRevision) {
    flags.push('revision-conflict');
  }
  if (eventTruth?.divergenceSeverity === 'material') {
    flags.push('material-divergence');
  }
  if (eventTruth?.confidence === 'low') {
    flags.push('low-confidence-truth');
  }

  const divergenceSummary = eventTruth
    ? buildDivergenceSummary(eventTruth)
    : null;

  if (freshnessStatus.state === 'degraded') {
    return {
      level: 'degraded',
      headline: operatorText('health.degradedHeadline'),
      detail: freshnessStatus.message ?? operatorText('health.degradedDetail'),
      flags,
    };
  }

  if (flags.includes('material-divergence')) {
    return {
      level: 'watch',
      headline: operatorText('health.materialHeadline'),
      detail: divergenceSummary ?? operatorText('health.materialDetail'),
      flags,
    };
  }

  if (flags.includes('revision-conflict') || freshnessStatus.state === 'stale' || flags.includes('low-confidence-truth')) {
    return {
      level: 'watch',
      headline: flags.includes('revision-conflict')
        ? operatorText('health.conflictHeadline')
        : flags.includes('low-confidence-truth')
          ? operatorText('health.lowConfidenceHeadline')
        : operatorText('health.staleHeadline'),
      detail: flags.includes('revision-conflict')
        ? divergenceSummary ?? operatorText('health.conflictDetail', {
          count: eventTruth?.revisionCount ?? 0,
          sources: (eventTruth?.sources ?? []).map((source) => formatSourceLabel(source)).join('/'),
        })
        : flags.includes('low-confidence-truth')
          ? operatorText('health.lowConfidenceDetail', {
            source: eventTruth?.source ? formatSourceLabel(eventTruth.source) : operatorText('health.feed'),
          })
        : freshnessStatus.message ?? operatorText('health.staleDetail'),
      flags,
    };
  }

  return {
    level: 'nominal',
    headline: operatorText('health.nominalHeadline'),
    detail: operatorText('health.nominalDetail'),
    flags,
  };
}

function buildDivergenceSummary(eventTruth: EventTruth): string | null {
  if (eventTruth.divergenceSeverity === 'none' && !eventTruth.hasConflictingRevision) {
    return null;
  }

  const parts: string[] = [];
  if (eventTruth.magnitudeSpread > 0) {
    parts.push(`magnitude spread ${eventTruth.magnitudeSpread.toFixed(1)}`);
  }
  if (eventTruth.depthSpreadKm > 0) {
    parts.push(`depth spread ${Math.round(eventTruth.depthSpreadKm)} km`);
  }
  if (eventTruth.locationSpreadKm > 0) {
    parts.push(`location spread ${Math.round(eventTruth.locationSpreadKm)} km`);
  }
  if (eventTruth.tsunamiMismatch) {
    parts.push('tsunami posture mismatch');
  }
  if (eventTruth.faultTypeMismatch) {
    parts.push('fault type mismatch');
  }

  if (parts.length === 0) {
    return operatorText('health.conflictDetail', {
      count: eventTruth.revisionCount,
      sources: eventTruth.sources.map((source) => formatSourceLabel(source)).join('/'),
    });
  }

  return operatorText('health.divergenceDetail', {
    count: eventTruth.revisionCount,
    sources: eventTruth.sources.map((source) => formatSourceLabel(source)).join('/'),
    details: parts.join(', '),
  });
}

function severityRank(severity: OpsSeverity): number {
  switch (severity) {
    case 'critical': return 3;
    case 'priority': return 2;
    case 'watch': return 1;
    case 'clear': return 0;
  }
}

function getAffectedEntries(exposures: OpsAssetExposure[]): OpsAssetExposure[] {
  return exposures.filter((entry) => entry.severity !== 'clear');
}

function getTopRegion(
  exposures: OpsAssetExposure[],
  assets: OpsAsset[],
): OpsRegion | null {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const sorted = [...getAffectedEntries(exposures)].sort((left, right) =>
    severityRank(right.severity) - severityRank(left.severity) || right.score - left.score,
  );

  return sorted.length > 0
    ? assetById.get(sorted[0]!.assetId)?.region ?? null
    : null;
}

function getTopSeverity(exposures: OpsAssetExposure[]): OpsSeverity {
  return getAffectedEntries(exposures).reduce<OpsSeverity>(
    (best, entry) => severityRank(entry.severity) > severityRank(best) ? entry.severity : best,
    'clear',
  );
}

function buildSelectionSummary(reason: SelectedOperationalFocusReason | null, hasEvent: boolean): string {
  if (!hasEvent) {
    return operatorText('ops.noSignificantEvent');
  }

  switch (reason) {
    case 'auto-select':
      return operatorText('ops.autoSelect');
    case 'retain-current':
      return operatorText('ops.retainCurrent');
    case 'escalate':
      return operatorText('ops.escalate');
    case 'no-significant-event':
    case null:
      return operatorText('ops.active');
  }
}

function buildImpactSummary(
  visibleCount: number,
  nationalCount: number,
  hasViewport: boolean,
): string {
  if (!hasViewport) {
    if (nationalCount > 0) {
      return formatElevatedAssetSummary(nationalCount, 'national');
    }
    return operatorText('ops.noneElevated');
  }

  if (visibleCount > 0) {
    return formatElevatedAssetSummary(visibleCount, 'visible');
  }
  if (nationalCount > 0) {
    return formatElevatedAssetSummary(nationalCount, 'national');
  }
  return operatorText('ops.noneElevated');
}

function buildOperationalOverview(input: {
  selectionReason: SelectedOperationalFocusReason | null;
  assets: OpsAsset[];
  nationalExposureSummary: OpsAssetExposure[];
  visibleExposureSummary: OpsAssetExposure[];
  hasEvent: boolean;
  hasViewport: boolean;
}): OperationalOverview {
  const visibleAffected = getAffectedEntries(input.visibleExposureSummary);
  const nationalAffected = getAffectedEntries(input.nationalExposureSummary);

  return {
    selectionReason: input.selectionReason,
    selectionSummary: buildSelectionSummary(input.selectionReason, input.hasEvent),
    impactSummary: buildImpactSummary(
      visibleAffected.length,
      nationalAffected.length,
      input.hasViewport,
    ),
    visibleAffectedAssetCount: visibleAffected.length,
    nationalAffectedAssetCount: nationalAffected.length,
    topRegion: getTopRegion(
      visibleAffected.length > 0 ? visibleAffected : nationalAffected,
      input.assets,
    ),
    topSeverity: getTopSeverity(visibleAffected.length > 0 ? visibleAffected : nationalAffected),
  };
}

export function createEmptyServiceReadModel(
  freshnessStatus: RealtimeStatus,
  viewport: ViewportState | null = null,
): ServiceReadModel {
  const systemHealth = buildSystemHealth(freshnessStatus, null);
  return {
    currentEvent: null,
    eventTruth: null,
    viewport,
    nationalSnapshot: null,
    systemHealth,
    operationalOverview: {
      selectionReason: null,
      selectionSummary: operatorText('ops.noSignificantEvent'),
      impactSummary: operatorText('ops.noneElevated'),
      visibleAffectedAssetCount: 0,
      nationalAffectedAssetCount: 0,
      topRegion: null,
      topSeverity: 'clear',
    },
    bundleSummaries: buildOperatorBundleSummaries({
      selectedEvent: null,
      assets: [],
      exposures: [],
      operationalOverview: {
        selectionReason: null,
        selectionSummary: 'No operationally significant event selected',
        impactSummary: 'No assets in elevated posture',
        visibleAffectedAssetCount: 0,
        nationalAffectedAssetCount: 0,
        topRegion: null,
        topSeverity: 'clear',
      },
      maritimeOverview: null,
      trustLevel: 'confirmed',
    }),
    nationalExposureSummary: [],
    visibleExposureSummary: [],
    nationalPriorityQueue: [],
    visiblePriorityQueue: [],
    freshnessStatus,
  };
}

function buildOpsSnapshot(input: BuildServiceReadModelInput): OpsSnapshot | null {
  const event = input.selectedEvent;
  if (!event) {
    return null;
  }

  const topImpact = input.impactResults?.[0] ?? null;
  const topPriority = input.priorities[0] ?? null;
  const tsunamiRisk = input.tsunamiAssessment?.risk ?? 'pending';

  return {
    title: event.place.text,
    summary: `${event.place.text} M${event.magnitude.toFixed(1)} event. Tsunami posture ${tsunamiRisk}.`,
    headline: topPriority?.title ?? null,
    tsunami: input.tsunamiAssessment,
    topImpact,
  };
}

function buildEventTruth(
  envelope: CanonicalEventEnvelope | null | undefined,
  history: CanonicalEventEnvelope[] | undefined,
): EventTruth | null {
  if (!envelope) {
    return null;
  }

  const revisionHistory = history && history.length > 0
    ? history.some((entry) => entry.revision === envelope.revision)
      ? history
      : [...history, envelope]
    : [envelope];
  const sources = Array.from(
    new Set(revisionHistory.map((entry) => entry.source)),
  ) as CanonicalEventSource[];
  const divergence = analyzeEventRevisionHistory(revisionHistory);

  return {
    source: envelope.source,
    revision: envelope.revision,
    issuedAt: envelope.issuedAt,
    receivedAt: envelope.receivedAt,
    observedAt: envelope.observedAt,
    supersedes: envelope.supersedes,
    confidence: envelope.confidence,
    revisionCount: revisionHistory.length,
    sources,
    hasConflictingRevision: sources.length > 1,
    divergenceSeverity: divergence.divergenceSeverity,
    magnitudeSpread: divergence.magnitudeSpread,
    depthSpreadKm: divergence.depthSpreadKm,
    locationSpreadKm: divergence.locationSpreadKm,
    tsunamiMismatch: divergence.tsunamiMismatch,
    faultTypeMismatch: divergence.faultTypeMismatch,
  };
}

function deriveVisibleAssetIds(
  assets: OpsAsset[],
  viewport: ViewportState | null | undefined,
): string[] | null {
  if (!viewport) {
    return null;
  }

  return filterVisibleOpsAssets(assets, viewport).map((asset) => asset.id);
}

function filterVisibleExposures(
  exposures: OpsAssetExposure[],
  visibleAssetIds: string[] | null,
): OpsAssetExposure[] {
  if (!visibleAssetIds) {
    return exposures;
  }

  const visible = new Set(visibleAssetIds);
  return exposures.filter((entry) => visible.has(entry.assetId));
}

function filterVisiblePriorities(
  priorities: OpsPriority[],
  visibleAssetIds: string[] | null,
): OpsPriority[] {
  if (!visibleAssetIds) {
    return priorities;
  }

  const visible = new Set(visibleAssetIds);
  return priorities.filter((entry) => entry.assetId !== null && visible.has(entry.assetId));
}

export function buildServiceReadModel(input: BuildServiceReadModelInput): ServiceReadModel {
  const nationalExposureSummary = input.exposures;
  const nationalPriorityQueue = input.priorities;
  const visibleAssetIds = deriveVisibleAssetIds(input.assets, input.viewport);
  const eventTruth = buildEventTruth(input.selectedEventEnvelope, input.selectedEventRevisionHistory);
  const visibleExposureSummary = filterVisibleExposures(input.exposures, visibleAssetIds);
  const visiblePriorityQueue = filterVisiblePriorities(input.priorities, visibleAssetIds);
  const operationalOverview = buildOperationalOverview({
    selectionReason: input.selectionReason ?? null,
    assets: input.assets,
    nationalExposureSummary,
    visibleExposureSummary,
    hasEvent: input.selectedEvent !== null,
    hasViewport: Boolean(input.viewport),
  });
  const systemHealth = buildSystemHealth(input.freshnessStatus, eventTruth);
  const trustLevel = systemHealth.level === 'degraded'
    ? 'degraded'
    : systemHealth.level === 'watch'
      ? 'review'
      : 'confirmed';
  const bundleDomainOverviews = {
    ...buildDefaultBundleDomainOverviews({
      assets: input.assets,
      exposures: nationalExposureSummary,
      priorities: nationalPriorityQueue,
      trustLevel,
    }),
    ...input.domainOverviews,
  };

  return {
    currentEvent: input.selectedEvent,
    eventTruth,
    viewport: input.viewport ?? null,
    nationalSnapshot: buildOpsSnapshot(input),
    systemHealth,
    operationalOverview,
    bundleSummaries: buildOperatorBundleSummaries({
      selectedEvent: input.selectedEvent,
      assets: input.assets,
      exposures: input.exposures,
      operationalOverview,
      maritimeOverview: input.maritimeOverview ?? null,
      domainOverviews: bundleDomainOverviews,
      trustLevel,
    }),
    nationalExposureSummary,
    visibleExposureSummary,
    nationalPriorityQueue,
    visiblePriorityQueue,
    freshnessStatus: input.freshnessStatus,
  };
}
