import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIngestEvent, type IngestEventInput } from '../src/lib/eventsValidation.ts';

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

test('parseIngestEvent accepts valid payload and normalizes values', () => {
  const parsed = parseIngestEvent(
    buildBaseEvent({
      id: '  evt-2  ',
      source: 'JMA',
      fault_type: 'INTERFACE',
      tsunami: 'true',
    }),
    Date.parse('2026-03-06T00:04:00.000Z'),
  );

  assert.ok('value' in parsed);
  if ('error' in parsed) return;
  assert.equal(parsed.value.id, 'evt-2');
  assert.equal(parsed.value.source, 'jma');
  assert.equal(parsed.value.fault_type, 'interface');
  assert.equal(parsed.value.tsunami, true);
});

test('parseIngestEvent rejects missing event.id', () => {
  const parsed = parseIngestEvent(buildBaseEvent({ id: '   ' }));
  assert.deepEqual(parsed, { error: 'event.id is required' });
});

test('parseIngestEvent rejects invalid source values', () => {
  const parsed = parseIngestEvent(buildBaseEvent({ source: 'kma' }));
  assert.deepEqual(parsed, {
    error: 'event.source must be one of: usgs|jma|gcmt (id=evt-1)',
  });
});

test('parseIngestEvent rejects incomplete moment tensor triplets', () => {
  const parsed = parseIngestEvent(
    buildBaseEvent({
      mt_strike: 120,
      mt_dip: null,
      mt_rake: -90,
    }),
  );
  assert.deepEqual(parsed, {
    error: 'event.mt_nodal_plane_1 requires strike, dip, and rake together (id=evt-1)',
  });
});

test('parseIngestEvent rejects timestamps too far in the future', () => {
  const parsed = parseIngestEvent(
    buildBaseEvent({ time: '2026-03-06T00:20:00.000Z' }),
    Date.parse('2026-03-06T00:00:00.000Z'),
  );
  assert.deepEqual(parsed, {
    error: 'event.time is too far in the future (id=evt-1)',
  });
});

test('parseIngestEvent rejects out-of-range depth', () => {
  const parsed = parseIngestEvent(buildBaseEvent({ depth_km: 900 }));
  assert.deepEqual(parsed, {
    error: 'event.depth_km must be between 0 and 700 (id=evt-1)',
  });
});
