import { earthquakeStore } from '../data/earthquakeStore';
import type { Vessel } from '../data/aisManager';
import { computeIntensityGrid } from '@namazue/ops/engine/gmpe';
import { OPS_ASSETS } from '@namazue/ops/ops/assetCatalog';
import { buildOperatorBundleSummaries } from '@namazue/ops/ops/bundleSummaries';
import { buildDefaultBundleDomainOverviews } from '@namazue/ops/ops/bundleDomainOverviews';
import { selectOperationalFocusEvent } from '@namazue/ops/ops/eventSelection';
import { buildAssetExposures } from '@namazue/ops/ops/exposure';
import type { OpsAsset, OpsAssetExposure } from '@namazue/ops/ops/types';
import type { RealtimeSource, RealtimeStatus, ServiceReadModel } from '@namazue/ops/ops/readModelTypes';
import { buildServiceReadModel } from '@namazue/ops/ops/serviceReadModel';
import type { ViewportState as OpsViewportState } from '@namazue/ops/ops/types';
import { buildOpsPriorities } from '@namazue/ops/ops/priorities';
import { buildMaritimeOverview } from '../ops/maritimeTelemetry';
import type { EarthquakeEvent, IntensityGrid, TsunamiAssessment } from '@namazue/ops/types';
import type { ViewportState as ConsoleViewportState } from './viewportManager';

export interface DeriveConsoleOperationalStateInput {
  now: number;
  events: EarthquakeEvent[];
  currentSelectedEventId: string | null;
  source: RealtimeSource;
  updatedAt: number;
  viewport: ConsoleViewportState;
}

export interface ConsoleOperationalState {
  mode: 'calm' | 'event';
  selectedEvent: EarthquakeEvent | null;
  intensityGrid: IntensityGrid | null;
  exposures: ReturnType<typeof buildAssetExposures>;
  priorities: ReturnType<typeof buildOpsPriorities>;
  readModel: ServiceReadModel;
  realtimeStatus: RealtimeStatus;
}

export function applyConsoleRealtimeError(input: {
  now: number;
  source: RealtimeSource;
  updatedAt: number;
  message: string;
  readModel: ServiceReadModel;
}): Pick<ConsoleOperationalState, 'readModel' | 'realtimeStatus'> {
  const realtimeStatus = deriveRealtimeStatus({
    source: input.source,
    updatedAt: input.updatedAt,
    now: input.now,
    staleAfterMs: STALE_AFTER_MS,
    fallbackActive: input.source !== 'server',
    networkError: input.message,
  });

  return {
    realtimeStatus,
    readModel: {
      ...input.readModel,
      freshnessStatus: realtimeStatus,
    },
  };
}

export function refreshConsoleBundleTruth(input: {
  readModel: ServiceReadModel;
  realtimeStatus: RealtimeStatus;
  selectedEvent: EarthquakeEvent | null;
  exposures: OpsAssetExposure[];
  vessels: Vessel[];
  assets: OpsAsset[];
}): ServiceReadModel {
  const baseReadModel = input.readModel;
  const currentEvent = input.selectedEvent ?? baseReadModel.currentEvent;
  const trustLevel = baseReadModel.systemHealth.level === 'degraded'
    ? 'degraded'
    : baseReadModel.systemHealth.level === 'watch'
      ? 'review'
      : 'confirmed';
  return {
    ...baseReadModel,
    currentEvent,
    bundleSummaries: buildOperatorBundleSummaries({
      selectedEvent: currentEvent,
      assets: input.assets,
      exposures: input.exposures,
      operationalOverview: baseReadModel.operationalOverview,
      maritimeOverview: buildMaritimeOverview(input.vessels),
      domainOverviews: buildDefaultBundleDomainOverviews({
        assets: input.assets,
        exposures: baseReadModel.nationalExposureSummary,
        priorities: baseReadModel.nationalPriorityQueue,
        trustLevel,
      }),
      trustLevel,
    }),
    freshnessStatus: input.realtimeStatus,
  };
}

const STALE_AFTER_MS = 60_000;

