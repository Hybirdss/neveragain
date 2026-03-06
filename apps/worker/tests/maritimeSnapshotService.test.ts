import test from 'node:test';
import assert from 'node:assert/strict';

import { MaritimeSnapshotService } from '../src/maritime/service.ts';
import type { MaritimeSnapshotProvider, MaritimeSnapshotRecord, MaritimeSnapshotStore } from '../src/maritime/service.ts';

class MemorySnapshotStore implements MaritimeSnapshotStore {
  private readonly records = new Map<string, MaritimeSnapshotRecord>();

  async get(profileId: string): Promise<MaritimeSnapshotRecord | null> {
    return this.records.get(profileId) ?? null;
  }

  async put(record: MaritimeSnapshotRecord): Promise<void> {
    this.records.set(record.profile.id, record);
  }
}

test('maritime snapshot service caches a profile snapshot and filters bounds on read', async () => {
  let calls = 0;
  const provider: MaritimeSnapshotProvider = {
    provider: 'synthetic',
    async loadProfileSnapshot(profileId, now) {
      calls++;
      return {
        source: 'synthetic',
        fallbackReason: 'not-configured',
        diagnostics: {
          attemptedLive: false,
          upstreamPhase: 'not-configured',
          messagesReceived: 0,
          socketOpened: false,
          subscriptionSent: false,
        },
        profile: {
          id: profileId,
          label: 'Japan Wide',
          boundingBoxes: [],
          laneIds: [],
          demoFleetScale: 2,
        },
        generatedAt: now,
        totalTracked: 2,
        vessels: [
          {
            mmsi: '1',
            name: 'TOKYO ONE',
            lat: 35,
            lng: 140,
            cog: 90,
            sog: 10,
            type: 'cargo',
            lastUpdate: now,
            trail: [[140, 35]],
          },
          {
            mmsi: '2',
            name: 'KOBE ONE',
            lat: 34.6,
            lng: 135.2,
            cog: 90,
            sog: 10,
            type: 'cargo',
            lastUpdate: now,
            trail: [[135.2, 34.6]],
          },
        ],
      };
    },
  };

  const service = new MaritimeSnapshotService({
    provider,
    store: new MemorySnapshotStore(),
    resolveRuntimeGovernor() {
      return {
        activation: {
          state: 'watch',
          sourceClasses: ['event-truth', 'fast-situational'],
          regionScope: {
            kind: 'regional',
            regionIds: ['kanto'],
          },
          activatedAt: '2026-03-07T00:00:00.000Z',
          reason: 'moderate seismic activity activated watch mode',
        },
        refreshMs: 60_000,
      };
    },
  });

  const first = await service.getSnapshot({
    profileId: 'japan-wide',
    bounds: [138.5, 33.5, 141.5, 36.5],
    now: 1_000,
  });
  const second = await service.getSnapshot({
    profileId: 'japan-wide',
    bounds: [138.5, 33.5, 141.5, 36.5],
    now: 4_000,
  });

  assert.equal(calls, 1);
  assert.equal(first.visibleCount, 1);
  assert.equal(first.totalTracked, 2);
  assert.equal(first.provenance.cacheStatus, 'miss');
  assert.equal(first.provenance.fallbackReason, 'not-configured');
  assert.equal(first.provenance.diagnostics.attemptedLive, false);
  assert.equal(first.provenance.diagnostics.upstreamPhase, 'not-configured');
  assert.equal(first.provenance.diagnostics.messagesReceived, 0);
  assert.equal(first.provenance.diagnostics.socketOpened, false);
  assert.equal(first.provenance.diagnostics.subscriptionSent, false);
  assert.equal(first.provenance.governorState, 'watch');
  assert.equal(first.provenance.policyRefreshMs, 60_000);
  assert.deepEqual(first.provenance.regionScope, {
    kind: 'regional',
    regionIds: ['kanto'],
  });
  assert.equal(second.visibleCount, 1);
  assert.equal(second.provenance.cacheStatus, 'hit');
  assert.equal(second.provenance.fallbackReason, 'not-configured');
  assert.equal(second.provenance.governorState, 'watch');
});

