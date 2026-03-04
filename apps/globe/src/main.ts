/**
 * Namazue — Application Bootstrap & Module Wiring
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
import { initCamera, flyToEarthquake, executeCameraPath, disposeCamera, NANKAI_CAMERA_PATH, TOHOKU_CAMERA_PATH } from './globe/camera';
import { getEventFromPoint } from './globe/layers/seismicPoints';
import { initSeismicPoints, updateSeismicPoints, initDrillLine } from './globe/layers/seismicPoints';
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
import { fetchShakeMap, abortShakeMapFetch } from './data/shakeMapApi';
import { initShakeMapOverlay, updateShakeMapOverlay, clearShakeMapOverlay } from './globe/features/shakeMapOverlay';

// Slab2 + ViewPreset
import { initSlab2Contours } from './globe/features/slab2Contours';
import { initDepthRings, disposeDepthRings } from './globe/features/depthRings';
import { initPlateauBuildings, disposePlateau } from './globe/features/plateauBuildings';
import { initGsiLayers } from './globe/layers/gsiLayers';
import { setHistoricalCatalog, setCatalogActive, disposeSeismicPoints, highlightSearchResults } from './globe/layers/seismicPoints';
import { loadHistoricalCatalog } from './data/historicalCatalog';
import { applyViewPreset } from './store/viewPresets';
import type { ViewPreset } from './types';

// Cross-section
import { initCrossSection, showCrossSection, hideCrossSection, disposeCrossSection } from './ui/crossSection';
import { enableCrossSectionDrawing, disableCrossSectionDrawing, isDrawingActive } from './globe/features/crossSectionLine';

// Cinematic
import { playCinematicSequence, buildSnsSequence, skipCinematic } from './globe/cinematicSequence';

// UI
import { initSidebar, updateSidebar, disposeSidebar } from './ui/sidebar';
import { initTimeline, updateTimeline, disposeTimeline } from './ui/timeline';
import { initIntensityLegend, disposeIntensityLegend } from './ui/intensityLegend';
import { initScenarioPicker, showPicker, disposeScenarioPicker } from './ui/scenarioPicker';
import { showTooltip, hideTooltip } from './ui/tooltip';
import { initAlertBar, showAlert, hideAlert } from './ui/alertBar';
import { initHudOverlay, updateHud, disposeHudOverlay } from './ui/hudOverlay';
import { initLayerToggles, disposeLayerToggles } from './ui/layerToggles';
import { initModeSwitcher, disposeModeSwitcher } from './ui/modeSwitcher';
import { initLocaleSwitcher, disposeLocaleSwitcher } from './ui/localeSwitcher';
import { initDepthScale, disposeDepthScale } from './ui/depthScale';
import { initMobileShell, disposeMobileShell } from './ui/mobileShell';

// Data (new)
import { loadTimelineData } from './data/timelineLoader';
import { t, onLocaleChange } from './i18n/index';

// AI
import { initAiPanel, disposeAiPanel } from './ui/aiPanel';
import { fetchAnalysis } from './ai/client';
import { shouldFetchOnClick } from './ai/tierRouter';
import { initSearchBar, toggleSearch, disposeSearchBar } from './ui/searchBar';

// Feature 1-5: Data integration engine
import type {
  Vs30Grid,
  Vs30GridTransfer,
  ActiveFault,
  Prefecture,
  HazardGrid,
  SlopeGrid,
  LayerVisibility,
} from './types';
import { computeImpact } from './engine/impactAssessment';
import { computeHazardComparison } from './engine/hazardComparison';
import { computeLandslideGrid } from './engine/landslideRisk';
import { initActiveFaults, setActiveFaultsVisible, disposeActiveFaults, tryPickFault } from './globe/features/activeFaults';
import { updateLandslideOverlay, clearLandslideOverlay } from './globe/layers/landslideOverlay';
import { updateComparisonOverlay, clearComparisonOverlay } from './globe/layers/comparisonOverlay';
import { initImpactPanel, disposeImpactPanel } from './ui/impactPanel';

// ============================================================
// DOM Setup
// ============================================================

interface LayoutContainers {
  globeContainer: HTMLElement;
  globeArea: HTMLElement;
  sidebarContainer: HTMLElement;
  timelineContainer: HTMLElement;
  legendContainer: HTMLElement;
  disposeClock: () => void;
}

function createLayout(): LayoutContainers {
  const app = document.getElementById('app')!;
  app.className = 'dashboard';
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
        <span class="top-bar__name">鯰 Namazue</span>
        <span class="top-bar__tag mono">4D</span>
      </div>
      <div class="top-bar__divider"></div>
      <span class="top-bar__date mono" id="top-bar-date"></span>
      <span class="top-bar__clock" id="top-bar-clock"></span>
    </div>
    <div class="top-bar__right">
      <div class="top-bar__live-dot"></div>
      <span class="mono" style="font-size:var(--text-2xs);color:var(--text-disabled)">USGS LIVE</span>
    </div>
  `;
  globeArea.appendChild(topBar);

  // Live clock & Date
  const dateEl = topBar.querySelector('#top-bar-date') as HTMLElement;
  const clockEl = topBar.querySelector('#top-bar-clock') as HTMLElement;

  const dateFormatter = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeFormatter = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  function updateClock() {
    const now = new Date();
    dateEl.textContent = dateFormatter.format(now).replace(/\//g, '-');
    clockEl.textContent = `${timeFormatter.format(now)} JST`;
  }
  updateClock();
  const clockIntervalId = window.setInterval(updateClock, 1000);

  // Network error indicator
  const liveDot = topBar.querySelector('.top-bar__live-dot') as HTMLElement;
  const liveLabel = topBar.querySelector('.top-bar__right .mono') as HTMLElement;
  store.subscribe('networkError', (err) => {
    if (err) {
      liveDot.style.background = 'var(--accent-danger)';
      liveLabel.textContent = 'OFFLINE';
      liveLabel.style.color = 'var(--accent-danger)';
    } else {
      liveDot.style.background = 'var(--accent-positive)';
      liveLabel.textContent = 'USGS LIVE';
      liveLabel.style.color = 'var(--text-disabled)';
    }
  });

  // Scenario trigger button (globe HUD)
  const scenarioBtn = document.createElement('button');
  scenarioBtn.className = 'training-entry-btn';
  scenarioBtn.textContent = `${t('sidebar.training')} (${HISTORICAL_PRESETS.length})`;
  scenarioBtn.addEventListener('click', () => showPicker());
  globeArea.appendChild(scenarioBtn);

  // Update scenario button text on locale change
  onLocaleChange(() => {
    scenarioBtn.textContent = `${t('sidebar.training')} (${HISTORICAL_PRESETS.length})`;
  });

  return {
    globeContainer,
    globeArea,
    sidebarContainer,
    timelineContainer,
    legendContainer,
    disposeClock: () => window.clearInterval(clockIntervalId),
  };
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

/** Cached data grids loaded at boot time */
let vs30GridData: Vs30Grid | null = null;
let prefectureData: Prefecture[] = [];
let hazardGridData: HazardGrid | null = null;
let slopeGridData: SlopeGrid | null = null;
let activeFaultData: ActiveFault[] = [];
let gmpeRequestSequence = 0;
let activeGmpeRequestId: string | null = null;

