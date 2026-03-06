import { beforeEach, describe, expect, it } from 'vitest';

import type { EarthquakeEvent } from '../../types';
import { earthquakeStore } from '../../data/earthquakeStore';
import { deriveConsoleOperationalState } from '../consoleOps';

function createEvent(
  id: string,
  magnitude: number,
  time: number,
  overrides: Partial<EarthquakeEvent> = {},
): EarthquakeEvent {
  return {
    id,
    lat: 35.62,
    lng: 139.79,
    depth_km: 24,
    magnitude,
    time,
    faultType: 'interface',
    tsunami: false,
    place: { text: `${id} corridor` },
    ...overrides,
  };
}

describe('deriveConsoleOperationalState', () => {
  const now = Date.parse('2026-03-06T10:00:00.000Z');

  beforeEach(() => {
    earthquakeStore.clear();
  });

  it('returns calm mode and a calm read model when no significant event is active', () => {
    const result = deriveConsoleOperationalState({
      now,
      events: [createEvent('minor', 4.1, now - 5 * 60_000)],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 5.5,
        bounds: [122, 24, 150, 46],
        tier: 'national',
        pitch: 0,
        bearing: 0,
      },
    });

    expect(result.mode).toBe('calm');
    expect(result.selectedEvent).toBeNull();
    expect(result.readModel.currentEvent).toBeNull();
    expect(result.readModel.nationalSnapshot).toBeNull();
    expect(result.realtimeStatus.state).toBe('fresh');
  });

  it('returns viewport-aware read model data for a significant event', () => {
    const result = deriveConsoleOperationalState({
      now,
      events: [
        createEvent('moderate', 5.0, now - 15 * 60_000),
        createEvent('severe', 6.8, now - 4 * 60_000, { tsunami: true }),
      ],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 9.2,
        bounds: [138.8, 34.8, 140.2, 36.2],
        tier: 'regional',
        pitch: 0,
        bearing: 0,
      },
    });

    expect(result.mode).toBe('event');
    expect(result.selectedEvent?.id).toBe('severe');
    expect(result.readModel.eventTruth?.source).toBe('server');
    expect(result.readModel.visibleExposureSummary.length).toBeGreaterThan(0);
    expect(result.readModel.visiblePriorityQueue.length).toBeGreaterThan(0);
    expect(result.readModel.viewport?.activeRegion).toBe('kanto');
  });
});
