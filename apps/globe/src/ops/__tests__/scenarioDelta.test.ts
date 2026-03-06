import { describe, expect, it } from 'vitest';

import { buildScenarioDelta } from '../scenarioDelta';

describe('buildScenarioDelta', () => {
  it('describes ranking changes and reasons between two scenario states', () => {
    const delta = buildScenarioDelta({
      previousExposures: [
        {
          assetId: 'tokyo-port',
          severity: 'watch',
          score: 50,
          summary: 'Port watch',
          reasons: ['coastal'],
        },
      ],
      nextExposures: [
        {
          assetId: 'tokyo-port',
          severity: 'critical',
          score: 90,
          summary: 'Port critical',
          reasons: ['shallower quake'],
        },
      ],
      previousPriorities: [
        {
          id: 'prio-port',
          assetId: 'tokyo-port',
          severity: 'watch',
          title: 'Inspect port',
          rationale: 'Initial watch',
        },
      ],
      nextPriorities: [
        {
          id: 'prio-port',
          assetId: 'tokyo-port',
          severity: 'critical',
          title: 'Inspect port',
          rationale: 'Escalated risk',
        },
      ],
      scenarioShift: {
        magnitudeDelta: 0.4,
        depthDeltaKm: -20,
        latShiftDeg: 0,
        lngShiftDeg: 0.2,
      },
    });

    expect(delta.exposureChanges[0]?.to).toBe('critical');
    expect(delta.priorityChanges[0]?.to).toBe(0);
    expect(delta.reasons.length).toBeGreaterThan(0);
    expect(delta.changeSummary[0]).toContain('+0.4');
  });
});
