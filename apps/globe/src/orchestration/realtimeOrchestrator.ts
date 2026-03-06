/**
 * Realtime Orchestrator — USGS polling, mode changes, and earthquake data management.
 */

import { store } from '../store/appState';
import type { EarthquakeEvent } from '../types';
import { buildServiceReadModel } from '../ops/serviceReadModel';
import type { RealtimeStatus } from '../ops/readModelTypes';
import {
  getLastSuccessSource,
  startRealtimePolling,
  type RealtimePollMeta,
  type RealtimePollerHandle,
} from '../data/usgsRealtime';
import { earthquakeStore } from '../data/earthquakeStore';

export interface RealtimeOrchestratorHandle {
  pollerHandle: RealtimePollerHandle;
  dispose: () => void;
}

const STALE_AFTER_MS = 60_000;

interface DeriveRealtimeStatusInput {
  source: RealtimeStatus['source'];
  updatedAt: number;
  now: number;
  staleAfterMs: number;
  fallbackActive: boolean;
  networkError: string | null;
}

export function deriveRealtimeStatus(input: DeriveRealtimeStatusInput): RealtimeStatus {
  if (input.networkError) {
    return {
      source: input.source,
      state: 'degraded',
      updatedAt: input.updatedAt,
      staleAfterMs: input.staleAfterMs,
      message: input.networkError,
    };
  }

  if (input.fallbackActive || input.source !== 'server') {
    return {
      source: input.source,
      state: 'degraded',
      updatedAt: input.updatedAt,
      staleAfterMs: input.staleAfterMs,
      message: 'Running on fallback realtime feed',
    };
  }

  const isStale = input.now - input.updatedAt > input.staleAfterMs;
  return {
    source: input.source,
    state: isStale ? 'stale' : 'fresh',
    updatedAt: input.updatedAt,
    staleAfterMs: input.staleAfterMs,
    message: isStale ? 'Realtime updates are delayed' : undefined,
  };
}

function syncServiceReadModel(): void {
  const ops = store.get('ops');
  store.set('serviceReadModel', buildServiceReadModel({
    selectedEvent: store.get('selectedEvent'),
    tsunamiAssessment: store.get('tsunamiAssessment'),
    impactResults: store.get('impactResults'),
    assets: ops.assets,
    viewport: store.get('viewportState'),
    exposures: ops.exposures,
    priorities: ops.priorities,
    freshnessStatus: store.get('realtimeStatus'),
  }));
}

function onNewRealtimeEvents(newEvents: EarthquakeEvent[], meta: RealtimePollMeta): void {
  const realtimeStatus = deriveRealtimeStatus({
    source: meta.source,
    updatedAt: meta.updatedAt,
    now: Date.now(),
    staleAfterMs: STALE_AFTER_MS,
    fallbackActive: meta.source !== 'server',
    networkError: null,
  });
  store.set('realtimeStatus', realtimeStatus);

  if (store.get('mode') !== 'realtime') return;

  // Delegate dedup + storage to earthquakeStore
  earthquakeStore.upsert(newEvents, {
    source: meta.source === 'fallback' ? 'usgs' : meta.source,
    issuedAt: meta.updatedAt,
    receivedAt: Date.now(),
  });
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

  syncServiceReadModel();
}

export function initRealtimeOrchestrator(): RealtimeOrchestratorHandle {
  const pollerHandle = startRealtimePolling(onNewRealtimeEvents);

  const unsubNetworkError = store.subscribe('networkError', (networkError) => {
    if (!networkError) return;

    const currentStatus = store.get('realtimeStatus');
    store.set('realtimeStatus', deriveRealtimeStatus({
      source: currentStatus.source || getLastSuccessSource(),
      updatedAt: currentStatus.updatedAt,
      now: Date.now(),
      staleAfterMs: currentStatus.staleAfterMs || STALE_AFTER_MS,
      fallbackActive: currentStatus.source !== 'server',
      networkError,
    }));
    syncServiceReadModel();
  });

  // Mode changes → clean up stale state
  const unsubMode = store.subscribe('mode', (mode) => {
    store.set('selectedEvent', null);

    if (mode === 'realtime') {
      pollerHandle.resetSeen();
      // Keep existing data visible while re-polling (no earthquakeStore.clear())
      pollerHandle.pollNow(); // Immediate fetch — no 60s wait
    }

    syncServiceReadModel();
  });

  return {
    pollerHandle,
    dispose: () => {
      unsubNetworkError();
      unsubMode();
      pollerHandle.stop();
    },
  };
}
