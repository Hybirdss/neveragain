/**
 * Realtime Orchestrator — USGS polling, mode changes, and earthquake data management.
 */

import { store } from '../store/appState';
import type { EarthquakeEvent } from '../types';
import { startRealtimePolling, type RealtimePollerHandle } from '../data/usgsRealtime';
import { earthquakeStore } from '../data/earthquakeStore';

export interface RealtimeOrchestratorHandle {
  pollerHandle: RealtimePollerHandle;
  dispose: () => void;
}

function onNewRealtimeEvents(newEvents: EarthquakeEvent[]): void {
  if (store.get('mode') !== 'realtime') return;

  // Delegate dedup + storage to earthquakeStore
  earthquakeStore.upsert(newEvents);
  earthquakeStore.prune();

  // Read all events from store (sorted newest-first by default)
  const allEvents = [...earthquakeStore.getAll()];
  // timeline.events expects ascending time order
  allEvents.reverse();

  const now = Date.now();
  const cutoff = now - 7 * 86_400_000;

  const selectedId = store.get('selectedEvent')?.id ?? null;
  const selectedIndex = selectedId
    ? allEvents.findIndex((event) => event.id === selectedId)
    : -1;
  const currentIndex = selectedIndex >= 0
    ? selectedIndex
    : Math.max(0, allEvents.length - 1);

  store.set('timeline', {
    ...store.get('timeline'),
    events: allEvents,
    currentIndex,
    currentTime: now,
    timeRange: [cutoff, now],
  });
}

export function initRealtimeOrchestrator(): RealtimeOrchestratorHandle {
  const pollerHandle = startRealtimePolling(onNewRealtimeEvents);

  // Mode changes → clean up stale state
  const unsubMode = store.subscribe('mode', (mode) => {
    store.set('selectedEvent', null);

    if (mode === 'realtime') {
      pollerHandle.resetSeen();
      earthquakeStore.clear();
      const now = Date.now();
      store.set('timeline', {
        events: [],
        currentIndex: -1,
        currentTime: now,
        isPlaying: false,
        speed: 1,
        timeRange: [now - 86_400_000, now],
      });
    }
  });

  return {
    pollerHandle,
    dispose: () => {
      unsubMode();
      pollerHandle.stop();
    },
  };
}
