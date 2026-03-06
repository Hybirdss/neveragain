export type OperatorLatencyMilestone =
  | 'firstUsefulMapAt'
  | 'firstTruthAt'
  | 'firstActionQueueAt';

export interface OperatorLatencyState {
  startedAt: number | null;
  firstUsefulMapAt: number | null;
  firstTruthAt: number | null;
  firstActionQueueAt: number | null;
}

export interface OperatorLatencyDurations {
  firstUsefulMapAt: number | null;
  firstTruthAt: number | null;
  firstActionQueueAt: number | null;
}

export function createDefaultOperatorLatencyState(startedAt: number | null = null): OperatorLatencyState {
  return {
    startedAt,
    firstUsefulMapAt: null,
    firstTruthAt: null,
    firstActionQueueAt: null,
  };
}

export function markOperatorLatencyMilestone(
  state: OperatorLatencyState,
  milestone: OperatorLatencyMilestone,
  completedAt: number,
): OperatorLatencyState {
  if (state[milestone] !== null) {
    return state;
  }

  return {
    ...state,
    [milestone]: completedAt,
  };
}

export function deriveOperatorLatencyDurations(
  state: OperatorLatencyState,
): OperatorLatencyDurations {
  if (state.startedAt === null) {
    return {
      firstUsefulMapAt: null,
      firstTruthAt: null,
      firstActionQueueAt: null,
    };
  }

  return {
    firstUsefulMapAt:
      state.firstUsefulMapAt === null ? null : state.firstUsefulMapAt - state.startedAt,
    firstTruthAt:
      state.firstTruthAt === null ? null : state.firstTruthAt - state.startedAt,
    firstActionQueueAt:
      state.firstActionQueueAt === null ? null : state.firstActionQueueAt - state.startedAt,
  };
}
