import test from 'node:test';
import assert from 'node:assert/strict';

import { GOVERNED_SOURCES, getSourcePolicy } from '../src/governor/policies.ts';

test('runtime governor exposes the canonical governed source set', () => {
  assert.deepEqual(GOVERNED_SOURCES, ['events', 'maritime', 'rail', 'power', 'water', 'hospitals']);
});

test('maritime cadence slows in calm and accelerates in incident', () => {
  const calm = getSourcePolicy('maritime', 'calm');
  const incident = getSourcePolicy('maritime', 'incident');

  assert.equal(calm.cadenceMode, 'poll');
  assert.equal(calm.refreshMs, 60_000);
  assert.equal(incident.cadenceMode, 'poll');
  assert.equal(incident.refreshMs, 10_000);
  assert.equal(calm.sourceClass, 'fast-situational');
});

test('events and rail use their expected governor cadences', () => {
  assert.equal(getSourcePolicy('events', 'watch').refreshMs, 30_000);
  assert.equal(getSourcePolicy('rail', 'recovery').refreshMs, 120_000);
  assert.equal(getSourcePolicy('power', 'incident').refreshMs, 120_000);
  assert.equal(getSourcePolicy('water', 'calm').refreshMs, 900_000);
});

test('hospitals are modeled as event-driven instead of fixed polling', () => {
  const policy = getSourcePolicy('hospitals', 'incident');

  assert.equal(policy.cadenceMode, 'event-driven');
  assert.equal(policy.refreshMs, null);
  assert.equal(policy.sourceClass, 'slow-infrastructure');
  assert.equal(policy.trigger, 'incident-change');
});
