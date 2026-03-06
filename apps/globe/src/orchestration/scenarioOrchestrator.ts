/**
 * Scenario Orchestrator — Historical preset selection + Nankai multi-worker runner.
 */

import { store } from '../store/appState';
import type { GlobeInstance } from '../globe/globeInstance';
import type { EarthquakeEvent, HistoricalPreset } from '../types';
import type { OpsFocus, OpsScenarioShift } from '../ops/types';
import { applyScenarioShiftToEvent } from '../ops/scenarioShift';
import { runNankaiScenario } from '../engine/nankai';
import { executeCameraPath, NANKAI_CAMERA_PATH, TOHOKU_CAMERA_PATH } from '../globe/camera';
import { setSkipNextFlyTo } from './selectionOrchestrator';

export interface ScenarioOrchestratorHandle {
  onScenarioSelect: (preset: HistoricalPreset) => void;
  applyScenarioShift: (shift: OpsScenarioShift | null) => void;
  dispose: () => void;
}

export function initScenarioOrchestrator(globe: GlobeInstance): ScenarioOrchestratorHandle {
  let baseScenarioEvent: EarthquakeEvent | null = null;

  function updateScenarioState(event: EarthquakeEvent, shift: OpsScenarioShift | null): void {
    const eventTime = event.time;
    const ops = store.get('ops');
    const focus: OpsFocus = shift
      ? { type: 'scenario', earthquakeId: event.id }
      : { type: 'event', earthquakeId: event.id };

    store.batch(() => {
      store.set('mode', 'scenario');
      store.set('scenarioDelta', null);
      store.set('ops', {
        ...ops,
        focus,
        scenarioShift: shift,
      });
      store.set('timeline', {
        events: [event],
        currentIndex: 0,
        currentTime: eventTime,
        isPlaying: false,
        speed: 1,
        timeRange: [eventTime - 60_000, eventTime + 600_000],
      });
      store.set('selectedEvent', event);
    });
  }

  function applyScenarioShift(shift: OpsScenarioShift | null): void {
    if (!baseScenarioEvent) {
      return;
    }

    updateScenarioState(
      shift ? applyScenarioShiftToEvent(baseScenarioEvent, shift) : baseScenarioEvent,
      shift,
    );
  }

  function onScenarioSelect(preset: HistoricalPreset): void {
    const ops = store.get('ops');
    store.set('mode', 'scenario');
    store.set('ops', {
      ...ops,
      focus: { type: 'event', earthquakeId: preset.id },
      scenarioShift: null,
    });
    store.set('scenarioDelta', null);
    store.set('selectedEvent', null);
    store.set('intensityGrid', null);
    store.set('waveState', null);

    const event: EarthquakeEvent = {
      id: preset.id,
      lat: preset.epicenter.lat,
      lng: preset.epicenter.lng,
      depth_km: preset.depth_km,
      magnitude: preset.Mw,
      time: preset.startTime ? new Date(preset.startTime).getTime() : Date.now(),
      faultType: preset.faultType,
      tsunami: preset.faultType === 'interface' && preset.Mw >= 7.5,
      place: { text: preset.name },
    };
    baseScenarioEvent = event;

    // Nankai multi-worker scenario
    if (preset.id === 'nankai-scenario') {
      runNankaiScenario({
        onProgress: (fraction) => {
          console.log(`[nankai] Progress: ${(fraction * 100).toFixed(0)}%`);
        },
        onIntermediateGrid: (grid) => {
          store.set('intensityGrid', grid);
        },
      }).then((finalGrid) => {
        store.set('intensityGrid', finalGrid);
      }).catch((err) => {
        console.error('[nankai] Scenario failed:', err);
      });
    }

    // Camera paths (suppress flyTo from selectionOrchestrator)
    if (preset.id === 'nankai-scenario') {
      setSkipNextFlyTo(true);
      executeCameraPath(globe, NANKAI_CAMERA_PATH);
    } else if (preset.id === 'tohoku-2011') {
      setSkipNextFlyTo(true);
      executeCameraPath(globe, TOHOKU_CAMERA_PATH);
    }

    updateScenarioState(event, null);
  }

  return {
    onScenarioSelect,
    applyScenarioShift,
    dispose: () => {},
  };
}
