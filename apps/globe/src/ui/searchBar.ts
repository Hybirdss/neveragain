/**
 * Namazue — Search Bar (CMD+K Command Palette)
 *
 * Overlay search bar for natural language earthquake queries.
 * Supports ko/ja/en input, parses client-side, and fetches from API.
 */

import { store } from '../store/appState';
import { buildSearchFilter } from '../ai/search/combiner';
import { getPlaceText } from '../utils/earthquakeUtils';
import { t, onLocaleChange } from '../i18n/index';

let overlay: HTMLElement | null = null;
let input: HTMLInputElement | null = null;
let resultsList: HTMLElement | null = null;
let hintEl: HTMLElement | null = null;
let unsubAi: (() => void) | null = null;
let unsubLocale: (() => void) | null = null;
let activeSearchController: AbortController | null = null;
let activeSearchSeq = 0;

const API_URL = import.meta.env.VITE_API_URL
  ?? (import.meta.env.PROD ? 'https://api.namazue.dev' : '');

export function initSearchBar(): void {
  // Create overlay (hidden by default)
  overlay = document.createElement('div');
  overlay.className = 'search-overlay';
  overlay.style.display = 'none';
  overlay.innerHTML = `
    <div class="search-backdrop"></div>
    <div class="search-dialog">
      <div class="search-input-row">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M11 11L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input class="search-input" type="text" spellcheck="false" />
        <kbd class="search-kbd">ESC</kbd>
      </div>
      <div class="search-results"></div>
      <div class="search-footer">
        <span class="search-hint"></span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  input = overlay.querySelector('.search-input');
  resultsList = overlay.querySelector('.search-results');
  hintEl = overlay.querySelector('.search-hint');
  const backdrop = overlay.querySelector('.search-backdrop');
  const applyLocaleText = () => {
    if (input) input.placeholder = t('search.placeholder');
    if (hintEl) hintEl.textContent = t('search.hint');
  };
  applyLocaleText();

  // Close on backdrop click
  backdrop?.addEventListener('click', closeSearch);

  // Input handler
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSearch();
    } else if (e.key === 'Enter') {
      executeSearch();
    }
  });

  // Subscribe to search state
  unsubAi?.();
  unsubAi = store.subscribe('ai', (ai) => {
    if (!resultsList) return;
    if (ai.searchLoading) {
      resultsList.innerHTML = `<div class="search-loading">${t('search.loading')}</div>`;
    } else if (ai.searchResults) {
      renderResults(ai.searchResults);
    }
  });

  unsubLocale?.();
  unsubLocale = onLocaleChange(() => {
    applyLocaleText();
    const ai = store.get('ai');
    if (ai.searchLoading) {
      if (resultsList) {
        resultsList.innerHTML = `<div class="search-loading">${t('search.loading')}</div>`;
      }
      return;
    }
    if (ai.searchResults) {
      renderResults(ai.searchResults);
    }
  });
}

export function openSearch(): void {
  if (!overlay || !input) return;
  overlay.style.display = 'flex';
  input.value = '';
  if (resultsList) resultsList.innerHTML = '';
  requestAnimationFrame(() => input?.focus());
}

export function closeSearch(): void {
  if (!overlay) return;
  activeSearchController?.abort();
  activeSearchController = null;
  activeSearchSeq += 1;
  overlay.style.display = 'none';
  // Clear search highlights on globe
  const ai = store.get('ai');
  if (ai.searchResults || ai.searchLoading) {
    store.set('ai', { ...ai, searchResults: null, searchQuery: '', searchLoading: false });
  }
}

export function toggleSearch(): void {
  if (overlay?.style.display === 'none') {
    openSearch();
  } else {
    closeSearch();
  }
}

async function executeSearch(): Promise<void> {
  if (!input) return;
  const query = input.value.trim();
  if (!query) return;

  activeSearchController?.abort();
  const requestController = new AbortController();
  activeSearchController = requestController;
  const requestSeq = ++activeSearchSeq;

  const filter = buildSearchFilter(query);

  const ai = store.get('ai');
  store.set('ai', { ...ai, searchLoading: true, searchQuery: query, searchResults: null });

  try {
    // If client parser succeeded, use SQL search
    if (filter.parsed) {
      const resp = await fetch(`${API_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filter),
        signal: requestController.signal,
      });

      if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);
      const data = await resp.json();
      if (requestSeq !== activeSearchSeq) return;

      store.set('ai', {
        ...store.get('ai'),
        searchResults: data.results ?? data.events ?? [],
        searchLoading: false,
      });
    } else {
      // AI fallback — send raw query
      const resp = await fetch(`${API_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_query: query }),
        signal: requestController.signal,
      });

      if (!resp.ok) throw new Error(`AI search failed: ${resp.status}`);
      const data = await resp.json();
      if (requestSeq !== activeSearchSeq) return;

      store.set('ai', {
        ...store.get('ai'),
        searchResults: data.results ?? [],
        searchLoading: false,
      });
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return;
    }
    if (requestSeq !== activeSearchSeq) return;
    store.set('ai', {
      ...store.get('ai'),
      searchLoading: false,
      searchResults: [],
    });
    console.error('[search]', err);
  } finally {
    if (activeSearchController === requestController) {
      activeSearchController = null;
    }
  }
}

function renderResults(results: any[]): void {
  if (!resultsList) return;

  if (results.length === 0) {
    resultsList.innerHTML = `<div class="search-empty">${t('search.noResults')}</div>`;
    return;
  }

  resultsList.textContent = '';

  // Stats summary
  const rows = results.map(toSearchRow);
  const avgMag = rows.reduce((s, r) => s + r.magnitude, 0) / rows.length;
  const offshore = rows.filter(r => r.place.match(/沖|offshore|off\s|海/i)).length;
  const inland = rows.length - offshore;
  const statsEl = document.createElement('div');
  statsEl.className = 'search-stats';
  statsEl.textContent =
    `${rows.length}${t('search.stats.countSuffix')} · ` +
    `${t('search.stats.avgPrefix')} M${avgMag.toFixed(1)} · ` +
    `${offshore}${t('search.stats.offshoreSuffix')} · ` +
    `${inland}${t('search.stats.inlandSuffix')}`;
  resultsList.appendChild(statsEl);

  const fragment = document.createDocumentFragment();
  const sliced = results.slice(0, 20);

  for (const result of sliced) {
    const row = toSearchRow(result);
    const button = document.createElement('button');
    button.className = 'search-result-item';
    button.type = 'button';

    const mag = document.createElement('span');
    mag.className = 'search-result-mag';
    mag.textContent = `M${row.magnitude.toFixed(1)}`;

    const place = document.createElement('span');
    place.className = 'search-result-place';
    place.textContent = getPlaceText(row.place);

    const date = document.createElement('span');
    date.className = 'search-result-date';
    date.textContent = row.time ? new Date(row.time).toLocaleDateString() : '';

    button.append(mag, place, date);
    button.addEventListener('click', () => {
      if (!row.id) return;

      const parsedTime = row.time instanceof Date
        ? row.time.getTime()
        : typeof row.time === 'number'
          ? row.time
          : row.time ? new Date(row.time).getTime() : NaN;

      store.set('selectedEvent', {
        id: row.id,
        lat: row.lat,
        lng: row.lng,
        depth_km: row.depth_km,
        magnitude: row.magnitude,
        time: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
        faultType: row.fault_type ?? 'crustal',
        tsunami: row.tsunami === true,
        place: { text: getPlaceText(row.place) },
      });
      closeSearch();
    });
    fragment.appendChild(button);
  }

  resultsList.appendChild(fragment);
}

interface SearchRow {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  time: string | number | Date | null;
  fault_type: 'crustal' | 'interface' | 'intraslab' | null;
  tsunami: boolean;
  place: string;
}

function toSearchRow(value: unknown): SearchRow {
  const r = (typeof value === 'object' && value !== null)
    ? value as Record<string, unknown>
    : {};

  const faultType = r.fault_type;
  const normalizedFaultType =
    faultType === 'crustal' || faultType === 'interface' || faultType === 'intraslab'
      ? faultType
      : null;

  return {
    id: typeof r.id === 'string' ? r.id : '',
    lat: toNumber(r.lat),
    lng: toNumber(r.lng),
    depth_km: toNumber(r.depth_km),
    magnitude: toNumber(r.magnitude),
    time: isSupportedTime(r.time) ? r.time : null,
    fault_type: normalizedFaultType,
    tsunami: r.tsunami === true,
    place: typeof r.place === 'string' ? r.place : '',
  };
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isSupportedTime(value: unknown): value is string | number | Date {
  return typeof value === 'string' || typeof value === 'number' || value instanceof Date;
}

export function disposeSearchBar(): void {
  activeSearchController?.abort();
  activeSearchController = null;
  activeSearchSeq += 1;
  unsubAi?.();
  unsubAi = null;
  unsubLocale?.();
  unsubLocale = null;
  overlay?.remove();
  overlay = null;
  input = null;
  resultsList = null;
  hintEl = null;
}
