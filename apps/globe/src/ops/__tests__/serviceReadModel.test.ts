import { describe, expect, it } from 'vitest';

import { buildServiceReadModel } from '../serviceReadModel';

describe('buildServiceReadModel', () => {
  it('returns a service snapshot using the selected event and ops priorities', () => {
    const model = buildServiceReadModel({
      selectedEvent: {
        id: 'eq-1',
        lat: 35,
        lng: 139,
        depth_km: 30,
        magnitude: 7.1,
        time: 1_700_000_000_000,
        faultType: 'interface',
        tsunami: true,
        place: { text: 'Sagami corridor' },
      },
      tsunamiAssessment: {
        risk: 'moderate',
        confidence: 'high',
        factors: ['offshore'],
        locationType: 'offshore',
        coastDistanceKm: 12,
        faultType: 'interface',
      },
      impactResults: null,
      exposures: [
        {
          assetId: 'tokyo-port',
          severity: 'priority',
          score: 72,
          summary: 'Port exposure elevated',
          reasons: ['coastal'],
        },
      ],
      priorities: [
        {
          id: 'prio-1',
          assetId: 'tokyo-port',
          severity: 'priority',
          title: 'Verify port access',
          rationale: 'Coastal exposure elevated',
        },
      ],
      freshnessStatus: {
        source: 'server',
        state: 'fresh',
        updatedAt: 1_700_000_005_000,
        staleAfterMs: 60_000,
      },
    });

    expect(model.currentEvent?.id).toBe('eq-1');
    expect(model.assetExposureSummary[0]?.assetId).toBe('tokyo-port');
    expect(model.priorityQueue[0]?.title).toBe('Verify port access');
    expect(model.opsSnapshot?.summary).toMatch(/Sagami corridor/);
  });
});
