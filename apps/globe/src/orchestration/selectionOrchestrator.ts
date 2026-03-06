/**
 * Selection Orchestrator — Handles selectedEvent subscription.
 *
 * When a user clicks an earthquake, this orchestrator:
 * - Flies camera to epicenter
 * - Triggers GMPE computation
 * - Fetches ShakeMap for M5+
 * - Spawns wave rings for recent events
 * - Triggers AI analysis
 * - Shows M7+ alert bar
 */

import { store } from '../store/appState';
import type { EarthquakeEvent } from '../types';
import type { TsunamiAssessment } from '../types';
import { assessTsunamiRisk, classifyLocation, inferFaultType } from '@namazue/db/geo';
import type { GlobeInstance } from '../globe/globeInstance';
import type { GmpeOrchestrator } from './gmpeOrchestrator';
import { flyToEarthquake } from '../globe/camera';
import { spawnWaveRings, clearWaveRings } from '../globe/layers/waveRings';
import { clearIsoseismal } from '../globe/layers/isoseismal';
import { fetchShakeMap, abortShakeMapFetch } from '../data/shakeMapApi';
import { updateShakeMapOverlay, clearShakeMapOverlay } from '../globe/features/shakeMapOverlay';
import { highlightSearchResults } from '../globe/layers/seismicPoints';
import { updateLiveFeed } from '../ui/liveFeed';
import { showAlert, hideAlert } from '../ui/alertBar';
import { fetchAnalysis } from '../ai/client';
import { shouldFetchOnClick } from '../ai/tierRouter';
import { HISTORICAL_PRESETS } from '../engine/presets';
import { startWaveAnimation, stopWaveAnimation } from './waveOrchestrator';
import { hideTooltip } from '../ui/tooltip';
import { resolvePresetAfterSelectionChange } from './expertPresetGuard';

let skipNextFlyTo = false;

export function setSkipNextFlyTo(value: boolean): void {
  skipNextFlyTo = value;
}

export function initSelectionOrchestrator(
  globe: GlobeInstance,
  gmpe: GmpeOrchestrator,
): () => void {
  const unsubs: Array<() => void> = [];

  // Search results → globe highlight
  let prevSearchResultIds: Set<string> | null = null;
  unsubs.push(store.subscribe('ai', (aiState) => {
    const results = aiState.searchResults as Array<{ id?: string }> | null;
    if (!results || results.length === 0) {
      if (prevSearchResultIds !== null) {
        highlightSearchResults(null);
        prevSearchResultIds = null;
      }
      return;
    }
    const ids = new Set(results.map(r => r.id).filter((id): id is string => !!id));
    prevSearchResultIds = ids;
    highlightSearchResults(ids);
  }));

  // selectedEvent → GMPE + ShakeMap + camera + waves + AI
  let selectedEventVersion = 0;
  let previousSelectedEventId: string | null = null;
  unsubs.push(store.subscribe('selectedEvent', async (event: EarthquakeEvent | null) => {
    const myVersion = ++selectedEventVersion;
    const currentPreset = store.get('viewPreset');
    const normalizedPreset = resolvePresetAfterSelectionChange({
      currentPreset,
      previousSelectedId: previousSelectedEventId,
      nextSelectedId: event?.id ?? null,
    });
    previousSelectedEventId = event?.id ?? null;
    if (normalizedPreset !== currentPreset) {
      store.set('viewPreset', normalizedPreset);
    }

    // Always hide tooltip (may have been shown by globe click for a different event)
    hideTooltip();

    if (!event) {
      abortShakeMapFetch();
      clearIsoseismal(globe);
      clearShakeMapOverlay();
      clearWaveRings(globe);
      stopWaveAnimation();
      store.set('intensityGrid', null);
      store.set('intensitySource', 'none');
      store.set('waveState', null);
      store.set('tsunamiAssessment', null);
      store.set('ai', {
        ...store.get('ai'),
        currentAnalysis: null,
        analysisLoading: false,
        analysisError: null,
      });
      return;
    }

    abortShakeMapFetch();
    clearIsoseismal(globe);
    clearShakeMapOverlay();
    store.set('intensityGrid', null);
    store.set('intensitySource', 'none');

    // Tsunami assessment — compute once, store for all UI modules
    const placeText = event.place?.text;
    const loc = classifyLocation(event.lat, event.lng, placeText, undefined);
    const ft = event.faultType || inferFaultType(event.depth_km, event.lat, event.lng, placeText, undefined);
    const tsunamiResult = assessTsunamiRisk(
      event.magnitude, event.depth_km, ft,
      event.lat, event.lng, placeText, undefined,
      event.tsunami,
    );
    const assessment: TsunamiAssessment = {
      risk: tsunamiResult.risk,
      confidence: tsunamiResult.confidence,
      factors: tsunamiResult.factors,
      locationType: loc.type,
      coastDistanceKm: loc.coastDistanceKm,
      faultType: ft,
    };
    store.set('tsunamiAssessment', assessment);

    // AI analysis
    if (shouldFetchOnClick(event)) {
      fetchAnalysis(event.id);
    } else {
      store.set('ai', {
        ...store.get('ai'),
        currentAnalysis: null,
        analysisLoading: false,
        analysisError: null,
      });
    }

    // Camera flyTo (unless suppressed by scenario camera path)
    if (skipNextFlyTo) {
      skipNextFlyTo = false;
    } else {
      flyToEarthquake(globe, event);
    }

    // Wave rings for recent events (< 30 min old)
    const eventAge = Date.now() - event.time;
    if (eventAge < 30 * 60_000) {
      spawnWaveRings(globe, event);
      startWaveAnimation(event);
    } else {
      clearWaveRings(globe);
      stopWaveAnimation();
    }

    // Update live feed detail panel
    const timeline = store.get('timeline');
    updateLiveFeed(timeline.events, event, store.get('intensitySource'));

    // Sync timeline currentIndex
    const selectedIdx = timeline.events.findIndex(e => e.id === event.id);
    if (selectedIdx !== -1 && selectedIdx !== timeline.currentIndex) {
      store.set('timeline', { ...timeline, currentIndex: selectedIdx });
    }

    // M7+ alert bar
    if (event.magnitude >= 7.0) {
      showAlert(event);
    } else {
      hideAlert();
    }

    // GMPE computation
    const isScenario = event.id === 'nankai-scenario' || event.id.startsWith('preset-');
    if (event.id !== 'nankai-scenario') {
      store.set('intensitySource', 'gmpe');
      updateLiveFeed(store.get('timeline').events, event, 'gmpe');
      gmpe.requestComputation(event);
    }

    // ShakeMap override for M5+ non-scenario events
    if (!isScenario && event.magnitude >= 5.0) {
      const preset = HISTORICAL_PRESETS.find(p => p.id === event.id);
      const usgsEventId = preset?.usgsId ?? event.id;
      const shakeMap = await fetchShakeMap(usgsEventId);
      if (myVersion !== selectedEventVersion) return;
      if (!shakeMap?.mmiContours) return;

      clearIsoseismal(globe);
      updateShakeMapOverlay(globe, shakeMap);
      store.set('intensitySource', 'shakemap');
      updateLiveFeed(store.get('timeline').events, event, 'shakemap');
    }
  }));

  return () => {
    for (const unsub of unsubs) unsub();
  };
}
