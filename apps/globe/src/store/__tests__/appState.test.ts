import { describe, expect, it } from 'vitest';
import { store } from '../appState';
import type { EarthquakeEvent } from '../../types';

function makeEvent(id: string): EarthquakeEvent {
  return {
    id,
    lat: 35.0,
    lng: 139.0,
    depth_km: 20,
    magnitude: 5.5,
    time: Date.parse('2026-03-01T00:00:00.000Z'),
    faultType: 'crustal',
    tsunami: false,
    place: { text: 'Tokyo' },
  };
}

describe('appState store', () => {
  it('does not notify when setting the same reference', () => {
    const event = makeEvent('same-ref');
    let calls = 0;
    const unsub = store.subscribe('selectedEvent', () => {
      calls += 1;
    });

    store.set('selectedEvent', null);
    store.set('selectedEvent', event);
    store.set('selectedEvent', event);

    unsub();
    expect(calls).toBe(1);
    store.set('selectedEvent', null);
  });

  it('batch emits one notification per key with final value', () => {
    const seen: string[] = [];
    const unsub = store.subscribe('networkError', (value) => {
      seen.push(value ?? 'null');
    });

    store.set('networkError', null);
    store.batch(() => {
      store.set('networkError', 'E1');
      store.set('networkError', 'E2');
      store.set('networkError', 'E3');
    });

    unsub();
    expect(seen).toEqual(['E3']);
    store.set('networkError', null);
  });
});
