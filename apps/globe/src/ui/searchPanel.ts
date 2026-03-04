/**
 * Search Panel — Inline search for the "Search" tab pane.
 *
 * Converts the CMD+K modal search into a persistent panel.
 * Mounts into the left panel's "search" pane via getTabPane('search').
 */

import { store } from '../store/appState';
import { buildSearchFilter } from '../ai/search/combiner';
import { getPlaceText } from '../utils/earthquakeUtils';
import { t, onLocaleChange, getLocale } from '../i18n/index';
import { getTabPane } from './leftPanel';
import type { FaultType } from '../types';

// ── DOM refs ──

let panelEl: HTMLElement;
let inputEl: HTMLInputElement;
let resultsList: HTMLElement;
let hintEl: HTMLElement;
let unsubLocale: (() => void) | null = null;
let activeSearchController: AbortController | null = null;
let searchRequestId = 0;
let resultButtons: HTMLButtonElement[] = [];
let activeResultIndex = -1;

const API_URL = import.meta.env.VITE_API_URL
  ?? (import.meta.env.PROD ? 'https://api.namazue.dev' : '');

// ── Helpers ──

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ── Build UI ──

function buildSearchInput(): HTMLElement {
  const row = el('div', 'search-panel__input-row');

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', 'search-panel__icon');
  icon.setAttribute('width', '16');
  icon.setAttribute('height', '16');
  icon.setAttribute('viewBox', '0 0 16 16');
  icon.setAttribute('fill', 'none');
  icon.innerHTML = '<circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/><path d="M11 11L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
  row.appendChild(icon);

  inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.className = 'search-panel__input';
  inputEl.spellcheck = false;
  inputEl.placeholder = t('search.placeholder');
  inputEl.setAttribute('aria-label', t('search.inputLabel'));
  row.appendChild(inputEl);

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveResultFocus(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveResultFocus(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeResultIndex >= 0 && resultButtons[activeResultIndex]) {
        resultButtons[activeResultIndex].click();
      } else {
        void executeSearch();
      }
    }
  });

  return row;
}

function buildQuickFilters(): HTMLElement {
  const section = el('div', 'search-panel__chips-section');
  const label = el('div', 'search-panel__section-label', t('search.quickFilters'));
  section.appendChild(label);

  const row = el('div', 'search-panel__chips');
  const chips = [
    { label: 'M6+', query: 'M6+' },
    { label: 'M7+', query: 'M7+' },
    { label: t('search.chip.recent'), query: '24h' },
    { label: t('search.chip.tsunami'), query: 'tsunami' },
    { label: t('search.chip.tohoku'), query: 'tohoku' },
    { label: t('search.chip.nankai'), query: 'nankai' },
    { label: t('search.chip.kanto'), query: 'kanto' },
    { label: t('search.chip.deep'), query: 'deep' },
  ];

  for (const chip of chips) {
    const btn = el('button', 'search-panel__chip', chip.label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      inputEl.value = chip.query;
      void executeSearch();
    });
    row.appendChild(btn);
  }
  section.appendChild(row);
  return section;
}

function buildExamples(): HTMLElement {
  const section = el('div', 'search-panel__examples-section');
  const label = el('div', 'search-panel__section-label', t('search.examples'));
  section.appendChild(label);

  const examples = [
    '"M6+ tohoku 2024"',
    '"tsunami kyushu"',
    '"\u6DF1\u3055300km\u4EE5\u4E0A"',
    '"nankai M7"',
    '"\uADDC\uBAA8 5 \uC774\uC0C1 \uB3C4\uD638\uCFE0"',
  ];

  const list = el('div', 'search-panel__examples');
  for (const ex of examples) {
    const btn = el('button', 'search-panel__example', ex);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      inputEl.value = ex.replace(/^"|"$/g, '');
      void executeSearch();
    });
    list.appendChild(btn);
  }
  section.appendChild(list);
  return section;
}

// ── Search Logic ──

async function executeSearch(): Promise<void> {
  const query = inputEl.value.trim();
  if (!query) return;

  cancelOngoingSearch();
  const controller = new AbortController();
  activeSearchController = controller;
  const currentRequestId = ++searchRequestId;
  const filter = buildSearchFilter(query);

  showLoading();

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

    if (currentRequestId !== searchRequestId || controller.signal.aborted) return;
    renderResults(data.results ?? data.events ?? []);
  } catch (err) {
    if (controller.signal.aborted || currentRequestId !== searchRequestId) return;
    renderResults([]);
    console.error('[searchPanel]', err);
  } finally {
    if (activeSearchController === controller) activeSearchController = null;
  }
}

function cancelOngoingSearch(): void {
  if (activeSearchController) {
    activeSearchController.abort();
    activeSearchController = null;
  }
}

function showLoading(): void {
  resultsList.textContent = '';
  resultsList.appendChild(el('div', 'search-panel__loading', t('search.loading')));
  resultButtons = [];
  activeResultIndex = -1;
}

// ── Render Results ──

interface SearchRow {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  time: string | number | Date | null;
  fault_type: FaultType | null;
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
  return Number.isFinite(n) ? n : Number.NaN;
}

