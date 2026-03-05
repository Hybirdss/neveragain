import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBulkIngestEvents } from '../src/lib/eventsBulk.ts';
import type { IngestEventInput } from '../src/lib/eventsValidation.ts';

function buildBaseEvent(overrides: Partial<IngestEventInput> = {}): IngestEventInput {
  return {
    id: 'evt-1',
    lat: 35.6895,
    lng: 139.6917,
    depth_km: 30,
    magnitude: 6.1,
    time: '2024-03-06T00:00:00.000Z',
    ...overrides,
  };
}

test('parseBulkIngestEvents returns accepted events and indexed rejections', () => {
  const result = parseBulkIngestEvents([
    buildBaseEvent({ id: 'evt-1' }),
    buildBaseEvent({ id: '   ' }),
    buildBaseEvent({ id: 'evt-3', source: 'JMA' }),
  ]);

  assert.deepEqual(result.acceptedIds, ['evt-1', 'evt-3']);
  assert.equal(result.acceptedEvents.length, 2);
  assert.equal(result.acceptedEvents[1]?.source, 'jma');
  assert.deepEqual(result.rejected, [{ index: 1, error: 'event.id is required' }]);
});

test('parseBulkIngestEvents applies nowMs to event-time validation', () => {
  const result = parseBulkIngestEvents([
    buildBaseEvent({
      id: 'future',
      time: '2026-03-06T00:20:00.000Z',
    }),
  ], Date.parse('2026-03-06T00:00:00.000Z'));

  assert.deepEqual(result.acceptedIds, []);
  assert.deepEqual(result.rejected, [{
    index: 0,
    error: 'event.time is too far in the future (id=future)',
  }]);
});
