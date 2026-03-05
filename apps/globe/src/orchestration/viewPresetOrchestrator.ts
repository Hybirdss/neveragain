/**
 * View Preset Orchestrator — Handles viewPreset subscription.
 *
 * Cross-section drawing, underground catalog toggle.
 */

import { store } from '../store/appState';
import type { GlobeInstance } from '../globe/globeInstance';
import type { ViewPreset } from '../types';
import { applyViewPreset } from '../store/viewPresets';
import { setCatalogActive } from '../globe/layers/seismicPoints';
import { enableCrossSectionDrawing, disableCrossSectionDrawing, isDrawingActive } from '../globe/features/crossSectionLine';
import { showCrossSection, hideCrossSection } from '../ui/crossSection';

export function initViewPresetOrchestrator(globe: GlobeInstance): () => void {
  const unsub = store.subscribe('viewPreset', (preset: ViewPreset) => {
    applyViewPreset(globe, preset);
    setCatalogActive(preset === 'underground');

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
  };
}
