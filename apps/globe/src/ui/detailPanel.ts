/**
 * Detail Panel — Earthquake detail view extracted from liveFeed.
 *
 * Shows magnitude, location, depth, MMI bar, AI analysis, and action buttons
 * for a selected earthquake event. Reusable in both desktop (inline in left panel)
 * and mobile (inside peek sheet) contexts.
 */

import type { EarthquakeEvent, IntensitySource, JmaClass } from '../types';
import { computeGmpe } from '../engine/gmpe';
import { store } from '../store/appState';
import { t, onLocaleChange, getLocale } from '../i18n/index';
import { MMI_COLORS } from '../utils/colorScale';
import { getJapanPlaceName } from '../utils/japanGeo';
import { buildAnalysisSection, updateAnalysis, disposeAnalysisPanel } from './analysisPanel';
import { createHelpButton } from './intensityGuide';
import { assessTsunamiRisk, classifyLocation, inferFaultType } from '../../../../packages/db/geo.ts';

// ── DOM refs ──

let detailPanel: HTMLElement;
let detailMagEl: HTMLElement;
let detailPlaceEl: HTMLElement;
let detailMetaEl: HTMLElement;
let detailSourceTag: HTMLElement;
let mmiBarContainer: HTMLElement;
let mmiBarEl: HTMLElement;
let mmiLevelEl: HTMLElement;
let mmiTitleEl: HTMLElement;
let crossSectionBtn: HTMLElement;

let unsubSelected: (() => void) | null = null;
let unsubAi: (() => void) | null = null;
let unsubIntensity: (() => void) | null = null;
let unsubLocale: (() => void) | null = null;

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

function eventPlaceName(event: EarthquakeEvent): string {
  const place = getJapanPlaceName(event.lat, event.lng);
  if (!place) return event.place?.text || 'Unknown';
  const locale = getLocale();
  if (locale === 'ko') return place.ko;
  return locale === 'ja' ? place.ja : place.en;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t('time.justNow');
  if (mins < 60) return `${mins}${t('time.minAgo')}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}${t('time.hrAgo')}`;
  const days = Math.floor(hours / 24);
  return `${days}${t('time.dayAgo')}`;
}

// ── Exported helpers (used by other modules) ──

export function computeJmaForEvent(event: EarthquakeEvent): JmaClass {
  return computeGmpe({
    Mw: event.magnitude,
    depth_km: event.depth_km,
    distance_km: Math.max(event.depth_km, 1),
    faultType: event.faultType,
  }).jmaClass;
}

export function jmaToMmi(jmaClass: JmaClass): number {
  const map: Record<JmaClass, number> = {
    '0': 1, '1': 2, '2': 3, '3': 4, '4': 5,
    '5-': 6, '5+': 7, '6-': 8, '6+': 9, '7': 10,
  };
  return map[jmaClass] || 1;
}

function mmiDescription(mmi: number): string {
  if (mmi >= 8) return t('mmi.destructive');
  if (mmi >= 6) return t('mmi.strong');
  if (mmi >= 4) return t('mmi.moderate');
  return t('mmi.weak');
}

// ── Build UI ──

