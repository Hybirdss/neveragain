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
  assert.equal(second.visibleCount, 1);
  assert.equal(second.provenance.cacheStatus, 'hit');
});

test('maritime snapshot service refreshes stale records', async () => {
  let calls = 0;
  const provider: MaritimeSnapshotProvider = {
    provider: 'synthetic',
    async loadProfileSnapshot(profileId, now) {
      calls++;
      return {
        source: 'synthetic',
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
  assert.equal(second.provenance.cacheStatus, 'stale');
  assert.equal(second.vessels[0]?.mmsi, '2');
});
