/**
 * NeverAgain — Application Bootstrap & Module Wiring
 *
 * Orchestrator-only: initialises every module and wires them together
 * through the reactive store. Contains no business logic.
 *
 * Boot sequence:
 *   1. Create DOM layout containers
 *   2. Initialise globe + layers
 *   3. Initialise UI components
 *   4. Spawn GMPE Web Worker
 *   5. Wire store subscriptions (data flow)
 *   6. Start real-time polling
 */

import './style.css';

// Store
import { store } from './store/appState';

// Types
import type {
  EarthquakeEvent,
  HistoricalPreset,
  IntensityGrid,
  TimelineState,
  GmpeWorkerRequest,
  GmpeWorkerResponse,
} from './types';

// Engine
import { updateWaveState, isWaveActive } from './engine/wavePropagation';
import { HISTORICAL_PRESETS } from './engine/presets';
import { runNankaiScenario } from './engine/nankai';

// Data
import { startRealtimePolling, type RealtimePollerHandle } from './data/usgsRealtime';

// Globe (CesiumJS)
import * as Cesium from 'cesium';
import { createGlobe, getPointOfView } from './globe/globeInstance';
import type { GlobeInstance } from './globe/globeInstance';
import { initCamera, flyToEarthquake, executeCameraPath, NANKAI_CAMERA_PATH, TOHOKU_CAMERA_PATH } from './globe/camera';
import { getEventFromPoint } from './globe/layers/seismicPoints';
import { initSeismicPoints, updateSeismicPoints } from './globe/layers/seismicPoints';
import { initWaveRings, spawnWaveRings, clearWaveRings } from './globe/layers/waveRings';
import { initIsoseismal, updateIsoseismal, clearIsoseismal } from './globe/layers/isoseismal';
import { initTectonicPlates } from './globe/layers/tectonicPlates';
import { initLabels, disposeLabels } from './globe/layers/labels';

// Utils
import { generateContourFeatures } from './utils/contourProjection';

// Globe layers (new)
import { initLayerToggle, disposeLayerToggle } from './globe/layers/layerToggle';
import { disposeGlobe } from './globe/globeInstance';

// ShakeMap
import { fetchShakeMap } from './data/shakeMapApi';
import { initShakeMapOverlay, updateShakeMapOverlay, clearShakeMapOverlay } from './globe/features/shakeMapOverlay';

// Slab2 + ViewPreset
import { initSlab2Contours } from './globe/features/slab2Contours';
import { initPlateauBuildings, disposePlateau } from './globe/features/plateauBuildings';
import { setHistoricalCatalog, setCatalogActive, disposeSeismicPoints } from './globe/layers/seismicPoints';
import { loadHistoricalCatalog } from './data/historicalCatalog';
import { applyViewPreset } from './store/viewPresets';
import type { ViewPreset } from './types';

// Cross-section
import { initCrossSection, showCrossSection, hideCrossSection, disposeCrossSection } from './ui/crossSection';
import { enableCrossSectionDrawing, disableCrossSectionDrawing, isDrawingActive } from './globe/features/crossSectionLine';

// Cinematic
import { playCinematicSequence, buildSnsSequence, skipCinematic } from './globe/cinematicSequence';

// UI
import { initSidebar, updateSidebar } from './ui/sidebar';
import { initTimeline, updateTimeline, disposeTimeline } from './ui/timeline';
import { initIntensityLegend } from './ui/intensityLegend';
import { initScenarioPicker, showPicker, disposeScenarioPicker } from './ui/scenarioPicker';
import { showTooltip, hideTooltip } from './ui/tooltip';
import { initAlertBar, showAlert, hideAlert } from './ui/alertBar';
import { initHudOverlay, updateHud } from './ui/hudOverlay';
import { initLayerToggles, disposeLayerToggles } from './ui/layerToggles';
import { initModeSwitcher } from './ui/modeSwitcher';
import { initLocaleSwitcher, disposeLocaleSwitcher } from './ui/localeSwitcher';

// Data (new)
import { loadTimelineData } from './data/timelineLoader';
import { t, onLocaleChange } from './i18n/index';

// ============================================================
// DOM Setup
// ============================================================

interface LayoutContainers {
  globeContainer: HTMLElement;
  globeArea: HTMLElement;
  sidebarContainer: HTMLElement;
  timelineContainer: HTMLElement;
  legendContainer: HTMLElement;
}