function buildDetailDOM(): HTMLElement {
  detailPanel = el('div', 'detail-panel detail-panel--hidden');

  const header = el('div', 'detail-panel__header-refined');
  const headerLeft = el('div', 'detail-panel__header-left');

  const magRow = el('div', 'detail-panel__mag-row');
  detailMagEl = el('span', 'detail-panel__magnitude-lg');
  detailPlaceEl = el('span', 'detail-panel__place-lg');
  magRow.appendChild(detailMagEl);
  magRow.appendChild(detailPlaceEl);
  headerLeft.appendChild(magRow);

  detailMetaEl = el('div', 'detail-panel__meta-row');
  headerLeft.appendChild(detailMetaEl);
  header.appendChild(headerLeft);

  detailSourceTag = el('span', 'source-tag');
  detailSourceTag.style.display = 'none';
  header.appendChild(detailSourceTag);

  // Close button
  const closeBtn = el('button', 'detail-panel__close');
  closeBtn.innerHTML = '\u00d7';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.addEventListener('click', () => {
    store.set('selectedEvent', null);
  });
  header.appendChild(closeBtn);

  detailPanel.appendChild(header);

  // MMI Bar
  mmiBarContainer = el('div');
  mmiBarContainer.style.marginTop = '10px';
  mmiBarContainer.style.display = 'none';

  mmiTitleEl = el('div', 'mmi-bar__title', t('sidebar.mmiTitle'));
  mmiTitleEl.appendChild(createHelpButton());
  mmiBarContainer.appendChild(mmiTitleEl);

  mmiBarEl = el('div', 'mmi-bar');
  for (let i = 1; i <= 10; i++) {
    const seg = el('div', 'mmi-segment');
    seg.style.background = MMI_COLORS[i];
    seg.dataset.mmi = String(i);
    mmiBarEl.appendChild(seg);
  }
  mmiBarContainer.appendChild(mmiBarEl);

  const labels = el('div', 'mmi-bar__labels');
  labels.appendChild(el('span', 'mmi-bar__label', 'I'));
  mmiLevelEl = el('span', 'mmi-bar__level');
  labels.appendChild(mmiLevelEl);
  labels.appendChild(el('span', 'mmi-bar__label', 'X'));
  mmiBarContainer.appendChild(labels);
  detailPanel.appendChild(mmiBarContainer);

  // AI Analysis Section (delegated to analysisPanel module)
  detailPanel.appendChild(buildAnalysisSection());

  // Action buttons
  const actions = el('div', 'detail-actions');
  crossSectionBtn = el('button', 'detail-action-btn', t('detail.crossSection'));
  crossSectionBtn.addEventListener('click', () => store.set('viewPreset', 'crossSection'));
  actions.appendChild(crossSectionBtn);

  detailPanel.appendChild(actions);
  return detailPanel;
}

// ── Refresh ──

