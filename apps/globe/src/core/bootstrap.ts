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
import { applyConsoleRealtimeError, deriveConsoleOperationalState } from './consoleOps';
import { consoleStore } from './store';
import { buildSystemBarState } from './systemBar';
import { createEmptyServiceReadModel } from '../ops/serviceReadModel';
import { createLayerCompositor } from '../layers/layerCompositor';
import { mountEventSnapshot } from '../panels/eventSnapshot';
import { mountRecentFeed } from '../panels/recentFeed';
import { mountCheckTheseNow } from '../panels/checkTheseNow';
import { mountAssetExposure } from '../panels/assetExposure';
import { mountFaultCatalog } from '../panels/faultCatalog';
import { mountLayerControl } from '../panels/layerControl';
import { mountMaritimeExposure } from '../panels/maritimeExposure';
import { fetchEventsWithMeta } from '../namazue/serviceEngine';
import { createAisManager } from '../data/aisManager';
import { formatVesselTooltip } from '../layers/aisLayer';
import { formatFaultTooltip } from '../layers/faultLayer';
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

  // 1. Shell
  const shell = createShell(root);

  // 2. Map engine
  setLoadingProgress(20, 'Initializing map…');
  const engine = createMapEngine(shell.mapContainer);

  // 3. Viewport
  const viewport = createViewportManager(engine.map);
  viewport.subscribe((state) => {
    consoleStore.set('viewport', state);
    if (consoleStore.get('events').length > 0) {
      syncOperationalTruth();
      return;
    }
    updateSystemBar(consoleStore.get('mode'), consoleStore.get('events').length);
  });

  // 4. Compositor
  const compositor = createLayerCompositor(engine);

  // 5. Panels — each gets its own wrapper so innerHTML won't clobber siblings
  setLoadingProgress(30, 'Mounting panels…');
  const snapContainer = document.createElement('div');
  shell.leftRail.appendChild(snapContainer);
  const disposeSnapshot = mountEventSnapshot(snapContainer);

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
  const disposeLayerControl = mountLayerControl(shell.bottomBar, shell.bottomDrawerHost);

  const faultContainer = document.createElement('div');
  shell.rightRail.appendChild(faultContainer);
  const disposeFaultCatalog = mountFaultCatalog(faultContainer, (fault) => {
    const scenario = faultToEvent(fault);
    selectEvent(scenario);
  });

  // 6a. Tooltip — vessel + fault hover details
  engine.setTooltip((info) => {
    if (info.layer?.id === 'ais-vessels' && info.object) {
      const vessel = info.object as Vessel;
      const selected = consoleStore.get('selectedEvent');
      return { html: formatVesselTooltip(vessel, selected) };
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
      source: lastFetchSource,
      updatedAt: lastUpdatedAt || Date.now(),
      viewport: consoleStore.get('viewport'),
    });

    consoleStore.set('mode', result.mode);
    consoleStore.set('selectedEvent', result.selectedEvent);
    consoleStore.set('intensityGrid', result.intensityGrid);
    consoleStore.set('exposures', result.exposures);
    consoleStore.set('priorities', result.priorities);
    consoleStore.set('readModel', result.readModel);
    consoleStore.set('realtimeStatus', result.realtimeStatus);
    updateSystemBar(result.mode, consoleStore.get('events').length);
  }

  function selectEvent(event: EarthquakeEvent): void {
    consoleStore.set('selectedEvent', event);
    syncOperationalTruth(event);
    engine.map.flyTo({
      center: [event.lng, event.lat],
      zoom: Math.max(engine.map.getZoom(), 7),
      duration: 1500,
    });
  }

  function deselectEvent(): void {
    consoleStore.set('selectedEvent', null);
    consoleStore.set('intensityGrid', null);
    consoleStore.set('exposures', []);
    consoleStore.set('priorities', []);
    consoleStore.set('readModel', createEmptyServiceReadModel(consoleStore.get('realtimeStatus')));
    consoleStore.set('mode', 'calm');
  }

  // 7. Keyboard shortcuts
  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      deselectEvent();
      return;
    }
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const visible = !consoleStore.get('panelsVisible');
      consoleStore.set('panelsVisible', visible);
      shell.root.toggleAttribute('data-panels-hidden', !visible);
    }
  }
  document.addEventListener('keydown', handleKeydown);

  // 8. System bar — mode + event count
  consoleStore.subscribe('mode', (mode) => {
    updateSystemBar(mode, consoleStore.get('events').length);
  });
  consoleStore.subscribe('events', (events) => {
    updateSystemBar(consoleStore.get('mode'), events.length);
  });
  consoleStore.subscribe('readModel', () => {
    updateSystemBar(consoleStore.get('mode'), consoleStore.get('events').length);
  });
  consoleStore.subscribe('realtimeStatus', () => {
    updateSystemBar(consoleStore.get('mode'), consoleStore.get('events').length);
  });

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
  }

  // 11. Load fault data in parallel
  setLoadingProgress(40, 'Loading fault data…');
  loadFaultData();

  // 12. Fetch + ops helper
  async function fetchAndSync(): Promise<void> {
    const result = await fetchEventsWithMeta();
    lastFetchSource = result.source;
    lastUpdatedAt = result.updatedAt;
    consoleStore.set('events', result.events);
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
    consoleStore.set('realtimeStatus', degraded.realtimeStatus);
    consoleStore.set('readModel', degraded.readModel);
  }

  // 13. AIS vessel tracking
  const aisManager = createAisManager((vessels) => {
    consoleStore.set('vessels', vessels);
  });

  // 14. Start on map load
  engine.map.once('load', async () => {
    setLoadingProgress(60, 'Map ready, fetching events…');
    compositor.start();
    aisManager.start();

    try {
      await fetchAndSync();
      setLoadingProgress(90, `${consoleStore.get('events').length} events loaded`);
    } catch (err) {
      console.error('[console] Initial fetch failed:', err);
      syncRealtimeError(err);
      setLoadingProgress(90, 'Using cached data…');
    }

    setLoadingProgress(100, 'Ready');
    updateSystemBar(consoleStore.get('mode'), consoleStore.get('events').length);
    dismissLoading();
  });

  // 14. Poll
  const pollTimer = setInterval(async () => {
    try {
      await fetchAndSync();
    } catch (err) {
      console.error('[console] Poll failed:', err);
      syncRealtimeError(err);
    }
  }, 60_000);

  // 15. HMR cleanup
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      clearInterval(pollTimer);
      document.removeEventListener('keydown', handleKeydown);
      aisManager.stop();
      compositor.stop();
      disposeSnapshot();
      disposeFeed();
      disposeExpo();
      disposeMaritime();
      disposeCheck();
      disposeLayerControl();
      disposeFaultCatalog();
      viewport.dispose();
      engine.dispose();
    });
  }
}