function requestGridComputation(worker: Worker, event: EarthquakeEvent): string {
  // Sync Vs30 grid to Worker cache first (separate message type).
  if (vs30GridData) {
    const bufferCopy = vs30GridData.data.buffer.slice(0) as ArrayBuffer;
    const vs30Transfer: Vs30GridTransfer = {
      data: bufferCopy,
      cols: vs30GridData.cols,
      rows: vs30GridData.rows,
      latMin: vs30GridData.latMin,
      lngMin: vs30GridData.lngMin,
      step: vs30GridData.step,
    };

    const syncRequest: GmpeWorkerRequest = {
      type: 'SET_VS30_GRID',
      vs30Grid: vs30Transfer,
    };
    worker.postMessage(syncRequest, [vs30Transfer.data]);
  }

  const requestId = `${event.id}:${event.time}:${++gmpeRequestSequence}`;
  activeGmpeRequestId = requestId;

  const request: GmpeWorkerRequest = {
    type: 'COMPUTE_GRID',
    requestId,
    epicenter: { lat: event.lat, lng: event.lng },
    Mw: event.magnitude,
    depth_km: event.depth_km,
    faultType: event.faultType,
    gridSpacingDeg: 0.1,
    radiusDeg: 5,
  };
  worker.postMessage(request);
  return requestId;
}