export function refreshDetail(
  selectedEvent: EarthquakeEvent | null,
  intensitySource: IntensitySource,
): void {
  // Guard: DOM not yet created (store subscription may fire before initDetailPanel)
  if (!detailPanel) return;

  if (selectedEvent) {
    detailPanel.classList.remove('detail-panel--hidden');
    // Scroll pane to top so detail panel is visible
    detailPanel.parentElement?.scrollTo({ top: 0, behavior: 'smooth' });

    detailMagEl.textContent = `M${selectedEvent.magnitude.toFixed(1)}`;
    detailPlaceEl.textContent = eventPlaceName(selectedEvent);

    detailMetaEl.textContent = '';
    detailMetaEl.appendChild(el('span', undefined, formatRelativeTime(selectedEvent.time)));
    const depthSpan = el('span');
    depthSpan.append(document.createTextNode(`${t('detail.depth')} `));
    const depthValue = el('span');
    depthValue.style.color = 'var(--text-secondary)';
    depthValue.textContent = `${Math.round(selectedEvent.depth_km)}km`;
    depthSpan.append(depthValue);
    detailMetaEl.appendChild(depthSpan);
    detailMetaEl.appendChild(el('span', undefined,
      `${Math.abs(selectedEvent.lat).toFixed(3)}\u00B0${selectedEvent.lat >= 0 ? 'N' : 'S'}`));
    detailMetaEl.appendChild(el('span', undefined,
      `${Math.abs(selectedEvent.lng).toFixed(3)}\u00B0${selectedEvent.lng >= 0 ? 'E' : 'W'}`));
    // Tsunami badge: compute client-side (overrides stale DB facts)
    const ai = store.get('ai');
    const placeText = selectedEvent.place?.text;
    const loc = classifyLocation(selectedEvent.lat, selectedEvent.lng, placeText, undefined);
    const ft = selectedEvent.faultType || inferFaultType(selectedEvent.depth_km, selectedEvent.lat, selectedEvent.lng, placeText, undefined);
    const tsunamiResult = assessTsunamiRisk(
      selectedEvent.magnitude, selectedEvent.depth_km, ft,
      selectedEvent.lat, selectedEvent.lng, placeText, undefined,
      selectedEvent.tsunami,
    );
    const tsunamiRisk = tsunamiResult.risk;
    const isOffshore = loc.type !== 'inland';
    if (tsunamiRisk === 'high' || tsunamiRisk === 'moderate') {
      detailMetaEl.appendChild(el('span', 'feed-item__tsunami feed-item__tsunami--warn',
        t(`tsunami.label.${tsunamiRisk}`)));
    } else if ((tsunamiRisk === 'low' || tsunamiRisk === 'none') && isOffshore) {
      detailMetaEl.appendChild(el('span', 'feed-item__tsunami--safe',
        t(`tsunami.label.${tsunamiRisk}`)));
    } else if (selectedEvent.tsunami) {
      detailMetaEl.appendChild(el('span', 'feed-item__tsunami', '津波注意'));
    }

    if (intensitySource === 'shakemap') {
      detailSourceTag.className = 'source-tag source-tag--shakemap';
      detailSourceTag.textContent = t('detail.source.shakemap');
      detailSourceTag.style.display = 'inline-block';
      detailSourceTag.style.fontSize = 'var(--text-xs)';
    } else if (intensitySource === 'gmpe') {
      detailSourceTag.className = 'source-tag source-tag--gmpe';
      detailSourceTag.textContent = t('detail.source.gmpe');
      detailSourceTag.style.display = 'inline-block';
      detailSourceTag.style.fontSize = 'var(--text-xs)';
    } else {
      detailSourceTag.style.display = 'none';
    }

    const jma = computeJmaForEvent(selectedEvent);
    const mmi = jmaToMmi(jma);
    if (mmi >= 2) {
      mmiBarContainer.style.display = 'block';
      const segments = mmiBarEl.children;
      for (let i = 0; i < segments.length; i++) {
        (segments[i] as HTMLElement).style.opacity = (i + 1) <= mmi ? '0.7' : '0.1';
      }
      mmiLevelEl.textContent = mmiDescription(mmi);
      mmiLevelEl.style.color = MMI_COLORS[mmi] || '#888';
    } else {
      mmiBarContainer.style.display = 'none';
    }

    // AI Analysis rendering (delegated to analysisPanel)
    updateAnalysis(ai.currentAnalysis, ai.analysisLoading, ai.analysisError);

    crossSectionBtn.style.display = selectedEvent.magnitude >= 4.0 ? 'block' : 'none';
  } else {
    detailPanel.classList.add('detail-panel--hidden');
  }
}

// ── Public API ──

export function initDetailPanel(container: HTMLElement): void {
  container.prepend(buildDetailDOM());

  unsubSelected = store.subscribe('selectedEvent', () => {
    const selected = store.get('selectedEvent');
    const intensitySource = store.get('intensitySource');
    refreshDetail(selected, intensitySource);
  });

  unsubAi = store.subscribe('ai', () => {
    const selected = store.get('selectedEvent');
    if (selected) {
      const intensitySource = store.get('intensitySource');
      refreshDetail(selected, intensitySource);
    }
  });

  unsubIntensity = store.subscribe('intensitySource', () => {
    const selected = store.get('selectedEvent');
    if (selected) {
      const intensitySource = store.get('intensitySource');
      refreshDetail(selected, intensitySource);
    }
  });

  unsubLocale = onLocaleChange(() => {
    crossSectionBtn.textContent = t('detail.crossSection');
    mmiTitleEl.textContent = t('sidebar.mmiTitle');
    const selected = store.get('selectedEvent');
    if (selected) {
      const intensitySource = store.get('intensitySource');
      refreshDetail(selected, intensitySource);
    }
  });
}

export function disposeDetailPanel(): void {
  disposeAnalysisPanel();
  unsubSelected?.();
  unsubSelected = null;
  unsubAi?.();
  unsubAi = null;
  unsubIntensity?.();
  unsubIntensity = null;
  unsubLocale?.();
  unsubLocale = null;
}
