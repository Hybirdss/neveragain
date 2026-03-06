import type {
  EarthquakeEvent,
  PrefectureImpact,
  TsunamiAssessment,
} from '../types';
import type { CanonicalEventEnvelope, CanonicalEventSource } from '../data/eventEnvelope';
import type { EventTruth, OpsSnapshot, RealtimeStatus, ServiceReadModel } from './readModelTypes';
import type { OpsAsset, OpsAssetExposure, OpsPriority, ViewportState } from './types';
import { filterVisibleOpsAssets } from './viewport';

export interface BuildServiceReadModelInput {
  selectedEvent: EarthquakeEvent | null;
  selectedEventEnvelope?: CanonicalEventEnvelope | null;
  selectedEventRevisionHistory?: CanonicalEventEnvelope[];
  tsunamiAssessment: TsunamiAssessment | null;
  impactResults: PrefectureImpact[] | null;
  assets: OpsAsset[];
  viewport?: ViewportState | null;
  exposures: OpsAssetExposure[];
  priorities: OpsPriority[];
  freshnessStatus: RealtimeStatus;
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

  return {
    currentEvent: input.selectedEvent,
    eventTruth: buildEventTruth(input.selectedEventEnvelope, input.selectedEventRevisionHistory),
    viewport: input.viewport ?? null,
    nationalSnapshot: buildOpsSnapshot(input),
    nationalExposureSummary,
    visibleExposureSummary: filterVisibleExposures(input.exposures, visibleAssetIds),
    nationalPriorityQueue,
    visiblePriorityQueue: filterVisiblePriorities(input.priorities, visibleAssetIds),
    freshnessStatus: input.freshnessStatus,
  };
}
