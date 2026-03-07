import { describe, expect, it } from 'vitest';

import { buildClientRefreshPlan } from '../clientGovernor';

describe('buildClientRefreshPlan', () => {
  it('falls back to calm cadence when worker governor truth is unavailable', () => {
    expect(buildClientRefreshPlan(null)).toEqual({
      state: 'calm',
      events: { source: 'events', refreshMs: 60_000 },
      maritime: { source: 'maritime', refreshMs: 60_000 },
      rail: { source: 'rail', refreshMs: 120_000 },
    });
  });

  it('derives coordinated event and maritime cadence from worker incident mode', () => {
    expect(buildClientRefreshPlan({
      states: ['calm', 'watch', 'incident', 'recovery'],
      sourceClasses: ['event-truth', 'fast-situational', 'slow-infrastructure'],
      activation: {
        state: 'incident',
        sourceClasses: ['event-truth', 'fast-situational', 'slow-infrastructure'],
        regionScope: { kind: 'regional', regionIds: ['kanto'] },
        activatedAt: '2026-03-07T05:00:00.000Z',
        reason: 'major offshore event activated incident mode',
      },
    })).toEqual({
      state: 'incident',
      events: { source: 'events', refreshMs: 10_000 },
      maritime: { source: 'maritime', refreshMs: 10_000 },
      rail: { source: 'rail', refreshMs: 15_000 },
    });
  });
});
