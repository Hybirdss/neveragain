/**
 * Namazue — Thin Bootstrap
 *
 * Entry point: creates DOM, initializes globe, wires orchestrators, starts polling.
 * All business logic lives in orchestration/ modules.
 */

import './style.css';
import './ui/geocoder.css';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// Bootstrap
import { createLayout } from './bootstrap/layout';
import { setupGlobe } from './bootstrap/globeSetup';
import { loadAllDataGrids } from './bootstrap/dataGridLoader';

// Store & State
import { store } from './store/appState';
import { initStateMachine, disposeStateMachine, dispatch } from './store/stateMachine';

// Orchestrators
import { createGmpeOrchestrator } from './orchestration/gmpeOrchestrator';
import { initSelectionOrchestrator } from './orchestration/selectionOrchestrator';
import { initLayerOrchestrator } from './orchestration/layerOrchestrator';
import { initViewPresetOrchestrator } from './orchestration/viewPresetOrchestrator';
import { initScenarioOrchestrator } from './orchestration/scenarioOrchestrator';
import { initRealtimeOrchestrator } from './orchestration/realtimeOrchestrator';
import { initTimelineOrchestrator } from './orchestration/timelineOrchestrator';
import { initKeyboardShortcuts } from './orchestration/keyboardShortcuts';
import { disposeWaveOrchestrator } from './orchestration/waveOrchestrator';

// Globe features
import * as Cesium from 'cesium';
import { getEventFromPoint } from './globe/layers/seismicPoints';
import { initActiveFaults, disposeActiveFaults } from './globe/features/activeFaults';
import { tryPickFault } from './globe/features/activeFaults';
import { disableCrossSectionDrawing } from './globe/features/crossSectionLine';
import { initGeocoder, disposeGeocoder } from './globe/geocoder';
import { HISTORICAL_PRESETS } from './engine/presets';

// UI
import { initLeftPanel } from './ui/leftPanel';
import { initLiveFeed } from './ui/liveFeed';
import { initTimeline, updateTimeline, disposeTimeline } from './ui/timeline';
import { initIntensityLegend, disposeIntensityLegend } from './ui/intensityLegend';
import { initScenarioPicker, disposeScenarioPicker } from './ui/scenarioPicker';
import { showTooltip, hideTooltip } from './ui/tooltip';
import { initAlertBar } from './ui/alertBar';
import { initLayerToggles, disposeLayerToggles } from './ui/layerToggles';
import { initModeSwitcher, disposeModeSwitcher } from './ui/modeSwitcher';
import { initLocaleSwitcher, disposeLocaleSwitcher } from './ui/localeSwitcher';
import { initDepthScale, disposeDepthScale } from './ui/depthScale';
import { initMobileShell, disposeMobileShell } from './ui/mobileShell';
import { initSearchBar, disposeSearchBar } from './ui/searchBar';
import { initCrossSection, disposeCrossSection } from './ui/crossSection';
import { initImpactPanel, disposeImpactPanel } from './ui/impactPanel';

// Data
import { loadTimelineData } from './data/timelineLoader';

// ── Timeline Playback Callbacks ──

function createTimelineCallbacks() {
  return {
    onPlay: () => {
      const tl = store.get('timeline');
      store.set('timeline', { ...tl, isPlaying: true });
    },
    onPause: () => {
      const tl = store.get('timeline');
      store.set('timeline', { ...tl, isPlaying: false });
    },
    onSeek: (time: number) => {
      const tl = store.get('timeline');
      store.set('timeline', { ...tl, currentTime: time });
    },
    onSpeedChange: (speed: number) => {
      const tl = store.get('timeline');
      store.set('timeline', { ...tl, speed });
    },
    onPrev: () => {
      const tl = store.get('timeline');
      if (tl.events.length === 0) return;
      const newIdx = Math.max(0, tl.currentIndex - 1);
      const event = tl.events[newIdx];
      store.set('timeline', { ...tl, currentIndex: newIdx, currentTime: event.time });
      store.set('selectedEvent', event);
    },
    onNext: () => {
      const tl = store.get('timeline');
      if (tl.events.length === 0) return;
      const newIdx = Math.min(tl.events.length - 1, tl.currentIndex + 1);
      const event = tl.events[newIdx];
      store.set('timeline', { ...tl, currentIndex: newIdx, currentTime: event.time });
      store.set('selectedEvent', event);
    },
  };
}

// ── Bootstrap ──

