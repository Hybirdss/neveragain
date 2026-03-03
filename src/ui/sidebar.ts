/**
 * NeverAgain — Sidebar Component
 *
 * Stats cards, magnitude histogram, and earthquake detail panel.
 * Pure DOM manipulation — no frameworks.
 */

import type { EarthquakeEvent, IntensitySource, JmaClass } from '../types';
import { JMA_COLORS } from '../types';
import { computeGmpe } from '../engine/gmpe';
import { store } from '../store/appState';
import { t, onLocaleChange } from '../i18n/index';

// ---- Internal references ----
let sidebarEl: HTMLElement;
let totalQuakesVal: HTMLElement;
let maxMagVal: HTMLElement;
let avgMagVal: HTMLElement;
let latestTimeVal: HTMLElement;

// Histogram bar elements indexed by bucket key
const histogramBars: Record<string, { bar: HTMLElement; count: HTMLElement }> = {};

// Detail panel
let detailPanel: HTMLElement;
let detailMag: HTMLElement;
let detailPlace: HTMLElement;
let detailTime: HTMLElement;
let detailCoords: HTMLElement;
let detailDepth: HTMLElement;
let detailFault: HTMLElement;
let detailSource: HTMLElement;
let detailJmaBadge: HTMLElement;
let cinematicBtn: HTMLElement;

// Label elements for i18n updates
let sidebarTitleEl: HTMLElement;
let totalQuakesLabel: HTMLElement;
let maxMagLabel: HTMLElement;
let avgMagLabel: HTMLElement;
let latestLabel: HTMLElement;
let histogramTitleEl: HTMLElement;
let detailKeyEls: Record<string, HTMLElement> = {};
let unsubLocale: (() => void) | null = null;

const HISTOGRAM_BUCKETS = [
  { key: 'M3', label: 'M3-4', min: 3, max: 4, cls: '' },
  { key: 'M4', label: 'M4-5', min: 4, max: 5, cls: 'histogram__bar--m4' },
  { key: 'M5', label: 'M5-6', min: 5, max: 6, cls: 'histogram__bar--m5' },
  { key: 'M6', label: 'M6-7', min: 6, max: 7, cls: 'histogram__bar--m6' },
  { key: 'M7', label: 'M7+', min: 7, max: Infinity, cls: 'histogram__bar--m7' },
];

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

function buildStatCards(): HTMLElement {
  const container = el('div', 'stat-cards');

  // Total earthquakes
  const cardTotal = el('div', 'stat-card');
  totalQuakesLabel = el('div', 'stat-card__label', t('sidebar.totalQuakes'));
  cardTotal.appendChild(totalQuakesLabel);
  totalQuakesVal = el('div', 'stat-card__value', '0');
  cardTotal.appendChild(totalQuakesVal);
  container.appendChild(cardTotal);

  // Max magnitude
  const cardMax = el('div', 'stat-card stat-card--warning');
  maxMagLabel = el('div', 'stat-card__label', t('sidebar.maxMag'));
  cardMax.appendChild(maxMagLabel);
  maxMagVal = el('div', 'stat-card__value', '--');
  cardMax.appendChild(maxMagVal);
  container.appendChild(cardMax);

  // Average magnitude
  const cardAvg = el('div', 'stat-card');
  avgMagLabel = el('div', 'stat-card__label', t('sidebar.avgMag'));
  cardAvg.appendChild(avgMagLabel);
  avgMagVal = el('div', 'stat-card__value', '--');
  cardAvg.appendChild(avgMagVal);
  container.appendChild(cardAvg);

  // Latest time
  const cardTime = el('div', 'stat-card');
  latestLabel = el('div', 'stat-card__label', t('sidebar.latest'));
  cardTime.appendChild(latestLabel);
  latestTimeVal = el('div', 'stat-card__value', '--');
  latestTimeVal.style.fontSize = 'var(--text-sm)';
  cardTime.appendChild(latestTimeVal);
  container.appendChild(cardTime);

  return container;
}

