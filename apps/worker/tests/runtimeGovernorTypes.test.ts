import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GOVERNOR_STATES,
  SOURCE_CLASSES,
  type GovernorActivation,
  type GovernorPolicyEnvelope,
  type GovernorRegionScope,
  type GovernorState,
  type SourceClass,
} from '../src/governor/types.ts';

test('runtime governor exports canonical states and source classes', () => {
  assert.deepEqual(GOVERNOR_STATES, ['calm', 'watch', 'incident', 'recovery']);
  assert.deepEqual(SOURCE_CLASSES, ['event-truth', 'fast-situational', 'slow-infrastructure']);
});

test('runtime governor contracts compose into a canonical policy envelope', () => {
  const state: GovernorState = 'incident';
  const sourceClass: SourceClass = 'fast-situational';

  const regionScope: GovernorRegionScope = {
    kind: 'regional',
    regionIds: ['kanto', 'tokai'],
  };

  const activation: GovernorActivation = {
    state,
    sourceClasses: [sourceClass, 'event-truth'],
    regionScope,
    activatedAt: '2026-03-07T00:00:00.000Z',
    reason: 'material seismic impact forming along the tokai corridor',
  };

  const envelope: GovernorPolicyEnvelope = {
    states: GOVERNOR_STATES,
    sourceClasses: SOURCE_CLASSES,
    activation,
  };

  assert.equal(envelope.activation.state, 'incident');
  assert.equal(envelope.activation.regionScope.kind, 'regional');
  assert.deepEqual(envelope.activation.regionScope.regionIds, ['kanto', 'tokai']);
  assert.deepEqual(envelope.activation.sourceClasses, ['fast-situational', 'event-truth']);
});
