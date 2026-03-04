/**
 * Namazue — Search Bar (CMD+K Command Palette)
 *
 * Overlay search bar for natural language earthquake queries.
 * Supports ko/ja/en input, parses client-side, and fetches from API.
 */

import { store } from '../store/appState';
import { buildSearchFilter } from '../ai/search/combiner';
import { getPlaceText } from '../utils/earthquakeUtils';
import { t, onLocaleChange, getLocale } from '../i18n/index';

let overlay: HTMLElement | null = null;
let dialog: HTMLElement | null = null;
let input: HTMLInputElement | null = null;
let resultsList: HTMLElement | null = null;
let hintEl: HTMLElement | null = null;
let unsubAi: (() => void) | null = null;
let unsubLocale: (() => void) | null = null;
let activeSearchController: AbortController | null = null;
let searchRequestId = 0;
let resultButtons: HTMLButtonElement[] = [];
let activeResultIndex = -1;
let focusRestoreEl: HTMLElement | null = null;

const API_URL = import.meta.env.VITE_API_URL
  ?? (import.meta.env.PROD ? 'https://api.namazue.dev' : '');

export function initSearchBar(): void {
  // Create overlay (hidden by default)
  overlay = document.createElement('div');
  overlay.className = 'search-overlay';
  overlay.style.display = 'none';
  overlay.setAttribute('aria-hidden', 'true');
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

  dialog = overlay.querySelector('.search-dialog');
  input = overlay.querySelector('.search-input');
  resultsList = overlay.querySelector('.search-results');
  hintEl = overlay.querySelector('.search-hint');
  const backdrop = overlay.querySelector('.search-backdrop');
  if (dialog) {
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', t('search.dialogLabel'));
  }

  const applyLocaleText = () => {
    if (input) input.placeholder = t('search.placeholder');
    if (hintEl) hintEl.textContent = t('search.hint');
    if (dialog) dialog.setAttribute('aria-label', t('search.dialogLabel'));
    if (input) input.setAttribute('aria-label', t('search.inputLabel'));
    if (resultsList) resultsList.setAttribute('aria-label', t('search.resultsLabel'));
  };
  applyLocaleText();
  if (resultsList) {
    resultsList.setAttribute('role', 'listbox');
    resultsList.setAttribute('aria-live', 'polite');
  }

  // Close on backdrop click
  backdrop?.addEventListener('click', () => {
    closeSearch();
  });

  // Input handler
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveResultFocus(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveResultFocus(-1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeResultIndex >= 0 && resultButtons[activeResultIndex]) {
        resultButtons[activeResultIndex].click();
      } else {
        const aiState = store.get('ai');
        if (!aiState.searchLoading) {
          void executeSearch();
        }
      }
    }
  });
  overlay.addEventListener('keydown', handleOverlayKeydown);

  // Subscribe to search state
  unsubAi?.();
  unsubAi = store.subscribe('ai', (ai) => {
    if (!resultsList) return;
    if (ai.searchLoading) {
      resultsList.innerHTML = `<div class="search-loading">${t('search.loading')}</div>`;
      resultButtons = [];
      activeResultIndex = -1;
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
  focusRestoreEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  overlay.style.display = 'flex';
  overlay.setAttribute('aria-hidden', 'false');
  lockBodyScroll();
  input.value = '';
  if (resultsList) resultsList.textContent = '';
  resultButtons = [];
  activeResultIndex = -1;
  requestAnimationFrame(() => input?.focus());
}

export function closeSearch(): void {
  if (!overlay) return;
  cancelOngoingSearch(true);
  overlay.style.display = 'none';
  overlay.setAttribute('aria-hidden', 'true');
  unlockBodyScroll();
  resultButtons = [];
  activeResultIndex = -1;
  // Clear search highlights on globe
  const ai = store.get('ai');
  if (ai.searchResults || ai.searchQuery || ai.searchLoading) {
    store.set('ai', { ...ai, searchResults: null, searchQuery: '', searchLoading: false });
  }
  focusRestoreEl?.focus();
  focusRestoreEl = null;
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

  cancelOngoingSearch(false);
  const controller = new AbortController();
  activeSearchController = controller;
  const currentRequestId = ++searchRequestId;
  const filter = buildSearchFilter(query);

  const ai = store.get('ai');
  store.set('ai', { ...ai, searchLoading: true, searchQuery: query, searchResults: null });

  try {
    const payload = filter.parsed ? filter : { raw_query: query };
    const resp = await fetch(`${API_URL}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);
    const data = await resp.json();

    // Ignore stale responses from older requests.
    if (currentRequestId !== searchRequestId || controller.signal.aborted) return;

    store.set('ai', {
      ...store.get('ai'),
      searchResults: data.results ?? data.events ?? [],
      searchLoading: false,
    });
  } catch (err) {
    if (controller.signal.aborted || currentRequestId !== searchRequestId) return;
    store.set('ai', {
      ...store.get('ai'),
      searchLoading: false,
      searchResults: [],
    });
    console.error('[search]', err);
  } finally {
    if (activeSearchController === controller) {
      activeSearchController = null;
    }
  }
}

function renderResults(results: unknown[]): void {
  if (!resultsList) return;

  if (results.length === 0) {
    resultsList.innerHTML = `<div class="search-empty">${t('search.noResults')}</div>`;
    resultButtons = [];
    activeResultIndex = -1;
    return;
  }

  resultsList.textContent = '';
  resultButtons = [];
  activeResultIndex = -1;

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
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', 'false');

    const mag = document.createElement('span');
    mag.className = 'search-result-mag';
    mag.textContent = `M${row.magnitude.toFixed(1)}`;

    const place = document.createElement('span');
    place.className = 'search-result-place';
    place.textContent = getPlaceText(row.place);

    const date = document.createElement('span');
    date.className = 'search-result-date';
    date.textContent = formatResultTime(row.time);

    button.append(mag, place, date);
    button.addEventListener('click', () => {
      selectSearchRow(row);
    });
    button.addEventListener('mouseenter', () => {
      const index = resultButtons.indexOf(button);
      if (index >= 0) setActiveResult(index, false);
    });
    resultButtons.push(button);
    fragment.appendChild(button);
  }

  resultsList.appendChild(fragment);
  if (resultButtons.length > 0) {
    setActiveResult(0, false);
  }
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

function setActiveResult(index: number, focus: boolean): void {
  if (resultButtons.length === 0) return;
  activeResultIndex = Math.max(0, Math.min(index, resultButtons.length - 1));
  for (let i = 0; i < resultButtons.length; i++) {
    const isActive = i === activeResultIndex;
    resultButtons[i].classList.toggle('search-result-item--active', isActive);
    resultButtons[i].setAttribute('aria-selected', String(isActive));
  }
  if (focus) {
    resultButtons[activeResultIndex]?.focus();
  }
}

function moveResultFocus(delta: 1 | -1): void {
  if (resultButtons.length === 0) return;
  if (activeResultIndex === -1) {
    setActiveResult(0, true);
    return;
  }
  const next = (activeResultIndex + delta + resultButtons.length) % resultButtons.length;
  setActiveResult(next, true);
}

function lockBodyScroll(): void {
  document.body.classList.add('search-open');
}

function unlockBodyScroll(): void {
  document.body.classList.remove('search-open');
}

function cancelOngoingSearch(clearLoading: boolean): void {
  if (activeSearchController) {
    activeSearchController.abort();
    activeSearchController = null;
  }
  if (clearLoading) {
    const ai = store.get('ai');
    if (ai.searchLoading) {
      store.set('ai', { ...ai, searchLoading: false });
    }
  }
}

function selectSearchRow(row: SearchRow): void {
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
}

function formatResultTime(time: SearchRow['time']): string {
  if (!time) return '';
  const date = time instanceof Date ? time : new Date(time);
  if (!Number.isFinite(date.getTime())) return '';
  const locale = getLocale();
  const localeCode = locale === 'ko' ? 'ko-KR' : locale === 'ja' ? 'ja-JP' : 'en-US';
  return date.toLocaleString(localeCode, {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function handleOverlayKeydown(e: KeyboardEvent): void {
  if (!overlay || overlay.style.display === 'none') return;
  if (e.key !== 'Tab' || !dialog) return;

  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
  )).filter((node) => !node.hasAttribute('hidden'));
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  } else if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  }
}

export function disposeSearchBar(): void {
  cancelOngoingSearch(false);
  unsubAi?.();
  unsubAi = null;
  unsubLocale?.();
  unsubLocale = null;
  unlockBodyScroll();
  resultButtons = [];
  activeResultIndex = -1;
  focusRestoreEl = null;
  overlay?.remove();
  overlay = null;
  dialog = null;
  input = null;
  resultsList = null;
  hintEl = null;
}
