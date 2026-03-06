import { describe, expect, it } from 'vitest';

import { buildServiceReadModel } from '../serviceReadModel';

describe('buildServiceReadModel', () => {
  it('returns national and viewport-ready summaries from the selected event and ops priorities', () => {
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
      assets: [
        {
          id: 'tokyo-port',
          region: 'kanto',
          class: 'port',
          name: 'Port of Tokyo',
          lat: 35.62,
          lng: 139.79,
          tags: ['coastal'],
          minZoomTier: 'regional',
        },
        {
          id: 'sendai-port',
          region: 'tohoku',
          class: 'port',
          name: 'Port of Sendai',
          lat: 38.25,
          lng: 141.02,
          tags: ['coastal'],
          minZoomTier: 'regional',
        },
      ],
      viewport: {
        center: { lat: 35.6, lng: 139.7 },
        zoom: 9.5,
        bounds: [138.8, 34.9, 140.1, 36.1],
        tier: 'regional',
        activeRegion: 'kanto',
      },
      exposures: [
        {
          assetId: 'tokyo-port',
          severity: 'priority',
          score: 72,
          summary: 'Port exposure elevated',
          reasons: ['coastal'],
        },
        {
          assetId: 'sendai-port',
          severity: 'watch',
          score: 24,
          summary: 'Northern port posture elevated',
          reasons: ['regional'],
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
        {
          id: 'prio-2',
          assetId: 'sendai-port',
          severity: 'watch',
          title: 'Monitor Sendai port posture',
          rationale: 'Regional watch posture elevated',
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
    expect(model.viewport?.activeRegion).toBe('kanto');
    expect(model.nationalExposureSummary).toHaveLength(2);
    expect(model.visibleExposureSummary.map((entry) => entry.assetId)).toEqual(['tokyo-port']);
    expect(model.nationalPriorityQueue).toHaveLength(2);
    expect(model.visiblePriorityQueue.map((entry) => entry.assetId)).toEqual(['tokyo-port']);
    expect(model.nationalSnapshot?.summary).toMatch(/Sagami corridor/);
  });

  it('falls back to the national view when visible assets are not provided yet', () => {
    const model = buildServiceReadModel({
      selectedEvent: null,
      tsunamiAssessment: null,
      impactResults: null,
      assets: [
        {
          id: 'tokyo-port',
          region: 'kanto',
          class: 'port',
          name: 'Port of Tokyo',
          lat: 35.62,
          lng: 139.79,
          tags: ['coastal'],
          minZoomTier: 'regional',
        },
      ],
      viewport: null,
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

    expect(model.nationalExposureSummary.map((entry) => entry.assetId)).toEqual(['tokyo-port']);
    expect(model.visibleExposureSummary.map((entry) => entry.assetId)).toEqual(['tokyo-port']);
    expect(model.visiblePriorityQueue.map((entry) => entry.assetId)).toEqual(['tokyo-port']);
  });
});
