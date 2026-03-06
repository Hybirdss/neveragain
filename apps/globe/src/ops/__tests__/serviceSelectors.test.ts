import { describe, expect, it } from 'vitest';

import type { AppState } from '../../types';
import { selectServiceBackendState } from '../serviceSelectors';

function createState(): AppState {
  return {
    mode: 'realtime',
    viewState: { type: 'idle' },
    activePanel: 'map',
    selectedEvent: null,
    ops: {
      metro: 'tokyo',
      focus: { type: 'calm' },
      assets: [],
      exposures: [],
      priorities: [],
      scenarioShift: null,
    },
    viewportState: null,
    serviceReadModel: {
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
      bundleSummaries: {},
      nationalExposureSummary: [],
      visibleExposureSummary: [],
      nationalPriorityQueue: [],
      visiblePriorityQueue: [],
      freshnessStatus: {
        source: 'server',
        state: 'fresh',
        updatedAt: 1_700_000_000_000,
        staleAfterMs: 60_000,
      },
    },
    realtimeStatus: {
      source: 'server',
      state: 'fresh',
      updatedAt: 1_700_000_000_000,
      staleAfterMs: 60_000,
    },
    replayMilestones: [
      { kind: 'event_locked', at: 1_700_000_000_100, label: 'Event locked' },
    ],
    scenarioDelta: {
      changeSummary: ['Magnitude +0.4'],
      exposureChanges: [],
      priorityChanges: [],
      reasons: ['shallower quake'],
    },
    tsunamiAssessment: null,
    intensityGrid: null,
    intensitySource: 'none',
    waveState: null,
    timeline: {
      events: [],
      currentIndex: -1,
      currentTime: 1_700_000_000_000,
      isPlaying: false,
      speed: 1,
      timeRange: [1_699_999_000_000, 1_700_000_000_000],
    },
    layers: {
      tectonicPlates: true,
      seismicPoints: true,
      waveRings: true,
      isoseismalContours: true,
      labels: true,
      shakeMapContours: false,
      slab2Contours: false,
      crossSection: false,
      plateauBuildings: false,
      gsiFaults: false,
      gsiRelief: false,
      gsiSlope: false,
      gsiPale: false,
      adminBoundary: false,
      jshisHazard: false,
      activeFaults: false,
    },
    viewPreset: 'default',
    colorblind: false,
    plateauCity: null,
    selectedFault: null,
    impactResults: null,
    networkError: null,
    ai: {
      currentAnalysis: null,
      analysisLoading: false,
      analysisError: null,
      activeTab: 'easy',
      searchQuery: '',
      searchResults: null,
      searchLoading: false,
    },
  };
}

describe('selectServiceBackendState', () => {
  it('returns the backend-owned service contracts as one selector bundle', () => {
    const selected = selectServiceBackendState(createState());

    expect(selected.readModel.freshnessStatus.state).toBe('fresh');
    expect(selected.readModel.visibleExposureSummary).toHaveLength(0);
    expect(selected.realtimeStatus.source).toBe('server');
    expect(selected.replayMilestones[0]?.kind).toBe('event_locked');
    expect(selected.scenarioDelta?.changeSummary[0]).toContain('+0.4');
  });

  it('throws when serviceReadModel is absent so the UI cannot silently reconstruct truth', () => {
    const state = createState();
    state.serviceReadModel = null;

    expect(() => selectServiceBackendState(state)).toThrow(/serviceReadModel/);
  });
});
