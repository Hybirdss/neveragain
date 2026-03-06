import type {
  EarthquakeEvent,
  PrefectureImpact,
  TsunamiAssessment,
} from '../types';
import type { OpsSnapshot, RealtimeStatus, ServiceReadModel } from './readModelTypes';
import type { OpsAssetExposure, OpsPriority } from './types';

export interface BuildServiceReadModelInput {
  selectedEvent: EarthquakeEvent | null;
  tsunamiAssessment: TsunamiAssessment | null;
  impactResults: PrefectureImpact[] | null;
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

export function buildServiceReadModel(input: BuildServiceReadModelInput): ServiceReadModel {
  return {
    currentEvent: input.selectedEvent,
    opsSnapshot: buildOpsSnapshot(input),
    assetExposureSummary: input.exposures,
    priorityQueue: input.priorities,
    freshnessStatus: input.freshnessStatus,
  };
}