// ============================================================
// Data Grid Loaders (Feature 1-5)
// ============================================================

interface GridJson {
  cols: number;
  rows: number;
  latMin: number;
  lngMin: number;
  step: number;
  data: number[];
}

async function loadGridJson(url: string): Promise<GridJson | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return await resp.json();
  } catch (err) {
    console.warn(`[main] Failed to load ${url}:`, err);
    return null;
  }
}

function jsonToFloat32Grid(json: GridJson): { data: Float32Array; cols: number; rows: number; latMin: number; lngMin: number; step: number } {
  return {
    data: new Float32Array(json.data),
    cols: json.cols,
    rows: json.rows,
    latMin: json.latMin,
    lngMin: json.lngMin,
    step: json.step,
  };
}

async function loadAllDataGrids(): Promise<void> {
  console.log('[main] Loading data grids...');

  const [vs30Json, slopeJson, prefJson, faultJson, hazardJson] = await Promise.all([
    loadGridJson('/data/vs30-grid.json'),
    loadGridJson('/data/slope-grid.json'),
    fetch('/data/prefectures.json').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('/data/active-faults.json').then(r => r.ok ? r.json() : null).catch(() => null),
    loadGridJson('/data/jshis-hazard-grid.json'),
  ]);

  if (vs30Json) {
    vs30GridData = jsonToFloat32Grid(vs30Json);
    console.log(`[main] Vs30 grid loaded: ${vs30Json.rows}x${vs30Json.cols}`);
  }

  if (slopeJson) {
    slopeGridData = jsonToFloat32Grid(slopeJson);
    console.log(`[main] Slope grid loaded: ${slopeJson.rows}x${slopeJson.cols}`);
  }

  if (prefJson && Array.isArray(prefJson)) {
    prefectureData = prefJson;
    console.log(`[main] Prefectures loaded: ${prefectureData.length}`);
  }

  if (faultJson && Array.isArray(faultJson)) {
    activeFaultData = faultJson;
    console.log(`[main] Active faults loaded: ${activeFaultData.length}`);
  }

  if (hazardJson) {
    hazardGridData = jsonToFloat32Grid(hazardJson);
    console.log(`[main] J-SHIS hazard grid loaded: ${hazardJson.rows}x${hazardJson.cols}`);
  }
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
  // --- Search results → globe highlight ---
  let prevSearchResultIds: Set<string> | null = null;
  store.subscribe('ai', (aiState) => {
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
  });

  // --- selectedEvent → immediate GMPE + ShakeMap override + camera + waves ---
  let selectedEventVersion = 0;
  store.subscribe('selectedEvent', async (event: EarthquakeEvent | null) => {
    const myVersion = ++selectedEventVersion;
    if (!event) {
      // Clear visuals when deselected
      abortShakeMapFetch();
      activeGmpeRequestId = null;
      clearIsoseismal(globe);
      clearShakeMapOverlay();
      clearWaveRings(globe);
      stopWaveAnimation();
      store.set('intensityGrid', null);
      store.set('intensitySource', 'none');
      store.set('waveState', null);
      return;
    }

    abortShakeMapFetch();
    activeGmpeRequestId = null;
    clearIsoseismal(globe);
    clearShakeMapOverlay();
    store.set('intensityGrid', null);
    store.set('intensitySource', 'none');

    // AI analysis: open panel and trigger fetch for qualifying events
    if (shouldFetchOnClick(event)) {
      fetchAnalysis(event.id);
    } else {
      // Prevent stale analysis from a previously selected event.
      store.set('ai', {
        ...store.get('ai'),
        currentAnalysis: null,
        analysisLoading: false,
        analysisError: null,
      });
    }

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

    // Intensity visualization: render GMPE immediately, then upgrade to ShakeMap when ready.
    const isScenario = event.id === 'nankai-scenario' || event.id.startsWith('preset-');
    if (event.id !== 'nankai-scenario') {
      store.set('intensitySource', 'gmpe');
      updateSidebar(store.get('timeline').events, event, 'gmpe');
      requestGridComputation(worker, event);
    }

    if (!isScenario && event.magnitude >= 5.0) {
      // Resolve USGS event ID: presets use a friendly id, real events use USGS id directly
      const preset = HISTORICAL_PRESETS.find(p => p.id === event.id);
      const usgsEventId = preset?.usgsId ?? event.id;
      // Fetch ShakeMap in parallel and replace GMPE when available.
      const shakeMap = await fetchShakeMap(usgsEventId);
      if (myVersion !== selectedEventVersion) return;
      if (!shakeMap?.mmiContours) return;

      clearIsoseismal(globe);
      updateShakeMapOverlay(globe, shakeMap);
      store.set('intensitySource', 'shakemap');
      updateSidebar(store.get('timeline').events, event, 'shakemap');
      console.log(`[main] ShakeMap loaded for ${event.id}`);
    }
  });

  // --- intensityGrid → contours → isoseismal + impact + landslide + hazard ---
  store.subscribe('intensityGrid', (grid: IntensityGrid | null) => {
    if (!grid) {
      clearIsoseismal(globe);
      store.set('impactResults', null);
      store.set('landslideGrid', null);
      store.set('comparisonGrid', null);
      clearLandslideOverlay(globe);
      clearComparisonOverlay(globe);
      return;
    }

    const features = generateContourFeatures(grid, store.get('colorblind'));
    updateIsoseismal(globe, features);

    // Feature 3: Impact assessment (prefecture-level damage)
    if (prefectureData.length > 0) {
      const impacts = computeImpact(grid, prefectureData);
      store.set('impactResults', impacts);
    }

    // Set to null initially; they will be computed on demand or if layer is already on
    store.set('landslideGrid', null);
    store.set('comparisonGrid', null);

    // Feature 5: Landslide risk (if layer enabled)
    if (store.get('layers').landslideRisk && slopeGridData) {
      const landslide = computeLandslideGrid(grid, slopeGridData);
      store.set('landslideGrid', landslide);
      updateLandslideOverlay(globe, landslide);
    } else {
      clearLandslideOverlay(globe);
    }

    // Feature 4: Hazard comparison (if layer enabled)
    if (store.get('layers').hazardComparison && hazardGridData) {
      const comparison = computeHazardComparison(grid, hazardGridData);
      store.set('comparisonGrid', comparison);
      updateComparisonOverlay(globe, comparison);
    } else {
      clearComparisonOverlay(globe);
    }
  });

  // --- layer visibility → toggle features (diff-based) ---
  store.subscribe('layers', (layers: LayerVisibility, prev: LayerVisibility) => {
    // 1. Calculate changed keys
    const changed = new Set<keyof LayerVisibility>();
    if (!prev) {
      // First run: treat all as changed
      Object.keys(layers).forEach(k => changed.add(k as keyof LayerVisibility));
    } else {
      Object.keys(layers).forEach(k => {
        const key = k as keyof LayerVisibility;
        if (layers[key] !== prev[key]) changed.add(key);
      });
    }

    if (changed.size === 0) return;

    // 2. Active faults visibility
    if (changed.has('activeFaults')) {
      setActiveFaultsVisible(layers.activeFaults);
    }

    const grid = store.get('intensityGrid');

    // 3. Landslide risk toggle
    if (changed.has('landslideRisk')) {
      if (layers.landslideRisk && grid && slopeGridData) {
        // Reuse if exists and grid is same (we'll check intensityGrid change in its own sub)
        let landslide = store.get('landslideGrid');
        if (!landslide) {
          landslide = computeLandslideGrid(grid, slopeGridData);
          store.set('landslideGrid', landslide);
        }
        updateLandslideOverlay(globe, landslide);
      } else if (!layers.landslideRisk) {
        clearLandslideOverlay(globe);
        // Note: we don't null landslideGrid here to allow reuse if toggled back ON
        // unless intensityGrid changes.
      }
    }

    // 4. Hazard comparison toggle
    if (changed.has('hazardComparison')) {
      if (layers.hazardComparison && grid && hazardGridData) {
        let comparison = store.get('comparisonGrid');
        if (!comparison) {
          comparison = computeHazardComparison(grid, hazardGridData);
          store.set('comparisonGrid', comparison);
        }
        updateComparisonOverlay(globe, comparison);
      } else if (!layers.hazardComparison) {
        clearComparisonOverlay(globe);
      }
    }
  });

  // --- colorblind → refresh visuals ---
  store.subscribe('colorblind', (isColorblind) => {
    const grid = store.get('intensityGrid');
    if (grid) {
      const features = generateContourFeatures(grid, isColorblind);
      updateIsoseismal(globe, features);
    }
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
    const selected = store.get('selectedEvent');
    const selectedStillVisible = selected
      ? visibleEvents.some((event) => event.id === selected.id)
      : false;
    if (selected && !selectedStillVisible) {
      store.set('selectedEvent', null);
      updateSidebar(visibleEvents, null, store.get('intensitySource'));
    } else {
      updateSidebar(visibleEvents, selected, store.get('intensitySource'));
    }
    updateSeismicPoints(globe, visibleEvents);
  });
}

