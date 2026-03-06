import type { RealtimeSource, RealtimeStatus, ServiceReadModel } from '@namazue/contracts';
import {
  buildCanonicalEventEnvelope,
  selectOperationalFocusEvent,
  type CanonicalEventEnvelope,
  type SelectedOperationalFocusReason,
} from '@namazue/domain-earthquake';
import { buildAssetExposures, type OpsAsset } from '@namazue/domain-ops/exposure';
import { buildOpsPriorities } from '@namazue/domain-ops/priorities';
import type {
  EarthquakeEvent,
  FaultType,
  IntensityGrid,
  OpsAssetExposure,
  OpsPriority,
  TsunamiAssessment,
  ViewportState,
} from '@namazue/kernel';

const STALE_AFTER_MS = 60_000;

export interface BuildServiceReadModelInput {
  selectedEvent: EarthquakeEvent | null;
  selectedEventEnvelope?: CanonicalEventEnvelope | null;
  selectedEventRevisionHistory?: CanonicalEventEnvelope[];
  selectionReason?: SelectedOperationalFocusReason | null;
  tsunamiAssessment: TsunamiAssessment | null;
  impactResults: null;
  assets: OpsAsset[];
  viewport?: ViewportState | null;
  exposures: OpsAssetExposure[];
  priorities: OpsPriority[];
  freshnessStatus: RealtimeStatus;
}

export interface BuildConsoleSnapshotInput {
  now: number;
  updatedAt: number;
  source: RealtimeSource;
  currentSelectedEventId: string | null;
  events: EarthquakeEvent[];
  viewport: ViewportState;
  assets: OpsAsset[];
  computeIntensityGrid: (
    center: { lat: number; lng: number },
    magnitude: number,
    depthKm: number,
    faultType: FaultType,
    spacingDeg: number,
    radiusDeg: number,
  ) => IntensityGrid;
  buildServiceReadModel: (input: BuildServiceReadModelInput) => ServiceReadModel;
  createEmptyServiceReadModel: (
    freshnessStatus: RealtimeStatus,
    viewport?: ViewportState | null,
  ) => ServiceReadModel;
}

export interface BuiltConsoleSnapshot {
  mode: 'calm' | 'event';
  selectedEvent: EarthquakeEvent | null;
  intensityGrid: IntensityGrid | null;
  exposures: ReturnType<typeof buildAssetExposures>;
  priorities: ReturnType<typeof buildOpsPriorities>;
  readModel: ServiceReadModel;
  realtimeStatus: RealtimeStatus;
}

function deriveRealtimeStatus(input: {
  source: RealtimeSource;
  updatedAt: number;
  now: number;
}): RealtimeStatus {
  if (input.source !== 'server') {
    return {
      source: input.source,
      state: 'degraded',
      updatedAt: input.updatedAt,
      staleAfterMs: STALE_AFTER_MS,
      message: 'Running on fallback realtime feed',
    };
  }

  const isStale = input.now - input.updatedAt > STALE_AFTER_MS;
  return {
    source: input.source,
    state: isStale ? 'stale' : 'fresh',
    updatedAt: input.updatedAt,
    staleAfterMs: STALE_AFTER_MS,
    message: isStale ? 'Realtime updates are delayed' : undefined,
  };
}

function quickTsunami(event: EarthquakeEvent | null): TsunamiAssessment | null {
  if (!event) return null;
  if (!event.tsunami && event.magnitude < 6.5) return null;

  const risk: TsunamiAssessment['risk'] = event.tsunami
    ? (event.magnitude >= 7.5 ? 'high' : event.magnitude >= 6.5 ? 'moderate' : 'low')
    : 'low';

  return {
    risk,
    confidence: event.tsunami ? 'high' : 'medium',
    factors: event.tsunami ? ['event tsunami flag'] : ['magnitude-based estimate'],
    locationType: 'offshore',
    coastDistanceKm: null,
    faultType: event.faultType,
  };
}

function selectEvent(input: BuildConsoleSnapshotInput): {
  selectedEvent: EarthquakeEvent | null;
  selectionReason: SelectedOperationalFocusReason | null;
  selectedEventEnvelope: CanonicalEventEnvelope | null;
} {
  const candidates = input.events.map((event) => {
    const envelope = buildCanonicalEventEnvelope({
      event,
      source: input.source === 'fallback' ? 'usgs' : input.source,
      issuedAt: input.updatedAt,
      receivedAt: input.now,
    });

    return {
      event,
      envelope,
      revisionHistory: [envelope],
    };
  });

  const focus = selectOperationalFocusEvent({
    now: input.now,
    currentSelectedEventId: input.currentSelectedEventId,
    candidates,
  });

  const selectedEvent = focus.selectedEventId
    ? input.events.find((event) => event.id === focus.selectedEventId) ?? null
    : null;

  return {
    selectedEvent,
    selectionReason: selectedEvent ? focus.reason : null,
    selectedEventEnvelope: selectedEvent
      ? buildCanonicalEventEnvelope({
          event: selectedEvent,
          source: input.source === 'fallback' ? 'usgs' : input.source,
          issuedAt: input.updatedAt,
          receivedAt: input.now,
        })
      : null,
  };
}

function buildIntensityGridForEvent(
  event: EarthquakeEvent | null,
  computeIntensityGrid: BuildConsoleSnapshotInput['computeIntensityGrid'],
): IntensityGrid | null {
  if (!event) {
    return null;
  }

  const radiusDeg = event.magnitude >= 8.5
    ? 8
    : event.magnitude >= 8.0
      ? 6
      : event.magnitude >= 7.0
        ? 4
        : 3;
  const spacingDeg = radiusDeg >= 6 ? 0.15 : 0.1;

  return computeIntensityGrid(
    { lat: event.lat, lng: event.lng },
    event.magnitude,
    event.depth_km,
    event.faultType,
    spacingDeg,
    radiusDeg,
  );
}

export function buildConsoleSnapshot(input: BuildConsoleSnapshotInput): BuiltConsoleSnapshot {
  const realtimeStatus = deriveRealtimeStatus({
    source: input.source,
    updatedAt: input.updatedAt,
    now: input.now,
  });
  const selected = selectEvent(input);
  const intensityGrid = buildIntensityGridForEvent(selected.selectedEvent, input.computeIntensityGrid);
  const tsunamiAssessment = quickTsunami(selected.selectedEvent);
  const exposures = intensityGrid
    ? buildAssetExposures({ grid: intensityGrid, assets: input.assets, tsunamiAssessment })
    : [];
  const priorities = selected.selectedEvent
    ? buildOpsPriorities({ assets: input.assets, exposures })
    : [];

  if (!selected.selectedEvent) {
    return {
      mode: 'calm',
      selectedEvent: null,
      intensityGrid: null,
      exposures,
      priorities,
      readModel: input.createEmptyServiceReadModel(realtimeStatus, input.viewport),
      realtimeStatus,
    };
  }

  return {
    mode: 'event',
    selectedEvent: selected.selectedEvent,
    intensityGrid,
    exposures,
    priorities,
    readModel: input.buildServiceReadModel({
      selectedEvent: selected.selectedEvent,
      selectedEventEnvelope: selected.selectedEventEnvelope,
      selectedEventRevisionHistory: selected.selectedEventEnvelope ? [selected.selectedEventEnvelope] : [],
      selectionReason: selected.selectionReason,
      tsunamiAssessment,
      impactResults: null,
      assets: input.assets,
      viewport: input.viewport,
      exposures,
      priorities,
      freshnessStatus: realtimeStatus,
    }),
    realtimeStatus,
  };
}