function createLayout(): LayoutContainers {
  const app = document.getElementById('app')!;
  app.className = 'dashboard scanlines';
  app.innerHTML = '';

  // Globe area (wraps globe-container for relative positioning of HUD/legend)
  const globeArea = document.createElement('div');
  globeArea.className = 'globe-area';
  const globeContainer = document.createElement('div');
  globeContainer.id = 'globe-container';
  globeArea.appendChild(globeContainer);
  app.appendChild(globeArea);

  // Sidebar
  const sidebarContainer = document.createElement('div');
  sidebarContainer.id = 'sidebar-container';
  app.appendChild(sidebarContainer);

  // Timeline
  const timelineContainer = document.createElement('div');
  timelineContainer.id = 'timeline-container';
  timelineContainer.style.gridArea = 'timeline';
  app.appendChild(timelineContainer);

  // Legend (positioned inside globe area for correct CSS placement)
  const legendContainer = document.createElement('div');
  legendContainer.id = 'legend-container';
  globeArea.appendChild(legendContainer);

  // Top bar (branding + live status)
  const topBar = document.createElement('div');
  topBar.className = 'top-bar';
  topBar.innerHTML = `
    <div class="top-bar__left">
      <div class="top-bar__brand">
        <div class="top-bar__dot"></div>
        <span class="top-bar__name">Seismic Japan</span>
        <span class="top-bar__tag mono">4D</span>
      </div>
      <div class="top-bar__divider"></div>
      <span class="top-bar__date mono">${new Date().toISOString().split('T')[0]}</span>
    </div>
    <div class="top-bar__right">
      <div class="top-bar__live-dot"></div>
      <span class="mono" style="font-size:var(--text-2xs);color:var(--text-disabled)">USGS LIVE</span>
    </div>
  `;
  globeArea.appendChild(topBar);

  // Scenario trigger button (globe HUD)
  const scenarioBtn = document.createElement('button');
  scenarioBtn.className = 'playback-btn';
  scenarioBtn.style.cssText =
    'position:absolute;top:44px;left:12px;z-index:var(--z-hud);width:auto;padding:4px 12px;font-family:var(--font-mono);font-size:var(--text-sm);';
  scenarioBtn.textContent = t('sidebar.scenarios');
  scenarioBtn.addEventListener('click', () => showPicker());
  globeArea.appendChild(scenarioBtn);

  // Update scenario button text on locale change
  onLocaleChange(() => {
    scenarioBtn.textContent = t('sidebar.scenarios');
  });

  return { globeContainer, globeArea, sidebarContainer, timelineContainer, legendContainer };
}

// ============================================================
// GMPE Worker
// ============================================================

function createGmpeWorker(): Worker {
  return new Worker(
    new URL('./engine/gmpe.worker.ts', import.meta.url),
    { type: 'module' },
  );
}

function requestGridComputation(worker: Worker, event: EarthquakeEvent): void {
  const request: GmpeWorkerRequest = {
    type: 'COMPUTE_GRID',
    epicenter: { lat: event.lat, lng: event.lng },
    Mw: event.magnitude,
    depth_km: event.depth_km,
    faultType: event.faultType,
    gridSpacingDeg: 0.1,
    radiusDeg: 5,
  };
  worker.postMessage(request);
}

// ============================================================
// Wave Animation
// ============================================================

let waveAnimationId: number | null = null;
let globeRef: GlobeInstance | null = null;

function startWaveAnimation(
  event: EarthquakeEvent,
  _globe: GlobeInstance,
): void {
  stopWaveAnimation();

  const originTime = event.time;

  function animate(): void {
    const waveState = updateWaveState(
      { lat: event.lat, lng: event.lng },
      event.depth_km,
      originTime,
      Date.now(),
    );

    store.set('waveState', waveState);

    const { pActive, sActive } = isWaveActive(waveState, 40);
    if (pActive || sActive) {
      waveAnimationId = requestAnimationFrame(animate);
    } else {
      waveAnimationId = null;
    }
  }

  animate();
}

function stopWaveAnimation(): void {
  if (waveAnimationId !== null) {
    cancelAnimationFrame(waveAnimationId);
    waveAnimationId = null;
  }
}