// ============================================================
// Event Handlers
// ============================================================

function onNewRealtimeEvents(newEvents: EarthquakeEvent[]): void {
  if (store.get('mode') !== 'realtime') return;

  const timeline = store.get('timeline');
  const byId = new Map<string, EarthquakeEvent>();
  for (const event of timeline.events) {
    byId.set(event.id, event);
  }
  for (const event of newEvents) {
    // New payload must override stale records with the same ID.
    byId.set(event.id, event);
  }
  const deduped = Array.from(byId.values());

  // Sort by time ascending
  deduped.sort((a, b) => a.time - b.time);

  const selectedId = store.get('selectedEvent')?.id ?? null;
  const selectedIndex = selectedId
    ? deduped.findIndex((event) => event.id === selectedId)
    : -1;
  const currentIndex = selectedIndex >= 0
    ? selectedIndex
    : Math.max(0, deduped.length - 1);

  const now = Date.now();
  store.set('timeline', {
    ...timeline,
    events: deduped,
    currentIndex,
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
    tsunami: preset.faultType === 'interface' && preset.Mw >= 7.5, // interface quakes M7.5+ generate tsunamis
    place: { text: preset.name },
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

    // 1. Check seismic points (billboards)
    if (Cesium.defined(picked) && picked.primitive instanceof Cesium.Billboard) {
      const eq = getEventFromPoint(picked.primitive);
      if (eq) {
        store.set('selectedEvent', eq);
        showTooltip(eq, click.position.x, click.position.y);
        return;
      }
    }

    // 2. Check active fault polylines (Feature 2)
    if (tryPickFault(picked)) {
      hideTooltip();
      return;
    }

    // 3. Click on empty space — hide tooltip only (keep selection for stability)
    hideTooltip();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

// ============================================================
// Bootstrap
// ============================================================

async function bootstrap(): Promise<void> {
  // 1. Create DOM layout
  const { globeContainer, globeArea, sidebarContainer, timelineContainer, legendContainer, disposeClock } =
    createLayout();

  // 2. Initialise globe + layers (CesiumJS — async)
  const globe = await createGlobe(globeContainer);
  globeRef = globe;

  // Tectonic plates loaded asynchronously (non-blocking)
  initTectonicPlates(globe).catch((err) =>
    console.error('[main] Failed to load tectonic plates:', err),
  );

  initSeismicPoints(globe);
  initDrillLine(globe);
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

  // Depth reference rings (visual anchors for underground mode)
  initDepthRings(globe);

  // PLATEAU 3D buildings
  initPlateauBuildings(globe);

  // GSI overlay layers (Japan-only raster tiles)
  initGsiLayers(globe);

  // Historical catalog for underground view (async, non-blocking)
  loadHistoricalCatalog().then((events) => {
    if (events.length > 0) setHistoricalCatalog(events);
  });

  // Feature 1-5: Load data grids and initialize features (async, non-blocking)
  loadAllDataGrids().then(() => {
    // Feature 2: Active faults (after data is loaded)
    if (activeFaultData.length > 0) {
      initActiveFaults(globe, activeFaultData, (event, fault) => {
        // Switch to scenario mode with auto-generated event
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
        console.log(`[main] Fault scenario: ${fault.nameEn} (M${fault.estimatedMw})`);
      });
    }
    console.log('[main] Data integration engine ready');
  });

  // 3. Initialise UI
  initSidebar(sidebarContainer);
  initImpactPanel(sidebarContainer);
  initTimeline(timelineContainer, createTimelineCallbacks());
  initIntensityLegend(legendContainer);
  initAlertBar(globeArea);
  initHudOverlay(globeArea);
  initLayerToggles(globeArea, globe);
  initLocaleSwitcher(globeArea);
  initDepthScale(globeArea);
  initAiPanel();
  initSearchBar();
  initCrossSection(globeArea);
  initMobileShell(globeArea, {
    onTraining: () => showPicker(),
  });
  initModeSwitcher(timelineContainer, {
    onLoadTimeline: (start, end) => {
      loadTimelineData(start, end).catch((err) =>
        console.error('[main] Timeline load failed:', err),
      );
    },
  });
  // Training scenarios are entered via dedicated button, not primary mode nav.
  const scenarioModeBtn = timelineContainer.querySelector<HTMLElement>('.mode-btn[data-mode="scenario"]');
  if (scenarioModeBtn) {
    scenarioModeBtn.style.display = 'none';
  }
  initScenarioPicker(
    document.getElementById('app')!,
    onScenarioSelect,
    HISTORICAL_PRESETS,
  );

  // 4. Spawn GMPE Web Worker
  const worker = createGmpeWorker();
  worker.onmessage = (e: MessageEvent<GmpeWorkerResponse | { type: 'GRID_ERROR'; error: string }>) => {
    if (e.data.type === 'GRID_COMPLETE') {
      if (activeGmpeRequestId && e.data.requestId !== activeGmpeRequestId) {
        return;
      }
      if (store.get('intensitySource') !== 'gmpe') {
        return;
      }
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

  // 7. HUD update loop — sync camera state to HUD overlay (throttled to ~15fps)
  let lastHudTime = 0;
  let hudRafId = 0;
  function hudLoop(now: number): void {
    if (now - lastHudTime >= 66) {
      lastHudTime = now;
      try {
        const pov = getPointOfView(globe);
        updateHud({
          lat: pov.lat,
          lng: pov.lng,
          altitude: pov.altitude,
          simTime: store.get('timeline').currentTime,
        });
      } catch { /* globe may not be ready */ }
    }
    hudRafId = requestAnimationFrame(hudLoop);
  }
  hudRafId = requestAnimationFrame(hudLoop);

  // 8. Push initial timeline state to UI
  updateTimeline(store.get('timeline'));

  // 9. Start real-time polling (immediate first fetch + 60s interval)
  pollerHandle = startRealtimePolling(onNewRealtimeEvents);

  // 9.5. Dismiss loading screen
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.opacity = '0';
    setTimeout(() => loadingScreen.remove(), 500);
  }

  // 10. Keyboard shortcuts
  function handleKeyboard(e: KeyboardEvent): void {
    // CMD+K / Ctrl+K → search
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggleSearch();
      return;
    }

    // Don't handle shortcuts when typing in inputs
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.key.toLowerCase()) {
      case 'd':
        store.set('viewPreset', 'default');
        break;
      case 'u':
        store.set('viewPreset', 'underground');
        break;
      case 's':
        store.set('viewPreset', 'shakemap');
        break;
      case 'x':
        store.set('viewPreset', 'crossSection');
        break;
      case 'c':
        store.set('viewPreset', 'cinematic');
        break;
      case 'escape':
        store.set('viewPreset', 'default');
        break;
      case ' ':
        e.preventDefault();
        const tl = store.get('timeline');
        store.set('timeline', { ...tl, isPlaying: !tl.isPlaying });
        break;
    }
  }

  document.addEventListener('keydown', handleKeyboard);

  // Expose cleanup for HMR / teardown
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      cancelAnimationFrame(hudRafId);
      document.removeEventListener('keydown', handleKeyboard);
      pollerHandle?.stop();
      stopWaveAnimation();
      disposeTimeline();
      disposeClock();
      disposeScenarioPicker();
      disposeLayerToggle();
      disposeLayerToggles();
      disposeLocaleSwitcher();
      disposeDepthScale();
      disposeSeismicPoints();
      disposeLabels();
      skipCinematic();
      disableCrossSectionDrawing(globe);
      disposeCrossSection();
      disposePlateau();
      disposeDepthRings();
      disposeActiveFaults(globe);
      disposeImpactPanel();
      disposeAiPanel();
      disposeSearchBar();
      disposeMobileShell();
      clearLandslideOverlay(globe);
      clearComparisonOverlay(globe);
      disposeSidebar();
      disposeHudOverlay();
      disposeModeSwitcher();
      disposeIntensityLegend();
      disposeCamera();
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
  console.error('[Namazue] Bootstrap failed:', err);
});
