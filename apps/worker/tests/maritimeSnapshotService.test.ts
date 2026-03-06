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
    ttlMs: 5_000,
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
  assert.equal(second.visibleCount, 1);
  assert.equal(second.provenance.cacheStatus, 'hit');
  assert.equal(second.provenance.fallbackReason, 'not-configured');
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
    ttlMs: 2_000,
  });

  const first = await service.getSnapshot({ profileId: 'japan-wide', now: 1_000 });
  const second = await service.getSnapshot({ profileId: 'japan-wide', now: 4_100 });

  assert.equal(calls, 2);
  assert.equal(first.provenance.cacheStatus, 'miss');
  assert.equal(first.provenance.fallbackReason, 'upstream-error');
  assert.equal(second.provenance.cacheStatus, 'stale');
  assert.equal(second.provenance.fallbackReason, 'upstream-error');
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
    ttlMs: 1_000,
  });

  const first = await service.getSnapshot({ profileId: 'japan-wide', now: 1_000 });
  assert.equal(first.vessels[0]?.mmsi, 'stale-1');

  const stale = await service.getSnapshot({ profileId: 'japan-wide', now: 3_000 });
  assert.equal(calls, 2);
  assert.equal(stale.provenance.cacheStatus, 'stale');
  assert.equal(stale.provenance.refreshInFlight, true);
  assert.equal(stale.vessels[0]?.mmsi, 'stale-1');

  resolveRefresh?.({
    source: 'synthetic',
    fallbackReason: 'not-configured',
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
    ttlMs: 5_000,
  });

  const firstPromise = service.getSnapshot({ profileId: 'japan-wide', now: 1_000 });
  const secondPromise = service.getSnapshot({ profileId: 'japan-wide', now: 1_000 });
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls, 1);

  resolveFirst?.({
    source: 'synthetic',
    fallbackReason: 'not-configured',
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
