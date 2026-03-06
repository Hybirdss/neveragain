import type { EarthquakeEvent, PrefectureImpact, TsunamiAssessment } from '../types';
import type { OpsAssetExposure, OpsPriority } from './types';

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

export interface ServiceReadModel {
  currentEvent: EarthquakeEvent | null;
  opsSnapshot: OpsSnapshot | null;
  assetExposureSummary: OpsAssetExposure[];
  priorityQueue: OpsPriority[];
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
