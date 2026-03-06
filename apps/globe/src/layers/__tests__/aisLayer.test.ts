import { describe, expect, it } from 'vitest';

import { computeMaritimeExposure, formatVesselTooltip } from '../aisLayer';
import type { Vessel } from '../../data/aisManager';
import type { EarthquakeEvent } from '../../types';

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
});