function buildHistogram(): HTMLElement {
  const container = el('div', 'histogram');
  histogramTitleEl = el('div', 'histogram__title', t('sidebar.magDistribution'));
  container.appendChild(histogramTitleEl);

  for (const bucket of HISTOGRAM_BUCKETS) {
    const row = el('div', 'histogram__row');

    row.appendChild(el('div', 'histogram__label', bucket.label));

    const track = el('div', 'histogram__track');
    const bar = el('div', `histogram__bar ${bucket.cls}`.trim());
    bar.style.width = '0%';
    track.appendChild(bar);
    row.appendChild(track);

    const count = el('div', 'histogram__count', '0');
    row.appendChild(count);

    histogramBars[bucket.key] = { bar, count };
    container.appendChild(row);
  }

  return container;
}

function buildDetailPanel(): HTMLElement {
  detailPanel = el('div', 'detail-panel detail-panel--hidden');

  const header = el('div', 'detail-panel__header');
  detailMag = el('span', 'detail-panel__magnitude', '');
  detailPlace = el('span', 'detail-panel__place', '');
  header.appendChild(detailMag);
  header.appendChild(detailPlace);
  detailPanel.appendChild(header);

  // Rows
  const rows: Array<{ i18nKey: string; ref: 'time' | 'coords' | 'depth' | 'fault' | 'source' | 'jma' }> = [
    { i18nKey: 'detail.time', ref: 'time' },
    { i18nKey: 'detail.location', ref: 'coords' },
    { i18nKey: 'detail.depth', ref: 'depth' },
    { i18nKey: 'detail.faultType', ref: 'fault' },
    { i18nKey: 'detail.intensitySource', ref: 'source' },
    { i18nKey: 'detail.jmaIntensity', ref: 'jma' },
  ];

  for (const { i18nKey, ref } of rows) {
    const row = el('div', 'detail-panel__row');
    const keyEl = el('span', 'detail-panel__key', t(i18nKey));
    detailKeyEls[ref] = keyEl;
    row.appendChild(keyEl);

    if (ref === 'jma') {
      detailJmaBadge = el('span', 'detail-panel__jma-badge');
      row.appendChild(detailJmaBadge);
    } else {
      const val = el('span', 'detail-panel__val', '--');
      row.appendChild(val);
      if (ref === 'time') detailTime = val;
      else if (ref === 'coords') detailCoords = val;
      else if (ref === 'depth') detailDepth = val;
      else if (ref === 'fault') detailFault = val;
      else if (ref === 'source') detailSource = val;
    }

    detailPanel.appendChild(row);
  }

  // Cinematic button (visible only for M5+ events)
  cinematicBtn = el('button', 'cinematic-btn cinematic-btn--hidden');
  cinematicBtn.textContent = t('sidebar.cinematic');
  cinematicBtn.addEventListener('click', () => {
    store.set('viewPreset', 'cinematic');
  });
  detailPanel.appendChild(cinematicBtn);

  return detailPanel;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function computeJmaForEvent(event: EarthquakeEvent): JmaClass {
  const result = computeGmpe({
    Mw: event.magnitude,
    depth_km: event.depth_km,
    distance_km: Math.max(event.depth_km, 1), // hypocentral distance at epicenter — clamp ≥1 to avoid /0
    faultType: event.faultType,
  });
  return result.jmaClass;
}

// ---- Public API ----

export function initSidebar(container: HTMLElement): void {
  sidebarEl = el('div', 'sidebar');

  sidebarTitleEl = el('div', 'sidebar__title', t('sidebar.title'));
  sidebarEl.appendChild(sidebarTitleEl);
  sidebarEl.appendChild(buildStatCards());
  sidebarEl.appendChild(buildHistogram());
  sidebarEl.appendChild(buildDetailPanel());

  container.appendChild(sidebarEl);

  // Mobile hamburger toggle
  const toggleBtn = el('button', 'sidebar-toggle');
  toggleBtn.textContent = '\u2630'; // hamburger icon ☰
  toggleBtn.setAttribute('aria-label', 'Toggle sidebar');
  toggleBtn.addEventListener('click', () => {
    sidebarEl.classList.toggle('sidebar--open');
  });
  container.appendChild(toggleBtn);

  // Subscribe to locale changes to update all labels dynamically
  unsubLocale = onLocaleChange(() => {
    sidebarTitleEl.textContent = t('sidebar.title');
    totalQuakesLabel.textContent = t('sidebar.totalQuakes');
    maxMagLabel.textContent = t('sidebar.maxMag');
    avgMagLabel.textContent = t('sidebar.avgMag');
    latestLabel.textContent = t('sidebar.latest');
    histogramTitleEl.textContent = t('sidebar.magDistribution');
    cinematicBtn.textContent = t('sidebar.cinematic');
    // Detail panel key labels
    if (detailKeyEls['time']) detailKeyEls['time'].textContent = t('detail.time');
    if (detailKeyEls['coords']) detailKeyEls['coords'].textContent = t('detail.location');
    if (detailKeyEls['depth']) detailKeyEls['depth'].textContent = t('detail.depth');
    if (detailKeyEls['fault']) detailKeyEls['fault'].textContent = t('detail.faultType');
    if (detailKeyEls['source']) detailKeyEls['source'].textContent = t('detail.intensitySource');
    if (detailKeyEls['jma']) detailKeyEls['jma'].textContent = t('detail.jmaIntensity');
  });
}

export function disposeSidebar(): void {
  unsubLocale?.();
  unsubLocale = null;
}

export function updateSidebar(
  events: EarthquakeEvent[],
  selectedEvent?: EarthquakeEvent | null,
  intensitySource: IntensitySource = 'none',
): void {
  // -- Stats --
  totalQuakesVal.textContent = events.length.toLocaleString();

  if (events.length > 0) {
    const mags = events.map((e) => e.magnitude);
    const max = Math.max(...mags);
    const avg = mags.reduce((a, b) => a + b, 0) / mags.length;

    maxMagVal.textContent = `M${max.toFixed(1)}`;
    avgMagVal.textContent = `M${avg.toFixed(1)}`;

    // Latest event by time
    let latest = events[0];
    for (let i = 1; i < events.length; i++) {
      if (events[i].time > latest.time) latest = events[i];
    }
    latestTimeVal.textContent = formatTime(latest.time);
  } else {
    maxMagVal.textContent = '--';
    avgMagVal.textContent = '--';
    latestTimeVal.textContent = '--';
  }

  // -- Histogram --
  const counts: Record<string, number> = {};
  for (const b of HISTOGRAM_BUCKETS) counts[b.key] = 0;

  for (const ev of events) {
    for (const b of HISTOGRAM_BUCKETS) {
      if (ev.magnitude >= b.min && ev.magnitude < b.max) {
        counts[b.key]++;
        break;
      }
    }
  }

  const maxCount = Math.max(1, ...Object.values(counts));

  for (const b of HISTOGRAM_BUCKETS) {
    const { bar, count } = histogramBars[b.key];
    const pct = (counts[b.key] / maxCount) * 100;
    bar.style.width = `${pct}%`;
    count.textContent = String(counts[b.key]);
  }

  // -- Detail panel --
  if (selectedEvent) {
    detailPanel.classList.remove('detail-panel--hidden');
    detailMag.textContent = `M ${selectedEvent.magnitude.toFixed(1)}`;
    detailPlace.textContent = `\u2014 ${selectedEvent.place}`;
    detailTime.textContent = formatTime(selectedEvent.time);
    detailCoords.textContent =
      `${Math.abs(selectedEvent.lat).toFixed(3)}\u00b0${selectedEvent.lat >= 0 ? 'N' : 'S'} ` +
      `${Math.abs(selectedEvent.lng).toFixed(3)}\u00b0${selectedEvent.lng >= 0 ? 'E' : 'W'}`;
    detailDepth.textContent = `${selectedEvent.depth_km} km`;
    detailFault.textContent = selectedEvent.faultType;
    detailSource.textContent = intensitySource === 'shakemap'
      ? t('detail.source.shakemap')
      : intensitySource === 'gmpe'
        ? t('detail.source.gmpe')
        : '--';

    const jma = computeJmaForEvent(selectedEvent);
    detailJmaBadge.textContent = jma;
    detailJmaBadge.style.backgroundColor = JMA_COLORS[jma];
    // Dark text for bright backgrounds
    const brightClasses: JmaClass[] = ['3', '4', '5-', '5+'];
    detailJmaBadge.style.color = brightClasses.includes(jma) ? '#000' : '#fff';

    // Show cinematic button only for M5+ events
    if (selectedEvent.magnitude >= 5.0) {
      cinematicBtn.classList.remove('cinematic-btn--hidden');
    } else {
      cinematicBtn.classList.add('cinematic-btn--hidden');
    }
  } else {
    detailPanel.classList.add('detail-panel--hidden');
  }
}
