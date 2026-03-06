import { describe, expect, it } from 'vitest';

import { buildBundleSummary, buildLayerControlModel } from '../layerControl';
import { createDefaultBundleSettings, createDefaultLayerVisibility } from '../../layers/bundleRegistry';
import type { ServiceReadModel } from '../../ops/readModelTypes';
import type { Vessel } from '../../data/aisManager';
import type { ConsoleState } from '../../core/store';

function createReadModel(): ServiceReadModel {
  return {
    currentEvent: null,
    eventTruth: null,
    viewport: null,
    nationalSnapshot: null,
    systemHealth: {
      level: 'nominal',
      headline: 'Primary realtime feed healthy',
      detail: 'No source conflicts or realtime degradation detected.',
      flags: [],
    },
    operationalOverview: {
      selectionReason: null,
      selectionSummary: 'No operationally significant event selected',
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
    freshnessStatus: {
      source: 'server',
      state: 'fresh',
      updatedAt: Date.parse('2026-03-06T10:00:00.000Z'),
      staleAfterMs: 60_000,
    },
  };
}

function createState(overrides: Partial<ConsoleState> = {}): ConsoleState {
  return {
    mode: 'calm',
    viewport: {
      center: { lat: 35.68, lng: 139.69 },
      zoom: 5.5,
      bounds: [122, 24, 150, 46],
      tier: 'national',
      pitch: 0,
      bearing: 0,
    },
    selectedEvent: null,
    events: [],
    exposures: [],
    priorities: [],
    readModel: createReadModel(),
    realtimeStatus: {
      source: 'server',
      state: 'fresh',
      updatedAt: Date.parse('2026-03-06T10:00:00.000Z'),
      staleAfterMs: 60_000,
    },
    intensityGrid: null,
    vessels: [],
    faults: [],
    scenarioMode: false,
    layerVisibility: createDefaultLayerVisibility(),
    activeBundleId: 'maritime',
    activeViewId: 'national-impact',
    bundleSettings: createDefaultBundleSettings(),
    bundleDrawerOpen: true,
    panelsVisible: true,
    ...overrides,
  };
}

describe('layerControl bundle summaries', () => {
  it('builds an operator-grade maritime summary in calm mode', () => {
    const vessels: Vessel[] = [
      {
        mmsi: '1',
        name: 'FERRY SAKURA',
        lat: 35,
        lng: 140,
        cog: 90,
        sog: 14,
        type: 'passenger',
        lastUpdate: Date.now(),
        trail: [[140, 35]],
      },
      {
        mmsi: '2',
        name: 'PACIFIC STAR',
        lat: 36,
        lng: 141,
        cog: 45,
        sog: 0,
        type: 'cargo',
        lastUpdate: Date.now(),
        trail: [[141, 36]],
      },
    ];

    const summary = buildBundleSummary('maritime', createState({ vessels }));

    expect(summary.title).toBe('Maritime');
    expect(summary.metric).toContain('2 tracked');
    expect(summary.detail).toContain('1 high-priority');
  });

  it('surfaces seismic truth when the seismic bundle is active', () => {
    const summary = buildBundleSummary('seismic', createState({
      readModel: {
        ...createReadModel(),
        operationalOverview: {
          selectionReason: 'auto-select',
          selectionSummary: 'Operational focus auto-selected from current incident stream',
          impactSummary: '3 assets in elevated posture nationwide',
          visibleAffectedAssetCount: 1,
          nationalAffectedAssetCount: 3,
          topRegion: 'kanto',
          topSeverity: 'priority',
        },
      },
    }));

    expect(summary.title).toBe('Seismic');
    expect(summary.metric).toContain('3 assets');
  });

  it('builds a drawer model with presets, bundles, and effective layer state', () => {
    const state = createState({
      activeBundleId: 'maritime',
      activeViewId: 'coastal-operations',
      bundleSettings: {
        ...createDefaultBundleSettings(),
        lifelines: { enabled: true, density: 'dense' },
      },
    });

    const model = buildLayerControlModel(state);
    const shipsRow = model.layerRows.find((row) => row.id === 'ais');
    const railRow = model.layerRows.find((row) => row.id === 'rail');

    expect(model.activeBundle.label).toBe('Maritime');
    expect(model.activeView.label).toBe('Coastal Operations');
    expect(model.bundleSummaries).toHaveLength(5);
    expect(shipsRow?.effectiveVisible).toBe(true);
    expect(railRow).toBeUndefined();
  });
});
