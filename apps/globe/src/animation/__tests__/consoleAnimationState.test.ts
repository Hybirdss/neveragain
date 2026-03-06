import { describe, expect, it } from 'vitest';

import {
  deriveIntensityAnimationFrame,
  extractWaveAnimationSources,
} from '../consoleAnimationState';

describe('consoleAnimationState', () => {
  it('extracts only recent operational events into wave animation sources', () => {
    const now = Date.parse('2026-03-07T04:00:00.000Z');

    expect(extractWaveAnimationSources([
      {
        id: 'recent-strong',
        lat: 38.2,
        lng: 142.4,
        depth_km: 24,
        magnitude: 6.8,
        time: now - 60_000,
        faultType: 'interface',
        tsunami: true,
        place: { text: 'Offshore Miyagi' },
      },
      {
        id: 'recent-weak',
        lat: 35.7,
        lng: 140.8,
        depth_km: 58,
        magnitude: 3.9,
        time: now - 30_000,
        faultType: 'crustal',
        tsunami: false,
        place: { text: 'Chiba' },
      },
      {
        id: 'stale-strong',
        lat: 33.2,
        lng: 131.4,
        depth_km: 44,
        magnitude: 5.4,
        time: now - 301_000,
        faultType: 'crustal',
        tsunami: false,
        place: { text: 'Kyushu' },
      },
    ], now)).toEqual([
      {
        id: 'recent-strong',
        lat: 38.2,
        lng: 142.4,
        depth_km: 24,
        magnitude: 6.8,
        originTime: now - 60_000,
      },
    ]);
  });

  it('derives reveal radius and completion for intensity animation frames', () => {
    expect(deriveIntensityAnimationFrame({
      now: 2_500,
      startAt: 1_000,
      epicenter: { lat: 35.7, lng: 140.8 },
      durationMs: 3_000,
      spreadSpeedKmPerSec: 200,
    })).toEqual({
      epicenter: { lat: 35.7, lng: 140.8 },
      revealRadiusKm: 300,
      completed: false,
    });

    expect(deriveIntensityAnimationFrame({
      now: 5_500,
      startAt: 1_000,
      epicenter: { lat: 35.7, lng: 140.8 },
      durationMs: 3_000,
      spreadSpeedKmPerSec: 200,
    })).toEqual({
      epicenter: { lat: 35.7, lng: 140.8 },
      revealRadiusKm: 600,
      completed: true,
    });
  });
});
