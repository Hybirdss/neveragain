import { describe, expect, it } from 'vitest';

import type { RealtimeStatus, ServiceReadModel } from '../../ops/readModelTypes';
import { buildSystemBarState } from '../systemBar';

const realtimeStatus: RealtimeStatus = {
  source: 'server',
  state: 'fresh',
  updatedAt: Date.parse('2026-03-06T10:00:00.000Z'),
  staleAfterMs: 60_000,
};

const readModel: ServiceReadModel = {
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
    divergenceSeverity: 'minor',
    magnitudeSpread: 0.1,
    depthSpreadKm: 0,
    locationSpreadKm: 0,
    tsunamiMismatch: false,
    faultTypeMismatch: false,
  },
  viewport: {
    center: { lat: 35.6, lng: 139.7 },
    zoom: 9.2,
    bounds: [138.8, 34.9, 140.1, 36.1],
    tier: 'regional',
    activeRegion: 'kanto',
  },
  nationalSnapshot: null,
  systemHealth: {
    level: 'watch',
    headline: 'Conflicting source revisions detected',
    detail: '2 revisions from server/usgs require operator review.',
    flags: ['revision-conflict'],
  },
  operationalOverview: {
    selectionReason: 'retain-current',
    selectionSummary: 'Operational focus retained on the current incident',
    impactSummary: 'No assets in elevated posture',
    visibleAffectedAssetCount: 0,
    nationalAffectedAssetCount: 0,
    topRegion: null,
    topSeverity: 'clear',
  },
  nationalExposureSummary: [],
  visibleExposureSummary: [],
  nationalPriorityQueue: [],
  visiblePriorityQueue: [],
  freshnessStatus: realtimeStatus,
};

describe('buildSystemBarState', () => {
  it('surfaces active region and revision conflict in the system bar state', () => {
    const state = buildSystemBarState({
      mode: 'event',
      eventCount: 4,
      readModel,
      realtimeStatus,
    });

    expect(state.regionLabel).toBe('Kanto');
    expect(state.statusText).toContain('Event active');
    expect(state.statusText).toContain('4 events');
    expect(state.statusText).toContain('server fresh');
    expect(state.statusText).toContain('conflict');
    expect(state.statusMode).toBe('event');
  });

  it('surfaces material divergence when revision disagreement is material', () => {
    const state = buildSystemBarState({
      mode: 'event',
      eventCount: 2,
      readModel: {
        ...readModel,
        eventTruth: {
          ...readModel.eventTruth!,
          divergenceSeverity: 'material',
          locationSpreadKm: 28,
        },
        systemHealth: {
          ...readModel.systemHealth,
          flags: ['revision-conflict', 'material-divergence'],
        },
      },
      realtimeStatus,
    });

    expect(state.statusText).toContain('divergence');
  });

  it('falls back to Japan-wide calm wording when no viewport or truth is available', () => {
    const state = buildSystemBarState({
      mode: 'calm',
      eventCount: 0,
      readModel: null,
      realtimeStatus: {
        source: 'usgs',
        state: 'degraded',
        updatedAt: 0,
        staleAfterMs: 60_000,
        message: 'fallback active',
      },
    });

    expect(state.regionLabel).toBe('Japan');
    expect(state.statusText).toContain('System calm');
    expect(state.statusText).toContain('usgs degraded');
    expect(state.statusMode).toBe('calm');
  });

  it('shows an explicit degraded status message when realtime health drops', () => {
    const state = buildSystemBarState({
      mode: 'event',
      eventCount: 1,
      readModel,
      realtimeStatus: {
        source: 'server',
        state: 'degraded',
        updatedAt: 0,
        staleAfterMs: 60_000,
        message: 'Realtime poll failed',
      },
    });

    expect(state.statusText).toContain('server degraded');
  });

  it('falls back to Japan at national zoom even if the viewport center is in Kanto', () => {
    const state = buildSystemBarState({
      mode: 'event',
      eventCount: 4,
      readModel: {
        ...readModel,
        viewport: {
          ...readModel.viewport!,
          tier: 'national',
        },
      },
      realtimeStatus,
    });

    expect(state.regionLabel).toBe('Japan');
  });
});
