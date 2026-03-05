import test from 'node:test';
import assert from 'node:assert/strict';
import { parseValidatedRange } from '../src/lib/searchValidation.ts';

test('parseValidatedRange accepts valid magnitude range', () => {
  const parsed = parseValidatedRange('4.5', '7', 'mag_min', 'mag_max', 0, 10);
  assert.deepEqual(parsed, { min: 4.5, max: 7, error: null });
});

test('parseValidatedRange rejects inverted range order', () => {
  const parsed = parseValidatedRange(7, 5, 'mag_min', 'mag_max', 0, 10);
  assert.equal(parsed.error, 'mag_min must be less than or equal to mag_max');
});

test('parseValidatedRange rejects out-of-range values', () => {
  const parsed = parseValidatedRange(-1, null, 'depth_min', 'depth_max', 0, 700);
  assert.equal(parsed.error, 'depth_min must be between 0 and 700');
});
