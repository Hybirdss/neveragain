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
import { createViewportManager, type ViewportState } from './viewportManager';
import { createShell } from './shell';
import { deriveConsoleOperationalState } from './consoleOps';
import { consoleStore } from './store';
import { buildSystemBarState } from './systemBar';
import { createLayerCompositor } from '../layers/layerCompositor';
import { mountEventSnapshot } from '../panels/eventSnapshot';
import { mountRecentFeed } from '../panels/recentFeed';
import { mountCheckTheseNow } from '../panels/checkTheseNow';
import { mountAssetExposure } from '../panels/assetExposure';
import { fetchEventsWithMeta } from '../namazue/serviceEngine';
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
    updateBottomBar(state);
    if (consoleStore.get('events').length > 0) {
      syncOperationalTruth();
    }
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

  const disposeCheck = mountCheckTheseNow(shell.rightRail);

  // 6. Picking — earthquakes, faults, empty space
  engine.onClick((info) => {
    if (info.layer?.id === 'earthquakes' && info.object) {
      selectEvent(info.object as EarthquakeEvent);
    } else if (info.layer?.id === 'active-faults' && info.object) {
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
    consoleStore.set('readModel', {
      currentEvent: null,
      eventTruth: null,
      viewport: null,
      nationalSnapshot: null,
      nationalExposureSummary: [],
      visibleExposureSummary: [],
      nationalPriorityQueue: [],
      visiblePriorityQueue: [],
      freshnessStatus: consoleStore.get('realtimeStatus'),
    });
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

  // 9. Bottom bar — viewport info + layer toggles
  function updateBottomBar(vp: ViewportState): void {
    const vis = consoleStore.get('layerVisibility');
    shell.bottomBar.innerHTML = `
      <div class="nz-bottom-bar__info">
        <span class="nz-bottom-bar__zoom">z${vp.zoom.toFixed(1)}</span>
        <span class="nz-bottom-bar__tier">${vp.tier}</span>
        <span class="nz-bottom-bar__coords">
          ${vp.center.lat.toFixed(3)}° ${vp.center.lng.toFixed(3)}°
        </span>
      </div>
      <div class="nz-bottom-bar__layers">
        <button class="nz-layer-btn${vis.faults ? ' nz-layer-btn--on' : ''}" data-layer="faults">Faults</button>
        <button class="nz-layer-btn${vis.intensity ? ' nz-layer-btn--on' : ''}" data-layer="intensity">Intensity</button>
        <button class="nz-layer-btn${vis.earthquakes ? ' nz-layer-btn--on' : ''}" data-layer="earthquakes">Quakes</button>
      </div>
    `;
    // Bind toggle clicks
    shell.bottomBar.querySelectorAll<HTMLButtonElement>('.nz-layer-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const layer = btn.dataset.layer!;
        const current = consoleStore.get('layerVisibility');
        consoleStore.set('layerVisibility', { ...current, [layer]: !current[layer] });
        updateBottomBar(consoleStore.get('viewport'));
      });
    });
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

  // 13. Start on map load
  engine.map.once('load', async () => {
    setLoadingProgress(60, 'Map ready, fetching events…');
    compositor.start();

    try {
      await fetchAndSync();
      setLoadingProgress(90, `${consoleStore.get('events').length} events loaded`);
    } catch (err) {
      console.error('[console] Initial fetch failed:', err);
      setLoadingProgress(90, 'Using cached data…');
    }

    setLoadingProgress(100, 'Ready');
    updateSystemBar(consoleStore.get('mode'), consoleStore.get('events').length);
    updateBottomBar(viewport.getState());
    dismissLoading();
  });

  // 14. Poll
  const pollTimer = setInterval(async () => {
    try {
      await fetchAndSync();
    } catch {
      // Silent retry
    }
  }, 60_000);

  // 15. HMR cleanup
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      clearInterval(pollTimer);
      document.removeEventListener('keydown', handleKeydown);
      compositor.stop();
      disposeSnapshot();
      disposeFeed();
      disposeExpo();
      disposeCheck();
      viewport.dispose();
      engine.dispose();
    });
  }
}
