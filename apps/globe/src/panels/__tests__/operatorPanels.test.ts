import { describe, expect, it } from 'vitest';

import type { ServiceReadModel } from '../../ops/readModelTypes';
import { renderEventSnapshotMarkup } from '../eventSnapshot';
import { selectExposureSummary } from '../assetExposure';
import { selectPriorityQueue } from '../checkTheseNow';

function createReadModel(overrides: Partial<ServiceReadModel> = {}): ServiceReadModel {
  return {
    currentEvent: {
      id: 'eq-1',
      lat: 35.6,
      lng: 139.7,
      depth_km: 28,
      magnitude: 7.1,
      time: Date.parse('2026-03-06T09:58:00.000Z'),
      faultType: 'interface',
      tsunami: true,
      place: { text: 'Sagami corridor' },
    },
    eventTruth: {
      source: 'server',
      revision: 'r2',
      issuedAt: Date.parse('2026-03-06T09:58:10.000Z'),
      receivedAt: Date.parse('2026-03-06T09:58:40.000Z'),
      observedAt: Date.parse('2026-03-06T09:58:00.000Z'),
      supersedes: 'r1',
      confidence: 'high',
      revisionCount: 2,
      sources: ['server', 'usgs'],
      hasConflictingRevision: true,
    },
    viewport: {
      center: { lat: 35.6, lng: 139.7 },
      zoom: 9.2,
      bounds: [138.8, 34.9, 140.1, 36.1],
      tier: 'regional',
      activeRegion: 'kanto',
    },
    nationalSnapshot: {
      title: 'Sagami corridor',
      summary: 'Sagami corridor M7.1 event. Tsunami posture moderate.',
      headline: 'Verify Port of Tokyo access',
      tsunami: {
        risk: 'moderate',
        confidence: 'high',
        factors: ['offshore'],
        locationType: 'offshore',
        coastDistanceKm: 12,
        faultType: 'interface',
      },
      topImpact: null,
    },
    nationalExposureSummary: [
      {
        assetId: 'tokyo-port',
        severity: 'critical',
        score: 91,
        summary: 'Tokyo port corridor exposed',
        reasons: ['strong shaking', 'coastal posture'],
      },
    ],
    visibleExposureSummary: [
      {
        assetId: 'tokyo-port',
        severity: 'critical',
        score: 91,
        summary: 'Tokyo port corridor exposed',
        reasons: ['strong shaking', 'coastal posture'],
      },
    ],
    nationalPriorityQueue: [
      {
        id: 'priority-1',
        assetId: 'tokyo-port',
        severity: 'critical',
        title: 'Verify Port of Tokyo access',
        rationale: 'Kanto port posture is critical because strong shaking, coastal posture.',
      },
    ],
    visiblePriorityQueue: [
      {
        id: 'priority-1',
        assetId: 'tokyo-port',
        severity: 'critical',
        title: 'Verify Port of Tokyo access',
        rationale: 'Kanto port posture is critical because strong shaking, coastal posture.',
      },
    ],
    freshnessStatus: {
      source: 'server',
      state: 'fresh',
      updatedAt: Date.parse('2026-03-06T10:00:00.000Z'),
      staleAfterMs: 60_000,
    },
    ...overrides,
  };
}

describe('operator panel selectors', () => {
  it('renders event truth metadata inside the event snapshot markup', () => {
    const markup = renderEventSnapshotMarkup({
      mode: 'event',
      selectedEvent: createReadModel().currentEvent,
      readModel: createReadModel(),
      now: Date.parse('2026-03-06T10:00:00.000Z'),
    });

    expect(markup).toContain('Sagami corridor');
    expect(markup).toContain('Server truth');
    expect(markup).toContain('High confidence');
    expect(markup).toContain('2 revisions');
    expect(markup).toContain('Conflict detected');
    expect(markup).toContain('Data fresh');
  });

  it('prefers visible exposure summaries and visible priorities when available', () => {
    const readModel = createReadModel({
      nationalExposureSummary: [
        {
          assetId: 'sendai-port',
          severity: 'watch',
          score: 24,
          summary: 'Sendai port watch posture',
          reasons: ['regional posture'],
        },
      ],
      nationalPriorityQueue: [
        {
          id: 'priority-2',
          assetId: 'sendai-port',
          severity: 'watch',
          title: 'Monitor Sendai port posture',
          rationale: 'Tohoku port posture elevated.',
        },
      ],
    });

    expect(selectExposureSummary(readModel).map((entry) => entry.assetId)).toEqual(['tokyo-port']);
    expect(selectPriorityQueue(readModel).map((entry) => entry.assetId)).toEqual(['tokyo-port']);
  });

  it('falls back to national summaries when visible summaries are empty', () => {
    const readModel = createReadModel({
      visibleExposureSummary: [],
      visiblePriorityQueue: [],
      nationalExposureSummary: [
        {
          assetId: 'sendai-port',
          severity: 'watch',
          score: 24,
          summary: 'Sendai port watch posture',
          reasons: ['regional posture'],
        },
      ],
      nationalPriorityQueue: [
        {
          id: 'priority-2',
          assetId: 'sendai-port',
          severity: 'watch',
          title: 'Monitor Sendai port posture',
          rationale: 'Tohoku port posture elevated.',
        },
      ],
    });

    expect(selectExposureSummary(readModel).map((entry) => entry.assetId)).toEqual(['sendai-port']);
    expect(selectPriorityQueue(readModel).map((entry) => entry.assetId)).toEqual(['sendai-port']);
  });
});
