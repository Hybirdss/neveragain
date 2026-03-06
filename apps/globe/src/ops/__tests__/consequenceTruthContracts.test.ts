import { describe, expect, it } from 'vitest';

import { buildVisualImpactHeuristic } from '../../layers/impactZone';
import { buildDefaultBundleDomainOverviews } from '../bundleDomainOverviews';
import { buildOperatorBundleSummaries } from '../bundleSummaries';
import type { ServiceReadModel } from '../readModelTypes';
import type { OpsAsset, OpsAssetExposure, OpsPriority } from '../types';

const freshnessStatus = {
  source: 'server' as const,
  state: 'fresh' as const,
  updatedAt: Date.parse('2026-03-07T00:00:00.000Z'),
  staleAfterMs: 60_000,
};

const assets: OpsAsset[] = [
  {
    id: 'tokyo-east-substation',
    region: 'kanto',
    class: 'power_substation',
    name: 'Tokyo East Substation',
    lat: 35.65,
    lng: 139.83,
    tags: ['power', 'grid'],
    minZoomTier: 'regional',
  },
  {
    id: 'toyosu-water',
    region: 'kanto',
    class: 'water_facility',
    name: 'Toyosu Water Purification Center',
    lat: 35.64,
    lng: 139.81,
    tags: ['water', 'lifeline'],
    minZoomTier: 'regional',
  },
];

const exposures: OpsAssetExposure[] = [
  {
    assetId: 'tokyo-east-substation',
    severity: 'critical',
    score: 93,
    summary: 'Tokyo East Substation is in critical posture.',
    reasons: ['strong shaking overlap', 'grid stability risk'],
  },
  {
    assetId: 'toyosu-water',
    severity: 'priority',
    score: 66,
    summary: 'Toyosu Water Purification Center is in priority posture.',
    reasons: ['moderate shaking overlap', 'service continuity risk'],
  },
];

const priorities: OpsPriority[] = [
  {
    id: 'priority-substation',
    assetId: 'tokyo-east-substation',
    severity: 'critical',
    title: 'Verify Tokyo East Substation power posture',
    rationale: 'Kanto power substation posture is critical because strong shaking overlap, grid stability risk.',
  },
  {
    id: 'priority-water',
    assetId: 'toyosu-water',
    severity: 'priority',
    title: 'Verify Toyosu Water Purification Center water posture',
    rationale: 'Kanto water facility posture is priority because moderate shaking overlap, service continuity risk.',
  },
];