test('maritime snapshot service refreshes stale records', async () => {
  let calls = 0;
  const provider: MaritimeSnapshotProvider = {
    provider: 'synthetic',
    async loadProfileSnapshot(profileId, now) {
      calls++;
      return {
        source: 'synthetic',
        fallbackReason: calls === 1 ? 'upstream-error' : 'connect-timeout',
        diagnostics: {
          attemptedLive: true,
          upstreamPhase: calls === 1 ? 'upstream-error' : 'connect-timeout',
          messagesReceived: 0,
          socketOpened: false,
          subscriptionSent: false,
          lastError: calls === 1 ? 'upstream error' : 'connect timeout',
        },
        profile: {
          id: profileId,
          label: 'Japan Wide',
          boundingBoxes: [],
          laneIds: [],
          demoFleetScale: 2,
        },
        generatedAt: now,
        totalTracked: 1,
        vessels: [
          {
            mmsi: String(calls),
            name: `VESSEL ${calls}`,
            lat: 35,
            lng: 140,
            cog: 90,
            sog: 10,
            type: 'cargo',
            lastUpdate: now,
            trail: [[140, 35]],
          },
        ],
      };
    },
  };

  const service = new MaritimeSnapshotService({
    provider,
    store: new MemorySnapshotStore(),
    ttlMs: 60_000,
    resolveRuntimeGovernor() {
      return {
        activation: {
          state: 'incident',
          sourceClasses: ['event-truth', 'fast-situational', 'slow-infrastructure'],
          regionScope: {
            kind: 'regional',
            regionIds: ['tokai'],
          },
          activatedAt: '2026-03-07T00:00:00.000Z',
          reason: 'large magnitude event escalated runtime into incident mode',
        },
        refreshMs: 2_000,
      };
    },
  });

  const first = await service.getSnapshot({ profileId: 'japan-wide', now: 1_000 });
  const second = await service.getSnapshot({ profileId: 'japan-wide', now: 4_100 });

  assert.equal(calls, 2);
  assert.equal(first.provenance.cacheStatus, 'miss');
  assert.equal(first.provenance.fallbackReason, 'upstream-error');
  assert.equal(second.provenance.cacheStatus, 'stale');
  assert.equal(second.provenance.fallbackReason, 'upstream-error');
  assert.equal(second.provenance.governorState, 'incident');
  assert.equal(second.provenance.policyRefreshMs, 2_000);
  assert.equal(second.vessels[0]?.mmsi, '1');
});

