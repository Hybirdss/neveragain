import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  fetchOpsConsoleEarthquakes,
  type OpsConsoleEarthquakeRow,
} from '@namazue/adapters-storage';

test('ops route reads console events through adapters-storage instead of inline drizzle queries', () => {
  const routeSource = readFileSync(new URL('../src/routes/ops.ts', import.meta.url), 'utf8');

  assert.match(routeSource, /from '@namazue\/adapters-storage'/);
  assert.doesNotMatch(routeSource, /from 'drizzle-orm'/);
  assert.doesNotMatch(routeSource, /from '@namazue\/db'/);
});

test('fetchOpsConsoleEarthquakes maps storage rows through an explicit adapter interface', async () => {
  const rows: OpsConsoleEarthquakeRow[] = [
    {
      id: 'eq-ops-1',
      lat: 38.2,
      lng: 142.4,
      depth_km: 24,
      magnitude: 6.7,
      time: new Date('2026-03-07T03:45:00.000Z'),
      place: 'Offshore Miyagi',
      fault_type: 'interface',
      tsunami: true,
    },
    {
      id: 'eq-ops-2',
      lat: 35.7,
      lng: 140.8,
      depth_km: 68,
      magnitude: 5.1,
      time: '2026-03-07T03:30:00.000Z',
      place: null,
      fault_type: null,
      tsunami: false,
    },
  ];

  const query = {
    async listRecentJapanEarthquakes(limit: number) {
      assert.equal(limit, 80);
      return rows;
    },
  };

  const events = await fetchOpsConsoleEarthquakes(query);

  assert.deepEqual(events, [
    {
      id: 'eq-ops-1',
      lat: 38.2,
      lng: 142.4,
      depth_km: 24,
      magnitude: 6.7,
      time: Date.parse('2026-03-07T03:45:00.000Z'),
      faultType: 'interface',
      tsunami: true,
      place: { text: 'Offshore Miyagi' },
    },
    {
      id: 'eq-ops-2',
      lat: 35.7,
      lng: 140.8,
      depth_km: 68,
      magnitude: 5.1,
      time: Date.parse('2026-03-07T03:30:00.000Z'),
      faultType: 'crustal',
      tsunami: false,
      place: { text: 'Unknown location' },
    },
  ]);
});