function isSupportedTime(value: unknown): value is string | number | Date {
  return typeof value === 'string' || typeof value === 'number' || value instanceof Date;
}

function isValidSearchRow(row: SearchRow): boolean {
  return row.id.length > 0 && Number.isFinite(row.lat) && Number.isFinite(row.lng)
    && Number.isFinite(row.depth_km) && Number.isFinite(row.magnitude);
}

function renderResults(results: unknown[]): void {
  resultsList.textContent = '';
  resultButtons = [];
  activeResultIndex = -1;

  if (results.length === 0) {
    resultsList.appendChild(el('div', 'search-panel__empty', t('search.noResults')));
    return;
  }

  const rows = results.map(toSearchRow).filter(isValidSearchRow);
  if (rows.length === 0) {
    resultsList.appendChild(el('div', 'search-panel__empty', t('search.noResults')));
    return;
  }

  // Stats
  const avgMag = rows.reduce((s, r) => s + r.magnitude, 0) / rows.length;
  const offshore = rows.filter(r => r.place.match(/沖|offshore|off\s|海/i)).length;
  const inland = rows.length - offshore;
  const stats = el('div', 'search-panel__stats');
  stats.textContent =
    `${rows.length}${t('search.stats.countSuffix')} \u00B7 ` +
    `${t('search.stats.avgPrefix')} M${avgMag.toFixed(1)} \u00B7 ` +
    `${offshore}${t('search.stats.offshoreSuffix')} \u00B7 ` +
    `${inland}${t('search.stats.inlandSuffix')}`;
  resultsList.appendChild(stats);

  // Result items
  const fragment = document.createDocumentFragment();
  for (const row of rows.slice(0, 30)) {
    const button = document.createElement('button');
    button.className = 'search-panel__result';
    button.type = 'button';
    button.setAttribute('role', 'option');

    const mag = el('span', 'search-panel__result-mag', `M${row.magnitude.toFixed(1)}`);
    const place = el('span', 'search-panel__result-place', getPlaceText(row.place));
    const date = el('span', 'search-panel__result-date', formatResultTime(row.time));

    button.append(mag, place, date);
    button.addEventListener('click', () => selectSearchRow(row));
    button.addEventListener('mouseenter', () => {
      const idx = resultButtons.indexOf(button);
      if (idx >= 0) setActiveResult(idx);
    });
    resultButtons.push(button);
    fragment.appendChild(button);
  }
  resultsList.appendChild(fragment);

  if (resultButtons.length > 0) setActiveResult(0);
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

  // Switch to live tab to see the detail
  store.set('activePanel', 'live');
  store.set('route', { ...store.get('route'), tab: 'live', eventId: row.id });
}

function formatResultTime(time: SearchRow['time']): string {
  if (!time) return '';
  const date = time instanceof Date ? time : new Date(time);
  if (!Number.isFinite(date.getTime())) return '';
  const locale = getLocale();
  const localeCode = locale === 'ko' ? 'ko-KR' : locale === 'ja' ? 'ja-JP' : 'en-US';
  return date.toLocaleString(localeCode, {
    year: '2-digit', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function setActiveResult(index: number): void {
  if (resultButtons.length === 0) return;
  activeResultIndex = Math.max(0, Math.min(index, resultButtons.length - 1));
  for (let i = 0; i < resultButtons.length; i++) {
    resultButtons[i].classList.toggle('search-panel__result--active', i === activeResultIndex);
  }
}

function moveResultFocus(delta: 1 | -1): void {
  if (resultButtons.length === 0) return;
  if (activeResultIndex === -1) { setActiveResult(0); return; }
  const next = (activeResultIndex + delta + resultButtons.length) % resultButtons.length;
  setActiveResult(next);
  resultButtons[next]?.scrollIntoView({ block: 'nearest' });
}

// ── Public API ──

export function initSearchPanel(): void {
  const pane = getTabPane('search');
  if (!pane) return;

  panelEl = el('div', 'search-panel');
  panelEl.appendChild(buildSearchInput());

  hintEl = el('div', 'search-panel__hint', t('search.hint'));
  panelEl.appendChild(hintEl);

  resultsList = el('div', 'search-panel__results');
  resultsList.setAttribute('role', 'listbox');
  resultsList.setAttribute('aria-live', 'polite');
  panelEl.appendChild(resultsList);

  // Show quick filters + examples as initial state
  const initialContent = el('div', 'search-panel__initial');
  initialContent.appendChild(buildQuickFilters());
  initialContent.appendChild(buildExamples());
  resultsList.appendChild(initialContent);

  pane.appendChild(panelEl);

  // Focus input when search tab is activated
  store.subscribe('activePanel', (tab) => {
    if (tab === 'search') {
      requestAnimationFrame(() => inputEl?.focus());
    }
  });

  unsubLocale = onLocaleChange(() => {
    inputEl.placeholder = t('search.placeholder');
    inputEl.setAttribute('aria-label', t('search.inputLabel'));
    hintEl.textContent = t('search.hint');
  });
}

export function focusSearchInput(): void {
  inputEl?.focus();
}

export function disposeSearchPanel(): void {
  cancelOngoingSearch();
  unsubLocale?.();
  unsubLocale = null;
  resultButtons = [];
  activeResultIndex = -1;
}
