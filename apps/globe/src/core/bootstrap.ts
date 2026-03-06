/**
 * Console Bootstrap — Wires map engine, viewport, layers, and panels.
 *
 * Boot sequence:
 *   1. Shell + loading progress
 *   2. Map engine (MapLibre + deck.gl)
 *   3. Viewport manager
 *   4. Layer compositor
 *   5. Panels (snapshot, feed, exposure, check-these-now)
 *   6. Picking (earthquake dots, fault lines, empty space)
 *   7. Keyboard (Tab=panels, Escape=deselect)
 *   8. Data fetch + ops compute + poll
 */

import 'maplibre-gl/dist/maplibre-gl.css';
import './console.css';

import { createMapEngine } from './mapEngine';
import { createViewportManager } from './viewportManager';
import { createShell } from './shell';
import { parseDeepLink } from './deepLink';
import {
  applyConsoleRealtimeError,
  deriveConsoleOperationalState,
  refreshConsoleBundleTruth,
} from './consoleOps';
import { consoleStore, toggleScenarioMode } from './store';
import { buildSystemBarState } from './systemBar';
import { createEmptyServiceReadModel } from '../ops/serviceReadModel';
import { OPS_ASSETS } from '../ops/assetCatalog';
import { createLayerCompositor } from '../layers/layerCompositor';
import { mountEventSnapshot } from '../panels/eventSnapshot';
import { mountRecentFeed } from '../panels/recentFeed';
import { mountCheckTheseNow } from '../panels/checkTheseNow';
import { mountAssetExposure } from '../panels/assetExposure';
import { mountFaultCatalog } from '../panels/faultCatalog';
import { mountImpactIntelligence } from '../panels/impactIntelligence';
import { mountLayerControl } from '../panels/layerControl';
import { mountMaritimeExposure } from '../panels/maritimeExposure';
import { earthquakeStore } from '../data/earthquakeStore';
import { fetchEventsWithMeta } from '../namazue/serviceEngine';
import { createAisManager } from '../data/aisManager';
import { createRailStatusManager } from '../data/railStatusManager';
import { formatVesselTooltip } from '../layers/aisLayer';
import { formatFaultTooltip } from '../layers/faultLayer';
import { createCommandPalette } from '../panels/commandPalette';
import { createKeyboardHelp } from '../panels/keyboardHelp';
import { createNotificationQueue } from '../panels/notificationQueue';
import { mountTimelineRail } from '../panels/timelineRail';
import { mountDataTicker } from '../panels/dataTicker';
import { mountIntensityLegend } from '../panels/intensityLegend';
import { createSettingsPanel } from '../panels/settingsPanel';
import { loadPreferences, type ConsolePreferences } from './preferences';
import { buildClientRefreshPlan } from '../governor/clientGovernor';
import { formatHospitalTooltip, type Hospital } from '../layers/hospitalLayer';
import { formatRailTooltip, type RailRoute } from '../layers/railLayer';
import { formatPowerTooltip, type PowerPlant } from '../layers/powerLayer';
import type { Vessel } from '../data/aisManager';
import type { RealtimeSource } from '../ops/readModelTypes';
import type { ActiveFault, EarthquakeEvent, FaultType } from '../types';

// ── Loading Progress ────────────────────────────────────────

function setLoadingProgress(pct: number, label: string): void {
  const bar = document.getElementById('loading-bar');
  const status = document.getElementById('loading-status');
  if (bar) bar.style.width = `${pct}%`;
  if (status) status.textContent = label;
}

function dismissLoading(): void {
  const el = document.getElementById('loading-screen');
  if (el) {
    el.classList.add('exit');
    setTimeout(() => el.remove(), 700);
  }
}

// ── Fault → Scenario Event ──────────────────────────────────

function faultToEvent(fault: ActiveFault): EarthquakeEvent {
  let latSum = 0;
  let lngSum = 0;
  for (const [lng, lat] of fault.segments) {
    latSum += lat;
    lngSum += lng;
  }
  const n = fault.segments.length;
  return {
    id: `scenario-${fault.id}`,
    lat: latSum / n,
    lng: lngSum / n,
    depth_km: fault.depthKm,
    magnitude: fault.estimatedMw,
    time: Date.now(),
    faultType: fault.faultType as FaultType,
    tsunami: fault.faultType === 'interface' && fault.estimatedMw >= 8.0,
    place: { text: `${fault.name} (${fault.nameEn})` },
  };
}

