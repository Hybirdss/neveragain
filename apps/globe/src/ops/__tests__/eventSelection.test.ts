import { describe, expect, it } from 'vitest';

import type { EarthquakeEvent } from '../../types';
import {
  buildCanonicalEventEnvelope,
  type CanonicalEventEnvelope,
} from '../../data/eventEnvelope';
import { selectOperationalFocusEvent } from '../eventSelection';

function createEvent(
  id: string,
  magnitude: number,
  time: number,
  overrides: Partial<EarthquakeEvent> = {},
): EarthquakeEvent {
  return {
    id,
    lat: 35,
    lng: 139,
    depth_km: 20,
    magnitude,
    time,
    faultType: 'interface',
    tsunami: false,
    place: { text: `${id} corridor` },
    ...overrides,
  };
}

function createEnvelope(
  event: EarthquakeEvent,
  source: CanonicalEventEnvelope['source'],
  issuedAt: number,
): CanonicalEventEnvelope {
  return buildCanonicalEventEnvelope({
    event,
    source,
    issuedAt,
    receivedAt: issuedAt + 500,
  });
}

describe('selectOperationalFocusEvent', () => {
  const now = Date.parse('2026-03-06T10:00:00.000Z');

  it('returns no focus when no event clears the operational significance threshold', () => {
    const minor = createEvent('minor', 4.2, now - 10 * 60_000);

    const result = selectOperationalFocusEvent({
      now,
      currentSelectedEventId: null,
      candidates: [
        {
          event: minor,
          envelope: createEnvelope(minor, 'server', minor.time + 5_000),
          revisionHistory: [],
        },
      ],
    });

    expect(result.selectedEventId).toBeNull();
    expect(result.reason).toBe('no-significant-event');
  });

  it('prefers the strongest recent trusted event when there is no current selection', () => {
    const moderate = createEvent('moderate', 5.4, now - 20 * 60_000);
    const severe = createEvent('severe', 6.7, now - 15 * 60_000);

    const result = selectOperationalFocusEvent({
      now,
      currentSelectedEventId: null,
      candidates: [
        {
          event: moderate,
          envelope: createEnvelope(moderate, 'usgs', moderate.time + 5_000),
          revisionHistory: [],
        },
        {
          event: severe,
          envelope: createEnvelope(severe, 'server', severe.time + 5_000),
          revisionHistory: [],
        },
      ],
    });

    expect(result.selectedEventId).toBe('severe');
    expect(result.reason).toBe('auto-select');
  });

  it('retains the current selection when the new candidate is not materially stronger', () => {
    const current = createEvent('current', 6.1, now - 30 * 60_000);
    const challenger = createEvent('challenger', 6.2, now - 10 * 60_000);

    const result = selectOperationalFocusEvent({
      now,
      currentSelectedEventId: 'current',
      candidates: [
        {
          event: current,
          envelope: createEnvelope(current, 'server', current.time + 5_000),
          revisionHistory: [],
        },
        {
          event: challenger,
          envelope: createEnvelope(challenger, 'usgs', challenger.time + 5_000),
          revisionHistory: [],
        },
      ],
    });

    expect(result.selectedEventId).toBe('current');
    expect(result.reason).toBe('retain-current');
  });

  it('switches focus when a much stronger event arrives', () => {
    const current = createEvent('current', 5.6, now - 30 * 60_000);
    const severe = createEvent('severe', 7.4, now - 2 * 60_000, { tsunami: true });

    const result = selectOperationalFocusEvent({
      now,
      currentSelectedEventId: 'current',
      candidates: [
        {
          event: current,
          envelope: createEnvelope(current, 'server', current.time + 5_000),
          revisionHistory: [],
        },
        {
          event: severe,
          envelope: createEnvelope(severe, 'server', severe.time + 5_000),
          revisionHistory: [],
        },
      ],
    });

    expect(result.selectedEventId).toBe('severe');
    expect(result.reason).toBe('escalate');
  });

  it('does not keep stale medium events active after the operational window expires', () => {
    const result = selectOperationalFocusEvent({
      now,
      currentSelectedEventId: null,
      candidates: [
        {
          event: createEvent('stale-medium', 5.9, now - 4 * 24 * 60 * 60_000),
          envelope: createEnvelope(
            createEvent('stale-medium', 5.9, now - 4 * 24 * 60 * 60_000),
            'server',
            now - 4 * 24 * 60 * 60_000 + 5_000,
          ),
          revisionHistory: [],
        },
        {
          event: createEvent('recent-watch', 4.6, now - 3 * 60 * 60_000),
          envelope: createEnvelope(
            createEvent('recent-watch', 4.6, now - 3 * 60 * 60_000),
            'server',
            now - 3 * 60 * 60_000 + 5_000,
          ),
          revisionHistory: [],
        },
      ],
    });

    expect(result.selectedEventId).toBe('recent-watch');
    expect(result.reason).toBe('auto-select');
  });

  it('allows a major tsunami event to remain eligible beyond the normal medium-event window', () => {
    const major = createEvent('major-tsunami', 7.4, now - 48 * 60 * 60_000, { tsunami: true });

    const result = selectOperationalFocusEvent({
      now,
      currentSelectedEventId: null,
      candidates: [
        {
          event: major,
          envelope: createEnvelope(major, 'server', major.time + 5_000),
          revisionHistory: [],
        },
      ],
    });

    expect(result.selectedEventId).toBe('major-tsunami');
    expect(result.reason).toBe('auto-select');
  });

  it('penalizes materially divergent revisions so stable operator truth wins auto-selection', () => {
    const stable = createEvent('stable', 6.1, now - 30 * 60_000);
    const divergent = createEvent('divergent', 6.7, now - 10 * 60_000);

    const result = selectOperationalFocusEvent({
      now,
      currentSelectedEventId: null,
      candidates: [
        {
          event: stable,
          envelope: createEnvelope(stable, 'server', stable.time + 5_000),
          revisionHistory: [],
        },
        {
          event: divergent,
          envelope: createEnvelope(divergent, 'server', divergent.time + 5_000),
          revisionHistory: [
            createEnvelope(
              createEvent('divergent', 6.0, divergent.time, {
                lat: 34.4,
                lng: 138.2,
                tsunami: true,
              }),
              'usgs',
              divergent.time + 2_000,
            ),
          ],
        },
      ],
    });

    expect(result.selectedEventId).toBe('stable');
    expect(result.reason).toBe('auto-select');
  });
});
