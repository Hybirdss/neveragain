import type {
  EarthquakeEvent,
  PrefectureImpact,
  TsunamiAssessment,
} from '../types';
import type { OpsSnapshot, RealtimeStatus, ServiceReadModel } from './readModelTypes';
import type { OpsAssetExposure, OpsPriority, ViewportState } from './types';

export interface BuildServiceReadModelInput {
  selectedEvent: EarthquakeEvent | null;
  tsunamiAssessment: TsunamiAssessment | null;
  impactResults: PrefectureImpact[] | null;
  viewport?: ViewportState | null;
  exposures: OpsAssetExposure[];
  priorities: OpsPriority[];
  visibleAssetIds?: string[];
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

function filterVisibleExposures(
  exposures: OpsAssetExposure[],
  visibleAssetIds?: string[],
): OpsAssetExposure[] {
  if (!visibleAssetIds) {
    return exposures;
  }

  const visible = new Set(visibleAssetIds);
  return exposures.filter((entry) => visible.has(entry.assetId));
}

function filterVisiblePriorities(
  priorities: OpsPriority[],
  visibleAssetIds?: string[],
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

  return {
    currentEvent: input.selectedEvent,
    viewport: input.viewport ?? null,
    nationalSnapshot: buildOpsSnapshot(input),
    nationalExposureSummary,
    visibleExposureSummary: filterVisibleExposures(input.exposures, input.visibleAssetIds),
    nationalPriorityQueue,
    visiblePriorityQueue: filterVisiblePriorities(input.priorities, input.visibleAssetIds),
    freshnessStatus: input.freshnessStatus,
  };
}
