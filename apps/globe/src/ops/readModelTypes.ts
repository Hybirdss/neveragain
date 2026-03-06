import type { EarthquakeEvent, PrefectureImpact, TsunamiAssessment } from '../types';
import type { OpsAssetExposure, OpsPriority, OpsRegion, OpsSeverity, ViewportState } from './types';
import type {
  CanonicalEventConfidence,
  CanonicalEventSource,
  RevisionDivergenceSeverity,
} from '../data/eventEnvelope';
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
  divergenceSeverity: RevisionDivergenceSeverity;
  magnitudeSpread: number;
  depthSpreadKm: number;
  locationSpreadKm: number;
  tsunamiMismatch: boolean;
  faultTypeMismatch: boolean;
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

export type OperatorBundleId =
  | 'seismic'
  | 'maritime'
  | 'lifelines'
  | 'medical'
  | 'built-environment';

export type OperatorBundleTrust = 'confirmed' | 'review' | 'degraded' | 'pending';
export type ConsequenceTruthSource = 'backend-truth' | 'visual-heuristic';

export interface ConsequenceMetadata {
  source: ConsequenceTruthSource;
  confidence: CanonicalEventConfidence | 'pending';
  freshness: RealtimeStatus;
  reason: string;
}

export interface OperatorBundleCounter {
  id: string;
  label: string;
  value: number;
  tone: OpsSeverity;
}

export interface OperatorBundleSignal {
  id: string;
  label: string;
  value: string;
  tone: OpsSeverity;
}

export interface OperatorBundleDomain {
  id: string;
  label: string;
  metric: string;
  detail: string;
  severity: OpsSeverity;
  availability: 'live' | 'planned';
  trust: OperatorBundleTrust;
  counters: OperatorBundleCounter[];
  signals: OperatorBundleSignal[];
  consequence?: ConsequenceMetadata;
}

export interface OperatorBundleSummary {
  bundleId: OperatorBundleId;
  title: string;
  metric: string;
  detail: string;
  severity: OpsSeverity;
  availability: 'live' | 'planned';
  trust: OperatorBundleTrust;
  counters: OperatorBundleCounter[];
  signals: OperatorBundleSignal[];
  domains: OperatorBundleDomain[];
  consequence?: ConsequenceMetadata;
}

export interface OperatorBundleDomainOverview {
  metric: string;
  detail: string;
  severity: OpsSeverity;
  availability: 'live' | 'planned';
  trust: OperatorBundleTrust;
  counters: OperatorBundleCounter[];
  signals: OperatorBundleSignal[];
  domains?: OperatorBundleDomain[];
  consequence?: ConsequenceMetadata;
}

export type OperatorBundleDomainOverviews = Partial<Record<OperatorBundleId, OperatorBundleDomainOverview>>;

export type OperatorBundleSummaries = Partial<Record<OperatorBundleId, OperatorBundleSummary>>;

export interface OperatorPriority extends OpsPriority {
  consequence?: ConsequenceMetadata;
}

export interface ServiceReadModel {
  currentEvent: EarthquakeEvent | null;
  eventTruth: EventTruth | null;
  viewport: ViewportState | null;
  nationalSnapshot: OpsSnapshot | null;
  systemHealth: SystemHealthSummary;
  operationalOverview: OperationalOverview;
  bundleSummaries: OperatorBundleSummaries;
  nationalExposureSummary: OpsAssetExposure[];
  visibleExposureSummary: OpsAssetExposure[];
  nationalPriorityQueue: OperatorPriority[];
  visiblePriorityQueue: OperatorPriority[];
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
