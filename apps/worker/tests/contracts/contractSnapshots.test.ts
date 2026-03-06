import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  serializeConsoleSnapshot,
  serializeReplaySnapshot,
  serializeScenarioSnapshot,
  type ConsoleSnapshot,
  type ReplaySnapshot,
  type ScenarioSnapshot,
} from '@namazue/contracts';

function loadFixture(name: string) {
  return JSON.parse(
    readFileSync(new URL(`../fixtures/contracts/${name}.json`, import.meta.url), 'utf8'),
  );
}

function buildConsoleSnapshotFixture(): ConsoleSnapshot {
  return {
    events: [
      {
        id: 'tokyo-impact',
        lat: 35.68,
        lng: 139.76,
        depth_km: 22,
        magnitude: 6.8,
        time: 1_741_318_400_000,
        faultType: 'crustal',
        tsunami: false,
        place: { text: 'Tokyo Bay' },
      },
    ],
    mode: 'event',
    selectedEvent: {
      id: 'tokyo-impact',
      lat: 35.68,
      lng: 139.76,
      depth_km: 22,
      magnitude: 6.8,
      time: 1_741_318_400_000,
      faultType: 'crustal',
      tsunami: false,
      place: { text: 'Tokyo Bay' },
    },
    intensityGrid: {
      cols: 2,
      rows: 2,
      center: { lat: 35.68, lng: 139.76 },
      radiusDeg: 1.5,
      data: [4.2, 5.1, 4.6, 3.8],
    },
    exposures: [
      {
        assetId: 'tokyo-port',
        severity: 'critical',
        score: 91,
        summary: 'Port cranes and logistics yards face strong shaking.',
        reasons: ['JMA 5+', 'soil amplification'],
      },
    ],
    priorities: [
      {
        id: 'tokyo-port-check',
        assetId: 'tokyo-port',
        severity: 'critical',
        title: 'Inspect Tokyo Port operations',
        rationale: 'Critical maritime handling nodes show the highest exposure score.',
      },
    ],
    readModel: {
      currentEvent: {
        id: 'tokyo-impact',
        lat: 35.68,
        lng: 139.76,
        depth_km: 22,
        magnitude: 6.8,
        time: 1_741_318_400_000,
        faultType: 'crustal',
        tsunami: false,
        place: { text: 'Tokyo Bay' },
      },
      eventTruth: {
        source: 'server',
        revision: 'server:tokyo-impact:1741318400000',
        issuedAt: 1_741_318_405_000,
        receivedAt: 1_741_318_408_000,
        observedAt: 1_741_318_400_000,
        supersedes: null,
        confidence: 'high',
        revisionCount: 1,
        sources: ['server'],
        hasConflictingRevision: false,
        divergenceSeverity: 'none',
        magnitudeSpread: 0,
        depthSpreadKm: 0,
        locationSpreadKm: 0,
        tsunamiMismatch: false,
        faultTypeMismatch: false,
      },
      viewport: {
        center: { lat: 35.68, lng: 139.76 },
        zoom: 8.4,
        bounds: [138.5, 34.8, 140.9, 36.4],
        tier: 'regional',
        activeRegion: 'kanto',
      },
      nationalSnapshot: {
        title: 'Kanto shaking posture',
        summary: 'Tokyo Bay event is driving the national operator view.',
        headline: 'Strong shaking expected across the Tokyo Bay corridor.',
        tsunami: null,
        topImpact: {
          id: 'tokyo',
          name: 'Tokyo',
          nameEn: 'Tokyo',
          maxIntensity: 5.1,
          jmaClass: '5+',
          population: 14000000,
          exposedPopulation: 8200000,
        },
      },
      systemHealth: {
        level: 'nominal',
        headline: 'Primary realtime feed healthy',
        detail: 'Worker-owned snapshot is current.',
        flags: [],
      },
      operationalOverview: {
        selectionReason: 'auto-select',
        selectionSummary: 'Tokyo Bay event remains the operational focus.',
        impactSummary: 'Critical exposure concentrated in Tokyo Bay logistics and medical corridors.',
        visibleAffectedAssetCount: 1,
        nationalAffectedAssetCount: 3,
        topRegion: 'kanto',
        topSeverity: 'critical',
      },
      bundleSummaries: {
        seismic: {
          bundleId: 'seismic',
          title: 'Seismic',
          metric: '1 critical exposure',
          detail: 'Tokyo Bay shaking is concentrated around the main logistics belt.',
          severity: 'critical',
          availability: 'live',
          trust: 'confirmed',
          counters: [
            { id: 'critical', label: 'Critical', value: 1, tone: 'critical' },
          ],
          signals: [
            { id: 'focus', label: 'Focus', value: 'Tokyo Bay', tone: 'critical' },
          ],
          domains: [],
        },
      },
      nationalExposureSummary: [
        {
          assetId: 'tokyo-port',
          severity: 'critical',
          score: 91,
          summary: 'Port cranes and logistics yards face strong shaking.',
          reasons: ['JMA 5+', 'soil amplification'],
        },
      ],
      visibleExposureSummary: [
        {
          assetId: 'tokyo-port',
          severity: 'critical',
          score: 91,
          summary: 'Port cranes and logistics yards face strong shaking.',
          reasons: ['JMA 5+', 'soil amplification'],
        },
      ],
      nationalPriorityQueue: [
        {
          id: 'tokyo-port-check',
          assetId: 'tokyo-port',
          severity: 'critical',
          title: 'Inspect Tokyo Port operations',
          rationale: 'Critical maritime handling nodes show the highest exposure score.',
        },
      ],
      visiblePriorityQueue: [
        {
          id: 'tokyo-port-check',
          assetId: 'tokyo-port',
          severity: 'critical',
          title: 'Inspect Tokyo Port operations',
          rationale: 'Critical maritime handling nodes show the highest exposure score.',
        },
      ],
      freshnessStatus: {
        source: 'server',
        state: 'fresh',
        updatedAt: 1_741_318_408_000,
        staleAfterMs: 60000,
      },
    },
    realtimeStatus: {
      source: 'server',
      state: 'fresh',
      updatedAt: 1_741_318_408_000,
      staleAfterMs: 60000,
    },
    replayMilestones: [
      { kind: 'event_locked', at: 1_741_318_401_000, label: 'Event locked' },
      { kind: 'impact_ready', at: 1_741_318_404_000, label: 'Impact ready' },
      { kind: 'priorities_published', at: 1_741_318_408_000, label: 'Priorities published' },
    ],
    scenarioDelta: {
      changeSummary: ['Magnitude +0.4', 'Depth -10 km'],
      exposureChanges: [
        { assetId: 'tokyo-port', from: 'watch', to: 'critical' },
      ],
      priorityChanges: [
        { id: 'tokyo-port-check', from: 1, to: 0 },
      ],
      reasons: ['Shallower rupture increased near-bay shaking'],
    },
    sourceMeta: {
      source: 'server',
      updatedAt: 1_741_318_408_000,
    },
  };
}

