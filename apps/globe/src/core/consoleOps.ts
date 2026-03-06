import { earthquakeStore } from '../data/earthquakeStore';
import { computeIntensityGrid } from '../engine/gmpe';
import { OPS_ASSETS } from '../ops/assetCatalog';
import { selectOperationalFocusEvent } from '../ops/eventSelection';
import { buildAssetExposures } from '../ops/exposure';
import type { RealtimeSource, RealtimeStatus, ServiceReadModel } from '../ops/readModelTypes';
import { buildServiceReadModel } from '../ops/serviceReadModel';
import type { ViewportState as OpsViewportState } from '../ops/types';
import { buildOpsPriorities } from '../ops/priorities';
import type { EarthquakeEvent, IntensityGrid, TsunamiAssessment } from '../types';
import { deriveRealtimeStatus } from '../orchestration/realtimeOrchestrator';
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

const STALE_AFTER_MS = 60_000;

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
  const intensityGrid = selectedEvent
    ? computeIntensityGrid(
        { lat: selectedEvent.lat, lng: selectedEvent.lng },
        selectedEvent.magnitude,
        selectedEvent.depth_km,
        selectedEvent.faultType,
        0.1,
        3,
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
