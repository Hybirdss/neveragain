import type { GovernorState, SourceClass } from './types.ts';

export const GOVERNED_SOURCES = ['events', 'maritime', 'rail', 'power', 'water', 'hospitals'] as const;

export type GovernedSource = (typeof GOVERNED_SOURCES)[number];

interface BaseGovernorSourcePolicy {
  source: GovernedSource;
  sourceClass: SourceClass;
}

export interface PollingGovernorSourcePolicy extends BaseGovernorSourcePolicy {
  cadenceMode: 'poll';
  refreshMs: number;
}

export interface EventDrivenGovernorSourcePolicy extends BaseGovernorSourcePolicy {
  cadenceMode: 'event-driven';
  refreshMs: null;
  trigger: 'incident-change';
}

export type GovernorSourcePolicy = PollingGovernorSourcePolicy | EventDrivenGovernorSourcePolicy;

const POLLING_SOURCE_CLASS_BY_SOURCE: Record<Exclude<GovernedSource, 'hospitals'>, SourceClass> = {
  events: 'event-truth',
  maritime: 'fast-situational',
  rail: 'slow-infrastructure',
  power: 'slow-infrastructure',
  water: 'slow-infrastructure',
};

const POLLING_REFRESH_MS_BY_SOURCE: Record<
  Exclude<GovernedSource, 'hospitals'>,
  Record<GovernorState, number>
> = {
  events: {
    calm: 60_000,
    watch: 30_000,
    incident: 15_000,
    recovery: 60_000,
  },
  maritime: {
    calm: 60_000,
    watch: 20_000,
    incident: 10_000,
    recovery: 30_000,
  },
  rail: {
    calm: 180_000,
    watch: 60_000,
    incident: 30_000,
    recovery: 120_000,
  },
  power: {
    calm: 600_000,
    watch: 300_000,
    incident: 120_000,
    recovery: 600_000,
  },
  water: {
    calm: 900_000,
    watch: 600_000,
    incident: 300_000,
    recovery: 900_000,
  },
};

export function getSourcePolicy(source: GovernedSource, state: GovernorState): GovernorSourcePolicy {
  if (source === 'hospitals') {
    return {
      source,
      sourceClass: 'slow-infrastructure',
      cadenceMode: 'event-driven',
      refreshMs: null,
      trigger: 'incident-change',
    };
  }

  return {
    source,
    sourceClass: POLLING_SOURCE_CLASS_BY_SOURCE[source],
    cadenceMode: 'poll',
    refreshMs: POLLING_REFRESH_MS_BY_SOURCE[source][state],
  };
}