// ── Static Data Loaders ─────────────────────────────────────

async function loadFaultData(): Promise<void> {
  try {
    const res = await fetch('/data/active-faults.json');
    if (!res.ok) return;
    const faults: ActiveFault[] = await res.json();
    consoleStore.set('faults', faults);
  } catch {
    // Non-critical
  }
}

// ── Main Bootstrap ──────────────────────────────────────────

export async function bootstrapConsole(root: HTMLElement): Promise<void> {
  setLoadingProgress(10, 'Building console…');
  let lastFetchSource: RealtimeSource = 'server';
  let lastUpdatedAt = 0;
  let refreshPlan = buildClientRefreshPlan(null);
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let pollingActive = false;

  // 0. Parse deep link BEFORE MapLibre init (hash:true overwrites the URL hash)
  const deepLink = parseDeepLink();

  // 1. Shell
  const shell = createShell(root);

  // 2. Map engine
  setLoadingProgress(20, 'Initializing map…');
  const engine = createMapEngine(shell.mapContainer);

  // 3. Viewport
  const viewport = createViewportManager(engine.map);
  viewport.subscribe((state) => {
    consoleStore.set('viewport', state);
    // NOTE: Do NOT call syncOperationalTruth() here.
    // The intensity grid, exposures, and priorities depend on selectedEvent,
    // not on viewport. Recomputing GMPE on every pan/zoom was a perf bug.
    // Layer compositor handles viewport-dependent layers via dirty flags.
    updateSystemBar(consoleStore.get('mode'), consoleStore.get('events').length);
  });

  // 4. Compositor
  const compositor = createLayerCompositor(engine);

  // 5. Panels — each gets its own wrapper so innerHTML won't clobber siblings
  setLoadingProgress(30, 'Mounting panels…');
  const snapContainer = document.createElement('div');
  shell.leftRail.appendChild(snapContainer);
  const disposeSnapshot = mountEventSnapshot(snapContainer, () => deselectEvent());

  const feedContainer = document.createElement('div');
  shell.leftRail.appendChild(feedContainer);
  const disposeFeed = mountRecentFeed(feedContainer, (event) => {
    selectEvent(event);
  });

  const expoContainer = document.createElement('div');
  shell.leftRail.appendChild(expoContainer);
  const disposeExpo = mountAssetExposure(expoContainer);

  const maritimeContainer = document.createElement('div');
  shell.leftRail.appendChild(maritimeContainer);
  const disposeMaritime = mountMaritimeExposure(maritimeContainer);

  const disposeCheck = mountCheckTheseNow(shell.rightRail);

  const intelContainer = document.createElement('div');
  shell.rightRail.appendChild(intelContainer);
  const disposeIntel = mountImpactIntelligence(intelContainer);

  const disposeLayerControl = mountLayerControl(shell.bottomBar, shell.bottomDrawerHost);
  const disposeTicker = mountDataTicker(shell.tickerEl);
  const timeline = mountTimelineRail(shell.timelineHost, (event) => selectEvent(event));

  // Intensity legend — positioned absolutely on the console root
  const legendContainer = document.createElement('div');
  shell.root.appendChild(legendContainer);
  const disposeLegend = mountIntensityLegend(legendContainer);

  const faultContainer = document.createElement('div');
  shell.rightRail.appendChild(faultContainer);
  const disposeFaultCatalog = mountFaultCatalog(faultContainer, (fault) => {
    const scenario = faultToEvent(fault);
    selectEvent(scenario);
  });

  // Preferences (loaded early so notification queue + timeline can use them)
  let prefs = loadPreferences();
  consoleStore.set('showCoordinates', prefs.display.showCoordinates);

  // 5b. Command Palette (Cmd+K)
  const palette = createCommandPalette(
    (lat, lng, zoom) => {
      engine.map.flyTo({ center: [lng, lat], zoom, duration: 1500 });
    },
    (event) => selectEvent(event),
  );

  // 5c. Notification Queue
  const notifications = createNotificationQueue(
    (event) => selectEvent(event),
    { enabled: prefs.notifications.enabled, minMagnitude: prefs.notifications.minMagnitude },
  );

  // 6a. Tooltip — hover details for all pickable layers
  engine.setTooltip((info) => {
    if (info.layer?.id === 'ais-vessels' && info.object) {
      const vessel = info.object as Vessel;
      const selected = consoleStore.get('selectedEvent');
      return { html: formatVesselTooltip(vessel, selected) };
    }
    if (info.layer?.id === 'hospitals' && info.object) {
      const hospital = info.object as Hospital;
      const selected = consoleStore.get('selectedEvent');
      return { html: formatHospitalTooltip(hospital, selected) };
    }
    if (info.layer?.id === 'rail' && info.object) {
      const route = info.object as RailRoute;
      const selected = consoleStore.get('selectedEvent');
      return { html: formatRailTooltip(route, selected, consoleStore.get('railStatuses')) };
    }
    if (info.layer?.id === 'power' && info.object) {
      const plant = info.object as PowerPlant;
      const selected = consoleStore.get('selectedEvent');
      return { html: formatPowerTooltip(plant, selected) };
    }
    if (info.layer?.id === 'active-faults' && info.object) {
      const fault = info.object as ActiveFault;
      const scenario = consoleStore.get('scenarioMode');
      const hint = scenario
        ? '<div style="color:#fbbf24;font-size:10px;margin-top:4px">Click to run scenario</div>'
        : '';
      return { html: formatFaultTooltip(fault) + hint };
    }
    return null;
  });

  // 6. Picking — earthquakes, faults (scenario mode only), empty space
  engine.onClick((info) => {
    if (info.layer?.id === 'earthquakes' && info.object) {
      selectEvent(info.object as EarthquakeEvent);
    } else if (info.layer?.id === 'active-faults' && info.object && consoleStore.get('scenarioMode')) {
      const fault = info.object as ActiveFault;
      const scenario = faultToEvent(fault);
      selectEvent(scenario);
    } else if (info.layer?.id === 'asset-markers' && info.object) {
      // Future: asset focus
    } else if (!info.object) {
      deselectEvent();
    }
  });

  function syncOperationalTruth(selectedOverride?: EarthquakeEvent | null): void {
    const baseEvents = consoleStore.get('events');
    const events = selectedOverride && !baseEvents.some((entry) => entry.id === selectedOverride.id)
      ? [selectedOverride, ...baseEvents]
      : baseEvents;

    const result = deriveConsoleOperationalState({
      now: Date.now(),
      events,
      currentSelectedEventId: selectedOverride?.id ?? consoleStore.get('selectedEvent')?.id ?? null,
      forceSelection: selectedOverride !== undefined,
      source: lastFetchSource,
      updatedAt: lastUpdatedAt || Date.now(),
      viewport: consoleStore.get('viewport'),
      faults: consoleStore.get('faults'),
    });

    // Batch: all 7 updates fire subscribers only once per key, after batch completes.
    // Without batch: 7 sequential .set() → 15+ cascading subscriber callbacks.
    consoleStore.batch(() => {
      consoleStore.set('mode', result.mode);
      consoleStore.set('selectedEvent', result.selectedEvent);
      consoleStore.set('intensityGrid', result.intensityGrid);
      consoleStore.set('exposures', result.exposures);
      consoleStore.set('priorities', result.priorities);
      consoleStore.set('readModel', result.readModel);
      consoleStore.set('realtimeStatus', result.realtimeStatus);
    });
  }

  function selectEvent(event: EarthquakeEvent): void {
    // NOTE: Don't set selectedEvent here — syncOperationalTruth already sets it
    // inside a batch. Pre-setting would fire subscribers twice for selectedEvent.
    syncOperationalTruth(event);
    engine.map.flyTo({
      center: [event.lng, event.lat],
      zoom: Math.max(engine.map.getZoom(), 7),
      duration: 1500,
    });
  }

  function deselectEvent(): void {
    consoleStore.batch(() => {
      consoleStore.set('selectedEvent', null);
      consoleStore.set('intensityGrid', null);
      consoleStore.set('exposures', []);
      consoleStore.set('priorities', []);
      consoleStore.set('readModel', createEmptyServiceReadModel(consoleStore.get('realtimeStatus')));
      consoleStore.set('mode', 'calm');
    });
  }

  // 7. Keyboard shortcuts
  const kbHelp = createKeyboardHelp();

  // 7a. Settings panel
  const settings = createSettingsPanel((newPrefs: ConsolePreferences) => {
    prefs = newPrefs;
    notifications.configure({ enabled: newPrefs.notifications.enabled, minMagnitude: newPrefs.notifications.minMagnitude });
    consoleStore.set('showCoordinates', newPrefs.display.showCoordinates);
  });
  shell.settingsBtn.addEventListener('click', () => settings.toggle());

  // 7b. Apply initial preferences
  timeline.setRange(prefs.timeline.defaultRange);

  const BUNDLE_KEYS: Record<string, 'seismic' | 'maritime' | 'lifelines' | 'medical' | 'built-environment'> = {
    '1': 'seismic',
    '2': 'maritime',
    '3': 'lifelines',
    '4': 'medical',
    '5': 'built-environment',
  };

  function selectNextEvent(): void {
    const events = consoleStore.get('events');
    if (events.length === 0) return;
    const sorted = [...events].sort((a, b) => b.time - a.time);
    const selectedId = consoleStore.get('selectedEvent')?.id ?? null;
    if (!selectedId) {
      selectEvent(sorted[0]);
      return;
    }
    const idx = sorted.findIndex((e) => e.id === selectedId);
    if (idx < sorted.length - 1) selectEvent(sorted[idx + 1]);
  }

  function selectPrevEvent(): void {
    const events = consoleStore.get('events');
    if (events.length === 0) return;
    const sorted = [...events].sort((a, b) => b.time - a.time);
    const selectedId = consoleStore.get('selectedEvent')?.id ?? null;
    if (!selectedId) {
      selectEvent(sorted[0]);
      return;
    }
    const idx = sorted.findIndex((e) => e.id === selectedId);
    if (idx > 0) selectEvent(sorted[idx - 1]);
  }

  function handleKeydown(e: KeyboardEvent): void {
    // Don't capture when typing in an input
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // Check if keyboard shortcuts are disabled
    if (!prefs.keyboard.enabled && e.key !== 'Escape') return;

    if (e.key === 'Escape') {
      if (palette.isOpen()) return; // palette handles its own Escape
      if (settings.isOpen()) { settings.close(); return; }
      if (kbHelp.isOpen()) { kbHelp.close(); return; }
      deselectEvent();
      return;
    }

    // Skip modified keys for shortcuts below (Cmd+K handled by palette)
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === '?') {
      e.preventDefault();
      kbHelp.toggle();
      return;
    }

    if (e.key === ',') {
      e.preventDefault();
      settings.toggle();
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      const visible = !consoleStore.get('panelsVisible');
      consoleStore.set('panelsVisible', visible);
      shell.root.toggleAttribute('data-panels-hidden', !visible);
      return;
    }

    if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      toggleScenarioMode();
      return;
    }

    if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      consoleStore.set('bundleDrawerOpen', !consoleStore.get('bundleDrawerOpen'));
      return;
    }

    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      const vis = consoleStore.get('layerVisibility');
      consoleStore.set('layerVisibility', { ...vis, faults: !vis.faults });
      return;
    }

    if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      timeline.cycleRange();
      return;
    }

    if (e.key === 'j' || e.key === 'J') {
      e.preventDefault();
      selectNextEvent();
      return;
    }

    if (e.key === 'k' || e.key === 'K') {
      e.preventDefault();
      selectPrevEvent();
      return;
    }

    // 1-5: bundle quick switch
    const bundleId = BUNDLE_KEYS[e.key];
    if (bundleId) {
      e.preventDefault();
      consoleStore.set('activeBundleId', bundleId);
      const bundleSettings = consoleStore.get('bundleSettings');
      consoleStore.set('bundleSettings', {
        ...bundleSettings,
        [bundleId]: { ...bundleSettings[bundleId], enabled: true },
      });
      return;
    }
  }
  document.addEventListener('keydown', handleKeydown);

  // 8. Scenario UI class — single source of truth
  //    Only apply nz-console--scenario when scenarioMode is explicitly ON.
  //    The scenarioMode store value is the sole authority; selectedEvent does NOT control it.
  function syncScenarioClass(): void {
    shell.root.classList.toggle('nz-console--scenario', consoleStore.get('scenarioMode'));
  }

  consoleStore.subscribe('scenarioMode', (on) => {
    syncScenarioClass();
    if (!on) {
      // Purge scenario events from the persistent earthquake store.
      // Without this, a stale scenario event (e.g. M8.5 Nankai) could be
      // auto-selected by selectOperationalFocusEvent on the next poll cycle.
      earthquakeStore.removeByPrefix('scenario-');
      const selected = consoleStore.get('selectedEvent');
      if (selected?.id.startsWith('scenario-')) {
        deselectEvent();
      }
    }
  });

  // 9. System bar — coalesced updates (mode, events, readModel, realtimeStatus all affect it)
  let sysBarScheduled = false;
  const scheduleSysBar = (): void => {
    if (sysBarScheduled) return;
    sysBarScheduled = true;
    requestAnimationFrame(() => {
      sysBarScheduled = false;
      updateSystemBar(consoleStore.get('mode'), consoleStore.get('events').length);
    });
  };
  consoleStore.subscribe('mode', scheduleSysBar);
  consoleStore.subscribe('events', scheduleSysBar);
  consoleStore.subscribe('readModel', scheduleSysBar);
  consoleStore.subscribe('realtimeStatus', scheduleSysBar);

  function updateSystemBar(mode: string, eventCount: number): void {
    const state = buildSystemBarState({
      mode: mode === 'event' ? 'event' : 'calm',
      eventCount,
      readModel: consoleStore.get('readModel'),
      realtimeStatus: consoleStore.get('realtimeStatus'),
    });

    shell.regionEl.textContent = state.regionLabel;
    shell.statusEl.textContent = state.statusText;
    shell.statusEl.setAttribute('data-mode', state.statusMode);
    shell.heartbeatEl.setAttribute('data-mode', state.statusMode);
  }

  // 10. Data freshness indicators
  function renderFreshness(el: HTMLElement): void {
    const f = consoleStore.get('dataFreshness');
    const now = Date.now();

    function ageLabel(ts: number): string {
      if (ts === 0) return '--';
      const sec = Math.floor((now - ts) / 1000);
      if (sec < 60) return `${sec}s`;
      return `${Math.floor(sec / 60)}m`;
    }

    function staleClass(ts: number): string {
      if (ts === 0) return 'nz-freshness__dot--offline';
      const age = now - ts;
      if (age > 120_000) return 'nz-freshness__dot--stale';
      return '';
    }

    const sources = [
      { key: 'usgs', label: 'USGS', ts: f.usgs },
      { key: 'ais', label: 'AIS', ts: f.ais },
      { key: 'odpt', label: 'ODPT', ts: f.odpt },
    ];

    el.innerHTML = `<div class="nz-freshness">${sources.map(s => `
      <span class="nz-freshness__src">
        <span class="nz-freshness__dot ${staleClass(s.ts)}"></span>
        <span class="nz-freshness__label">${s.label}</span>
        <span class="nz-freshness__age">${ageLabel(s.ts)}</span>
      </span>
    `).join('')}</div>`;
  }

  const unsubFreshness = consoleStore.subscribe('dataFreshness', () => renderFreshness(shell.freshnessEl));
  const freshnessTimer = setInterval(() => renderFreshness(shell.freshnessEl), 5_000);
  renderFreshness(shell.freshnessEl);

  // 11. Load fault data in parallel
  setLoadingProgress(40, 'Loading fault data…');
  loadFaultData();

  // 12. Fetch + ops helper
  async function fetchAndSync(): Promise<void> {
    const result = await fetchEventsWithMeta();
    lastFetchSource = result.source;
    lastUpdatedAt = result.updatedAt;
    refreshPlan = buildClientRefreshPlan(result.governor);
    aisManager.setRefreshMs(refreshPlan.maritime.refreshMs);
    consoleStore.set('events', result.events);
    consoleStore.set('dataFreshness', {
      ...consoleStore.get('dataFreshness'),
      usgs: Date.now(),
    });
    syncOperationalTruth();
  }

  function syncRealtimeError(error: unknown): void {
    const degraded = applyConsoleRealtimeError({
      now: Date.now(),
      source: lastFetchSource,
      updatedAt: lastUpdatedAt || Date.now(),
      message: error instanceof Error ? error.message : 'Realtime poll failed',
      readModel: consoleStore.get('readModel'),
    });
    consoleStore.batch(() => {
      consoleStore.set('realtimeStatus', degraded.realtimeStatus);
      consoleStore.set('readModel', degraded.readModel);
    });
  }

  // 13. Rail status tracking (ODPT Shinkansen feed)
  const railStatusManager = createRailStatusManager((statuses) => {
    consoleStore.set('railStatuses', statuses);
    consoleStore.set('dataFreshness', {
      ...consoleStore.get('dataFreshness'),
      odpt: Date.now(),
    });
  });

  // 13b. AIS vessel tracking
  const aisManager = createAisManager((vessels) => {
    // Batch: vessels + readModel update triggers subscribers once, not twice
    consoleStore.batch(() => {
      consoleStore.set('vessels', vessels);
      consoleStore.set('readModel', refreshConsoleBundleTruth({
        readModel: consoleStore.get('readModel'),
        realtimeStatus: consoleStore.get('realtimeStatus'),
        selectedEvent: consoleStore.get('selectedEvent'),
        exposures: consoleStore.get('exposures'),
        vessels,
        assets: OPS_ASSETS,
      }));
      consoleStore.set('dataFreshness', {
        ...consoleStore.get('dataFreshness'),
        ais: Date.now(),
      });
    });
  });
  aisManager.setRefreshMs(refreshPlan.maritime.refreshMs);

  function clearEventPoll(): void {
    if (!pollTimer) return;
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  function scheduleEventPoll(delayMs = refreshPlan.events.refreshMs): void {
    clearEventPoll();
    if (!pollingActive) return;
    pollTimer = setTimeout(async () => {
      try {
        await fetchAndSync();
      } catch (err) {
        console.error('[console] Poll failed:', err);
        syncRealtimeError(err);
      } finally {
        scheduleEventPoll(refreshPlan.events.refreshMs);
      }
    }, delayMs);
  }

  // 14. Start on map load
  engine.map.once('load', async () => {
    setLoadingProgress(60, 'Map ready, fetching events…');
    compositor.start();
    aisManager.start();
    railStatusManager.start();

    try {
      await fetchAndSync();
      setLoadingProgress(90, `${consoleStore.get('events').length} events loaded`);
    } catch (err) {
      console.error('[console] Initial fetch failed:', err);
      syncRealtimeError(err);
      setLoadingProgress(90, 'Using cached data…');
    }

    // Deep link: select event from URL (/event/{id})
    if (deepLink.eventId) {
      const match = consoleStore.get('events').find((e) => e.id === deepLink.eventId);
      if (match) selectEvent(match);
    } else if (deepLink.camera) {
      engine.map.flyTo({
        center: [deepLink.camera.lng, deepLink.camera.lat],
        zoom: deepLink.camera.zoom,
        duration: 1500,
      });
    }

    setLoadingProgress(100, 'Ready');
    updateSystemBar(consoleStore.get('mode'), consoleStore.get('events').length);
    dismissLoading();
    pollingActive = true;
    scheduleEventPoll(refreshPlan.events.refreshMs);
  });

  // 15. HMR cleanup
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      pollingActive = false;
      clearEventPoll();
      clearInterval(freshnessTimer);
      unsubFreshness();
      document.removeEventListener('keydown', handleKeydown);
      railStatusManager.stop();
      aisManager.stop();
      compositor.stop();
      disposeSnapshot();
      disposeFeed();
      disposeExpo();
      disposeMaritime();
      disposeCheck();
      disposeIntel();
      disposeLayerControl();
      disposeTicker();
      disposeLegend();
      timeline.dispose();
      disposeFaultCatalog();
      palette.dispose();
      kbHelp.dispose();
      notifications.dispose();
      settings.dispose();
      viewport.dispose();
      engine.dispose();
    });
  }
}
