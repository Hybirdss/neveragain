import { describe, expect, it } from 'vitest';

import { consoleStore } from '../store';
import {
  deriveOperatorLatencyDurations,
  markOperatorLatencyMilestone,
  type OperatorLatencyState,
} from '../operatorLatency';

function createLatencyState(startedAt = Date.parse('2026-03-07T00:00:00.000Z')): OperatorLatencyState {
  return {
    startedAt,
    firstUsefulMapAt: null,
    firstTruthAt: null,
    firstActionQueueAt: null,
  };
}

describe('markOperatorLatencyMilestone', () => {
  it('records first useful map, truth, and action queue milestones once', () => {
    const startedAt = Date.parse('2026-03-07T00:00:00.000Z');
    const firstUsefulMapAt = startedAt + 120;
    const firstTruthAt = startedAt + 260;
    const firstActionQueueAt = startedAt + 420;

    const withMap = markOperatorLatencyMilestone(createLatencyState(startedAt), 'firstUsefulMapAt', firstUsefulMapAt);
    const withTruth = markOperatorLatencyMilestone(withMap, 'firstTruthAt', firstTruthAt);
    const withQueue = markOperatorLatencyMilestone(withTruth, 'firstActionQueueAt', firstActionQueueAt);

    expect(withQueue).toMatchObject({
      startedAt,
      firstUsefulMapAt,
      firstTruthAt,
      firstActionQueueAt,
    });
  });

  it('ignores duplicate completion writes after a milestone is already recorded', () => {
    const state = markOperatorLatencyMilestone(
      createLatencyState(),
      'firstTruthAt',
      Date.parse('2026-03-07T00:00:00.260Z'),
    );

    const duplicate = markOperatorLatencyMilestone(
      state,
      'firstTruthAt',
      Date.parse('2026-03-07T00:00:00.999Z'),
    );

    expect(duplicate).toBe(state);
    expect(duplicate.firstTruthAt).toBe(Date.parse('2026-03-07T00:00:00.260Z'));
  });
});

describe('deriveOperatorLatencyDurations', () => {
  it('derives elapsed durations from the start timestamp', () => {
    const startedAt = Date.parse('2026-03-07T00:00:00.000Z');

    expect(
      deriveOperatorLatencyDurations({
        startedAt,
        firstUsefulMapAt: startedAt + 120,
        firstTruthAt: startedAt + 260,
        firstActionQueueAt: startedAt + 420,
      }),
    ).toEqual({
      firstUsefulMapAt: 120,
      firstTruthAt: 260,
      firstActionQueueAt: 420,
    });
  });

  it('exposes a safe default operator latency state in the console store', () => {
    expect(consoleStore.get('operatorLatency')).toEqual({
      startedAt: null,
      firstUsefulMapAt: null,
      firstTruthAt: null,
      firstActionQueueAt: null,
    });
  });
});
