import type { EarthquakeEvent, PrefectureImpact, TsunamiAssessment } from '../types';
import type { OpsAssetExposure, OpsPriority, OpsRegion, OpsSeverity, ViewportState } from './types';
import type { CanonicalEventConfidence, CanonicalEventSource } from '../data/eventEnvelope';
import type { SelectedOperationalFocusReason } from './eventSelection';

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
  revisionCount: number;
  sources: CanonicalEventSource[];
  hasConflictingRevision: boolean;
}

export interface SystemHealthSummary {
  level: 'nominal' | 'watch' | 'degraded';
  headline: string;
  detail: string;
  flags: string[];
}

export interface OperationalOverview {
  selectionReason: SelectedOperationalFocusReason | null;
  selectionSummary: string;
  impactSummary: string;
  visibleAffectedAssetCount: number;
  nationalAffectedAssetCount: number;
  topRegion: OpsRegion | null;
  topSeverity: OpsSeverity;
}

export interface ServiceReadModel {
  currentEvent: EarthquakeEvent | null;
  eventTruth: EventTruth | null;
  viewport: ViewportState | null;
  nationalSnapshot: OpsSnapshot | null;
  systemHealth: SystemHealthSummary;
  operationalOverview: OperationalOverview;
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