// ============================================================
// Subscription Wiring
// ============================================================

/** Reference to the poller handle — set during bootstrap. */
let pollerHandle: RealtimePollerHandle | null = null;

function wireSubscriptions(globe: GlobeInstance, worker: Worker): void {
  // --- mode changes → clean up state for realtime return ---
  store.subscribe('mode', (mode) => {
    if (mode === 'realtime') {
      // Reset seen IDs so next poll re-delivers events from the feed
      pollerHandle?.resetSeen();

      // Clear stale timeline data (scenario/historical events) to prevent contamination
      const now = Date.now();
      store.set('timeline', {
        events: [],
        currentIndex: -1,
        currentTime: now,
        isPlaying: false,
        speed: 1,
        timeRange: [now - 86_400_000, now],
      });

      // Clear visuals from previous mode
      store.set('selectedEvent', null);
      store.set('intensityGrid', null);
      store.set('waveState', null);
    }
  });
  // --- selectedEvent → ShakeMap (preferred) or GMPE (fallback) + camera + waves ---
  store.subscribe('selectedEvent', async (event: EarthquakeEvent | null) => {
    if (!event) {
      // Clear visuals when deselected
      clearIsoseismal(globe);
      clearShakeMapOverlay();
      clearWaveRings(globe);
      stopWaveAnimation();
      store.set('intensityGrid', null);
      store.set('intensitySource', 'none');
      store.set('waveState', null);
      return;
    }

    store.set('intensitySource', 'none');

    // Fly camera to epicentre
    flyToEarthquake(globe, event);

    // Spawn visual wave rings on globe
    spawnWaveRings(globe, event);

    // Start physics-based wave animation (updates store.waveState)
    startWaveAnimation(event, globe);

    // Update sidebar detail panel
    const timeline = store.get('timeline');
    updateSidebar(timeline.events, event, store.get('intensitySource'));

    // M7+ alert bar
    if (event.magnitude >= 7.0) {
      showAlert(event);
    } else {
      hideAlert();
    }

    // Intensity visualization: ShakeMap (real events) vs GMPE (scenarios)
    const isScenario = event.id === 'nankai-scenario' || event.id.startsWith('preset-');
    if (!isScenario && event.magnitude >= 5.0) {
      // Resolve USGS event ID: presets use a friendly id, real events use USGS id directly
      const preset = HISTORICAL_PRESETS.find(p => p.id === event.id);
      const usgsEventId = preset?.usgsId ?? event.id;
      // Try USGS ShakeMap first — much more accurate for real events
      const shakeMap = await fetchShakeMap(usgsEventId);
      if (shakeMap?.mmiContours) {
        clearIsoseismal(globe);
        updateShakeMapOverlay(globe, shakeMap);
        store.set('intensitySource', 'shakemap');
        updateSidebar(store.get('timeline').events, event, 'shakemap');
        console.log(`[main] ShakeMap loaded for ${event.id}`);
        return;
      }
    }

    // Fallback: compute GMPE grid locally
    clearShakeMapOverlay();
    store.set('intensitySource', 'gmpe');
    updateSidebar(store.get('timeline').events, event, 'gmpe');
    if (event.id !== 'nankai-scenario') {
      requestGridComputation(worker, event);
    }
  });

  // --- intensityGrid → contours → isoseismal layer ---
  store.subscribe('intensityGrid', (grid: IntensityGrid | null) => {
    if (!grid) {
      clearIsoseismal(globe);
      return;
    }

    const features = generateContourFeatures(grid);
    updateIsoseismal(globe, features);
  });

  // --- viewPreset → apply visual configuration ---
  store.subscribe('viewPreset', (preset: ViewPreset) => {
    applyViewPreset(globe, preset);
    // Toggle catalog mode for underground view
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
          // Return to default preset after cinematic ends
          store.set('viewPreset', 'default');
        });
      } else {
        console.warn('[cinematic] No M5+ event selected for cinematic');
        store.set('viewPreset', 'default');
      }
    }

    // Toggle cross-section drawing mode
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

  // --- timeline → sidebar + seismic points ---
  // Events are filtered to show only those up to currentTime (cumulative view).
  store.subscribe('timeline', (timeline: TimelineState) => {
    // Update timeline UI (always shows full range)
    updateTimeline(timeline);

    // Filter events: show all events with time <= currentTime
    const visibleEvents = timeline.events.filter(
      (e) => e.time <= timeline.currentTime,
    );

    updateSidebar(visibleEvents, store.get('selectedEvent'), store.get('intensitySource'));
    updateSeismicPoints(globe, visibleEvents);
  });
}

