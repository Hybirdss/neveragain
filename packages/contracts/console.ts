import type {
  CanonicalEventConfidence,
  CanonicalEventSource,
  EarthquakeEvent,
  IntensityGrid,
  OpsAssetExposure,
  OpsPriority,
  OpsRegion,
  OpsSeverity,
  PrefectureImpact,
  RevisionDivergenceSeverity,
  TsunamiAssessment,
  ViewportState,
} from '@namazue/kernel';
import type { ReplayMilestone } from './replay.ts';
import type { ScenarioDelta } from './scenario.ts';

export const CONSOLE_CONTRACT_VERSION = 'v1';

export type RealtimeSource = 'server' | 'usgs' | 'fallback';
export type RealtimeState = 'fresh' | 'stale' | 'degraded';
export type SelectedOperationalFocusReason =
  | 'no-significant-event'
  | 'auto-select'
  | 'retain-current'
  | 'escalate';

export type ConsoleMode = 'calm' | 'event';
export type OperatorBundleId =
  | 'seismic'
  | 'maritime'
  | 'lifelines'
  | 'medical'
  | 'built-environment';
export type OperatorBundleTrust = 'confirmed' | 'review' | 'degraded' | 'pending';

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
}

export type OperatorBundleDomainOverviews = Partial<Record<OperatorBundleId, OperatorBundleDomainOverview>>;
export type OperatorBundleSummaries = Partial<Record<OperatorBundleId, OperatorBundleSummary>>;

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
  nationalPriorityQueue: OpsPriority[];
  visiblePriorityQueue: OpsPriority[];
  freshnessStatus: RealtimeStatus;
}

export interface SerializedIntensityGrid extends Omit<IntensityGrid, 'data'> {
  data: number[];
}

export interface ConsoleSourceMeta {
  source: RealtimeSource;
  updatedAt: number;
}

export interface ConsoleSnapshot {
  events: EarthquakeEvent[];
  mode: ConsoleMode;
  selectedEvent: EarthquakeEvent | null;
  intensityGrid: SerializedIntensityGrid | null;
  exposures: OpsAssetExposure[];
  priorities: OpsPriority[];
  readModel: ServiceReadModel;
  realtimeStatus: RealtimeStatus;
  replayMilestones?: ReplayMilestone[];
  scenarioDelta?: ScenarioDelta | null;
  sourceMeta: ConsoleSourceMeta;
}
