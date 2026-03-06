import { earthquakeStore } from '../data/earthquakeStore';
import type { Vessel } from '../data/aisManager';
import { computeIntensityGrid } from '../engine/gmpe';
import { OPS_ASSETS } from '../ops/assetCatalog';
import { buildOperatorBundleSummaries } from '../ops/bundleSummaries';
import { buildDefaultBundleDomainOverviews } from '../ops/bundleDomainOverviews';
import { selectOperationalFocusEvent, type SelectedOperationalFocus } from '../ops/eventSelection';
import { buildAssetExposures } from '../ops/exposure';
import type { OpsAsset, OpsAssetExposure } from '../ops/types';
import type { RealtimeSource, RealtimeStatus, ServiceReadModel } from '../ops/readModelTypes';
import { buildServiceReadModel } from '../ops/serviceReadModel';
import type { ViewportState as OpsViewportState } from '../ops/types';
import { buildOpsPriorities } from '../ops/priorities';
import { buildMaritimeOverview } from '../ops/maritimeTelemetry';
import type { ActiveFault, EarthquakeEvent, FaultType, IntensityGrid, TsunamiAssessment } from '../types';
import { deriveRealtimeStatus } from '../orchestration/realtimeOrchestrator';
import type { ViewportState as ConsoleViewportState } from './viewportManager';

