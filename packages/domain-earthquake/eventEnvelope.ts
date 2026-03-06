import type {
  CanonicalEventConfidence,
  CanonicalEventSource,
  EarthquakeEvent,
  RevisionDivergenceSeverity,
} from '@namazue/kernel';

export type {
  CanonicalEventConfidence,
  CanonicalEventSource,
  RevisionDivergenceSeverity,
} from '@namazue/kernel';

export interface CanonicalEventEnvelope {
  id: string;
  revision: string;
  source: CanonicalEventSource;
  observedAt: number;
  issuedAt: number;
  receivedAt: number;
  supersedes: string | null;
  confidence: CanonicalEventConfidence;
  event: EarthquakeEvent;
}

export interface RevisionHistoryAnalysis {
  divergenceSeverity: RevisionDivergenceSeverity;
  magnitudeSpread: number;
  depthSpreadKm: number;
  locationSpreadKm: number;
  tsunamiMismatch: boolean;
  faultTypeMismatch: boolean;
}

export interface BuildCanonicalEventEnvelopeInput {
  event: EarthquakeEvent;
  source: CanonicalEventSource;
  issuedAt?: number;
  receivedAt?: number;
  supersedes?: string | null;
  confidence?: CanonicalEventConfidence;
}

const SOURCE_PRIORITY: Record<CanonicalEventSource, number> = {
  jma: 5,
  server: 4,
  usgs: 3,
  historical: 2,
  scenario: 1,
};

const CONFIDENCE_PRIORITY: Record<CanonicalEventConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function defaultConfidence(source: CanonicalEventSource): CanonicalEventConfidence {
  if (source === 'jma' || source === 'server') return 'high';
  if (source === 'usgs') return 'medium';
  return 'low';
}

export function buildCanonicalEventEnvelope(
  input: BuildCanonicalEventEnvelopeInput,
): CanonicalEventEnvelope {
  const issuedAt = input.issuedAt ?? input.event.time;
  const receivedAt = input.receivedAt ?? issuedAt;

  return {
    id: input.event.id,
    revision: `${input.source}:${issuedAt}:${input.event.id}`,
    source: input.source,
    observedAt: input.event.time,
    issuedAt,
    receivedAt,
    supersedes: input.supersedes ?? null,
    confidence: input.confidence ?? defaultConfidence(input.source),
    event: input.event,
  };
}

function haversineKm(
  leftLat: number,
  leftLng: number,
  rightLat: number,
  rightLng: number,
): number {
  const toRadians = (value: number) => value * Math.PI / 180;
  const earthRadiusKm = 6_371;
  const dLat = toRadians(rightLat - leftLat);
  const dLng = toRadians(rightLng - leftLng);
  const lat1 = toRadians(leftLat);
  const lat2 = toRadians(rightLat);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function analyzeEventRevisionHistory(
  history: CanonicalEventEnvelope[],
): RevisionHistoryAnalysis {
  if (history.length <= 1) {
    return {
      divergenceSeverity: 'none',
      magnitudeSpread: 0,
      depthSpreadKm: 0,
      locationSpreadKm: 0,
      tsunamiMismatch: false,
      faultTypeMismatch: false,
    };
  }

  const magnitudes = history.map((entry) => entry.event.magnitude);
  const depths = history.map((entry) => entry.event.depth_km);
  const magnitudeSpread = Math.max(...magnitudes) - Math.min(...magnitudes);
  const depthSpreadKm = Math.max(...depths) - Math.min(...depths);
  let locationSpreadKm = 0;

  for (let index = 0; index < history.length; index += 1) {
    const current = history[index]!;
    for (let compareIndex = index + 1; compareIndex < history.length; compareIndex += 1) {
      const compare = history[compareIndex]!;
      locationSpreadKm = Math.max(
        locationSpreadKm,
        haversineKm(
          current.event.lat,
          current.event.lng,
          compare.event.lat,
          compare.event.lng,
        ),
      );
    }
  }

  const tsunamiMismatch = new Set(history.map((entry) => entry.event.tsunami)).size > 1;
  const faultTypeMismatch = new Set(history.map((entry) => entry.event.faultType)).size > 1;
  const divergenceSeverity: RevisionDivergenceSeverity = (
    magnitudeSpread >= 0.5
    || depthSpreadKm >= 20
    || locationSpreadKm >= 20
    || tsunamiMismatch
    || faultTypeMismatch
  )
    ? 'material'
    : 'minor';

  return {
    divergenceSeverity,
    magnitudeSpread,
    depthSpreadKm,
    locationSpreadKm,
    tsunamiMismatch,
    faultTypeMismatch,
  };
}

export function pickPreferredEventEnvelope(
  current: CanonicalEventEnvelope,
  incoming: CanonicalEventEnvelope,
): CanonicalEventEnvelope {
  if (incoming.issuedAt !== current.issuedAt) {
    return incoming.issuedAt > current.issuedAt ? incoming : current;
  }

  if (SOURCE_PRIORITY[incoming.source] !== SOURCE_PRIORITY[current.source]) {
    return SOURCE_PRIORITY[incoming.source] > SOURCE_PRIORITY[current.source] ? incoming : current;
  }

  if (CONFIDENCE_PRIORITY[incoming.confidence] !== CONFIDENCE_PRIORITY[current.confidence]) {
    return CONFIDENCE_PRIORITY[incoming.confidence] > CONFIDENCE_PRIORITY[current.confidence]
      ? incoming
      : current;
  }

  return incoming.receivedAt >= current.receivedAt ? incoming : current;
}
