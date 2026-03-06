import { describe, expect, it } from 'vitest';

import type { EarthquakeEvent } from '../../types';
import { buildSnapshotModel } from '../presentation';
import { selectConsoleFocus } from '../focus';

const baseEvent: EarthquakeEvent = {
  id: 'tokyo-live-1',
  lat: 35.62,
  lng: 139.79,
  depth_km: 32,
  magnitude: 7.1,
  time: Date.parse('2026-03-06T08:00:00.000Z'),
  faultType: 'interface',
  tsunami: true,
  place: {
    text: 'Sagami Trough offshore corridor',
  },
};

describe('console focus', () => {
  it('returns calm focus when no critical event is selected', () => {
    expect(selectConsoleFocus({ selectedEvent: null, priorities: [] })).toEqual({ type: 'calm' });
  });

  it('returns event focus when a selected event has priorities', () => {
    expect(
      selectConsoleFocus({
        selectedEvent: baseEvent,
        priorities: [
          {
            id: 'check-port',
            assetId: 'tokyo-port',
            severity: 'priority',
            title: 'Verify Tokyo port access',
            rationale: 'Coastal shaking overlaps port operations',
          },
        ],
      }),
    ).toEqual({ type: 'event', earthquakeId: 'tokyo-live-1' });
  });

  it('builds a snapshot model with check-these-now entries for the focused event', () => {
    const snapshot = buildSnapshotModel({
      event: baseEvent,
      priorities: [
        {
          id: 'check-port',
          assetId: 'tokyo-port',
          severity: 'priority',
          title: 'Verify Tokyo port access',
          rationale: 'Coastal shaking overlaps port operations',
        },
      ],
      metro: 'tokyo',
    });

    expect(snapshot.mode).toBe('event');
    expect(snapshot.checks[0]).toContain('Verify Tokyo port access');
    expect(snapshot.summary).toContain('Tokyo');
  });

  it('builds a calm snapshot when no event is active', () => {
    const snapshot = buildSnapshotModel({
      event: null,
      priorities: [],
      metro: 'tokyo',
    });

    expect(snapshot.mode).toBe('calm');
    expect(snapshot.headline).toContain('No critical operational earthquake event');
    expect(snapshot.checks).toHaveLength(3);
  });
});
