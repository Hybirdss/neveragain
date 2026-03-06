import { describe, expect, it } from 'vitest';

import type { EarthquakeEvent } from '../../types';
import {
  analyzeEventRevisionHistory,
  buildCanonicalEventEnvelope,
  pickPreferredEventEnvelope,
} from '../eventEnvelope';

const baseEvent: EarthquakeEvent = {
  id: 'eq-1',
  lat: 35.7,
  lng: 139.7,
  depth_km: 24,
  magnitude: 6.8,
  time: 1_700_000_000_000,
  faultType: 'interface',
  tsunami: true,
  place: { text: 'Sagami corridor' },
};

describe('eventEnvelope', () => {
  it('builds a canonical envelope with deterministic metadata defaults', () => {
    const envelope = buildCanonicalEventEnvelope({
      event: baseEvent,
      source: 'server',
      issuedAt: 1_700_000_005_000,
      receivedAt: 1_700_000_006_000,
    });

    expect(envelope.id).toBe('eq-1');
    expect(envelope.revision).toBe('server:1700000005000:eq-1');
    expect(envelope.observedAt).toBe(baseEvent.time);
    expect(envelope.confidence).toBe('high');
    expect(envelope.supersedes).toBeNull();
  });

  it('prefers newer issued revisions, then higher-trust sources when timestamps tie', () => {
    const older = buildCanonicalEventEnvelope({
      event: baseEvent,
      source: 'usgs',
      issuedAt: 1_700_000_001_000,
      receivedAt: 1_700_000_001_500,
    });
    const newer = buildCanonicalEventEnvelope({
      event: { ...baseEvent, magnitude: 7.0 },
      source: 'server',
      issuedAt: 1_700_000_002_000,
      receivedAt: 1_700_000_002_500,
    });
    const tiedServer = buildCanonicalEventEnvelope({
      event: baseEvent,
      source: 'server',
      issuedAt: 1_700_000_003_000,
      receivedAt: 1_700_000_003_500,
    });
    const tiedUsgs = buildCanonicalEventEnvelope({
      event: { ...baseEvent, magnitude: 6.6 },
      source: 'usgs',
      issuedAt: 1_700_000_003_000,
      receivedAt: 1_700_000_003_200,
    });

    expect(pickPreferredEventEnvelope(older, newer)).toBe(newer);
    expect(pickPreferredEventEnvelope(tiedUsgs, tiedServer)).toBe(tiedServer);
  });

  it('classifies material divergence when revisions disagree on magnitude, location, or tsunami posture', () => {
    const usgs = buildCanonicalEventEnvelope({
      event: baseEvent,
      source: 'usgs',
      issuedAt: 1_700_000_001_000,
      receivedAt: 1_700_000_001_500,
    });
    const server = buildCanonicalEventEnvelope({
      event: {
        ...baseEvent,
        lat: 35.2,
        lng: 139.2,
        magnitude: 7.4,
        tsunami: false,
      },
      source: 'server',
      issuedAt: 1_700_000_002_000,
      receivedAt: 1_700_000_002_500,
    });

    const analysis = analyzeEventRevisionHistory([usgs, server]);

    expect(analysis.divergenceSeverity).toBe('material');
    expect(analysis.magnitudeSpread).toBeCloseTo(0.6, 3);
    expect(analysis.locationSpreadKm).toBeGreaterThan(20);
    expect(analysis.tsunamiMismatch).toBe(true);
  });
});
