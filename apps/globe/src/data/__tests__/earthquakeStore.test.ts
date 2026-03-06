import { beforeEach, describe, expect, it } from 'vitest';

import type { EarthquakeEvent } from '../../types';
import { earthquakeStore } from '../earthquakeStore';

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

describe('earthquakeStore', () => {
  beforeEach(() => {
    earthquakeStore.clear();
  });

  it('retains canonical event envelope metadata alongside normalized events', () => {
    earthquakeStore.upsert([baseEvent], {
      source: 'usgs',
      issuedAt: 1_700_000_001_000,
      receivedAt: 1_700_000_001_500,
    });

    const envelope = earthquakeStore.getEnvelope('eq-1');

    expect(envelope?.source).toBe('usgs');
    expect(envelope?.revision).toBe('usgs:1700000001000:eq-1');
    expect(earthquakeStore.get('eq-1')?.id).toBe('eq-1');
  });

  it('upgrades an event when a newer higher-trust revision arrives', () => {
    earthquakeStore.upsert([baseEvent], {
      source: 'usgs',
      issuedAt: 1_700_000_001_000,
      receivedAt: 1_700_000_001_500,
    });
    earthquakeStore.upsert([{ ...baseEvent, magnitude: 7.0 }], {
      source: 'server',
      issuedAt: 1_700_000_002_000,
      receivedAt: 1_700_000_002_500,
    });

    const envelope = earthquakeStore.getEnvelope('eq-1');

    expect(envelope?.source).toBe('server');
    expect(envelope?.supersedes).toBe('usgs:1700000001000:eq-1');
    expect(earthquakeStore.get('eq-1')?.magnitude).toBe(7.0);
    expect(earthquakeStore.getRevisionHistory('eq-1')).toHaveLength(2);
    expect(earthquakeStore.getRevisionHistory('eq-1').map((entry) => entry.source)).toEqual([
      'usgs',
      'server',
    ]);
  });
});
