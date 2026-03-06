import { describe, expect, it } from 'vitest';

import type { EarthquakeEvent } from '../../types';
import type { ImpactIntelligence } from '../../ops/impactIntelligence';
import { renderImpactIntelligenceMarkup } from '../impactIntelligence';

function createEvent(): EarthquakeEvent {
  return {
    id: 'eq-1',
    lat: 35.68,
    lng: 139.76,
    depth_km: 24,
    magnitude: 7.1,
    time: Date.parse('2026-03-07T01:00:00.000Z'),
    faultType: 'interface',
    tsunami: true,
    place: {
      text: 'Sagami Trough',
    },
  };
}

function createIntelligence(): ImpactIntelligence {
  return {
    peakIntensity: {
      jmaClass: '6-',
      value: 5.8,
      location: { lat: 35.68, lng: 139.76 },
    },
    areaStats: {
      jma7: 0,
      jma6plus: 240,
      jma6minus: 780,
      jma5plus: 1_540,
      jma5minus: 3_200,
      jma4plus: 8_800,
    },
    populationExposure: {
      jma7: 0,
      jma6plus: 182_000,
      jma6minus: 624_000,
      jma5plus: 1_320_000,
      jma5minus: 2_880_000,
      jma4plus: 4_200_000,
      jma3plus: 8_500_000,
      catalogedPopulation: 12_300_000,
      totalPopulation: 123_400_000,
      topAffected: [
        { name: 'Tokyo', nameEn: 'Tokyo', population: 1_420_000, intensity: 5.8, jmaClass: '6-' },
        { name: 'Yokohama', nameEn: 'Yokohama', population: 820_000, intensity: 5.1, jmaClass: '5+' },
      ],
    },
    infraSummary: {
      hospitalsCompromised: 2,
      hospitalsDisrupted: 5,
      hospitalsOperational: 12,
      dmatBasesDeployable: 3,
      nuclearScramLikely: 0,
      nuclearScramPossible: 1,
      railLinesSuspended: 4,
      railLinesAffected: 8,
      vesselsHighPriority: 7,
      vesselsInZone: 19,
    },
    tsunamiETAs: [
      {
        portName: 'Tokyo',
        portNameJa: '東京港',
        estimatedMinutes: 19,
        distanceKm: 31,
        lat: 35.63,
        lng: 139.79,
      },
    ],
    responseTimeline: [
      {
        minutesAfter: 0,
        label: 'Alert',
        labelJa: '警報',
        description: 'Initial operational check',
        triggered: true,
      },
    ],
  };
}

describe('impact intelligence markup', () => {
  it('keeps statistical source attribution while hiding calculation methodology from the main panel', () => {
    const markup = renderImpactIntelligenceMarkup(createIntelligence(), createEvent());

    expect(markup).toContain('Population Exposure');
    expect(markup).toContain('総務省人口推計 (2025-01)');
    expect(markup).not.toContain('Si &amp; Midorikawa');
    expect(markup).not.toContain('0.1° grid');
    expect(markup).not.toContain('v = √(g·d)');
    expect(markup).not.toContain('内閣府防災');
    expect(markup).not.toContain('NRA基準地震動');
    expect(markup).not.toContain('UrEDAS');
  });
});
