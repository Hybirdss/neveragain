import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EarthquakeEvent } from '../../types';

let realtimeCallback: ((events: EarthquakeEvent[]) => void) | null = null;
const resetSeen = vi.fn();
const pollNow = vi.fn(async () => {});
const stop = vi.fn();

vi.mock('../../data/usgsRealtime', () => ({
  startRealtimePolling: vi.fn((cb: (events: EarthquakeEvent[]) => void) => {
    realtimeCallback = cb;
    return {
      stop,
      resetSeen,
      pollNow,
      firstPollDone: Promise.resolve(),
    };
  }),
}));

import { initRealtimeOrchestrator } from '../realtimeOrchestrator';
import { earthquakeStore } from '../../data/earthquakeStore';
import { store } from '../../store/appState';

function makeEvent(id: string, time: number): EarthquakeEvent {
  return {
    id,
    lat: 35.0,
    lng: 139.0,
    depth_km: 20,
    magnitude: 6.0,
    time,
    faultType: 'crustal',
    tsunami: false,
    place: { text: 'Tokyo' },
  };
}

describe('realtimeOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-06T00:00:00.000Z'));
    realtimeCallback = null;

    earthquakeStore.clear();
    store.set('selectedEvent', null);
    store.set('mode', 'realtime');
    const now = Date.now();
    store.set('timeline', {
      ...store.get('timeline'),
      events: [],
      currentIndex: -1,
      currentTime: now,
      timeRange: [now - 86_400_000, now],
    });
  });

  it('updates timeline in ascending order and preserves selected event index', () => {
    const older = makeEvent('older', Date.parse('2026-03-05T00:00:00.000Z'));
    const newer = makeEvent('newer', Date.parse('2026-03-06T00:00:00.000Z'));
    store.set('selectedEvent', older);

    const handle = initRealtimeOrchestrator();
    expect(realtimeCallback).not.toBeNull();
    realtimeCallback?.([newer, older]);

    const timeline = store.get('timeline');
    expect(timeline.events.map((e) => e.id)).toEqual(['older', 'newer']);
    expect(timeline.currentIndex).toBe(0);

    handle.dispose();
    vi.useRealTimers();
  });

  it('ignores incoming events while not in realtime mode', () => {
    store.set('mode', 'timeline');
    const handle = initRealtimeOrchestrator();
    expect(realtimeCallback).not.toBeNull();
    realtimeCallback?.([makeEvent('evt', Date.parse('2026-03-06T00:00:00.000Z'))]);

    const timeline = store.get('timeline');
    expect(timeline.events).toHaveLength(0);
    expect(earthquakeStore.size).toBe(0);

    handle.dispose();
    vi.useRealTimers();
  });

  it('resets selection and triggers immediate repoll when mode returns to realtime', () => {
    const selected = makeEvent('selected', Date.parse('2026-03-05T12:00:00.000Z'));
    const handle = initRealtimeOrchestrator();

    store.set('mode', 'timeline');
    store.set('selectedEvent', selected);
    store.set('mode', 'realtime');

    expect(store.get('selectedEvent')).toBeNull();
    expect(resetSeen).toHaveBeenCalledTimes(1);
    expect(pollNow).toHaveBeenCalledTimes(1);

    handle.dispose();
    vi.useRealTimers();
  });
});
