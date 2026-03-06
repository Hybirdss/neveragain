import { beforeEach, describe, expect, it } from 'vitest';

import type { EarthquakeEvent } from '../../types';
import type { Vessel } from '../../data/aisManager';
import { earthquakeStore } from '../../data/earthquakeStore';
import {
  applyConsoleRealtimeError,
  deriveConsoleOperationalState,
  refreshConsoleBundleTruth,
} from '../consoleOps';
import { OPS_ASSETS } from '../../ops/assetCatalog';

function createEvent(
  id: string,
  magnitude: number,
  time: number,
  overrides: Partial<EarthquakeEvent> = {},
): EarthquakeEvent {
  return {
    id,
    lat: 35.62,
    lng: 139.79,
    depth_km: 24,
    magnitude,
    time,
    faultType: 'interface',
    tsunami: false,
    place: { text: `${id} corridor` },
    ...overrides,
  };
}

describe('deriveConsoleOperationalState', () => {
  const now = Date.parse('2026-03-06T10:00:00.000Z');

  beforeEach(() => {
    earthquakeStore.clear();
  });

  it('returns calm mode and a calm read model when no significant event is active', () => {
    const result = deriveConsoleOperationalState({
      now,
      events: [createEvent('minor', 4.1, now - 5 * 60_000)],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 5.5,
        bounds: [122, 24, 150, 46],
        tier: 'national',
        pitch: 0,
        bearing: 0,
      },
    });

    expect(result.mode).toBe('calm');
    expect(result.selectedEvent).toBeNull();
    expect(result.readModel.currentEvent).toBeNull();
    expect(result.readModel.nationalSnapshot).toBeNull();
    expect(result.realtimeStatus.state).toBe('fresh');
  });

  it('returns viewport-aware read model data for a significant event', () => {
    const result = deriveConsoleOperationalState({
      now,
      events: [
        createEvent('moderate', 5.0, now - 15 * 60_000),
        createEvent('severe', 6.8, now - 4 * 60_000, { tsunami: true }),
      ],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 9.2,
        bounds: [138.8, 34.8, 140.2, 36.2],
        tier: 'regional',
        pitch: 0,
        bearing: 0,
      },
    });

    expect(result.mode).toBe('event');
    expect(result.selectedEvent?.id).toBe('severe');
    expect(result.readModel.eventTruth?.source).toBe('server');
    expect(result.readModel.visibleExposureSummary.length).toBeGreaterThan(0);
    expect(result.readModel.visiblePriorityQueue.length).toBeGreaterThan(0);
    expect(result.readModel.viewport?.activeRegion).toBe('kanto');
  });

  it('surfaces richer lifeline and built-environment truth from the starter catalog during Tokyo-scale events', () => {
    const result = deriveConsoleOperationalState({
      now,
      events: [
        createEvent('severe', 7.0, now - 4 * 60_000, {
          lat: 35.64,
          lng: 139.82,
          tsunami: true,
          place: { text: 'Tokyo Bay operator corridor' },
        }),
      ],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.79 },
        zoom: 10.1,
        bounds: [139.2, 35.2, 140.2, 35.95],
        tier: 'regional',
        pitch: 0,
        bearing: 0,
      },
    });

    expect(result.readModel.bundleSummaries.lifelines?.metric).not.toContain('1 lifeline site');
    expect(result.readModel.bundleSummaries.lifelines?.counters).toContainEqual({
      id: 'lifeline-sites',
      label: 'Lifeline Sites',
      value: expect.any(Number),
      tone: expect.any(String),
    });
    expect((result.readModel.bundleSummaries.lifelines?.counters.find((counter) => counter.id === 'lifeline-sites')?.value ?? 0)).toBeGreaterThan(1);
    expect(result.readModel.bundleSummaries['built-environment']?.availability).toBe('live');
    expect(result.readModel.bundleSummaries['built-environment']?.metric).toContain('building cluster');
  });

  it('preserves the current read model while degrading freshness on realtime errors', () => {
    const derived = deriveConsoleOperationalState({
      now,
      events: [createEvent('severe', 6.8, now - 4 * 60_000, { tsunami: true })],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 9.2,
        bounds: [138.8, 34.8, 140.2, 36.2],
        tier: 'regional',
        pitch: 0,
        bearing: 0,
      },
    });

    const degraded = applyConsoleRealtimeError({
      now: now + 30_000,
      source: 'server',
      updatedAt: now,
      message: 'Realtime poll failed',
      readModel: derived.readModel,
    });

    expect(degraded.realtimeStatus.state).toBe('degraded');
    expect(degraded.realtimeStatus.message).toBe('Realtime poll failed');
    expect(degraded.readModel.currentEvent?.id).toBe('severe');
    expect(degraded.readModel.freshnessStatus.state).toBe('degraded');
  });

  it('refreshes maritime bundle truth from AIS updates without rerunning hazard computation', () => {
    const derived = deriveConsoleOperationalState({
      now,
      events: [createEvent('severe', 6.8, now - 4 * 60_000, { tsunami: true })],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 9.2,
        bounds: [138.8, 34.8, 140.2, 36.2],
        tier: 'regional',
        pitch: 0,
        bearing: 0,
      },
    });
    const vessels: Vessel[] = [
      {
        mmsi: '431000001',
        name: 'FERRY SAKURA',
        lat: 35.15,
        lng: 140.1,
        cog: 90,
        sog: 14,
        type: 'passenger',
        lastUpdate: now,
        trail: [[140.1, 35.15]],
      },
      {
        mmsi: '431000002',
        name: 'PACIFIC STAR',
        lat: 39.0,
        lng: 144.0,
        cog: 45,
        sog: 11,
        type: 'cargo',
        lastUpdate: now,
        trail: [[144, 39]],
      },
    ];

    const refreshed = refreshConsoleBundleTruth({
      readModel: derived.readModel,
      realtimeStatus: derived.realtimeStatus,
      selectedEvent: derived.selectedEvent,
      exposures: derived.exposures,
      vessels,
      assets: OPS_ASSETS,
    });

    expect(refreshed.currentEvent?.id).toBe('severe');
    expect(refreshed.operationalOverview.selectionReason).toBe('auto-select');
    expect(refreshed.bundleSummaries.maritime?.metric).toContain('2 tracked');
    expect(refreshed.bundleSummaries.seismic?.metric).toContain('assets');
  });

  it('preserves derived lifeline and medical domain overviews during AIS-only bundle refresh', () => {
    const derived = deriveConsoleOperationalState({
      now,
      events: [
        createEvent('severe', 6.8, now - 4 * 60_000, { tsunami: true }),
        createEvent('minor', 4.2, now - 8 * 60_000),
      ],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 9.2,
        bounds: [138.8, 34.8, 140.2, 36.2],
        tier: 'regional',
        pitch: 0,
        bearing: 0,
      },
    });

    const refreshed = refreshConsoleBundleTruth({
      readModel: derived.readModel,
      realtimeStatus: derived.realtimeStatus,
      selectedEvent: derived.selectedEvent,
      exposures: derived.exposures,
      vessels: [],
      assets: OPS_ASSETS,
    });

    expect(refreshed.bundleSummaries.lifelines?.signals.length ?? 0).toBeGreaterThanOrEqual(0);
    expect(refreshed.bundleSummaries.medical?.signals.length ?? 0).toBeGreaterThanOrEqual(0);
    expect(refreshed.bundleSummaries.lifelines?.metric).toBe(derived.readModel.bundleSummaries.lifelines?.metric);
    expect(refreshed.bundleSummaries.medical?.metric).toBe(derived.readModel.bundleSummaries.medical?.metric);
  });
});
