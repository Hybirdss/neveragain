/**
 * geocoder.ts — Map search via Nominatim (OpenStreetMap geocoding)
 *
 * Adds a search bar overlay on the globe that geocodes place names
 * and flies the camera to the result. Japan-biased results.
 */

import * as Cesium from 'cesium';
import { store } from '../store/appState';
import type { GlobeInstance } from './globeInstance';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
}

let searchEl: HTMLElement | null = null;
let inputEl: HTMLInputElement | null = null;
let resultsEl: HTMLElement | null = null;
let abortCtrl: AbortController | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let docKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
let docClickHandler: ((e: MouseEvent) => void) | null = null;

/**
 * Initialize the geocoder search UI overlay.
 */
export function initGeocoder(viewer: GlobeInstance, container: HTMLElement): void {
  // Wrapper
  searchEl = document.createElement('div');
  searchEl.className = 'geocoder';
  searchEl.innerHTML = `
    <div class="geocoder__bar">
      <svg class="geocoder__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
      </svg>
      <input class="geocoder__input" type="text" placeholder="場所を検索… / Search places" autocomplete="off" spellcheck="false" />
      <kbd class="geocoder__kbd">/</kbd>
    </div>
    <ul class="geocoder__results"></ul>
  `;
  container.appendChild(searchEl);

  inputEl = searchEl.querySelector('.geocoder__input') as HTMLInputElement;
  resultsEl = searchEl.querySelector('.geocoder__results') as HTMLElement;

  // Debounced search on input
  inputEl.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    const q = inputEl!.value.trim();
    if (q.length < 2) {
      clearResults();
      return;
    }
    debounceTimer = setTimeout(() => search(q, viewer), 350);
  });

  // Keyboard shortcut: "/" to focus search
  docKeydownHandler = (e: KeyboardEvent) => {
    if (e.key === '/' && document.activeElement !== inputEl) {
      e.preventDefault();
      inputEl!.focus();
      inputEl!.select();
    }
    if (e.key === 'Escape' && document.activeElement === inputEl) {
      inputEl!.blur();
      clearResults();
    }
  };
  document.addEventListener('keydown', docKeydownHandler);

  // Enter key selects first result
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = resultsEl!.querySelector('.geocoder__result') as HTMLElement | null;
      if (first) first.click();
    }
  });

  // Close results on outside click
  docClickHandler = (e: MouseEvent) => {
    if (searchEl && !searchEl.contains(e.target as Node)) {
      clearResults();
    }
  };
  document.addEventListener('click', docClickHandler);
}

/**
 * Search Nominatim for a place name.
 */
async function search(query: string, viewer: GlobeInstance): Promise<void> {
  // Cancel previous request
  if (abortCtrl) abortCtrl.abort();
  abortCtrl = new AbortController();

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '5',
      countrycodes: 'jp',   // Japan bias
      'accept-language': 'ja,en',
    });

    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        signal: abortCtrl.signal,
        headers: { 'User-Agent': 'Namazue/1.0 (namazue.dev)' },
      },
    );

    if (!resp.ok) return;
    const results: NominatimResult[] = await resp.json();

    // If no Japan results, retry without country restriction
    if (results.length === 0) {
      const globalParams = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '5',
        'accept-language': 'ja,en',
      });
      const globalResp = await fetch(
        `https://nominatim.openstreetmap.org/search?${globalParams}`,
        {
          signal: abortCtrl.signal,
          headers: { 'User-Agent': 'Namazue/1.0 (namazue.dev)' },
        },
      );
      if (!globalResp.ok) return;
      const globalResults: NominatimResult[] = await globalResp.json();
      renderResults(globalResults, viewer);
      return;
    }

    renderResults(results, viewer);
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.warn('[geocoder] Search failed:', err);
    }
  }
}

function renderResults(results: NominatimResult[], viewer: GlobeInstance): void {
  if (!resultsEl) return;
  resultsEl.innerHTML = '';

  if (results.length === 0) {
    resultsEl.innerHTML = '<li class="geocoder__empty">結果なし / No results</li>';
    resultsEl.classList.add('geocoder__results--open');
    return;
  }

  for (const r of results) {
    const li = document.createElement('li');
    li.className = 'geocoder__result';
    li.textContent = r.display_name;
    li.addEventListener('click', () => {
      flyToResult(r, viewer);
      store.set('focusLocation', {
        label: r.display_name.split(',')[0]?.trim() || r.display_name,
        lat: Number(r.lat),
        lng: Number(r.lon),
        source: 'search',
      });
      clearResults();
      if (inputEl) inputEl.value = r.display_name.split(',')[0];
      inputEl?.blur();
    });
    resultsEl.appendChild(li);
  }
  resultsEl.classList.add('geocoder__results--open');
}

function flyToResult(r: NominatimResult, viewer: GlobeInstance): void {
  const [south, north, west, east] = r.boundingbox.map(Number);
  const rect = Cesium.Rectangle.fromDegrees(west, south, east, north);

  // If bounding box is too small (single building), use point + fixed altitude
  const span = Math.max(north - south, east - west);
  if (span < 0.005) {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(Number(r.lon), Number(r.lat), 5000),
      duration: 1.5,
    });
  } else {
    viewer.camera.flyTo({
      destination: rect,
      duration: 1.5,
    });
  }
}

function clearResults(): void {
  if (resultsEl) {
    resultsEl.innerHTML = '';
    resultsEl.classList.remove('geocoder__results--open');
  }
}

/**
 * Dispose the geocoder UI.
 */
export function disposeGeocoder(): void {
  if (docKeydownHandler) {
    document.removeEventListener('keydown', docKeydownHandler);
    docKeydownHandler = null;
  }
  if (docClickHandler) {
    document.removeEventListener('click', docClickHandler);
    docClickHandler = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (abortCtrl) {
    abortCtrl.abort();
    abortCtrl = null;
  }
  if (searchEl && searchEl.parentElement) {
    searchEl.parentElement.removeChild(searchEl);
  }
  searchEl = null;
  inputEl = null;
  resultsEl = null;
}
