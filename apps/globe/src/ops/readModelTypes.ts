import type { EarthquakeEvent, PrefectureImpact, TsunamiAssessment } from '../types';
import type { OpsAssetExposure, OpsPriority, ViewportState } from './types';
import type { CanonicalEventConfidence, CanonicalEventSource } from '../data/eventEnvelope';

export type RealtimeSource = 'server' | 'usgs' | 'fallback';
export type RealtimeState = 'fresh' | 'stale' | 'degraded';

export interface RealtimeStatus {
  source: RealtimeSource;
  state: RealtimeState;
  updatedAt: number;
  staleAfterMs: number;
  message?: string;
}

export interface OpsSnapshot {
  title: string;
  summary: string;
  headline: string | null;
  tsunami: TsunamiAssessment | null;
  topImpact: PrefectureImpact | null;
}

export interface EventTruth {
  source: CanonicalEventSource;
  revision: string;
  issuedAt: number;
  receivedAt: number;
  observedAt: number;
  supersedes: string | null;
  confidence: CanonicalEventConfidence;
}

export interface ServiceReadModel {
  currentEvent: EarthquakeEvent | null;
  eventTruth: EventTruth | null;
  viewport: ViewportState | null;
  nationalSnapshot: OpsSnapshot | null;
  nationalExposureSummary: OpsAssetExposure[];
  visibleExposureSummary: OpsAssetExposure[];
  nationalPriorityQueue: OpsPriority[];
  visiblePriorityQueue: OpsPriority[];
  freshnessStatus: RealtimeStatus;
}

export interface ReplayMilestone {
  kind: 'event_locked' | 'impact_ready' | 'tsunami_ready' | 'exposure_ready' | 'priorities_published';
  at: number;
  label: string;
}

export interface ScenarioDelta {
  changeSummary: string[];
  exposureChanges: Array<{ assetId: string; from: string; to: string }>;
  priorityChanges: Array<{ id: string; from: number; to: number }>;
  reasons: string[];
}
