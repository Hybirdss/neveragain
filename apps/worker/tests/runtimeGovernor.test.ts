import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveGovernorState } from '../src/governor/runtimeGovernor.ts';

test('large coastal event escalates runtime to incident', () => {
  const activation = resolveGovernorState({
    magnitude: 6.8,
    tsunami: true,
    exposureCount: 12,
    activeRegion: 'kanto',
    now: '2026-03-07T00:00:00.000Z',
  });

  assert.equal(activation.state, 'incident');
  assert.deepEqual(activation.regionScope, {
    kind: 'regional',
    regionIds: ['kanto'],
  });
  assert.deepEqual(activation.sourceClasses, ['event-truth', 'fast-situational', 'slow-infrastructure']);
});

test('moderate seismic activity enters watch without over-activating slow infrastructure', () => {
  const activation = resolveGovernorState({
    magnitude: 5.1,
    tsunami: false,
    exposureCount: 2,
    activeRegion: 'tokai',
    now: '2026-03-07T00:00:00.000Z',
  });

  assert.equal(activation.state, 'watch');
  assert.deepEqual(activation.sourceClasses, ['event-truth', 'fast-situational']);
});

test('recent incident decays into recovery before returning to calm', () => {
  const activation = resolveGovernorState({
    magnitude: 3.2,
    tsunami: false,
    exposureCount: 0,
    activeRegion: 'kansai',
    lastIncidentAt: '2026-03-07T00:05:00.000Z',
    now: '2026-03-07T00:20:00.000Z',
  });

  assert.equal(activation.state, 'recovery');
  assert.equal(activation.regionScope.kind, 'regional');
});

test('inactive periods resolve to calm national scope', () => {
  const activation = resolveGovernorState({
    magnitude: 2.9,
    tsunami: false,
    exposureCount: 0,
    now: '2026-03-07T02:00:00.000Z',
  });

  assert.equal(activation.state, 'calm');
  assert.deepEqual(activation.regionScope, { kind: 'national' });
  assert.deepEqual(activation.sourceClasses, ['event-truth']);
});
