import { describe, expect, it } from 'vitest';

import { buildBundleSummary, buildLayerControlModel } from '../layerControl';
import { createDefaultBundleSettings, createDefaultLayerVisibility } from '../../layers/bundleRegistry';
import type { ServiceReadModel } from '../../ops/readModelTypes';
import { createEmptyServiceReadModel } from '../../ops/serviceReadModel';
import type { ConsoleState } from '../../core/store';

function createReadModel(): ServiceReadModel {
  return createEmptyServiceReadModel({
    source: 'server',
    state: 'fresh',
    updatedAt: Date.parse('2026-03-06T10:00:00.000Z'),
    staleAfterMs: 60_000,
  });
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
  it('uses backend-owned maritime summary in calm mode', () => {
    const summary = buildBundleSummary('maritime', createState());

    expect(summary.title).toBe('Maritime');
    expect(summary.metric).toContain('No tracked traffic');
    expect(summary.detail).toContain('standing by');
    expect(summary.trust).toBe('confirmed');
    expect(summary.counters).toEqual([]);
  });

  it('surfaces seismic truth when the seismic bundle is active', () => {
    const summary = buildBundleSummary('seismic', createState({
      readModel: {
        ...createReadModel(),
        bundleSummaries: {
          ...createReadModel().bundleSummaries,
          seismic: {
            bundleId: 'seismic',
            title: 'Seismic',
            metric: '3 assets in elevated posture',
            detail: 'Primary operational pressure centered on Kanto.',
            severity: 'priority',
            availability: 'live',
            trust: 'review',
            counters: [
              { id: 'affected-assets', label: 'Affected', value: 3, tone: 'priority' },
            ],
          },
        },
      },
    }));

    expect(summary.title).toBe('Seismic');
    expect(summary.metric).toContain('3 assets');
    expect(summary.trust).toBe('review');
    expect(summary.counters).toEqual([
      { id: 'affected-assets', label: 'Affected', value: 3, tone: 'priority' },
    ]);
  });

  it('prefers backend-owned bundle summaries when the read model provides them', () => {
    const summary = buildBundleSummary('medical', createState({
      readModel: {
        ...createReadModel(),
        bundleSummaries: {
          medical: {
            bundleId: 'medical',
            title: 'Medical',
            metric: '2 medical sites in elevated posture',
            detail: 'Hospital access verification required across Kanto.',
            severity: 'priority',
            availability: 'live',
            trust: 'confirmed',
            counters: [],
          },
        },
      },
    } as Partial<ConsoleState>));

    expect(summary.metric).toContain('2 medical sites');
    expect(summary.detail).toContain('Hospital access verification');
    expect(summary.trust).toBe('confirmed');
  });

  it('falls back to empty backend truth instead of pending copy when a bundle summary is missing', () => {
    const summary = buildBundleSummary('medical', createState({
      readModel: {
        ...createReadModel(),
        bundleSummaries: {},
      },
    }));

    expect(summary.title).toBe('Medical');
    expect(summary.metric).toContain('No medical access posture shift');
    expect(summary.detail).toContain('standing by');
    expect(summary.trust).toBe('pending');
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
