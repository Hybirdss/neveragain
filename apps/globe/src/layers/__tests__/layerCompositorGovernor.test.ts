import { describe, expect, it } from 'vitest';

import { buildLayerControlModel } from '../../panels/layerControl';
import { createDefaultOperatorLatencyState } from '../../core/operatorLatency';
import {
  createDefaultRuntimeGovernorState,
  type RuntimeGovernorState,
} from '../../core/runtimeGovernor';
import type { ConsoleState } from '../../core/store';
import {
  createDefaultBundleSettings,
  createDefaultLayerVisibility,
  createEffectiveBundleDensity,
} from '../bundleRegistry';
import {
  getGovernorDirtyFactoryIds,
  getVisibleFactoryIdsForGovernor,
} from '../layerCompositor';
import { LAYER_FACTORIES } from '../layerFactories';
import { createEmptyServiceReadModel } from '../../ops/serviceReadModel';

function createGovernor(
  overrides: Partial<RuntimeGovernorState> = {},
): RuntimeGovernorState {
  const bundleSettings = createDefaultBundleSettings();
  return {
    ...createDefaultRuntimeGovernorState(bundleSettings),
    ...overrides,
  };
}

function createState(overrides: Partial<ConsoleState> = {}): ConsoleState {
  const bundleSettings = overrides.bundleSettings ?? createDefaultBundleSettings();
  const runtimeGovernor = overrides.runtimeGovernor ?? createDefaultRuntimeGovernorState(bundleSettings);

  return {
    mode: 'event',
    viewport: {
      center: { lat: 35.68, lng: 139.69 },
      zoom: 6.2,
      bounds: [122, 24, 150, 46],
      tier: 'regional',
      pitch: 0,
      bearing: 0,
    },
    selectedEvent: null,
    events: [],
    exposures: [],
    priorities: [],
    readModel: createEmptyServiceReadModel({
      source: 'server',
      state: 'fresh',
      updatedAt: Date.parse('2026-03-07T00:00:00.000Z'),
      staleAfterMs: 60_000,
    }),
    realtimeStatus: {
      source: 'server',
      state: 'fresh',
      updatedAt: Date.parse('2026-03-07T00:00:00.000Z'),
      staleAfterMs: 60_000,
    },
    intensityGrid: null,
    vessels: [],
    faults: [],
    scenarioMode: false,
    layerVisibility: createDefaultLayerVisibility(),
    activeBundleId: 'maritime',
    activeViewId: 'coastal-operations',
    bundleSettings,
    bundleDrawerOpen: true,
    panelsVisible: true,
    showCoordinates: true,
    operatorLatency: createDefaultOperatorLatencyState(),
    runtimeGovernor,
    ...overrides,
  };
}

describe('layer compositor governor wiring', () => {
  it('marks density-sensitive factories dirty when effective density changes', () => {
    const bundleSettings = createDefaultBundleSettings();
    bundleSettings.maritime.density = 'dense';
    bundleSettings.lifelines.density = 'dense';
    bundleSettings.medical.density = 'dense';

    const previous = createGovernor({
      effectiveDensity: createEffectiveBundleDensity(bundleSettings),
    });
    const next = createGovernor({
      effectiveDensity: {
        ...createEffectiveBundleDensity(bundleSettings),
        maritime: 'standard',
        lifelines: 'standard',
        medical: 'standard',
      },
    });

    const dirty = getGovernorDirtyFactoryIds(LAYER_FACTORIES, previous, next);

    expect(dirty).toContain('ais');
    expect(dirty).toContain('rail');
    expect(dirty).toContain('power');
    expect(dirty).toContain('hospitals');
    expect(dirty).not.toContain('earthquakes');
  });

  it('drops suppressed non-critical layers while keeping seismic truth visible', () => {
    const bundleSettings = createDefaultBundleSettings();
    bundleSettings.lifelines.enabled = true;
    bundleSettings.medical.enabled = true;

    const visible = getVisibleFactoryIdsForGovernor(
      LAYER_FACTORIES,
      createDefaultLayerVisibility(),
      bundleSettings,
      createGovernor({
        suppressedBundles: ['maritime', 'medical'],
      }),
    );

    expect(visible).not.toContain('ais');
    expect(visible).not.toContain('hospitals');
    expect(visible).toContain('earthquakes');
    expect(visible).toContain('faults');
  });

  it('surfaces requested vs effective density in the layer control model', () => {
    const bundleSettings = createDefaultBundleSettings();
    bundleSettings.maritime.density = 'dense';

    const model = buildLayerControlModel(createState({
      activeBundleId: 'maritime',
      bundleSettings,
      runtimeGovernor: createGovernor({
        effectiveDensity: {
          ...createEffectiveBundleDensity(bundleSettings),
          maritime: 'standard',
        },
      }),
    }));

    expect(model.activeBundle.requestedDensity).toBe('dense');
    expect(model.activeBundle.effectiveDensity).toBe('standard');
    expect(model.activeBundle.governorStatus).toBe('clamped');
  });
});