// ============================================================
// Event Handlers
// ============================================================

function onNewRealtimeEvents(newEvents: EarthquakeEvent[]): void {
  if (store.get('mode') !== 'realtime') return;

  const timeline = store.get('timeline');
  const allEvents = [...timeline.events, ...newEvents];

  // Deduplicate by ID
  const seen = new Set<string>();
  const deduped = allEvents.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  // Sort by time ascending
  deduped.sort((a, b) => a.time - b.time);

  const now = Date.now();
  store.set('timeline', {
    ...timeline,
    events: deduped,
    currentTime: now,
    timeRange: [now - 86_400_000, now],
  });

  // Auto-select the strongest new event if nothing is selected
  if (!store.get('selectedEvent') && newEvents.length > 0) {
    const strongest = newEvents.reduce((a, b) =>
      a.magnitude > b.magnitude ? a : b,
    );
    if (strongest.magnitude >= 4.0) {
      store.set('selectedEvent', strongest);
    }
  }
}

function onScenarioSelect(preset: HistoricalPreset): void {
  // Switch mode
  store.set('mode', 'scenario');

  // Clear existing state
  store.set('selectedEvent', null);
  store.set('intensityGrid', null);
  store.set('waveState', null);

  // Create a synthetic EarthquakeEvent from the preset
  const event: EarthquakeEvent = {
    id: preset.id,
    lat: preset.epicenter.lat,
    lng: preset.epicenter.lng,
    depth_km: preset.depth_km,
    magnitude: preset.Mw,
    time: preset.startTime ? new Date(preset.startTime).getTime() : Date.now(),
    faultType: preset.faultType,
    tsunami: preset.id === 'tohoku-2011', // Tohoku had tsunami
    place: preset.name,
  };

  // If Nankai scenario, use the special multi-worker runner
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

  // Execute scenario-specific camera path
  if (globeRef) {
    if (preset.id === 'nankai-scenario') {
      executeCameraPath(globeRef, NANKAI_CAMERA_PATH);
    } else if (preset.id === 'tohoku-2011') {
      executeCameraPath(globeRef, TOHOKU_CAMERA_PATH);
    }
  }

  // Update timeline with the single scenario event
  const eventTime = event.time;
  store.set('timeline', {
    events: [event],
    currentIndex: 0,
    currentTime: eventTime,
    isPlaying: false,
    speed: 1,
    timeRange: [eventTime - 60_000, eventTime + 600_000],
  });

  // Select the event (triggers GMPE worker, camera fly, wave rings)
  store.set('selectedEvent', event);
}

// ============================================================
// Timeline Playback Callbacks
// ============================================================

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
      store.set('timeline', {
        ...tl,
        currentIndex: newIdx,
        currentTime: event.time,
      });
      store.set('selectedEvent', event);
    },
    onNext: () => {
      const tl = store.get('timeline');
      if (tl.events.length === 0) return;
      const newIdx = Math.min(tl.events.length - 1, tl.currentIndex + 1);
      const event = tl.events[newIdx];
      store.set('timeline', {
        ...tl,
        currentIndex: newIdx,
        currentTime: event.time,
      });
      store.set('selectedEvent', event);
    },
  };
}

// ============================================================
// Globe Click Handler
// ============================================================

