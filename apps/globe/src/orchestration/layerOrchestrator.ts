/**
 * Layer Orchestrator — Manages intensity grid, layer visibility, and colorblind subscriptions.
 */

import { store } from '../store/appState';
import type { GlobeInstance } from '../globe/globeInstance';
import type { DataGrids } from '../bootstrap/dataGridLoader';
import type { IntensityGrid, LayerVisibility } from '../types';
import { generateContourFeatures } from '../utils/contourProjection';
import { updateIsoseismal, clearIsoseismal } from '../globe/layers/isoseismal';
import { setActiveFaultsVisible } from '../globe/features/activeFaults';
import { computeImpact } from '../engine/impactAssessment';
import { buildAssetExposures } from '../ops/exposure';
import { buildOpsPriorities } from '../ops/priorities';
import { buildScenarioDelta } from '../ops/scenarioDelta';
import { buildServiceReadModel } from '../ops/serviceReadModel';
import { earthquakeStore } from '../data/earthquakeStore';

export function initLayerOrchestrator(
  globe: GlobeInstance,
  dataGrids: DataGrids,
): () => void {
  const unsubs: Array<() => void> = [];

  function syncServiceReadModel(): void {
    const ops = store.get('ops');
    const selectedEvent = store.get('selectedEvent');
    store.set('serviceReadModel', buildServiceReadModel({
      selectedEvent,
      selectedEventEnvelope: selectedEvent ? earthquakeStore.getEnvelope(selectedEvent.id) ?? null : null,
      selectedEventRevisionHistory: selectedEvent ? [...earthquakeStore.getRevisionHistory(selectedEvent.id)] : [],
      selectionReason: selectedEvent ? 'retain-current' : null,
      tsunamiAssessment: store.get('tsunamiAssessment'),
      impactResults: store.get('impactResults'),
      assets: ops.assets,
      viewport: store.get('viewportState'),
      exposures: ops.exposures,
      priorities: ops.priorities,
      freshnessStatus: store.get('realtimeStatus'),
    }));
  }

  // intensityGrid → contours + impact
  unsubs.push(store.subscribe('intensityGrid', (grid: IntensityGrid | null) => {
    if (!grid) {
      clearIsoseismal(globe);
      store.set('impactResults', null);
      const ops = store.get('ops');
      store.set('ops', { ...ops, exposures: [], priorities: [] });
      store.set('scenarioDelta', null);
      syncServiceReadModel();
      return;
    }

    const features = generateContourFeatures(grid, store.get('colorblind'));
    updateIsoseismal(globe, features);

    // Impact assessment
    if (dataGrids.prefectures.length > 0) {
      const impacts = computeImpact(grid, dataGrids.prefectures);
      store.set('impactResults', impacts);
    }

    const selectedEvent = store.get('selectedEvent');
    const tsunamiAssessment = store.get('tsunamiAssessment');
    const ops = store.get('ops');

    if (!selectedEvent) {
      store.set('ops', { ...ops, exposures: [], priorities: [] });
      store.set('scenarioDelta', null);
      syncServiceReadModel();
      return;
    }

    const exposures = buildAssetExposures({
      grid,
      assets: ops.assets,
      tsunamiAssessment,
    });
    const priorities = buildOpsPriorities({
      assets: ops.assets,
      exposures,
    });
    store.set('ops', { ...ops, exposures, priorities });
    store.set(
      'scenarioDelta',
      ops.scenarioShift
        ? buildScenarioDelta({
            previousExposures: ops.exposures,
            nextExposures: exposures,
            previousPriorities: ops.priorities,
            nextPriorities: priorities,
            scenarioShift: ops.scenarioShift,
          })
        : null,
    );
    syncServiceReadModel();
  }));

  unsubs.push(store.subscribe('selectedEvent', () => {
    syncServiceReadModel();
  }));

  unsubs.push(store.subscribe('tsunamiAssessment', () => {
    syncServiceReadModel();
  }));

  // Layer visibility → toggle features (diff-based)
  unsubs.push(store.subscribe('layers', (layers: LayerVisibility, prev: LayerVisibility) => {
    const changed = new Set<keyof LayerVisibility>();
    if (!prev) {
      Object.keys(layers).forEach(k => changed.add(k as keyof LayerVisibility));
    } else {
      Object.keys(layers).forEach(k => {
        const key = k as keyof LayerVisibility;
        if (layers[key] !== prev[key]) changed.add(key);
      });
    }
    if (changed.size === 0) return;

    if (changed.has('activeFaults')) {
      setActiveFaultsVisible(layers.activeFaults);
    }
  }));

  // Colorblind → refresh visuals
  unsubs.push(store.subscribe('colorblind', (isColorblind) => {
    const grid = store.get('intensityGrid');
    if (grid) {
      const features = generateContourFeatures(grid, isColorblind);
      updateIsoseismal(globe, features);
    }
  }));

  return () => {
    for (const unsub of unsubs) unsub();
  };
}
