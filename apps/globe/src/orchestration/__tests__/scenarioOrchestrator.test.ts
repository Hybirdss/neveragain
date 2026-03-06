import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { OpsScenarioShift } from '../../ops/types';
import { store } from '../../store/appState';
import type { AppState, HistoricalPreset } from '../../types';
vi.mock('../selectionOrchestrator', () => ({
  setSkipNextFlyTo: () => {},
}));

vi.mock('../../globe/camera', () => ({
  executeCameraPath: () => {},
  NANKAI_CAMERA_PATH: [],
  TOHOKU_CAMERA_PATH: [],
}));

vi.mock('../../engine/nankai', () => ({
  runNankaiScenario: () => Promise.resolve(null),
}));

let initScenarioOrchestrator: typeof import('../scenarioOrchestrator').initScenarioOrchestrator;

const SNAPSHOT_KEYS = [
  'mode',
  'selectedEvent',
  'ops',
  'timeline',
  'intensityGrid',
  'waveState',
  'scenarioDelta',
] as const satisfies ReadonlyArray<keyof AppState>;

type Snapshot = Pick<AppState, typeof SNAPSHOT_KEYS[number]>;

function takeSnapshot(): Snapshot {
  return {
    mode: store.get('mode'),
    selectedEvent: store.get('selectedEvent'),
    ops: store.get('ops'),
    timeline: store.get('timeline'),
    intensityGrid: store.get('intensityGrid'),
    waveState: store.get('waveState'),
    scenarioDelta: store.get('scenarioDelta'),
  };
}

function restoreSnapshot(snapshot: Snapshot): void {
  store.batch(() => {
    store.set('mode', snapshot.mode);
    store.set('selectedEvent', snapshot.selectedEvent);
    store.set('ops', snapshot.ops);
    store.set('timeline', snapshot.timeline);
    store.set('intensityGrid', snapshot.intensityGrid);
    store.set('waveState', snapshot.waveState);
    store.set('scenarioDelta', snapshot.scenarioDelta);
  });
}

function createPreset(): HistoricalPreset {
  return {
    id: 'preset-test-scenario',
    name: 'Tokyo Bay Shift Test',
    epicenter: { lat: 35.6, lng: 140.1 },
    Mw: 7.6,
    depth_km: 38,
    faultType: 'interface',
    usgsId: null,
    startTime: '2024-01-01T00:00:00.000Z',
    description: 'Test preset',
  };
}

describe('scenarioOrchestrator.applyScenarioShift', () => {
  const originalState = takeSnapshot();

  beforeAll(async () => {
    ({ initScenarioOrchestrator } = await import('../scenarioOrchestrator'));
  });

  afterEach(() => {
    restoreSnapshot(originalState);
  });

  it('applies a live scenario shift on top of the selected preset baseline', () => {
    const orchestrator = initScenarioOrchestrator({} as never);
    const shift: OpsScenarioShift = {
      magnitudeDelta: 0.4,
      depthDeltaKm: -20,
      latShiftDeg: 0.15,
      lngShiftDeg: 0.25,
    };

    orchestrator.onScenarioSelect(createPreset());
    orchestrator.applyScenarioShift(shift);

    const selectedEvent = store.get('selectedEvent');
    const ops = store.get('ops');
    const timeline = store.get('timeline');

    expect(selectedEvent?.magnitude).toBeCloseTo(8.0, 5);
    expect(selectedEvent?.depth_km).toBeCloseTo(18, 5);
    expect(selectedEvent?.lat).toBeCloseTo(35.75, 5);
    expect(selectedEvent?.lng).toBeCloseTo(140.35, 5);
    expect(selectedEvent?.tsunami).toBe(true);
    expect(ops.scenarioShift).toEqual(shift);
    expect(ops.focus).toEqual({ type: 'scenario', earthquakeId: 'preset-test-scenario' });
    expect(timeline.events[0]).toEqual(selectedEvent);
    expect(timeline.currentIndex).toBe(0);

    orchestrator.dispose();
  });

  it('restores the baseline scenario event when the shift is cleared', () => {
    const orchestrator = initScenarioOrchestrator({} as never);
    const shift: OpsScenarioShift = {
      magnitudeDelta: 0.2,
      depthDeltaKm: -10,
      latShiftDeg: -0.1,
      lngShiftDeg: 0.2,
    };

    orchestrator.onScenarioSelect(createPreset());
    const baselineEvent = store.get('selectedEvent');

    orchestrator.applyScenarioShift(shift);
    orchestrator.applyScenarioShift(null);

    expect(store.get('selectedEvent')).toEqual(baselineEvent);
    expect(store.get('ops').scenarioShift).toBeNull();
    expect(store.get('ops').focus).toEqual({ type: 'event', earthquakeId: 'preset-test-scenario' });
    expect(store.get('timeline').events[0]).toEqual(baselineEvent);

    orchestrator.dispose();
  });
});