test('maritime snapshot service returns stale data immediately while refreshing in background', async () => {
  let calls = 0;
  let resolveRefresh: ((value: Awaited<ReturnType<MaritimeSnapshotProvider['loadProfileSnapshot']>>) => void) | null = null;

  const provider: MaritimeSnapshotProvider = {
    provider: 'synthetic',
    loadProfileSnapshot(profileId, now) {
      calls++;
      if (calls === 1) {
        return Promise.resolve({
          source: 'synthetic',
          fallbackReason: 'upstream-error',
          diagnostics: {
            attemptedLive: true,
            upstreamPhase: 'upstream-error',
            messagesReceived: 0,
            socketOpened: false,
            subscriptionSent: false,
            lastError: 'upstream error',
          },
          profile: {
            id: profileId,
            label: 'Japan Wide',
            boundingBoxes: [],
            laneIds: [],
            demoFleetScale: 2,
          },
          generatedAt: now,
          totalTracked: 1,
          vessels: [{
            mmsi: 'stale-1',
            name: 'STALE ONE',
            lat: 35,
            lng: 140,
            cog: 90,
            sog: 10,
            type: 'cargo',
            lastUpdate: now,
            trail: [[140, 35]],
          }],
        });
      }

      return new Promise((resolve) => {
        resolveRefresh = resolve;
      });
    },
  };

  const service = new MaritimeSnapshotService({
    provider,
    store: new MemorySnapshotStore(),
    resolveRuntimeGovernor() {
      return {
        activation: {
          state: 'incident',
          sourceClasses: ['event-truth', 'fast-situational', 'slow-infrastructure'],
          regionScope: {
            kind: 'regional',
            regionIds: ['tokai'],
          },
          activatedAt: '2026-03-07T00:00:00.000Z',
          reason: 'material exposure count escalated runtime into incident mode',
        },
        refreshMs: 1_000,
      };
    },
  });

  const first = await service.getSnapshot({ profileId: 'japan-wide', now: 1_000 });
  assert.equal(first.vessels[0]?.mmsi, 'stale-1');

  const stale = await service.getSnapshot({ profileId: 'japan-wide', now: 3_000 });
  assert.equal(calls, 2);
  assert.equal(stale.provenance.cacheStatus, 'stale');
  assert.equal(stale.provenance.refreshInFlight, true);
  assert.equal(stale.provenance.governorState, 'incident');
  assert.equal(stale.vessels[0]?.mmsi, 'stale-1');

  resolveRefresh?.({
    source: 'synthetic',
    fallbackReason: 'not-configured',
    diagnostics: {
      attemptedLive: false,
      upstreamPhase: 'not-configured',
      messagesReceived: 0,
      socketOpened: false,
      subscriptionSent: false,
    },
    profile: {
      id: 'japan-wide',
      label: 'Japan Wide',
      boundingBoxes: [],
      laneIds: [],
      demoFleetScale: 2,
    },
    generatedAt: 3_000,
    totalTracked: 1,
    vessels: [{
      mmsi: 'fresh-1',
      name: 'FRESH ONE',
      lat: 35.1,
      lng: 140.1,
      cog: 95,
      sog: 11,
      type: 'cargo',
      lastUpdate: 3_000,
      trail: [[140.1, 35.1]],
    }],
  });

  await Promise.resolve();
  await Promise.resolve();

  const refreshed = await service.getSnapshot({ profileId: 'japan-wide', now: 3_100 });
  assert.equal(refreshed.provenance.cacheStatus, 'hit');
  assert.equal(refreshed.provenance.refreshInFlight, false);
  assert.equal(refreshed.vessels[0]?.mmsi, 'fresh-1');
});

test('maritime snapshot service deduplicates concurrent cache misses', async () => {
  let calls = 0;
  let resolveFirst: ((value: Awaited<ReturnType<MaritimeSnapshotProvider['loadProfileSnapshot']>>) => void) | null = null;

  const provider: MaritimeSnapshotProvider = {
    provider: 'synthetic',
    loadProfileSnapshot(profileId, now) {
      calls++;
      return new Promise((resolve) => {
        resolveFirst = resolve;
      });
    },
  };

  const service = new MaritimeSnapshotService({
    provider,
    store: new MemorySnapshotStore(),
    resolveRuntimeGovernor() {
      return {
        activation: {
          state: 'calm',
          sourceClasses: ['event-truth'],
          regionScope: {
            kind: 'national',
          },
          activatedAt: '2026-03-07T00:00:00.000Z',
          reason: 'no material seismic escalation detected',
        },
        refreshMs: 60_000,
      };
    },
  });

  const firstPromise = service.getSnapshot({ profileId: 'japan-wide', now: 1_000 });
  const secondPromise = service.getSnapshot({ profileId: 'japan-wide', now: 1_000 });
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls, 1);

  resolveFirst?.({
    source: 'synthetic',
    fallbackReason: 'not-configured',
    diagnostics: {
      attemptedLive: false,
      upstreamPhase: 'not-configured',
      messagesReceived: 0,
      socketOpened: false,
      subscriptionSent: false,
    },
    profile: {
      id: 'japan-wide',
      label: 'Japan Wide',
      boundingBoxes: [],
      laneIds: [],
      demoFleetScale: 2,
    },
    generatedAt: 1_000,
    totalTracked: 1,
    vessels: [{
      mmsi: 'shared-1',
      name: 'SHARED ONE',
      lat: 35,
      lng: 140,
      cog: 90,
      sog: 10,
      type: 'cargo',
      lastUpdate: 1_000,
      trail: [[140, 35]],
    }],
  });

  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  assert.equal(first.vessels[0]?.mmsi, 'shared-1');
  assert.equal(second.vessels[0]?.mmsi, 'shared-1');
  assert.equal(first.provenance.cacheStatus, 'miss');
  assert.equal(second.provenance.cacheStatus, 'miss');
});
