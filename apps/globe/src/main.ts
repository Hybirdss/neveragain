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
import { loadAllDataGrids, getVs30Grid } from './bootstrap/dataGridLoader';

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
import { getEventFromPoint, disposeSeismicPoints } from './globe/layers/seismicPoints';
import { initActiveFaults, disposeActiveFaults } from './globe/features/activeFaults';
import { tryPickFault } from './globe/features/activeFaults';
import { initGeocoder, disposeGeocoder } from './globe/geocoder';
import { HISTORICAL_PRESETS } from './engine/presets';

// UI
import { initLeftPanel, getToolbarSlot, getTabPane } from './ui/leftPanel';
import { initLiveFeed } from './ui/liveFeed';
import { initDetailPanel, disposeDetailPanel } from './ui/detailPanel';
import { initTimeline, updateTimeline, disposeTimeline } from './ui/timeline';
import { initIntensityLegend, disposeIntensityLegend } from './ui/intensityLegend';
import { disposeIntensityGuide } from './ui/intensityGuide';
import { initScenarioPicker, disposeScenarioPicker } from './ui/scenarioPicker';
import { showTooltip, hideTooltip } from './ui/tooltip';
import { initAlertBar } from './ui/alertBar';
import { initLayerToggles, disposeLayerToggles } from './ui/layerToggles';
import { initModeSwitcher, disposeModeSwitcher } from './ui/modeSwitcher';
import { initLocaleSwitcher, disposeLocaleSwitcher } from './ui/localeSwitcher';
import { initDepthScale, disposeDepthScale } from './ui/depthScale';
import { initMobileShell, disposeMobileShell } from './ui/mobileShell';
import { initMobileSheet, disposeMobileSheet } from './ui/mobileSheet';
import { initSearchBar, disposeSearchBar } from './ui/searchBar';
import { initCrossSection, disposeCrossSection } from './ui/crossSection';
import { initImpactPanel, disposeImpactPanel } from './ui/impactPanel';
import { initHomeButton, disposeHomeButton } from './ui/homeButton';

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

// ── Loading Screen Progress ──

function updateLoading(status: string, percent: number): void {
  const statusEl = document.getElementById('loading-status');
  const barEl = document.getElementById('loading-bar');
  if (statusEl) statusEl.textContent = status;
  if (barEl) barEl.style.width = `${percent}%`;
}

// ── Bootstrap ──

async function bootstrap(): Promise<void> {
  // 1. DOM layout
  updateLoading('Building layout…', 10);
  const layout = createLayout();

  // 2. State machine (needed before any store subscriptions)
  initStateMachine();
  const unsubSelectedDispatch = store.subscribe('selectedEvent', (event) => {
    if (event) dispatch({ type: 'SELECT_EARTHQUAKE', id: event.id });
    else dispatch({ type: 'DESELECT' });
  });

  // 3. UI modules (mount DOM while globe loads in parallel)
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  if (isMobile) {
    const sheet = initMobileSheet();
    initLiveFeed(sheet.listContainer);
    initDetailPanel(sheet.detailContainer);
  } else {
    initLeftPanel(layout.panelContainer);
    initLiveFeed();
    initDetailPanel(getTabPane('live')!);
    initMobileShell(layout.globeArea);
  }

  // 4. Start earthquake fetch EARLY — runs in parallel with globe + data grids
  const realtime = initRealtimeOrchestrator();
  const firstPollDone = realtime.pollerHandle.firstPollDone;

  // Dismiss the loading screen as soon as the first realtime fetch resolves.
  // The live feed and mobile peek summary are already mounted before globe boot.
  const loadingScreen = document.getElementById('loading-screen');
  function dismissLoading(): void {
    if (!loadingScreen || loadingScreen.classList.contains('exit')) return;
    updateLoading('Ready', 100);
    setTimeout(() => {
      loadingScreen.classList.add('exit');
      setTimeout(() => loadingScreen.remove(), 700);
    }, 200);
  }
  firstPollDone.then(dismissLoading, dismissLoading);
  setTimeout(dismissLoading, 12_000);

  // 5. Globe + data grids in parallel
  updateLoading('Loading 3D globe…', 20);
  const [{ globe, disposeGlobeSetup }, dataGrids] = await Promise.all([
    setupGlobe(layout.globeContainer),
    loadAllDataGrids(),
  ]);
  updateLoading('Globe ready', 60);

  // 6. Orchestrators FIRST — wire data pipeline before UI mounts
  //    so any data arriving during UI creation flows through immediately.
  updateLoading('Wiring engine…', 70);
  const gmpe = createGmpeOrchestrator(getVs30Grid);
  const disposeSelection = initSelectionOrchestrator(globe, gmpe);
  const disposeLayers = initLayerOrchestrator(globe, dataGrids);
  const disposeViewPreset = initViewPresetOrchestrator(globe);
  const disposeTimeline2 = initTimelineOrchestrator(globe);
  const disposeKeyboard = initKeyboardShortcuts();
  const scenario = initScenarioOrchestrator(globe);

  // 7. Remaining UI (needs globe reference)
  initImpactPanel(layout.sidebarContainer);
  initTimeline(layout.timelineContainer, createTimelineCallbacks());
  initIntensityLegend(layout.legendContainer);
  initAlertBar(layout.globeArea);
  initGeocoder(globe, layout.globeArea);
  initLayerToggles(layout.globeArea, globe);
  initLocaleSwitcher(layout.globeArea);
  initDepthScale(layout.globeArea);
  initSearchBar();
  initCrossSection(layout.globeArea, globe);
  initHomeButton(layout.globeArea, globe);
  const toolbarSlot = getToolbarSlot();
  if (toolbarSlot) {
    initModeSwitcher(toolbarSlot, {
      onLoadTimeline: (start, end) => {
        loadTimelineData(start, end).catch((err) =>
          console.error('[main] Timeline load failed:', err),
        );
      },
    });
  }

  // Timeline container visibility
  const timelineEl = layout.timelineContainer;
  function syncTimelineVisibility(mode: string): void {
    const show = mode !== 'realtime';
    timelineEl.style.display = show ? '' : 'none';
    const app = document.getElementById('app')!;
    app.style.gridTemplateRows = show ? '1fr var(--timeline-height)' : '1fr';
  }
  syncTimelineVisibility(store.get('mode'));
  const unsubTimelineMode = store.subscribe('mode', syncTimelineVisibility);

  // 8. Active faults (uses dataGrids result)
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

  // Scenario picker
  initScenarioPicker(
    document.getElementById('app')!,
    scenario.onScenarioSelect,
    HISTORICAL_PRESETS,
  );

  // 9. Globe click handler
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

  // 10. Initial timeline state
  updateTimeline(store.get('timeline'));

  // 11. Final loading status update for any in-flight loading UI.
  updateLoading('Fetching earthquakes…', 90);

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
      disposeCrossSection();
      disposeActiveFaults(globe);
      disposeImpactPanel();
      disposeSearchBar();
      disposeMobileShell();
      disposeMobileSheet();
      disposeDetailPanel();
      disposeHomeButton();
      disposeGeocoder();
      disposeModeSwitcher();
      disposeIntensityLegend();
      disposeIntensityGuide();
      disposeSeismicPoints();
      unsubSelectedDispatch();
      unsubTimelineMode();
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
