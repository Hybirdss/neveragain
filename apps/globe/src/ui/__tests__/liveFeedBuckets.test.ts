import { describe, expect, it } from 'vitest';

import type { EarthquakeEvent } from '../../types';
import { clusterEvents, getDisplayEvents } from '../../utils/aftershockCluster';
import { bucketLiveFeedEvents } from '../liveFeedBuckets';

const NOW = Date.UTC(2026, 2, 6, 0, 0, 0);

function buildEvent(overrides: Partial<EarthquakeEvent> & Pick<EarthquakeEvent, 'id'>): EarthquakeEvent {
  return {
    id: overrides.id,
    lat: overrides.lat ?? 35,
    lng: overrides.lng ?? 140,
    depth_km: overrides.depth_km ?? 24,
    magnitude: overrides.magnitude ?? 3.4,
    time: overrides.time ?? NOW,
    faultType: overrides.faultType ?? 'crustal',
    tsunami: overrides.tsunami ?? false,
    place: overrides.place ?? { text: overrides.id, lang: 'en' },
  };
}

function bucket(events: EarthquakeEvent[], selectedId?: string | null) {
  const clusters = clusterEvents(events);
  const displayEvents = getDisplayEvents(events, clusters);
  return bucketLiveFeedEvents({
    events: displayEvents,
    clusters,
    selectedId: selectedId ?? null,
    now: NOW,
  });
}

describe('bucketLiveFeedEvents', () => {
  it('keeps the selected incident in primary even when it is stale', () => {
    const events = [
      buildEvent({ id: 'fresh-1', time: NOW - (1 * 60 * 60 * 1000) }),
      buildEvent({ id: 'fresh-2', time: NOW - (2 * 60 * 60 * 1000) }),
      buildEvent({ id: 'fresh-3', time: NOW - (3 * 60 * 60 * 1000) }),
      buildEvent({ id: 'fresh-4', time: NOW - (4 * 60 * 60 * 1000) }),
      buildEvent({ id: 'selected-stale', time: NOW - (60 * 60 * 60 * 1000) }),
    ];

    const result = bucket(events, 'selected-stale');

    expect(result.primary.map((event) => event.id)).toContain('selected-stale');
    expect(result.background.map((event) => event.id)).not.toContain('selected-stale');
  });

  it('moves older low-signal incidents into background monitoring', () => {
    const events = [
      buildEvent({ id: 'fresh-high', magnitude: 5.2, time: NOW - (2 * 60 * 60 * 1000), lat: 35.0, lng: 140.0 }),
      buildEvent({ id: 'fresh-mid', magnitude: 4.2, time: NOW - (6 * 60 * 60 * 1000), lat: 37.2, lng: 138.4 }),
      buildEvent({ id: 'fresh-low', magnitude: 3.8, time: NOW - (12 * 60 * 60 * 1000), lat: 33.8, lng: 132.5 }),
      buildEvent({ id: 'older-low-1', magnitude: 3.1, time: NOW - (30 * 60 * 60 * 1000), lat: 43.0, lng: 145.0 }),
      buildEvent({ id: 'older-low-2', magnitude: 3.0, time: NOW - (54 * 60 * 60 * 1000), lat: 26.5, lng: 127.9 }),
    ];

    const result = bucket(events);

    expect(result.primary.map((event) => event.id)).toEqual(['fresh-high', 'fresh-mid', 'fresh-low']);
    expect(result.background.map((event) => event.id)).toEqual(['older-low-1', 'older-low-2']);
  });

  it('keeps clustered mainshocks in primary even when they are older than the fresh window', () => {
    const mainshock = buildEvent({
      id: 'mainshock',
      lat: 36,
      lng: 141,
      magnitude: 4.4,
      time: NOW - (30 * 60 * 60 * 1000),
    });
    const aftershockA = buildEvent({
      id: 'aftershock-a',
      lat: 36.05,
      lng: 141.04,
      magnitude: 3.1,
      time: NOW - (20 * 60 * 60 * 1000),
    });
    const aftershockB = buildEvent({
      id: 'aftershock-b',
      lat: 36.06,
      lng: 141.03,
      magnitude: 3.0,
      time: NOW - (18 * 60 * 60 * 1000),
    });
    const fresh = [
      buildEvent({ id: 'fresh-1', time: NOW - (1 * 60 * 60 * 1000) }),
      buildEvent({ id: 'fresh-2', time: NOW - (2 * 60 * 60 * 1000) }),
      buildEvent({ id: 'fresh-3', time: NOW - (3 * 60 * 60 * 1000) }),
    ];

    const result = bucket([mainshock, aftershockA, aftershockB, ...fresh]);

    expect(result.primary.map((event) => event.id)).toContain('mainshock');
    expect(result.background.map((event) => event.id)).not.toContain('mainshock');
  });

  it('keeps the newest incident visible when every incident is stale and low-signal', () => {
    const events = [
      buildEvent({ id: 'stale-newest', magnitude: 3.4, time: NOW - (50 * 60 * 60 * 1000), lat: 41.0, lng: 143.0 }),
      buildEvent({ id: 'stale-older', magnitude: 3.2, time: NOW - (80 * 60 * 60 * 1000), lat: 31.0, lng: 130.0 }),
    ];

    const result = bucket(events);

    expect(result.primary.map((event) => event.id)).toEqual(['stale-newest']);
    expect(result.background.map((event) => event.id)).toEqual(['stale-older']);
  });
});
