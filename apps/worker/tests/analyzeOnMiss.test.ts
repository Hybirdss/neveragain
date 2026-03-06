import test from 'node:test';
import assert from 'node:assert/strict';

import { planAnalyzeCacheMiss } from '../src/lib/analyzeOnMiss.ts';

test('plans synchronous generation for Japan M4+ cache misses', () => {
  assert.equal(
    planAnalyzeCacheMiss({ magnitude: 4.2, lat: 35.1, lng: 139.7 }),
    'generate-and-store',
  );
  assert.equal(
    planAnalyzeCacheMiss({ magnitude: 6.1, lat: 24.3, lng: 124.1 }),
    'generate-and-store',
  );
});

test('plans deterministic immediate answers for lower-priority cache misses', () => {
  assert.equal(
    planAnalyzeCacheMiss({ magnitude: 3.8, lat: 35.1, lng: 139.7 }),
    'deterministic',
  );
  assert.equal(
    planAnalyzeCacheMiss({ magnitude: 6.8, lat: 37.7, lng: -122.4 }),
    'deterministic',
  );
  assert.equal(
    planAnalyzeCacheMiss({ magnitude: 2.9, lat: -6.2, lng: 106.8 }),
    'deterministic',
  );
});
