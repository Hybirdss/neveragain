import test from 'node:test';
import assert from 'node:assert/strict';
import { runCronStep } from '../src/lib/cronStep.ts';

test('runCronStep returns the step result when work succeeds', async () => {
  const errors: unknown[][] = [];
  const logger = {
    error: (...args: unknown[]) => {
      errors.push(args);
    },
  };

  const result = await runCronStep('backfill', async () => 2, logger);

  assert.equal(result, 2);
  assert.equal(errors.length, 0);
});

test('runCronStep logs and returns null when work throws', async () => {
  const errors: unknown[][] = [];
  const logger = {
    error: (...args: unknown[]) => {
      errors.push(args);
    },
  };

  const result = await runCronStep('backfill', async () => {
    throw new Error('db offline');
  }, logger);

  assert.equal(result, null);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.[0], '[cron] backfill failed:');
  assert.ok(errors[0]?.[1] instanceof Error);
});
