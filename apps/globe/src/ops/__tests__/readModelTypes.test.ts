import { describe, expect, it } from 'vitest';

import type {
  RealtimeStatus,
  ReplayMilestone,
  ScenarioDelta,
  ServiceReadModel,
} from '../readModelTypes';

describe('read model backend contracts', () => {
  it('supports a minimal service read model shape', () => {
    const model: ServiceReadModel = {
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
        updatedAt: 0,
        staleAfterMs: 60_000,
      },
    };

    expect(model.freshnessStatus.state).toBe('fresh');
    expect(model.eventTruth).toBeNull();
    expect(model.systemHealth.level).toBe('nominal');
    expect(model.operationalOverview.topSeverity).toBe('clear');
  });

  it('supports replay and scenario state contracts', () => {
    const milestone: ReplayMilestone = { kind: 'event_locked', at: 0, label: 'Event locked' };
    const delta: ScenarioDelta = {
      changeSummary: [],
      exposureChanges: [],
      priorityChanges: [],
      reasons: [],
    };
    const status: RealtimeStatus = {
      source: 'server',
      state: 'fresh',
      updatedAt: 0,
      staleAfterMs: 60_000,
    };

    expect(milestone.kind).toBe('event_locked');
    expect(delta.reasons).toHaveLength(0);
    expect(status.source).toBe('server');
  });
});
