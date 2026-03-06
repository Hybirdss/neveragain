import { describe, expect, it } from 'vitest';

import { buildOperatorBundleSummaries } from '../bundleSummaries';
import type { OperationalOverview } from '../readModelTypes';
import type { OpsAsset, OpsAssetExposure } from '@namazue/ops/ops/types';

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
    expect(summaries.seismic!.trust).toBe('confirmed');
    expect(summaries.seismic!.counters).toEqual([
      { id: 'affected-assets', label: 'Affected', value: 3, tone: 'priority' },
      { id: 'visible-assets', label: 'Visible', value: 3, tone: 'priority' },
    ]);
    expect(summaries.seismic!.signals).toEqual([
      { id: 'focus-region', label: 'Focus Region', value: 'Kanto', tone: 'priority' },
      { id: 'top-assets', label: 'Top Assets', value: 'Port of Tokyo, University of Tokyo Hospital', tone: 'priority' },
    ]);
    expect(summaries.maritime!.metric).toContain('122 tracked');
    expect(summaries.maritime!.counters).toEqual([
      { id: 'tracked', label: 'Tracked', value: 122, tone: 'clear' },
      { id: 'high-priority', label: 'High Priority', value: 34, tone: 'priority' },
      { id: 'underway', label: 'Underway', value: 98, tone: 'watch' },
    ]);
    expect(summaries.maritime!.signals).toEqual([
      { id: 'exposed-ports', label: 'Exposed Ports', value: 'Port of Tokyo', tone: 'priority' },
      { id: 'traffic-posture', label: 'Traffic Posture', value: '34 priority / 98 underway', tone: 'watch' },
    ]);
    expect(summaries.lifelines!.metric).toContain('1 lifeline site');
    expect(summaries.lifelines!.signals).toEqual([
      { id: 'corridor-focus', label: 'Corridor Focus', value: 'Tokyo Station', tone: 'watch' },
    ]);
    expect(summaries.medical!.metric).toContain('1 medical site');
    expect(summaries.medical!.signals).toEqual([
      { id: 'medical-focus', label: 'Medical Focus', value: 'University of Tokyo Hospital', tone: 'priority' },
    ]);
    expect(summaries['built-environment']!.detail).toContain('city-tier');
    expect(summaries['built-environment']!.trust).toBe('pending');
    expect(summaries['built-environment']!.signals).toEqual([
      { id: 'activation-tier', label: 'Activation Tier', value: 'City-tier on operator focus', tone: 'watch' },
    ]);
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
    expect(summaries.seismic!.trust).toBe('confirmed');
    expect(summaries.maritime!.metric).toContain('No tracked traffic');
    expect(summaries.maritime!.detail).toContain('standing by');
    expect(summaries.maritime!.counters).toEqual([]);
    expect(summaries.maritime!.signals).toEqual([]);
    expect(summaries.lifelines!.detail).toContain('standing by');
    expect(summaries.lifelines!.signals).toEqual([]);
    expect(summaries.medical!.detail).toContain('standing by');
    expect(summaries.medical!.signals).toEqual([]);
  });

  it('accepts domain overview overrides so future feeds can plug into the same summary contract', () => {
    const summaries = buildOperatorBundleSummaries({
      selectedEvent: {
        id: 'eq-1',
        lat: 35,
        lng: 139,
        depth_km: 24,
        magnitude: 6.8,
        time: Date.parse('2026-03-06T10:00:00.000Z'),
        faultType: 'interface',
        tsunami: false,
        place: { text: 'Sagami corridor' },
      },
      assets,
      exposures,
      operationalOverview,
      maritimeOverview: null,
      domainOverviews: {
        lifelines: {
          metric: '2 rail corridors, 1 power node under review',
          detail: 'Tokaido corridor and Tokyo grid ingress require operator verification.',
          severity: 'critical',
          availability: 'live',
          trust: 'review',
          counters: [
            { id: 'rail-corridors', label: 'Rail Corridors', value: 2, tone: 'priority' },
            { id: 'power-nodes', label: 'Power Nodes', value: 1, tone: 'watch' },
          ],
          signals: [
            { id: 'lifeline-focus', label: 'Lifeline Focus', value: 'Tokaido, Tokyo Grid East', tone: 'critical' },
          ],
        },
        medical: {
          metric: 'Tertiary hospitals on ambulance access watch',
          detail: 'Ambulance ingress degraded across central Tokyo catchments.',
          severity: 'watch',
          availability: 'live',
          trust: 'confirmed',
          counters: [
            { id: 'ambulance-zones', label: 'Ambulance Zones', value: 3, tone: 'watch' },
          ],
          signals: [
            { id: 'medical-access', label: 'Medical Access', value: 'Central Tokyo catchments', tone: 'watch' },
          ],
        },
      },
    });

    expect(summaries.lifelines).toMatchObject({
      metric: '2 rail corridors, 1 power node under review',
      detail: 'Tokaido corridor and Tokyo grid ingress require operator verification.',
      severity: 'critical',
      availability: 'live',
      trust: 'review',
    });
    expect(summaries.lifelines!.counters).toEqual([
      { id: 'rail-corridors', label: 'Rail Corridors', value: 2, tone: 'priority' },
      { id: 'power-nodes', label: 'Power Nodes', value: 1, tone: 'watch' },
    ]);
    expect(summaries.lifelines!.signals).toEqual([
      { id: 'lifeline-focus', label: 'Lifeline Focus', value: 'Tokaido, Tokyo Grid East', tone: 'critical' },
    ]);
    expect(summaries.medical).toMatchObject({
      metric: 'Tertiary hospitals on ambulance access watch',
      detail: 'Ambulance ingress degraded across central Tokyo catchments.',
      severity: 'watch',
      availability: 'live',
      trust: 'confirmed',
    });
  });

  it('surfaces family breakdown counters for mixed lifeline and built-environment exposure sets', () => {
    const summaries = buildOperatorBundleSummaries({
      selectedEvent: {
        id: 'eq-2',
        lat: 35.64,
        lng: 139.82,
        depth_km: 22,
        magnitude: 6.9,
        time: Date.parse('2026-03-06T10:04:00.000Z'),
        faultType: 'interface',
        tsunami: true,
        place: { text: 'Tokyo Bay operator corridor' },
      },
      assets: [
        ...assets,
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
        {
          id: 'marunouchi-core',
          region: 'kanto',
          class: 'building_cluster',
          name: 'Marunouchi Core',
          lat: 35.68,
          lng: 139.76,
          tags: ['urban', 'buildings'],
          minZoomTier: 'city',
        },
      ] as OpsAsset[],
      exposures: [
        ...exposures,
        {
          assetId: 'tokyo-east-substation',
          severity: 'critical',
          score: 93,
          summary: 'Tokyo East Substation is in critical posture.',
          reasons: ['grid stability risk'],
        },
        {
          assetId: 'toyosu-water',
          severity: 'priority',
          score: 67,
          summary: 'Toyosu Water Purification Center is in priority posture.',
          reasons: ['service continuity risk'],
        },
        {
          assetId: 'marunouchi-core',
          severity: 'watch',
          score: 44,
          summary: 'Marunouchi Core is in watch posture.',
          reasons: ['urban structure inspection'],
        },
      ],
      operationalOverview: {
        ...operationalOverview,
        visibleAffectedAssetCount: 6,
        nationalAffectedAssetCount: 6,
        topSeverity: 'critical',
      },
      maritimeOverview: null,
      trustLevel: 'review',
    });

    expect(summaries.lifelines?.counters).toEqual([
      { id: 'lifeline-sites', label: 'Lifeline Sites', value: 3, tone: 'critical' },
      { id: 'rail-hubs', label: 'Rail Hubs', value: 1, tone: 'watch' },
      { id: 'power-nodes', label: 'Power Nodes', value: 1, tone: 'critical' },
      { id: 'water-sites', label: 'Water Sites', value: 1, tone: 'priority' },
    ]);
    expect(summaries.lifelines?.domains).toEqual([
      {
        id: 'rail',
        label: 'Rail',
        metric: '1 rail hub exposed',
        detail: 'Tokyo Station requires operator verification.',
        severity: 'watch',
        availability: 'live',
        trust: 'review',
        counters: [
          { id: 'rail-hubs', label: 'Rail Hubs', value: 1, tone: 'watch' },
        ],
        signals: [
          { id: 'focus-assets', label: 'Focus Assets', value: 'Tokyo Station', tone: 'watch' },
        ],
      },
      {
        id: 'power',
        label: 'Power',
        metric: '1 power node exposed',
        detail: 'Tokyo East Substation requires operator verification.',
        severity: 'critical',
        availability: 'live',
        trust: 'review',
        counters: [
          { id: 'power-nodes', label: 'Power Nodes', value: 1, tone: 'critical' },
        ],
        signals: [
          { id: 'focus-assets', label: 'Focus Assets', value: 'Tokyo East Substation', tone: 'critical' },
        ],
      },
      {
        id: 'water',
        label: 'Water',
        metric: '1 water site exposed',
        detail: 'Toyosu Water Purification Center requires operator verification.',
        severity: 'priority',
        availability: 'live',
        trust: 'review',
        counters: [
          { id: 'water-sites', label: 'Water Sites', value: 1, tone: 'priority' },
        ],
        signals: [
          { id: 'focus-assets', label: 'Focus Assets', value: 'Toyosu Water Purification Center', tone: 'priority' },
        ],
      },
    ]);
    expect(summaries.lifelines?.signals).toEqual([
      { id: 'corridor-focus', label: 'Corridor Focus', value: 'Tokyo East Substation, Toyosu Water Purification Center', tone: 'critical' },
      { id: 'domain-mix', label: 'Domain Mix', value: 'Rail + Power + Water', tone: 'critical' },
    ]);
    expect(summaries['built-environment']?.counters).toEqual([
      { id: 'building-clusters', label: 'Building Clusters', value: 1, tone: 'watch' },
    ]);
    expect(summaries['built-environment']?.domains).toEqual([
      {
        id: 'urban-core',
        label: 'Urban Core',
        metric: '1 building cluster exposed',
        detail: 'Marunouchi Core requires operator verification.',
        severity: 'watch',
        availability: 'live',
        trust: 'review',
        counters: [
          { id: 'building-clusters', label: 'Building Clusters', value: 1, tone: 'watch' },
        ],
        signals: [
          { id: 'focus-assets', label: 'Focus Assets', value: 'Marunouchi Core', tone: 'watch' },
        ],
      },
    ]);
    expect(summaries['built-environment']?.signals).toEqual([
      { id: 'urban-focus', label: 'Urban Focus', value: 'Marunouchi Core', tone: 'watch' },
    ]);
  });
});
