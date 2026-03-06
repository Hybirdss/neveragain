import {
  buildAssetExposures,
  buildCanonicalEventEnvelope,
  buildOpsPriorities,
  buildServiceReadModel,
  computeIntensityGrid,
  createEmptyServiceReadModel,
  OPS_ASSETS,
  selectOperationalFocusEvent,
  type EarthquakeEvent,
  type IntensityGrid,
  type RealtimeSource,
  type RealtimeStatus,
  type ServiceReadModel,
  type TsunamiAssessment,
  type ViewportState,
} from '@namazue/ops';

const STALE_AFTER_MS = 60_000;

export interface BuildConsoleSnapshotInput {
  now: number;
  updatedAt: number;
  source: RealtimeSource;
  currentSelectedEventId: string | null;
  events: EarthquakeEvent[];
  viewport: ViewportState;
}

export interface ConsoleSnapshot {
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

function selectEvent(input: BuildConsoleSnapshotInput): EarthquakeEvent | null {
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

  return focus.selectedEventId
    ? input.events.find((event) => event.id === focus.selectedEventId) ?? null
    : null;
}

function buildIntensityGridForEvent(event: EarthquakeEvent | null): IntensityGrid | null {
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

export function buildConsoleSnapshot(input: BuildConsoleSnapshotInput): ConsoleSnapshot {
  const realtimeStatus = deriveRealtimeStatus({
    source: input.source,
    updatedAt: input.updatedAt,
    now: input.now,
  });
  const selectedEvent = selectEvent(input);
  const intensityGrid = buildIntensityGridForEvent(selectedEvent);
  const tsunamiAssessment = quickTsunami(selectedEvent);
  const exposures = intensityGrid
    ? buildAssetExposures({ grid: intensityGrid, assets: OPS_ASSETS, tsunamiAssessment })
    : [];
  const priorities = selectedEvent
    ? buildOpsPriorities({ assets: OPS_ASSETS, exposures })
    : [];

  if (!selectedEvent) {
    return {
      mode: 'calm',
      selectedEvent: null,
      intensityGrid: null,
      exposures,
      priorities,
      readModel: createEmptyServiceReadModel(realtimeStatus, input.viewport),
      realtimeStatus,
    };
  }

  const envelope = buildCanonicalEventEnvelope({
    event: selectedEvent,
    source: input.source === 'fallback' ? 'usgs' : input.source,
    issuedAt: input.updatedAt,
    receivedAt: input.now,
  });

  return {
    mode: 'event',
    selectedEvent,
    intensityGrid,
    exposures,
    priorities,
    readModel: buildServiceReadModel({
      selectedEvent,
      selectedEventEnvelope: envelope,
      selectedEventRevisionHistory: [envelope],
      selectionReason: input.currentSelectedEventId ? 'retain-current' : 'auto-select',
      tsunamiAssessment,
      impactResults: null,
      assets: OPS_ASSETS,
      viewport: input.viewport,
      exposures,
      priorities,
      freshnessStatus: realtimeStatus,
    }),
    realtimeStatus,
  };
}
