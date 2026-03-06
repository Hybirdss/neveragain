import type { EarthquakeEvent } from '../types';

export type CanonicalEventSource = 'server' | 'usgs' | 'jma' | 'historical' | 'scenario';
export type CanonicalEventConfidence = 'high' | 'medium' | 'low';

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
