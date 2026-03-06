import test from 'node:test';
import assert from 'node:assert/strict';

import { maritimeRoute } from '../src/routes/maritime.ts';

test('maritime route returns a wider japan-wide snapshot by default', async () => {
  const response = await maritimeRoute.request('http://example.com/vessels');
  assert.equal(response.status, 200);

  const payload = await response.json() as {
    source: string;
    profile: { id: string };
    total_tracked: number;
    visible_count: number;
    vessels: unknown[];
  };

  assert.equal(payload.source, 'synthetic');
  assert.equal(payload.profile.id, 'japan-wide');
  assert.ok(payload.total_tracked > 122);
  assert.equal(payload.vessels.length, payload.visible_count);
});

test('maritime route can filter to a requested bbox', async () => {
  const response = await maritimeRoute.request(
    'http://example.com/vessels?west=138.5&south=33.5&east=141.5&north=36.5&profile=japan-wide',
  );
  assert.equal(response.status, 200);

  const payload = await response.json() as {
    visible_count: number;
    total_tracked: number;
    vessels: Array<{ lat: number; lng: number }>;
  };

  assert.ok(payload.total_tracked >= payload.visible_count);
  assert.ok(payload.visible_count > 0);
  assert.ok(payload.vessels.every((v) => (
    v.lng >= 138.5 &&
    v.lng <= 141.5 &&
    v.lat >= 33.5 &&
    v.lat <= 36.5
  )));
});
