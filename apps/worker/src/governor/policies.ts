import type { GovernorState, SourceClass } from './types.ts';

export const GOVERNOR_SOURCES = ['events', 'maritime', 'rail', 'power', 'water', 'hospitals'] as const;

export type GovernorSource = (typeof GOVERNOR_SOURCES)[number];

export interface GovernorCadence {
  strategy: 'poll' | 'event-driven';
  refreshMs: number | null;
}

export interface GovernorSourcePolicy {
  source: GovernorSource;
  state: GovernorState;
  sourceClass: SourceClass;
  cadence: GovernorCadence;
}

type GovernorSourcePolicyTable = Record<GovernorSource, {
  sourceClass: SourceClass;
  cadenceByState: Record<GovernorState, GovernorCadence>;
}>;

const GOVERNOR_SOURCE_POLICIES: GovernorSourcePolicyTable = {
  events: {
    sourceClass: 'event-truth',
    cadenceByState: {
      calm: { strategy: 'poll', refreshMs: 60_000 },
      watch: { strategy: 'poll', refreshMs: 30_000 },
      incident: { strategy: 'poll', refreshMs: 15_000 },
      recovery: { strategy: 'poll', refreshMs: 60_000 },
    },
  },
  maritime: {
    sourceClass: 'fast-situational',
    cadenceByState: {
      calm: { strategy: 'poll', refreshMs: 60_000 },
      watch: { strategy: 'poll', refreshMs: 20_000 },
      incident: { strategy: 'poll', refreshMs: 10_000 },
      recovery: { strategy: 'poll', refreshMs: 30_000 },
    },
  },
  rail: {
    sourceClass: 'fast-situational',
    cadenceByState: {
      calm: { strategy: 'poll', refreshMs: 180_000 },
      watch: { strategy: 'poll', refreshMs: 60_000 },
      incident: { strategy: 'poll', refreshMs: 30_000 },
      recovery: { strategy: 'poll', refreshMs: 120_000 },
    },
  },
  power: {
    sourceClass: 'slow-infrastructure',
    cadenceByState: {
      calm: { strategy: 'poll', refreshMs: 600_000 },
      watch: { strategy: 'poll', refreshMs: 300_000 },
      incident: { strategy: 'poll', refreshMs: 120_000 },
      recovery: { strategy: 'poll', refreshMs: 600_000 },
    },
  },
  water: {
    sourceClass: 'slow-infrastructure',
    cadenceByState: {
      calm: { strategy: 'poll', refreshMs: 900_000 },
      watch: { strategy: 'poll', refreshMs: 600_000 },
      incident: { strategy: 'poll', refreshMs: 300_000 },
      recovery: { strategy: 'poll', refreshMs: 900_000 },
    },
  },
  hospitals: {
    sourceClass: 'slow-infrastructure',
    cadenceByState: {
      calm: { strategy: 'event-driven', refreshMs: null },
      watch: { strategy: 'event-driven', refreshMs: null },
      incident: { strategy: 'event-driven', refreshMs: null },
      recovery: { strategy: 'event-driven', refreshMs: null },
    },
  },
};

export function getSourcePolicy(source: GovernorSource, state: GovernorState): GovernorSourcePolicy {
  const definition = GOVERNOR_SOURCE_POLICIES[source];

  return {
    source,
    state,
    sourceClass: definition.sourceClass,
    cadence: definition.cadenceByState[state],
  };
}