function deriveRealtimeStatus(input: {
  source: RealtimeSource;
  updatedAt: number;
  now: number;
  staleAfterMs: number;
  fallbackActive: boolean;
  networkError: string | null;
}): RealtimeStatus {
  if (input.networkError) {
    return {
      source: input.source,
      state: 'degraded',
      updatedAt: input.updatedAt,
      staleAfterMs: input.staleAfterMs,
      message: input.networkError,
    };
  }

  if (input.fallbackActive || input.source !== 'server') {
    return {
      source: input.source,
      state: 'degraded',
      updatedAt: input.updatedAt,
      staleAfterMs: input.staleAfterMs,
      message: 'Running on fallback realtime feed',
    };
  }

  const isStale = input.now - input.updatedAt > input.staleAfterMs;
  return {
    source: input.source,
    state: isStale ? 'stale' : 'fresh',
    updatedAt: input.updatedAt,
    staleAfterMs: input.staleAfterMs,
    message: isStale ? 'Realtime updates are delayed' : undefined,
  };
}

function classifyRegion(lat: number, lng: number): OpsViewportState['activeRegion'] {
  if (lat >= 42) return 'hokkaido';
  if (lat >= 37) return 'tohoku';
  if (lat >= 34.5 && lng >= 138) return 'kanto';
  if (lat >= 34 && lng >= 136) return 'chubu';
  if (lat >= 33.5 && lng >= 132.5) return 'kansai';
  if (lat >= 33 && lng >= 131) return 'chugoku';
  if (lat >= 32.5 && lng >= 133) return 'shikoku';
  return 'kyushu';
}

function toOpsViewportState(viewport: ConsoleViewportState): OpsViewportState {
  return {
    center: viewport.center,
    zoom: viewport.zoom,
    bounds: viewport.bounds,
    tier: viewport.tier,
    activeRegion: classifyRegion(viewport.center.lat, viewport.center.lng),
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

export function deriveConsoleOperationalState(
  input: DeriveConsoleOperationalStateInput,
): ConsoleOperationalState {
  earthquakeStore.upsert(input.events, {
    source: input.source === 'fallback' ? 'usgs' : input.source,
    issuedAt: input.updatedAt,
    receivedAt: input.now,
  });

  const events = [...earthquakeStore.getAll()];
  const focus = selectOperationalFocusEvent({
    now: input.now,
    currentSelectedEventId: input.currentSelectedEventId,
    candidates: events.map((event) => ({
      event,
      envelope: earthquakeStore.getEnvelope(event.id) ?? null,
      revisionHistory: [...earthquakeStore.getRevisionHistory(event.id)],
    })),
  });

  const selectedEvent = focus.selectedEventId
    ? earthquakeStore.get(focus.selectedEventId) ?? null
    : null;
  // Dynamic radius: large events need wider grids to avoid rectangular clipping
  const intensityRadiusDeg = selectedEvent
    ? (selectedEvent.magnitude >= 8.5 ? 8
      : selectedEvent.magnitude >= 8.0 ? 6
      : selectedEvent.magnitude >= 7.0 ? 4
      : 3)
    : 3;
  // Coarser grid for very large events to keep performance budget
  const intensitySpacing = intensityRadiusDeg >= 6 ? 0.15 : 0.1;

  const intensityGrid = selectedEvent
    ? computeIntensityGrid(
        { lat: selectedEvent.lat, lng: selectedEvent.lng },
        selectedEvent.magnitude,
        selectedEvent.depth_km,
        selectedEvent.faultType,
        intensitySpacing,
        intensityRadiusDeg,
      )
    : null;
  const tsunamiAssessment = quickTsunami(selectedEvent);
  const exposures = intensityGrid
    ? buildAssetExposures({ grid: intensityGrid, assets: OPS_ASSETS, tsunamiAssessment })
    : [];
  const priorities = selectedEvent
    ? buildOpsPriorities({ assets: OPS_ASSETS, exposures })
    : [];
  const realtimeStatus = deriveRealtimeStatus({
    source: input.source,
    updatedAt: input.updatedAt,
    now: input.now,
    staleAfterMs: STALE_AFTER_MS,
    fallbackActive: input.source !== 'server',
    networkError: null,
  });
  const viewport = toOpsViewportState(input.viewport);
  const readModel = buildServiceReadModel({
    selectedEvent,
    selectedEventEnvelope: selectedEvent ? earthquakeStore.getEnvelope(selectedEvent.id) ?? null : null,
    selectedEventRevisionHistory: selectedEvent ? [...earthquakeStore.getRevisionHistory(selectedEvent.id)] : [],
    selectionReason: focus.reason,
    tsunamiAssessment,
    impactResults: null,
    assets: OPS_ASSETS,
    viewport,
    exposures,
    priorities,
    freshnessStatus: realtimeStatus,
  });

  return {
    mode: selectedEvent ? 'event' : 'calm',
    selectedEvent,
    intensityGrid,
    exposures,
    priorities,
    readModel,
    realtimeStatus,
  };
}