function buildReplaySnapshotFixture(): ReplaySnapshot {
  return {
    sourceEventId: 'tokyo-impact',
    generatedAt: 1_741_318_408_000,
    milestones: [
      { kind: 'event_locked', at: 1_741_318_401_000, label: 'Event locked' },
      { kind: 'impact_ready', at: 1_741_318_404_000, label: 'Impact ready' },
      { kind: 'priorities_published', at: 1_741_318_408_000, label: 'Priorities published' },
    ],
  };
}

function buildScenarioSnapshotFixture(): ScenarioSnapshot {
  return {
    sourceEventId: 'scenario-sagami',
    generatedAt: 1_741_318_500_000,
    delta: {
      changeSummary: ['Magnitude +0.7', 'Depth -15 km', 'Latitude shift +0.2°'],
      exposureChanges: [
        { assetId: 'yokohama-port', from: 'priority', to: 'critical' },
      ],
      priorityChanges: [
        { id: 'yokohama-port-check', from: 2, to: 0 },
      ],
      reasons: ['Scenario shift moved strongest shaking into the bay corridor'],
    },
  };
}

test('serializeConsoleSnapshot produces the locked console contract fixture', () => {
  assert.deepEqual(
    serializeConsoleSnapshot(buildConsoleSnapshotFixture()),
    loadFixture('console-snapshot'),
  );
});

test('serializeReplaySnapshot produces the locked replay contract fixture', () => {
  assert.deepEqual(
    serializeReplaySnapshot(buildReplaySnapshotFixture()),
    loadFixture('replay-snapshot'),
  );
});

test('serializeScenarioSnapshot produces the locked scenario contract fixture', () => {
  assert.deepEqual(
    serializeScenarioSnapshot(buildScenarioSnapshotFixture()),
    loadFixture('scenario-snapshot'),
  );
});