function setupGlobeClickHandler(globe: GlobeInstance): void {
  const handler = new Cesium.ScreenSpaceEventHandler(globe.scene.canvas);

  handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
    const picked = globe.scene.pick(click.position);
    if (Cesium.defined(picked) && picked.primitive instanceof Cesium.PointPrimitive) {
      const eq = getEventFromPoint(picked.primitive);
      if (eq) {
        store.set('selectedEvent', eq);
        showTooltip(eq, click.position.x, click.position.y);
        return;
      }
    }
    // Click on empty space — deselect
    hideTooltip();
    if (store.get('mode') !== 'scenario') {
      store.set('selectedEvent', null);
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

// ============================================================
// Bootstrap
// ============================================================

async function bootstrap(): Promise<void> {
  // 1. Create DOM layout
  const { globeContainer, globeArea, sidebarContainer, timelineContainer, legendContainer } =
    createLayout();

  // 2. Initialise globe + layers (CesiumJS — async)
  const globe = await createGlobe(globeContainer);
  globeRef = globe;

  // Tectonic plates loaded asynchronously (non-blocking)
  initTectonicPlates(globe).catch((err) =>
    console.error('[main] Failed to load tectonic plates:', err),
  );

  initSeismicPoints(globe);
  initWaveRings(globe);
  initIsoseismal(globe);
  initShakeMapOverlay(globe);
  initCamera(globe);
  initLabels(globe);
  initLayerToggle(globe);

  // Slab2 contours (async, non-blocking — data appears when loaded)
  initSlab2Contours(globe).catch((err) =>
    console.error('[main] Failed to load Slab2 contours:', err),
  );

  // PLATEAU 3D buildings
  initPlateauBuildings(globe);

  // Historical catalog for underground view (async, non-blocking)
  loadHistoricalCatalog().then((events) => {
    if (events.length > 0) setHistoricalCatalog(events);
  });

  // 3. Initialise UI
  initSidebar(sidebarContainer);
  initTimeline(timelineContainer, createTimelineCallbacks());
  initIntensityLegend(legendContainer);
  initAlertBar(globeArea);
  initHudOverlay(globeArea);
  initLayerToggles(globeArea, globe);
  initLocaleSwitcher(globeArea);
  initCrossSection(globeArea);
  initModeSwitcher(timelineContainer, {
    onLoadTimeline: (start, end) => {
      loadTimelineData(start, end).catch((err) =>
        console.error('[main] Timeline load failed:', err),
      );
    },
  });
  initScenarioPicker(
    document.getElementById('app')!,
    onScenarioSelect,
    HISTORICAL_PRESETS,
  );

  // 4. Spawn GMPE Web Worker
  const worker = createGmpeWorker();
  worker.onmessage = (e: MessageEvent<GmpeWorkerResponse | { type: 'GRID_ERROR'; error: string }>) => {
    if (e.data.type === 'GRID_COMPLETE') {
      store.set('intensityGrid', e.data.grid);
    } else if (e.data.type === 'GRID_ERROR') {
      console.error('[main] GMPE computation failed:', e.data.error);
    }
  };
  worker.onerror = (err) => {
    console.error('[main] GMPE worker error:', err);
  };

  // 5. Wire store subscriptions
  wireSubscriptions(globe, worker);

  // 6. Set up globe click handlers
  setupGlobeClickHandler(globe);

  // 7. HUD update loop — sync camera state to HUD overlay
  function hudLoop(): void {
    try {
      const pov = getPointOfView(globe);
      updateHud({
        lat: pov.lat,
        lng: pov.lng,
        altitude: pov.altitude,
        simTime: store.get('timeline').currentTime,
      });
    } catch { /* globe may not be ready */ }
    requestAnimationFrame(hudLoop);
  }
  requestAnimationFrame(hudLoop);

  // 8. Push initial timeline state to UI
  updateTimeline(store.get('timeline'));

  // 9. Start real-time polling (immediate first fetch + 60s interval)
  pollerHandle = startRealtimePolling(onNewRealtimeEvents);

  // Expose cleanup for HMR / teardown
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      pollerHandle?.stop();
      stopWaveAnimation();
      disposeTimeline();
      disposeScenarioPicker();
      disposeLayerToggle();
      disposeLayerToggles();
      disposeLocaleSwitcher();
      disposeSeismicPoints();
      disposeLabels();
      skipCinematic();
      disableCrossSectionDrawing(globe);
      disposeCrossSection();
      disposePlateau();
      disposeGlobe(globe);
      worker.terminate();
    });
  }
}

// ============================================================
// Entry Point
// ============================================================

// Unregister any stale Service Workers on startup.
// Register tile-cache Service Worker for browser-level caching (Layer 2).
// Now safe: tiles go through Vite dev proxy (same-origin) or CF Workers proxy.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/tile-cache-sw.js').catch((err) => {
    console.warn('[sw] Registration failed:', err);
  });
}

bootstrap().catch((err) => {
  console.error('[NeverAgain] Bootstrap failed:', err);
});
