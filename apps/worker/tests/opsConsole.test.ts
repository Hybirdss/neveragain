import test from 'node:test';
import assert from 'node:assert/strict';

import { buildConsoleSnapshot } from '../src/lib/consoleOps.ts';

test('buildConsoleSnapshot derives backend-owned console truth for a viewport', () => {
  const now = Date.now();
  const snapshot = buildConsoleSnapshot({
    now,
    updatedAt: now - 5_000,
    source: 'server',
    currentSelectedEventId: null,
    events: [
      {
        id: 'tokyo-impact',
        lat: 35.68,
        lng: 139.76,
        depth_km: 22,
        magnitude: 6.8,
        time: now - 10 * 60_000,
        faultType: 'crustal',
        tsunami: false,
        place: { text: 'Tokyo Bay' },
      },
    ],
    viewport: {
      center: { lat: 35.68, lng: 139.76 },
      zoom: 9.2,
      bounds: [138.4, 34.8, 140.9, 36.4],
      tier: 'regional',
      activeRegion: 'kanto',
    },
  });

  assert.equal(snapshot.mode, 'event');
  assert.equal(snapshot.selectedEvent?.id, 'tokyo-impact');
  assert.ok(snapshot.intensityGrid);
  assert.ok(snapshot.exposures.length > 0);
  assert.ok(snapshot.priorities.length > 0);
  assert.equal(snapshot.readModel.viewport?.activeRegion, 'kanto');
  assert.ok(snapshot.readModel.visibleExposureSummary.length > 0);
  assert.ok(snapshot.readModel.visiblePriorityQueue.length > 0);
  assert.equal(snapshot.realtimeStatus.state, 'fresh');
});

test('buildConsoleSnapshot keeps calm mode when no significant event is active', () => {
  const now = Date.now();
  const snapshot = buildConsoleSnapshot({
    now,
    updatedAt: now - 5_000,
    source: 'server',
    currentSelectedEventId: null,
    events: [],
    viewport: {
      center: { lat: 35.68, lng: 139.76 },
      zoom: 5.5,
      bounds: [122, 24, 150, 46],
      tier: 'national',
      activeRegion: 'kanto',
    },
  });

  assert.equal(snapshot.mode, 'calm');
  assert.equal(snapshot.selectedEvent, null);
  assert.equal(snapshot.readModel.currentEvent, null);
  assert.equal(snapshot.readModel.visiblePriorityQueue.length, 0);
});
