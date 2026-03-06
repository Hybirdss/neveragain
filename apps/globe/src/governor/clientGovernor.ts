import type { GovernorPolicyEnvelope, GovernorState } from './types.ts';

export const CLIENT_GOVERNED_SOURCES = ['events', 'maritime', 'rail'] as const;

export type ClientGovernedSource = (typeof CLIENT_GOVERNED_SOURCES)[number];

export interface ClientRefreshPolicy {
  source: ClientGovernedSource;
  refreshMs: number;
}

export interface ClientRefreshPlan {
  state: GovernorState;
  events: ClientRefreshPolicy;
  maritime: ClientRefreshPolicy;
  rail: ClientRefreshPolicy;
}

const CLIENT_REFRESH_MS: Record<ClientGovernedSource, Record<GovernorState, number>> = {
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
};

export function getClientRefreshPolicy(
  source: ClientGovernedSource,
  state: GovernorState,
): ClientRefreshPolicy {
  return {
    source,
    refreshMs: CLIENT_REFRESH_MS[source][state],
  };
}

export function resolveClientGovernorState(
  governor: GovernorPolicyEnvelope | null | undefined,
): GovernorState {
  return governor?.activation.state ?? 'calm';
}

export function buildClientRefreshPlan(
  governor: GovernorPolicyEnvelope | null | undefined,
): ClientRefreshPlan {
  const state = resolveClientGovernorState(governor);
  return {
    state,
    events: getClientRefreshPolicy('events', state),
    maritime: getClientRefreshPolicy('maritime', state),
    rail: getClientRefreshPolicy('rail', state),
  };
}
