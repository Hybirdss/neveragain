/**
 * View Preset Orchestrator — Handles viewPreset subscription.
 *
 * Cinematic sequences, cross-section drawing, underground catalog toggle.
 */

import { store } from '../store/appState';
import type { GlobeInstance } from '../globe/globeInstance';
import type { ViewPreset } from '../types';
import { applyViewPreset } from '../store/viewPresets';
import { setCatalogActive } from '../globe/layers/seismicPoints';
import { playCinematicSequence, buildSnsSequence, skipCinematic } from '../globe/cinematicSequence';
import { enableCrossSectionDrawing, disableCrossSectionDrawing, isDrawingActive } from '../globe/features/crossSectionLine';
import { showCrossSection, hideCrossSection } from '../ui/crossSection';

export function initViewPresetOrchestrator(globe: GlobeInstance): () => void {
  const unsub = store.subscribe('viewPreset', (preset: ViewPreset) => {
    applyViewPreset(globe, preset);
    setCatalogActive(preset === 'underground');

    // Cinematic sequence
    if (preset === 'cinematic') {
      const event = store.get('selectedEvent');
      if (event && event.magnitude >= 5.0) {
        const steps = buildSnsSequence(event);
        playCinematicSequence(globe, steps).then((capturedUrl) => {
          if (capturedUrl) {
            console.log(`[cinematic] Frame captured: ${capturedUrl.slice(0, 60)}...`);
          }
          store.set('viewPreset', 'default');
        });
      } else {
        console.warn('[cinematic] No M5+ event selected');
        store.set('viewPreset', 'default');
      }
    }

    // Cross-section drawing mode
    if (preset === 'crossSection') {
      enableCrossSectionDrawing(globe, (config) => {
        const timeline = store.get('timeline');
        const visibleEvents = timeline.events.filter(
          (e) => e.time <= timeline.currentTime,
        );
        showCrossSection(config, visibleEvents);
      });
    } else {
      if (isDrawingActive()) {
        disableCrossSectionDrawing(globe);
      }
      hideCrossSection();
    }
  });

  return () => {
    unsub();
    skipCinematic();
  };
}
