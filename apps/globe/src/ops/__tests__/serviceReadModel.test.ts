import { describe, expect, it } from 'vitest';

import { buildServiceReadModel } from '../serviceReadModel';
import { buildCanonicalEventEnvelope } from '../../data/eventEnvelope';
import type { CanonicalEventEnvelope } from '../../data/eventEnvelope';

describe('buildServiceReadModel', () => {
  it('returns national and viewport-ready summaries from the selected event and ops priorities', () => {
    const model = buildServiceReadModel({
      selectedEventRevisionHistory: [
        buildCanonicalEventEnvelope({
          event: {
            id: 'eq-1',
            lat: 35,
            lng: 139,
            depth_km: 30,
            magnitude: 7.0,
            time: 1_700_000_000_000,
            faultType: 'interface',
            tsunami: true,
            place: { text: 'Sagami corridor' },
          },
          source: 'usgs',
          issuedAt: 1_700_000_001_000,
          receivedAt: 1_700_000_001_500,
        }),
      ] satisfies CanonicalEventEnvelope[],
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
      selectedEventEnvelope: buildCanonicalEventEnvelope({
        event: {
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
        source: 'server',
        issuedAt: 1_700_000_002_000,
        receivedAt: 1_700_000_003_000,
      }),
      selectionReason: 'auto-select',
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
      maritimeOverview: {
        totalTracked: 122,
        highPriorityTracked: 34,
        underwayCount: 98,
        anchoredCount: 24,
        summary: '122 tracked · 34 high-priority · 98 underway',
      },
      freshnessStatus: {
        source: 'server',
        state: 'fresh',
        updatedAt: 1_700_000_005_000,
        staleAfterMs: 60_000,
      },
    });

    expect(model.currentEvent?.id).toBe('eq-1');
    expect(model.eventTruth?.source).toBe('server');
    expect(model.eventTruth?.confidence).toBe('high');
    expect(model.eventTruth?.revisionCount).toBe(2);
    expect(model.eventTruth?.sources).toEqual(['usgs', 'server']);
    expect(model.eventTruth?.hasConflictingRevision).toBe(true);
    expect(model.viewport?.activeRegion).toBe('kanto');
    expect(model.nationalExposureSummary).toHaveLength(2);
    expect(model.visibleExposureSummary.map((entry) => entry.assetId)).toEqual(['tokyo-port']);
    expect(model.nationalPriorityQueue).toHaveLength(2);
    expect(model.visiblePriorityQueue.map((entry) => entry.assetId)).toEqual(['tokyo-port']);
    expect(model.nationalSnapshot?.summary).toMatch(/Sagami corridor/);
    expect(model.systemHealth.level).toBe('watch');
    expect(model.systemHealth.flags).toContain('revision-conflict');
    expect(model.operationalOverview.selectionReason).toBe('auto-select');
    expect(model.operationalOverview.visibleAffectedAssetCount).toBe(1);
    expect(model.operationalOverview.nationalAffectedAssetCount).toBe(2);
    expect(model.operationalOverview.topRegion).toBe('kanto');
    expect(model.operationalOverview.impactSummary).toMatch(/1 visible asset/);
    expect(model.bundleSummaries.seismic?.metric).toContain('2 assets');
    expect(model.bundleSummaries.seismic?.trust).toBe('review');
    expect(model.bundleSummaries.seismic?.counters).toEqual([
      { id: 'affected-assets', label: 'Affected', value: 2, tone: 'priority' },
      { id: 'visible-assets', label: 'Visible', value: 1, tone: 'priority' },
    ]);
    expect(model.bundleSummaries.maritime?.metric).toContain('122 tracked');
    expect(model.bundleSummaries.maritime?.detail).toContain('Port of Tokyo');
    expect(model.bundleSummaries.maritime?.counters).toEqual([
      { id: 'tracked', label: 'Tracked', value: 122, tone: 'clear' },
      { id: 'high-priority', label: 'High Priority', value: 34, tone: 'priority' },
      { id: 'underway', label: 'Underway', value: 98, tone: 'watch' },
    ]);
  });

  it('falls back to the national view when visible assets are not provided yet', () => {
    const model = buildServiceReadModel({
      selectedEvent: null,
      selectedEventEnvelope: null,
      selectedEventRevisionHistory: [],
      selectionReason: null,
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
      maritimeOverview: null,
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
    expect(model.systemHealth.level).toBe('nominal');
    expect(model.operationalOverview.impactSummary).toMatch(/1 asset in elevated posture nationwide/);
    expect(model.bundleSummaries.lifelines?.detail).toContain('standing by');
    expect(model.bundleSummaries.maritime?.trust).toBe('confirmed');
    expect(model.bundleSummaries.maritime?.counters).toEqual([]);
  });

  it('escalates system health and selection messaging when the realtime feed is degraded', () => {
    const event = {
      id: 'eq-2',
      lat: 24.2,
      lng: 125.1,
      depth_km: 10,
      magnitude: 5.2,
      time: 1_700_000_000_000,
      faultType: 'interface' as const,
      tsunami: false,
      place: { text: '53 km NW of Hirara, Japan' },
    };

    const model = buildServiceReadModel({
      selectedEvent: event,
      selectedEventEnvelope: buildCanonicalEventEnvelope({
        event,
        source: 'usgs',
        issuedAt: 1_700_000_001_000,
        receivedAt: 1_700_000_001_500,
      }),
      selectedEventRevisionHistory: [],
      selectionReason: 'auto-select',
      tsunamiAssessment: null,
      impactResults: null,
      assets: [],
      viewport: {
        center: { lat: 35.6, lng: 139.7 },
        zoom: 5.5,
        bounds: [122, 24, 150, 46],
        tier: 'national',
        activeRegion: 'kanto',
      },
      exposures: [],
      priorities: [],
      freshnessStatus: {
        source: 'usgs',
        state: 'degraded',
        updatedAt: 1_700_000_005_000,
        staleAfterMs: 60_000,
        message: 'Running on fallback realtime feed',
      },
    });

    expect(model.systemHealth.level).toBe('degraded');
    expect(model.systemHealth.flags).toContain('fallback-feed');
    expect(model.operationalOverview.selectionReason).toBe('auto-select');
    expect(model.operationalOverview.selectionSummary).toMatch(/auto-selected/i);
    expect(model.operationalOverview.impactSummary).toBe('No assets in elevated posture');
    expect(model.bundleSummaries.seismic?.trust).toBe('degraded');
  });

  it('surfaces material revision divergence for operator review when source revisions disagree', () => {
    const usgsEvent = {
      id: 'eq-3',
      lat: 38.1,
      lng: 142.2,
      depth_km: 22,
      magnitude: 6.6,
      time: 1_700_000_000_000,
      faultType: 'interface' as const,
      tsunami: true,
      place: { text: 'Off the coast of Tohoku' },
    };
    const serverEvent = {
      ...usgsEvent,
      lat: 37.8,
      lng: 141.9,
      depth_km: 38,
      magnitude: 7.2,
      tsunami: false,
    };

    const model = buildServiceReadModel({
      selectedEvent: serverEvent,
      selectedEventEnvelope: buildCanonicalEventEnvelope({
        event: serverEvent,
        source: 'server',
        issuedAt: 1_700_000_002_000,
        receivedAt: 1_700_000_003_000,
      }),
      selectedEventRevisionHistory: [
        buildCanonicalEventEnvelope({
          event: usgsEvent,
          source: 'usgs',
          issuedAt: 1_700_000_001_000,
          receivedAt: 1_700_000_001_500,
        }),
      ],
      selectionReason: 'escalate',
      tsunamiAssessment: null,
      impactResults: null,
      assets: [],
      viewport: null,
      exposures: [],
      priorities: [],
      freshnessStatus: {
        source: 'server',
        state: 'fresh',
        updatedAt: 1_700_000_005_000,
        staleAfterMs: 60_000,
      },
    });

    expect(model.eventTruth?.divergenceSeverity).toBe('material');
    expect(model.eventTruth?.magnitudeSpread).toBeCloseTo(0.6, 3);
    expect(model.eventTruth?.depthSpreadKm).toBeCloseTo(16, 3);
    expect(model.eventTruth?.locationSpreadKm).toBeGreaterThan(20);
    expect(model.eventTruth?.tsunamiMismatch).toBe(true);
    expect(model.systemHealth.flags).toContain('material-divergence');
    expect(model.systemHealth.detail).toMatch(/magnitude spread/i);
  });
});
