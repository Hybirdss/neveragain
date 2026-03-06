/**
 * Console Bootstrap — Wires map engine, viewport, layers, and panels.
 *
 * This is the entry point for the new spatial console (service route).
 * Boot sequence:
 *   1. Shell DOM
 *   2. Map engine (MapLibre + deck.gl)
 *   3. Viewport manager
 *   4. Layer compositor (animation loop)
 *   5. Panels (event snapshot, recent feed)
 *   6. Data fetch + poll
 */

import 'maplibre-gl/dist/maplibre-gl.css';
import './console.css';

import { createMapEngine } from './mapEngine';
import { createViewportManager } from './viewportManager';
import { createShell } from './shell';
import { consoleStore } from './store';
import { createLayerCompositor } from '../layers/layerCompositor';
import { mountEventSnapshot } from '../panels/eventSnapshot';
import { mountRecentFeed } from '../panels/recentFeed';
import { fetchEvents } from '../namazue/serviceEngine';

export async function bootstrapConsole(root: HTMLElement): Promise<void> {
  // 1. Build DOM shell
  const shell = createShell(root);

  // 2. Init map engine
  const engine = createMapEngine(shell.mapContainer);

  // 3. Viewport manager — syncs map camera to store
  const viewport = createViewportManager(engine.map);
  viewport.subscribe((state) => {
    consoleStore.set('viewport', state);
    updateBottomBar(state);
  });

  // 4. Layer compositor — animation loop
  const compositor = createLayerCompositor(engine);

  // 5. Panels
  const disposeSnapshot = mountEventSnapshot(shell.leftRail);

  // Create a container for the feed inside left rail (appended after snapshot)
  const feedContainer = document.createElement('div');
  shell.leftRail.appendChild(feedContainer);
  const disposeFeed = mountRecentFeed(feedContainer, (event) => {
    consoleStore.set('selectedEvent', event);
    consoleStore.set('mode', 'event');
    // Fly to event
    engine.map.flyTo({
      center: [event.lng, event.lat],
      zoom: Math.max(engine.map.getZoom(), 7),
      duration: 1500,
    });
  });

  // 6. Bottom bar info
  function updateBottomBar(vp: typeof viewport extends { getState(): infer R } ? R : never): void {
    shell.bottomBar.innerHTML = `
      <div class="nz-bottom-bar__info">
        <span class="nz-bottom-bar__zoom">z${vp.zoom.toFixed(1)}</span>
        <span class="nz-bottom-bar__tier">${vp.tier}</span>
        <span class="nz-bottom-bar__coords">
          ${vp.center.lat.toFixed(3)}° ${vp.center.lng.toFixed(3)}°
        </span>
      </div>
    `;
  }

  // 7. Tab key toggles all panels
  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const visible = !consoleStore.get('panelsVisible');
      consoleStore.set('panelsVisible', visible);
      if (visible) {
        shell.root.removeAttribute('data-panels-hidden');
      } else {
        shell.root.setAttribute('data-panels-hidden', '');
      }
    }
  }
  document.addEventListener('keydown', handleKeydown);

  // 8. System bar mode sync
  consoleStore.subscribe('mode', (mode) => {
    shell.statusEl.textContent = mode === 'calm' ? 'System calm' : 'Event active';
    shell.statusEl.setAttribute('data-mode', mode);
  });

  // 9. Start everything once map loads
  engine.map.once('load', async () => {
    // Start animation loop
    compositor.start();

    // Dismiss loading screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('exit');
      setTimeout(() => loadingScreen.remove(), 700);
    }

    shell.statusEl.textContent = 'System calm';
    updateBottomBar(viewport.getState());

    // Fetch earthquake data
    try {
      const events = await fetchEvents();
      consoleStore.set('events', events);

      // Check for significant recent event
      const cutoff = Date.now() - 24 * 3600_000;
      const significant = events.find((e) => e.time >= cutoff && e.magnitude >= 4.5);
      if (significant) {
        consoleStore.set('mode', 'event');
        consoleStore.set('selectedEvent', significant);
      }
    } catch (err) {
      console.error('[console] Initial fetch failed:', err);
    }
  });

  // 10. Poll for updates
  const pollTimer = setInterval(async () => {
    try {
      const events = await fetchEvents();
      consoleStore.set('events', events);
    } catch {
      // Silent retry on next poll
    }
  }, 60_000);

  // 11. HMR cleanup
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      clearInterval(pollTimer);
      document.removeEventListener('keydown', handleKeydown);
      compositor.stop();
      disposeSnapshot();
      disposeFeed();
      viewport.dispose();
      engine.dispose();
    });
  }
}
