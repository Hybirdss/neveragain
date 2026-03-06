import { describe, expect, it } from 'vitest';

import { buildOperatorBundleSummaries } from '../bundleSummaries';
import type { OperationalOverview } from '../readModelTypes';
import type { OpsAsset, OpsAssetExposure } from '../types';

const assets: OpsAsset[] = [
  {
    id: 'tokyo-port',
    region: 'kanto',
    class: 'port',
    name: 'Port of Tokyo',
    lat: 35.61,
    lng: 139.79,
    tags: ['coastal'],
    minZoomTier: 'national',
  },
  {
    id: 'tokyo-station',
    region: 'kanto',
    class: 'rail_hub',
    name: 'Tokyo Station',
    lat: 35.68,
    lng: 139.76,
    tags: ['rail'],
    minZoomTier: 'regional',
  },
  {
    id: 'tokyo-univ-hospital',
    region: 'kanto',
    class: 'hospital',
    name: 'University of Tokyo Hospital',
    lat: 35.71,
    lng: 139.76,
    tags: ['medical'],
    minZoomTier: 'city',
  },
];

const operationalOverview: OperationalOverview = {
  selectionReason: 'auto-select',
  selectionSummary: 'Operational focus auto-selected from current incident stream',
  impactSummary: '3 assets in elevated posture nationwide',
  visibleAffectedAssetCount: 3,
  nationalAffectedAssetCount: 3,
  topRegion: 'kanto',
  topSeverity: 'priority',
};

const exposures: OpsAssetExposure[] = [
  {
    assetId: 'tokyo-port',
    severity: 'priority',
    score: 80,
    summary: 'Port posture elevated',
    reasons: ['coastal shaking'],
  },
  {
    assetId: 'tokyo-station',
    severity: 'watch',
    score: 58,
    summary: 'Rail posture elevated',
    reasons: ['transport corridor'],
  },
  {
    assetId: 'tokyo-univ-hospital',
    severity: 'priority',
    score: 62,
    summary: 'Hospital access posture elevated',
    reasons: ['medical access'],
  },
];

describe('buildOperatorBundleSummaries', () => {
  it('derives backend-owned summaries for seismic, lifelines, medical, and built environment', () => {
    const summaries = buildOperatorBundleSummaries({
      selectedEvent: {
        id: 'eq-1',
        lat: 35,
        lng: 139,
        depth_km: 24,
        magnitude: 7.1,
        time: Date.parse('2026-03-06T10:00:00.000Z'),
        faultType: 'interface',
        tsunami: true,
        place: { text: 'Sagami corridor' },
      },
      assets,
      exposures,
      operationalOverview,
      maritimeOverview: {
        totalTracked: 122,
        highPriorityTracked: 34,
        underwayCount: 98,
        anchoredCount: 24,
        summary: '122 tracked · 34 high-priority · 98 underway',
      },
    });

    expect(summaries.seismic!.metric).toContain('3 assets');
    expect(summaries.maritime!.metric).toContain('122 tracked');
    expect(summaries.lifelines!.metric).toContain('1 rail hub');
    expect(summaries.medical!.metric).toContain('1 medical site');
    expect(summaries['built-environment']!.detail).toContain('city-tier');
  });

  it('keeps calm standby wording when there is no active event or affected assets', () => {
    const summaries = buildOperatorBundleSummaries({
      selectedEvent: null,
      assets,
      exposures: [],
      operationalOverview: {
        selectionReason: null,
        selectionSummary: 'No operationally significant event selected',
        impactSummary: 'No assets in elevated posture',
        visibleAffectedAssetCount: 0,
        nationalAffectedAssetCount: 0,
        topRegion: null,
        topSeverity: 'clear',
      },
      maritimeOverview: null,
    });

    expect(summaries.seismic!.metric).toContain('No elevated');
    expect(summaries.maritime!.metric).toContain('No tracked traffic');
    expect(summaries.maritime!.detail).toContain('standing by');
    expect(summaries.lifelines!.detail).toContain('standing by');
    expect(summaries.medical!.detail).toContain('standing by');
  });
});
