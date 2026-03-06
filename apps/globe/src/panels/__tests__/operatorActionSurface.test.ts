import { describe, expect, it } from 'vitest';

import type { ServiceReadModel } from '../../ops/readModelTypes';
import { renderEventSnapshotMarkup } from '../eventSnapshot';
import { renderPriorityQueueMarkup } from '../checkTheseNow';
import { sanitizeBundleSummaryForDrawer, type BundleSummary } from '../layerControl';

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
      hasConflictingRevision: false,
      divergenceSeverity: 'minor',
      magnitudeSpread: 0.1,
      depthSpreadKm: 0,
      locationSpreadKm: 0,
      tsunamiMismatch: false,
      faultTypeMismatch: false,
    },
    viewport: {
      center: { lat: 35.6, lng: 139.7 },
      zoom: 8.4,
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
    systemHealth: {
      level: 'nominal',
      headline: 'Nominal',
      detail: 'All systems nominal.',
      flags: [],
    },
    operationalOverview: {
      selectionReason: 'auto-select',
      selectionSummary: 'Operational focus auto-selected from current incident stream',
      impactSummary: '4 assets in elevated posture',
      visibleAffectedAssetCount: 4,
      nationalAffectedAssetCount: 4,
      topRegion: 'kanto',
      topSeverity: 'critical',
    },
    bundleSummaries: {},
    nationalExposureSummary: [],
    visibleExposureSummary: [],
    nationalPriorityQueue: [
      {
        id: 'priority-1',
        assetId: 'tokyo-port',
        severity: 'critical',
        title: 'Verify Port of Tokyo access',
        rationale: 'Kanto port posture is critical because strong shaking, coastal posture.',
      },
      {
        id: 'priority-2',
        assetId: 'tokyo-grid',
        severity: 'priority',
        title: 'Confirm Tokyo grid substation posture',
        rationale: 'Grid corridor posture elevated.',
      },
      {
        id: 'priority-3',
        assetId: 'tokyo-hospital',
        severity: 'priority',
        title: 'Confirm ER access to central Tokyo',
        rationale: 'Medical access posture elevated.',
      },
      {
        id: 'priority-4',
        assetId: 'tokyo-rail',
        severity: 'watch',
        title: 'Review Tokaido corridor suspension',
        rationale: 'Rail corridor remains under watch.',
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
      {
        id: 'priority-2',
        assetId: 'tokyo-grid',
        severity: 'priority',
        title: 'Confirm Tokyo grid substation posture',
        rationale: 'Grid corridor posture elevated.',
      },
      {
        id: 'priority-3',
        assetId: 'tokyo-hospital',
        severity: 'priority',
        title: 'Confirm ER access to central Tokyo',
        rationale: 'Medical access posture elevated.',
      },
      {
        id: 'priority-4',
        assetId: 'tokyo-rail',
        severity: 'watch',
        title: 'Review Tokaido corridor suspension',
        rationale: 'Rail corridor remains under watch.',
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

describe('operator action surfaces', () => {
  it('keeps event truth focused on confidence and freshness instead of repeating top queue actions', () => {
    const markup = renderEventSnapshotMarkup({
      mode: 'event',
      selectedEvent: createReadModel().currentEvent,
      readModel: createReadModel(),
      now: Date.parse('2026-03-06T10:00:00.000Z'),
    });

    expect(markup).toContain('Server truth');
    expect(markup).toContain('High confidence');
    expect(markup).toContain('Data fresh');
    expect(markup).not.toContain('Verify Port of Tokyo access');
  });

  it('renders only the top action queue items and summarizes overflow', () => {
    const markup = renderPriorityQueueMarkup(createReadModel());

    expect(markup).toContain('Verify Port of Tokyo access');
    expect(markup).toContain('Confirm Tokyo grid substation posture');
    expect(markup).toContain('Confirm ER access to central Tokyo');
    expect(markup).not.toContain('Review Tokaido corridor suspension');
    expect(markup).toContain('1 more queued');
  });

  it('sanitizes drawer summaries when they duplicate ranked queue actions', () => {
    const summary: BundleSummary = {
      title: 'Maritime',
      metric: 'Verify Port of Tokyo access',
      detail: 'Kanto port posture is critical because strong shaking, coastal posture.',
      trust: 'review',
      counters: [],
      signals: [],
      domains: [],
    };

    const sanitized = sanitizeBundleSummaryForDrawer(summary, createReadModel());

    expect(sanitized.metric).toBe('Operational diagnostics');
    expect(sanitized.detail).toContain('Check These Now');
  });
});
