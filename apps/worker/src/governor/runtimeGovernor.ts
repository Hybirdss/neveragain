import {
  GOVERNOR_STATES,
  SOURCE_CLASSES,
  type GovernorActivation,
  type GovernorPolicyEnvelope,
  type GovernorRegionScope,
  type GovernorViewportBounds,
  type SourceClass,
} from './types.ts';

const INCIDENT_MAGNITUDE = 6.5;
const WATCH_MAGNITUDE = 4.5;
const INCIDENT_EXPOSURE_COUNT = 10;
const WATCH_EXPOSURE_COUNT = 4;
const RECOVERY_WINDOW_MS = 60 * 60 * 1000;
const MATERIAL_EVENT_WINDOW_MS = 6 * 60 * 60 * 1000;

export interface RuntimeGovernorSignalInput {
  magnitude: number;
  tsunami: boolean;
  exposureCount: number;
  activeRegion?: string | null;
  regionIds?: string[];
  viewportBounds?: GovernorViewportBounds;
  lastIncidentAt?: string | null;
  now?: string;
}

export interface RuntimeGovernorEventSignal {
  magnitude: number;
  tsunami: boolean;
  lat: number;
  lng: number;
  time: string | number | Date;
  exposureCount?: number;
}

export function resolveGovernorState(input: RuntimeGovernorSignalInput): GovernorActivation {
  const now = new Date(input.now ?? Date.now());
  const regionScope = resolveRegionScope(input);
  const state = resolveGovernorStateName(input, now);

  return {
    state,
    sourceClasses: resolveSourceClasses(state),
    regionScope,
    activatedAt: now.toISOString(),
    reason: describeGovernorReason(state, input),
  };
}

export function buildGovernorPolicyEnvelope(input: RuntimeGovernorSignalInput): GovernorPolicyEnvelope {
  return {
    states: GOVERNOR_STATES,
    sourceClasses: SOURCE_CLASSES,
    activation: resolveGovernorState(input),
  };
}

export function buildGovernorPolicyEnvelopeFromEvents(
  events: RuntimeGovernorEventSignal[],
  options: Pick<RuntimeGovernorSignalInput, 'now' | 'lastIncidentAt' | 'viewportBounds'> = {},
): GovernorPolicyEnvelope {
  const now = new Date(options.now ?? Date.now());
  const recentEvents = events.filter((event) => {
    const eventTime = new Date(event.time).getTime();
    return Number.isFinite(eventTime) && now.getTime() - eventTime <= MATERIAL_EVENT_WINDOW_MS;
  });

  const strongestMagnitude = recentEvents.reduce((max, event) => Math.max(max, event.magnitude), 0);
  const tsunami = recentEvents.some((event) => event.tsunami);
  const exposureCount = recentEvents.reduce((total, event) => total + (event.exposureCount ?? 1), 0);
  const regionIds = uniqueRegionIds(
    recentEvents
      .map((event) => inferGovernorRegionId(event.lat, event.lng))
      .filter((regionId): regionId is string => regionId !== null),
  );
  const lastIncidentAt = options.lastIncidentAt ?? deriveLastIncidentAt(recentEvents);

  return buildGovernorPolicyEnvelope({
    magnitude: strongestMagnitude,
    tsunami,
    exposureCount,
    activeRegion: regionIds[0] ?? null,
    regionIds,
    viewportBounds: options.viewportBounds,
    lastIncidentAt,
    now: now.toISOString(),
  });
}

export function inferGovernorRegionId(lat: number, lng: number): string | null {
  const isJapan = lat >= 20 && lat <= 50 && lng >= 120 && lng <= 155;
  if (!isJapan) return null;
  if (lat > 41) return 'hokkaido';
  if (lat > 38) return 'tohoku';
  if (lat > 36) return 'kanto';
  if (lat > 35 && lng < 138) return 'chubu';
  if (lat > 34 && lng < 136) return 'kansai';
  if (lat > 33 && lng < 133) return 'chugoku';
  if (lat > 32 && lng > 132 && lng < 135) return 'shikoku';
  if (lat > 30 && lat <= 34) return 'kyushu';
  return null;
}

function resolveGovernorStateName(
  input: RuntimeGovernorSignalInput,
  now: Date,
): GovernorActivation['state'] {
  if (input.tsunami || input.magnitude >= INCIDENT_MAGNITUDE || input.exposureCount >= INCIDENT_EXPOSURE_COUNT) {
    return 'incident';
  }
  if (input.magnitude >= WATCH_MAGNITUDE || input.exposureCount >= WATCH_EXPOSURE_COUNT) {
    return 'watch';
  }
  if (input.lastIncidentAt) {
    const lastIncidentAt = new Date(input.lastIncidentAt).getTime();
    if (Number.isFinite(lastIncidentAt) && now.getTime() - lastIncidentAt <= RECOVERY_WINDOW_MS) {
      return 'recovery';
    }
  }
  return 'calm';
}

function resolveRegionScope(input: RuntimeGovernorSignalInput): GovernorRegionScope {
  const regionIds = uniqueRegionIds([
    ...(input.activeRegion ? [input.activeRegion] : []),
    ...(input.regionIds ?? []),
  ]);

  if (input.viewportBounds && regionIds.length > 0) {
    const scopedRegionIds = regionIds as [string, ...string[]];
    return {
      kind: 'viewport',
      regionIds: scopedRegionIds,
      bounds: input.viewportBounds,
    };
  }

  if (regionIds.length > 0) {
    const scopedRegionIds = regionIds as [string, ...string[]];
    return {
      kind: 'regional',
      regionIds: scopedRegionIds,
    };
  }

  return { kind: 'national' };
}

function resolveSourceClasses(state: GovernorActivation['state']): SourceClass[] {
  switch (state) {
    case 'incident':
      return ['event-truth', 'fast-situational', 'slow-infrastructure'];
    case 'watch':
      return ['event-truth', 'fast-situational'];
    case 'recovery':
      return ['event-truth', 'slow-infrastructure'];
    case 'calm':
    default:
      return ['event-truth'];
  }
}

function describeGovernorReason(
  state: GovernorActivation['state'],
  input: RuntimeGovernorSignalInput,
): string {
  if (state === 'incident') {
    if (input.tsunami) return 'tsunami risk escalated runtime into incident mode';
    if (input.magnitude >= INCIDENT_MAGNITUDE) return 'large magnitude event escalated runtime into incident mode';
    return 'material exposure count escalated runtime into incident mode';
  }
  if (state === 'watch') {
    if (input.magnitude >= WATCH_MAGNITUDE) return 'moderate seismic activity activated watch mode';
    return 'localized exposure activated watch mode';
  }
  if (state === 'recovery') {
    return 'recent incident remains inside recovery decay window';
  }
  return 'no material seismic escalation detected';
}

function uniqueRegionIds(regionIds: string[]): [string, ...string[]] | [] {
  return Array.from(new Set(regionIds.filter(Boolean))) as [string, ...string[]] | [];
}

function deriveLastIncidentAt(events: RuntimeGovernorEventSignal[]): string | null {
  const incidentCandidate = events.find((event) =>
    event.tsunami || event.magnitude >= INCIDENT_MAGNITUDE || (event.exposureCount ?? 1) >= INCIDENT_EXPOSURE_COUNT,
  );

  if (!incidentCandidate) {
    return null;
  }

  return new Date(incidentCandidate.time).toISOString();
}
