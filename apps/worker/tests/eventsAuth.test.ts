import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeInternal } from '../src/lib/eventsAuth.ts';

test('authorizeInternal allows request when internal token is not configured', () => {
  assert.equal(authorizeInternal(undefined, undefined), true);
  assert.equal(authorizeInternal('', 'anything'), true);
});

test('authorizeInternal allows matching tokens and rejects mismatches', () => {
  assert.equal(authorizeInternal('secret', 'secret'), true);
  assert.equal(authorizeInternal('secret', 'wrong'), false);
  assert.equal(authorizeInternal('secret', undefined), false);
});
