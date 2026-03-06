import { describe, expect, it } from 'vitest';

import {
  computeMaritimeExposure,
  filterVisibleVessels,
  formatVesselTooltip,
} from '../aisLayer';
import type { Vessel } from '../../data/aisManager';
import { buildMaritimeOverview } from '../../ops/maritimeTelemetry';
import type { EarthquakeEvent } from '../../types';
import type { ViewportState } from '../../core/viewportManager';

const selectedEvent: EarthquakeEvent = {
  id: 'eq-ais',
  lat: 35.0,
  lng: 140.0,
  depth_km: 18,
  magnitude: 6.8,
  time: Date.parse('2026-03-06T10:00:00.000Z'),
  faultType: 'interface',
  tsunami: true,
  place: { text: 'Off the coast of Chiba' },
};

const vessels: Vessel[] = [
  {
    mmsi: '431000001',
    name: 'FERRY SAKURA',
    lat: 35.15,
    lng: 140.1,
    cog: 90,
    sog: 14,
    type: 'passenger',
    lastUpdate: Date.parse('2026-03-06T10:01:00.000Z'),
    trail: [
      [140.06, 35.11],
      [140.08, 35.13],
      [140.1, 35.15],
    ],
  },
  {
    mmsi: '431000002',
    name: 'PACIFIC STAR',
    lat: 39.0,
    lng: 144.0,
    cog: 45,
    sog: 11,
    type: 'cargo',
    lastUpdate: Date.parse('2026-03-06T10:01:00.000Z'),
    trail: [
      [143.9, 38.9],
      [143.95, 38.95],
      [144.0, 39.0],
    ],
  },
];

describe('aisLayer', () => {
  it('summarizes vessels inside the impact zone for operator review', () => {
    const exposure = computeMaritimeExposure(vessels, selectedEvent);

    expect(exposure.totalInZone).toBe(1);
    expect(exposure.passengerCount).toBe(1);
    expect(exposure.cargoCount).toBe(0);
    expect(exposure.summary).toContain('1 vessels in impact zone');
    expect(exposure.summary).toContain('1 passenger');
  });

  it('marks high-priority vessels that are inside the impact zone in the tooltip', () => {
    const tooltip = formatVesselTooltip(vessels[0]!, selectedEvent);

    expect(tooltip).toContain('HIGH PRIORITY');
    expect(tooltip).toContain('IN IMPACT ZONE');
  });

  it('builds a richer calm-state overview than a raw tracked count', () => {
    const overview = buildMaritimeOverview(vessels);

    expect(overview.totalTracked).toBe(2);
    expect(overview.highPriorityTracked).toBe(1);
    expect(overview.underwayCount).toBe(2);
    expect(overview.summary).toContain('2 tracked');
    expect(overview.summary).toContain('1 high-priority');
  });

  it('filters rendered vessels to the active viewport while keeping nearby traffic', () => {
    const viewport: ViewportState = {
      center: { lat: 35.5, lng: 140.1 },
      zoom: 9,
      bounds: [138.5, 33.5, 141.5, 36.5],
      tier: 'regional',
      pitch: 0,
      bearing: 0,
    };

    const visible = filterVisibleVessels(vessels, viewport);

    expect(visible).toHaveLength(1);
    expect(visible[0]?.mmsi).toBe('431000001');
  });
});
