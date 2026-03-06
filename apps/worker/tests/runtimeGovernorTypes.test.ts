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
import {
  GOVERNOR_STATES as SHARED_GOVERNOR_STATES,
  SOURCE_CLASSES as SHARED_SOURCE_CLASSES,
  type GovernorRegionScope as SharedGovernorRegionScope,
} from '@namazue/db';
import {
  GOVERNOR_STATES as GLOBE_GOVERNOR_STATES,
  SOURCE_CLASSES as GLOBE_SOURCE_CLASSES,
  type GovernorRegionScope as GlobeGovernorRegionScope,
} from '../../../apps/globe/src/governor/types.ts';

test('runtime governor exports canonical states and source classes', () => {
  assert.deepEqual(GOVERNOR_STATES, ['calm', 'watch', 'incident', 'recovery']);
  assert.deepEqual(SOURCE_CLASSES, ['event-truth', 'fast-situational', 'slow-infrastructure']);
  assert.equal(GOVERNOR_STATES, SHARED_GOVERNOR_STATES);
  assert.equal(GOVERNOR_STATES, GLOBE_GOVERNOR_STATES);
  assert.equal(SOURCE_CLASSES, SHARED_SOURCE_CLASSES);
  assert.equal(SOURCE_CLASSES, GLOBE_SOURCE_CLASSES);
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

test('runtime governor region scopes are explicitly modeled by activation tier', () => {
  const nationalScope: GovernorRegionScope = { kind: 'national' };
  const regionalScope: GlobeGovernorRegionScope = {
    kind: 'regional',
    regionIds: ['kanto'],
  };
  const viewportScope: SharedGovernorRegionScope = {
    kind: 'viewport',
    regionIds: ['kanto', 'tokai'],
    bounds: [138.2, 33.8, 141.5, 36.4],
  };

  assert.deepEqual(nationalScope, { kind: 'national' });
  assert.deepEqual(regionalScope.regionIds, ['kanto']);
  assert.deepEqual(viewportScope.bounds, [138.2, 33.8, 141.5, 36.4]);
});
