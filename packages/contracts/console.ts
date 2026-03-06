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

export interface ConsoleSnapshotDocument extends Omit<ConsoleSnapshot, 'replayMilestones' | 'scenarioDelta'> {
  contractVersion: typeof CONSOLE_CONTRACT_VERSION;
  replayMilestones: ReplayMilestone[];
  scenarioDelta: ScenarioDelta | null;
}

export function serializeConsoleSnapshot(snapshot: ConsoleSnapshot): ConsoleSnapshotDocument {
  return {
    contractVersion: CONSOLE_CONTRACT_VERSION,
    ...snapshot,
    events: snapshot.events.map((event) => ({
      ...event,
      place: { ...event.place },
    })),
    selectedEvent: snapshot.selectedEvent
      ? {
          ...snapshot.selectedEvent,
          place: { ...snapshot.selectedEvent.place },
        }
      : null,
    intensityGrid: snapshot.intensityGrid
      ? {
          ...snapshot.intensityGrid,
          center: { ...snapshot.intensityGrid.center },
          data: [...snapshot.intensityGrid.data],
        }
      : null,
    exposures: snapshot.exposures.map((entry) => ({
      ...entry,
      reasons: [...entry.reasons],
    })),
    priorities: snapshot.priorities.map((entry) => ({ ...entry })),
    readModel: {
      ...snapshot.readModel,
      currentEvent: snapshot.readModel.currentEvent
        ? {
            ...snapshot.readModel.currentEvent,
            place: { ...snapshot.readModel.currentEvent.place },
          }
        : null,
      eventTruth: snapshot.readModel.eventTruth
        ? {
            ...snapshot.readModel.eventTruth,
            sources: [...snapshot.readModel.eventTruth.sources],
          }
        : null,
      viewport: snapshot.readModel.viewport
        ? {
            ...snapshot.readModel.viewport,
            center: { ...snapshot.readModel.viewport.center },
            bounds: [...snapshot.readModel.viewport.bounds] as typeof snapshot.readModel.viewport.bounds,
          }
        : null,
      nationalSnapshot: snapshot.readModel.nationalSnapshot
        ? {
            ...snapshot.readModel.nationalSnapshot,
            topImpact: snapshot.readModel.nationalSnapshot.topImpact
              ? { ...snapshot.readModel.nationalSnapshot.topImpact }
              : null,
            tsunami: snapshot.readModel.nationalSnapshot.tsunami
              ? {
                  ...snapshot.readModel.nationalSnapshot.tsunami,
                  factors: [...snapshot.readModel.nationalSnapshot.tsunami.factors],
                }
              : null,
          }
        : null,
      systemHealth: {
        ...snapshot.readModel.systemHealth,
        flags: [...snapshot.readModel.systemHealth.flags],
      },
      operationalOverview: {
        ...snapshot.readModel.operationalOverview,
      },
      bundleSummaries: Object.fromEntries(
        Object.entries(snapshot.readModel.bundleSummaries).map(([bundleId, summary]) => [
          bundleId,
          summary
            ? {
                ...summary,
                counters: summary.counters.map((counter) => ({ ...counter })),
                signals: summary.signals.map((signal) => ({ ...signal })),
                domains: summary.domains.map((domain) => ({
                  ...domain,
                  counters: domain.counters.map((counter) => ({ ...counter })),
                  signals: domain.signals.map((signal) => ({ ...signal })),
                })),
              }
            : summary,
        ]),
      ),
      nationalExposureSummary: snapshot.readModel.nationalExposureSummary.map((entry) => ({
        ...entry,
        reasons: [...entry.reasons],
      })),
      visibleExposureSummary: snapshot.readModel.visibleExposureSummary.map((entry) => ({
        ...entry,
        reasons: [...entry.reasons],
      })),
      nationalPriorityQueue: snapshot.readModel.nationalPriorityQueue.map((entry) => ({ ...entry })),
      visiblePriorityQueue: snapshot.readModel.visiblePriorityQueue.map((entry) => ({ ...entry })),
      freshnessStatus: {
        ...snapshot.readModel.freshnessStatus,
      },
    },
    realtimeStatus: { ...snapshot.realtimeStatus },
    replayMilestones: (snapshot.replayMilestones ?? []).map((milestone) => ({ ...milestone })),
    scenarioDelta: snapshot.scenarioDelta
      ? {
          changeSummary: [...snapshot.scenarioDelta.changeSummary],
          exposureChanges: snapshot.scenarioDelta.exposureChanges.map((entry) => ({ ...entry })),
          priorityChanges: snapshot.scenarioDelta.priorityChanges.map((entry) => ({ ...entry })),
          reasons: [...snapshot.scenarioDelta.reasons],
        }
      : null,
    sourceMeta: { ...snapshot.sourceMeta },
  };
}