describe('consequence truth contracts', () => {
  it('lets queues and bundle summaries carry confidence, freshness, and reason', () => {
    const domainOverviews = buildDefaultBundleDomainOverviews({
      priorities,
      exposures,
      assets,
      trustLevel: 'review',
      freshnessStatus,
      consequenceConfidence: 'high',
      consequenceSource: 'backend-truth',
    });

    const summaries = buildOperatorBundleSummaries({
      selectedEvent: {
        id: 'eq-1',
        lat: 35,
        lng: 139,
        depth_km: 24,
        magnitude: 6.8,
        time: Date.parse('2026-03-07T00:00:00.000Z'),
        faultType: 'interface',
        tsunami: false,
        place: { text: 'Sagami corridor' },
      },
      assets,
      exposures,
      operationalOverview: {
        selectionReason: 'auto-select',
        selectionSummary: 'Operational focus auto-selected from current incident stream',
        impactSummary: '2 lifeline sites in elevated posture',
        visibleAffectedAssetCount: 2,
        nationalAffectedAssetCount: 2,
        topRegion: 'kanto',
        topSeverity: 'critical',
      },
      maritimeOverview: null,
      domainOverviews,
      freshnessStatus,
      consequenceConfidence: 'high',
      consequenceSource: 'backend-truth',
    });

    const readModel: ServiceReadModel = {
      currentEvent: null,
      eventTruth: null,
      viewport: null,
      nationalSnapshot: null,
      systemHealth: {
        level: 'nominal',
        headline: 'Nominal',
        detail: 'All systems nominal.',
        flags: [],
      },
      operationalOverview: {
        selectionReason: 'auto-select',
        selectionSummary: 'Operational focus auto-selected from current incident stream',
        impactSummary: '2 lifeline sites in elevated posture',
        visibleAffectedAssetCount: 2,
        nationalAffectedAssetCount: 2,
        topRegion: 'kanto',
        topSeverity: 'critical',
      },
      bundleSummaries: summaries,
      nationalExposureSummary: exposures,
      visibleExposureSummary: exposures,
      nationalPriorityQueue: [
        {
          ...priorities[0]!,
          consequence: {
            source: 'backend-truth',
            confidence: 'high',
            freshness: freshnessStatus,
            reason: priorities[0]!.rationale,
          },
        },
      ],
      visiblePriorityQueue: [],
      freshnessStatus,
    };

    expect(readModel.nationalPriorityQueue[0]?.consequence?.reason).toContain('grid stability risk');
    expect(readModel.nationalPriorityQueue[0]?.consequence?.confidence).toBe('high');
    expect(readModel.bundleSummaries.lifelines?.consequence?.freshness.updatedAt).toBe(freshnessStatus.updatedAt);
    expect(readModel.bundleSummaries.lifelines?.consequence?.reason).toContain('grid stability risk');
  });

  it('keeps visual heuristics explicit and out of final consequence truth', () => {
    const heuristic = buildVisualImpactHeuristic({
      id: 'eq-1',
      lat: 35,
      lng: 139,
      depth_km: 24,
      magnitude: 6.8,
      time: Date.parse('2026-03-07T00:00:00.000Z'),
      faultType: 'interface',
      tsunami: false,
      place: { text: 'Sagami corridor' },
    });

    const overviews = buildDefaultBundleDomainOverviews({
      priorities,
      exposures,
      assets,
      trustLevel: 'review',
      freshnessStatus,
      consequenceConfidence: 'medium',
      consequenceSource: 'backend-truth',
    });

    expect(heuristic?.source).toBe('visual-heuristic');
    expect(overviews.lifelines?.consequence?.source).toBe('backend-truth');
    expect(overviews.lifelines?.detail).toBe('Verify Tokyo East Substation power posture');
  });

  it('allows nuclear to remain a distinct domain inside lifelines', () => {
    const summaries = buildOperatorBundleSummaries({
      selectedEvent: null,
      assets,
      exposures,
      operationalOverview: {
        selectionReason: 'auto-select',
        selectionSummary: 'Operational focus auto-selected from current incident stream',
        impactSummary: '2 lifeline sites in elevated posture',
        visibleAffectedAssetCount: 2,
        nationalAffectedAssetCount: 2,
        topRegion: 'kanto',
        topSeverity: 'critical',
      },
      maritimeOverview: null,
      domainOverviews: {
        lifelines: {
          metric: '1 nuclear status verification queued',
          detail: 'Tokyo grid ingress remains under operator review.',
          severity: 'critical',
          availability: 'live',
          trust: 'review',
          counters: [],
          signals: [],
          consequence: {
            source: 'backend-truth',
            confidence: 'high',
            freshness: freshnessStatus,
            reason: 'Independent nuclear-site verification remains required.',
          },
          domains: [
            {
              id: 'nuclear',
              label: 'Nuclear',
              metric: '1 site awaiting status verification',
              detail: 'Independent nuclear-site verification remains required.',
              severity: 'critical',
              availability: 'live',
              trust: 'review',
              counters: [],
              signals: [],
              consequence: {
                source: 'backend-truth',
                confidence: 'high',
                freshness: freshnessStatus,
                reason: 'Independent nuclear-site verification remains required.',
              },
            },
          ],
        },
      },
      freshnessStatus,
      consequenceConfidence: 'high',
      consequenceSource: 'backend-truth',
    });

    expect(summaries.lifelines?.domains.map((domain) => domain.id)).toContain('nuclear');
    expect(summaries.lifelines?.domains[0]?.consequence?.reason).toContain('nuclear-site verification');
  });
});
