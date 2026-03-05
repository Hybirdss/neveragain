import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEventsKvKey, normalizeEventsSearch } from '../src/lib/eventsCache.ts';

test('normalizeEventsSearch sorts params into a stable cache signature', () => {
  assert.equal(
    normalizeEventsSearch('?limit=200&lat_max=46&lat_min=24&mag_min=2.5'),
    '?lat_max=46&lat_min=24&limit=200&mag_min=2.5',
  );
});

test('buildEventsKvKey matches regardless of query param order', () => {
  const a = new Request('https://api.namazue.dev/api/events?limit=200&mag_min=2.5&lat_min=24');
  const b = new Request('https://api.namazue.dev/api/events?lat_min=24&limit=200&mag_min=2.5');

  assert.equal(buildEventsKvKey(a), buildEventsKvKey(b));
  assert.equal(buildEventsKvKey(a), 'ev:?lat_min=24&limit=200&mag_min=2.5');
});
