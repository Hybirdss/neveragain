/**
 * View Preset Orchestrator — Handles viewPreset subscription.
 *
 * Cross-section: auto-generates line from selected earthquake,
 * flies camera, shows full-page overlay.
 */

import { store } from '../store/appState';
import type { GlobeInstance } from '../globe/globeInstance';
import type { ViewPreset } from '../types';
import { applyViewPreset } from '../store/viewPresets';
import { setCatalogActive } from '../globe/layers/seismicPoints';
import { showCrossSection, hideCrossSection } from '../ui/crossSection';

export function initViewPresetOrchestrator(globe: GlobeInstance): () => void {
  const unsub = store.subscribe('viewPreset', (preset: ViewPreset) => {
    applyViewPreset(globe, preset);
    setCatalogActive(preset === 'underground');

    if (preset === 'crossSection') {
      const selectedEvent = store.get('selectedEvent');
      if (!selectedEvent) return;

      // Get visible events for cross-section projection
      const timeline = store.get('timeline');
      const visibleEvents = timeline.events.filter(
        (e) => e.time <= timeline.currentTime,
      );

      showCrossSection(selectedEvent, visibleEvents);
    } else {
      hideCrossSection();
    }
  });

  return () => {
    unsub();
  };
}
