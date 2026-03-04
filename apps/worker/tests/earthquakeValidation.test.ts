import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFiniteNumber,
  parseTimestamp,
  validateEventTime,
  validateMomentTensor,
  validateRange,
  validateRangePair,
} from '../src/lib/earthquakeValidation.ts';

test('parseFiniteNumber treats empty string as null', () => {
  assert.equal(parseFiniteNumber(''), null);
  assert.equal(parseFiniteNumber('   '), null);
  assert.equal(parseFiniteNumber('12.3'), 12.3);
});

test('parseTimestamp parses seconds/milliseconds and rejects invalid values', () => {
  const sec = parseTimestamp('1710000000');
  assert.ok(sec instanceof Date);
  assert.equal(sec?.toISOString(), '2024-03-09T16:00:00.000Z');

  const ms = parseTimestamp('1710000000000');
  assert.ok(ms instanceof Date);
  assert.equal(ms?.toISOString(), '2024-03-09T16:00:00.000Z');

  assert.equal(parseTimestamp('not-a-date'), null);
});

test('validateRange and validateRangePair enforce numeric bounds/order', () => {
  assert.equal(validateRange('lat', 35, -90, 90), null);
  assert.equal(validateRange('lat', 120, -90, 90), 'lat must be between -90 and 90');

  assert.equal(validateRangePair('mag_min', 4, 'mag_max', 6), null);
  assert.equal(
    validateRangePair('mag_min', 7, 'mag_max', 5),
    'mag_min must be less than or equal to mag_max',
  );
});

test('validateEventTime rejects future skew and too-old dates', () => {
  const now = Date.parse('2026-03-04T00:00:00.000Z');

  const ok = new Date('2026-03-04T00:03:00.000Z');
  assert.equal(validateEventTime(ok, now), null);

  const future = new Date('2026-03-04T00:20:00.000Z');
  assert.equal(validateEventTime(future, now), 'event.time is too far in the future');

  const old = new Date('1899-12-31T23:59:59.000Z');
  assert.equal(validateEventTime(old, now), 'event.time must be in or after 1900');
});

test('validateMomentTensor enforces triplet completeness and physical ranges', () => {
  assert.equal(validateMomentTensor(120, 45, -90, 'mt1'), null);

  assert.equal(
    validateMomentTensor(120, null, -90, 'mt1'),
    'mt1 requires strike, dip, and rake together',
  );
  assert.equal(
    validateMomentTensor(400, 45, -90, 'mt1'),
    'mt1.strike must be between 0 and 360',
  );
  assert.equal(
    validateMomentTensor(120, 95, -90, 'mt1'),
    'mt1.dip must be between 0 and 90',
  );
  assert.equal(
    validateMomentTensor(120, 45, -200, 'mt1'),
    'mt1.rake must be between -180 and 180',
  );
});