async function bootstrap(): Promise<void> {
  // 1. DOM layout
  const layout = createLayout();

  // 2. Globe + layers
  const { globe, disposeGlobeSetup } = await setupGlobe(layout.globeContainer);

  // 3. State machine + bridge
  initStateMachine();
  store.subscribe('selectedEvent', (event) => {
    if (event) dispatch({ type: 'SELECT_EARTHQUAKE', id: event.id });
    else dispatch({ type: 'DESELECT' });
  });

  // 4. UI modules
  initLeftPanel(layout.panelContainer);
  initLiveFeed();
  initImpactPanel(layout.sidebarContainer);
  initTimeline(layout.timelineContainer, createTimelineCallbacks());
  initIntensityLegend(layout.legendContainer);
  initAlertBar(layout.globeArea);
  initGeocoder(globe, layout.globeArea);
  initLayerToggles(layout.globeArea, globe);
  initLocaleSwitcher(layout.globeArea);
  initDepthScale(layout.globeArea);
  initSearchBar();
  initCrossSection(layout.globeArea);
  initMobileShell(layout.globeArea);
  initModeSwitcher(layout.timelineContainer, {
    onLoadTimeline: (start, end) => {
      loadTimelineData(start, end).catch((err) =>
        console.error('[main] Timeline load failed:', err),
      );
    },
  });

  // 5. Data grids (async, non-blocking) + active faults
  const dataGrids = await loadAllDataGrids();
  if (dataGrids.activeFaults.length > 0) {
    initActiveFaults(globe, dataGrids.activeFaults, (event, fault) => {
      store.set('mode', 'scenario');
      store.set('selectedFault', fault);
      const eventTime = event.time;
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

  // 6. Orchestrators (each wires its own subscriptions)
  const gmpe = createGmpeOrchestrator(dataGrids.vs30Grid);
  const disposeSelection = initSelectionOrchestrator(globe, gmpe);
  const disposeLayers = initLayerOrchestrator(globe, dataGrids);
  const disposeViewPreset = initViewPresetOrchestrator(globe);
  const disposeTimeline2 = initTimelineOrchestrator(globe);
  const disposeKeyboard = initKeyboardShortcuts();
  const scenario = initScenarioOrchestrator(globe);
  const realtime = initRealtimeOrchestrator();

  // Scenario picker
  initScenarioPicker(
    document.getElementById('app')!,
    scenario.onScenarioSelect,
    HISTORICAL_PRESETS,
  );

  // 7. Globe click handler
  const clickHandler = new Cesium.ScreenSpaceEventHandler(globe.scene.canvas);
  clickHandler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
    const picked = globe.scene.pick(click.position);
    if (Cesium.defined(picked) && picked.primitive instanceof Cesium.Billboard) {
      const eq = getEventFromPoint(picked.primitive);
      if (eq) {
        store.set('selectedEvent', eq);
        showTooltip(eq, click.position.x, click.position.y);
        return;
      }
    }
    if (tryPickFault(picked)) {
      hideTooltip();
      return;
    }
    hideTooltip();
    store.set('selectedEvent', null);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // 8. Initial timeline state
  updateTimeline(store.get('timeline'));

  // 9. Dismiss loading screen after first poll
  const loadingScreen = document.getElementById('loading-screen');
  realtime.pollerHandle.firstPollDone.then(() => {
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      setTimeout(() => loadingScreen.remove(), 500);
    }
  });

  // HMR cleanup
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      disposeSelection();
      disposeLayers();
      disposeViewPreset();
      disposeTimeline2();
      disposeKeyboard();
      scenario.dispose();
      realtime.dispose();
      gmpe.dispose();
      disposeWaveOrchestrator();
      disposeGlobeSetup();
      disposeStateMachine();
      disposeTimeline();
      disposeScenarioPicker();
      disposeLayerToggles();
      disposeLocaleSwitcher();
      disposeDepthScale();
      disableCrossSectionDrawing(globe);
      disposeCrossSection();
      disposeActiveFaults(globe);
      disposeImpactPanel();
      disposeSearchBar();
      disposeMobileShell();
      disposeGeocoder();
      disposeModeSwitcher();
      disposeIntensityLegend();
      layout.disposeLayout();
    });
  }
}

// ── Entry Point ──

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/tile-cache-sw.js').catch((err) => {
    console.warn('[sw] Registration failed:', err);
  });
}

bootstrap().catch((err) => {
  console.error('[Namazue] Bootstrap failed:', err);
});
