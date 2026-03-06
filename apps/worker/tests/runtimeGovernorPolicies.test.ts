import test from 'node:test';
import assert from 'node:assert/strict';

import { getSourcePolicy, GOVERNOR_SOURCES, type GovernorSource } from '../src/governor/policies.ts';

test('runtime governor exposes canonical source keys', () => {
  assert.deepEqual(GOVERNOR_SOURCES, ['events', 'maritime', 'rail', 'power', 'water', 'hospitals']);
});

test('maritime cadence slows in calm and accelerates in incident', () => {
  assert.equal(getSourcePolicy('maritime', 'calm').cadence.refreshMs, 60_000);
  assert.equal(getSourcePolicy('maritime', 'incident').cadence.refreshMs, 10_000);
});

test('hospitals remain event-driven across all governor states', () => {
  const policy = getSourcePolicy('hospitals', 'watch');

  assert.equal(policy.cadence.strategy, 'event-driven');
  assert.equal(policy.cadence.refreshMs, null);
  assert.equal(policy.sourceClass, 'slow-infrastructure');
});

test('each source resolves to a complete stateful policy envelope', () => {
  const sources: GovernorSource[] = [...GOVERNOR_SOURCES];
  const incidentPolicies = sources.map(source => getSourcePolicy(source, 'incident'));

  assert.deepEqual(
    incidentPolicies.map(policy => policy.source),
    ['events', 'maritime', 'rail', 'power', 'water', 'hospitals'],
  );
  assert.ok(incidentPolicies.every(policy => policy.state === 'incident'));
});