export interface DeriveConsoleOperationalStateInput {
  now: number;
  events: EarthquakeEvent[];
  currentSelectedEventId: string | null;
  /** When true, currentSelectedEventId is an explicit user click — bypass ops focus scoring */
  forceSelection?: boolean;
  source: RealtimeSource;
  updatedAt: number;
  viewport: ConsoleViewportState;
  faults?: ActiveFault[];
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

// ── Fault Strike Estimation ───────────────────────────────────
//
// For the finite-fault distance correction, we need the dominant fault
// strike direction. For scenario events we compute it directly from
// fault geometry. For real-time events we estimate from regional
// subduction/fault architecture.
//
// Subduction trench orientations derived from the USGS Slab2 model:
//   Hayes, G.P. et al. (2018). "Slab2, a comprehensive subduction zone
//   geometry model." Science 362(6410):58-61. doi:10.1126/science.aat4723
//
// Representative slab contour azimuths (computed from Slab2 iso-depth lines):
//   Japan Trench (Pacific plate, ~36-41°N): ~195° (≡ 15° NNE)
//   Nankai Trough (Philippine Sea plate, ~32-34°N): ~245° (≡ 65° ENE)
//   Ryukyu Trench (~24-30°N): ~220° (≡ 40° NE)
//
// Crustal fault trends from the GSI Active Fault Database (国土地理院活断層データベース)
// and HERP long-term probability assessments (地震調査研究推進本部).

const DEG_TO_RAD = Math.PI / 180;

function computeStrikeFromSegments(segments: [number, number][]): number {
  const first = segments[0];
  const last = segments[segments.length - 1];
  const dLng = last[0] - first[0];
  const dLat = last[1] - first[1];
  const cosLat = Math.cos(first[1] * DEG_TO_RAD);
  const azimuthRad = Math.atan2(dLng * cosLat, dLat);
  return ((azimuthRad * 180 / Math.PI) + 360) % 360;
}

/**
 * Estimate dominant fault strike from regional tectonics.
 *
 * Subduction zone strikes from Slab2 iso-depth contour azimuths (Hayes 2018).
 * Crustal fault trends from GSI Active Fault DB + HERP probability assessments.
 */
function estimateRegionalStrike(lat: number, lng: number, faultType: FaultType): number {
  if (faultType === 'interface' || faultType === 'intraslab') {
    // Slab2 contour azimuths:
    //   Japan Trench: iso-depth lines trend ~15° (NNE) at 36-41°N, 140-145°E
    //   Nankai Trough: iso-depth lines trend ~65° (ENE) at 32-34°N, 132-137°E
    //   Ryukyu Trench: iso-depth lines trend ~40° (NE) at 24-31°N, 123-130°E
    if (lng >= 140) return 15;
    if (lat < 31) return 40;
    return 65;
  }

  // Crustal fault trends (GSI/HERP):
  //   Sagami Trough region (~35°N, 139°E): ~N140°E (NW-SE)
  //     — Sagami Trough strikes approximately NW-SE (GSI)
  //   Median Tectonic Line (~34°N, 132-136°E): ~N80°E (≈E-W)
  //     — MTL strikes roughly E-W across Shikoku-Kii (HERP)
  //   Tohoku inland faults (>37°N): ~N20°E (NNE-SSW)
  //     — Parallel to the volcanic arc (GSI fault traces)
  //   Kyushu faults (<33°N): ~N50°E (NE-SW)
  //     — Beppu-Shimabara graben system (HERP)
  if (lat >= 35 && lat < 37 && lng >= 139) return 140;
  if (lat >= 34 && lat < 36 && lng < 137) return 80;
  if (lat >= 37) return 20;
  if (lat < 33) return 50;
  return 45;
}

function estimateStrikeAngle(
  event: EarthquakeEvent,
  faults: ActiveFault[],
): number {
  // For scenario events, use exact fault geometry
  if (event.id.startsWith('scenario-')) {
    const faultId = event.id.replace('scenario-', '');
    const fault = faults.find((f) => f.id === faultId);
    if (fault && fault.segments.length >= 2) {
      return computeStrikeFromSegments(fault.segments);
    }
  }
  return estimateRegionalStrike(event.lat, event.lng, event.faultType);
}

export function deriveConsoleOperationalState(
  input: DeriveConsoleOperationalStateInput,
): ConsoleOperationalState {
  // CRITICAL: Never upsert scenario events into the persistent earthquake store.
  // Scenario events (id starts with 'scenario-') are ephemeral and only exist
  // while scenario mode is active. Storing them would cause the ops focus algorithm
  // to auto-select them on subsequent polls even after scenario mode is turned off.
  const realEvents = input.events.filter((e) => !e.id.startsWith('scenario-'));
  earthquakeStore.upsert(realEvents, {
    source: input.source === 'fallback' ? 'usgs' : input.source,
    issuedAt: input.updatedAt,
    receivedAt: input.now,
  });

  // Build candidate list from store (real events only — scenario events are excluded)
  const events = [...earthquakeStore.getAll()].filter((e) => !e.id.startsWith('scenario-'));

  // When user explicitly clicks an event, bypass ops focus scoring.
  // selectOperationalFocusEvent filters for "significant" events (M≥4.5, recent)
  // and would override user clicks on smaller/older earthquakes.
  let selectedEvent: EarthquakeEvent | null;
  let focusReason: SelectedOperationalFocus['reason'];

  if (input.forceSelection && input.currentSelectedEventId) {
    // For scenario events, find in the input events (not in earthquakeStore)
    selectedEvent = earthquakeStore.get(input.currentSelectedEventId)
      ?? input.events.find((e) => e.id === input.currentSelectedEventId)
      ?? null;
    focusReason = 'retain-current';
  } else {
    const focus = selectOperationalFocusEvent({
      now: input.now,
      currentSelectedEventId: input.currentSelectedEventId,
      candidates: events.map((event) => ({
        event,
        envelope: earthquakeStore.getEnvelope(event.id) ?? null,
        revisionHistory: [...earthquakeStore.getRevisionHistory(event.id)],
      })),
    });
    selectedEvent = focus.selectedEventId
      ? earthquakeStore.get(focus.selectedEventId) ?? null
      : null;
    focusReason = focus.reason;
  }
  // Dynamic radius derived from Si & Midorikawa (1999) GMPE.
  // For each magnitude, the JMA 0.5 threshold distance (display cutoff) was computed
  // via binary search of the attenuation curve with typical fault depths, then divided
  // by 0.82 for the circular edge-fade margin (fade band = outer 18% of grid).
  //
  // Computed values (Vs30 amp = 1.41, crustal d=15km, subduction d=25km):
  //   M4.5 → 173km → 1.6° → /0.82 = 2.0°
  //   M5.0 → 243km → 2.2° → /0.82 = 2.7°
  //   M5.5 → 331km → 3.0° → /0.82 = 3.6°
  //   M6.0 → 417km → 3.8° → /0.82 = 4.5°
  //   M6.5 → 515km → 4.6° → /0.82 = 5.5°
  //   M7.0 → 614km → 5.5° → /0.82 = 6.5°
  //   M7.5 → 720km → 6.5° → /0.82 = 8.0°
  //   M8.0+ → 846-914km → 7.6-8.2° → /0.82 = 10.0° (Mw cap 8.3 saturates)
  const intensityRadiusDeg = selectedEvent
    ? (selectedEvent.magnitude >= 8.0 ? 10.0
      : selectedEvent.magnitude >= 7.5 ? 8.0
      : selectedEvent.magnitude >= 7.0 ? 6.5
      : selectedEvent.magnitude >= 6.5 ? 5.5
      : selectedEvent.magnitude >= 6.0 ? 4.5
      : selectedEvent.magnitude >= 5.5 ? 3.6
      : selectedEvent.magnitude >= 5.0 ? 2.7
      : 2.0)
    : 3;
  // Grid spacing: ~100 rows regardless of radius (total cells ≈ 10-12K)
  const intensitySpacing = Math.max(0.06, intensityRadiusDeg * 0.02);

  // Estimate fault strike for directional intensity propagation
  const strikeAngle = selectedEvent
    ? estimateStrikeAngle(selectedEvent, input.faults ?? [])
    : undefined;

  const intensityGrid = selectedEvent
    ? computeIntensityGrid(
        { lat: selectedEvent.lat, lng: selectedEvent.lng },
        selectedEvent.magnitude,
        selectedEvent.depth_km,
        selectedEvent.faultType,
        intensitySpacing,
        intensityRadiusDeg,
        undefined,     // vs30Grid
        strikeAngle,   // directivity from fault strike
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
    selectionReason: focusReason,
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
