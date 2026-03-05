/**
 * Live Feed — Event list for the "Live" tab pane.
 *
 * Renders real-time earthquake events as a scrollable list.
 * Mounts into the left panel's "live" pane via getTabPane('live'),
 * or into an explicit container (mobile sheet).
 */

import type { EarthquakeEvent, IntensitySource } from '../types';
import { store } from '../store/appState';
import { t, onLocaleChange, getLocale } from '../i18n/index';
import { depthToColor } from '../utils/colorScale';
import { clusterEvents, getDisplayEvents, type ClusteredEvent } from '../utils/aftershockCluster';
import { getTabPane } from './leftPanel';
import { getLastUpdatedAt } from '../data/usgsRealtime';
import { buildLiveFeedSummary, deriveTsunamiAssessmentFromEvent, formatRelativeTime as formatPresentationRelativeTime } from './presentation';

// ── DOM refs ──

let feedEl: HTMLElement;
let headerTitleEl: HTMLElement;
let headerCountEl: HTMLElement;
let alertBadgeEl: HTMLElement;
let eventListEl: HTMLElement;

let statusBarEl: HTMLElement;
let unsubLocale: (() => void) | null = null;
let unsubSelected: (() => void) | null = null;
let unsubNetworkError: (() => void) | null = null;
let statusTimerId: ReturnType<typeof setInterval> | null = null;
let currentEvents: EarthquakeEvent[] = [];
let currentClusters: Map<string, ClusteredEvent> = new Map();
let expandedClusters: Set<string> = new Set();
let hasReceivedData = false;

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

function formatTimeShort(ts: number): string {
  const d = new Date(ts);
  const h = String((d.getUTCHours() + 9) % 24).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function formatRelativeTime(ts: number): string {
  return formatPresentationRelativeTime(ts, getLocale());
}

function magColorClass(mag: number): string {
  if (mag >= 6) return 'feed-item__mag--high';
  if (mag >= 5) return 'feed-item__mag--mid';
  return 'feed-item__mag--low';
}

function getListSourceTag(mag: number): { className: string; label: string } | null {
  if (mag >= 5.0) return { className: 'source-tag--shakemap', label: t('sidebar.source.shakemap') };
  if (mag >= 4.0) return { className: 'source-tag--gmpe', label: t('sidebar.source.gmpe') };
  return null;
}

// ── Build UI ──

function formatLastUpdated(): string {
  const ts = getLastUpdatedAt();
  if (ts === 0) return t('sidebar.loading');
  const ago = Math.floor((Date.now() - ts) / 60_000);
  if (ago < 1) return `${t('sidebar.lastUpdated')} ${t('sidebar.justNow')}`;
  return `${t('sidebar.lastUpdated')} ${ago}${t('sidebar.agoMin')}`;
}

function formatEventCount(count: number): string {
  const suffix = count === 1 ? t('sidebar.eventCount.one') : t('sidebar.eventCount');
  return `${count} ${suffix}`;
}

function buildHeader(): HTMLElement {
  const header = el('div', 'feed__header');

  const left = el('div', 'feed__header-left');
  headerTitleEl = el('div', 'feed__header-title', t('sidebar.title'));
  left.appendChild(headerTitleEl);
  headerCountEl = el('div', 'feed__header-count');
  left.appendChild(headerCountEl);
  header.appendChild(left);

  alertBadgeEl = el('div', 'feed__alert-badge', t('sidebar.alert'));
  alertBadgeEl.style.display = 'none';
  header.appendChild(alertBadgeEl);

  return header;
}

function buildStatusBar(): HTMLElement {
  statusBarEl = el('div', 'feed__status');
  statusBarEl.textContent = t('sidebar.loading');
  return statusBarEl;
}

function refreshStatusBar(): void {
  const err = store.get('networkError');
  if (err) {
    statusBarEl.textContent = t('sidebar.offline');
    statusBarEl.className = 'feed__status feed__status--error';
  } else {
    statusBarEl.textContent = formatLastUpdated();
    statusBarEl.className = 'feed__status';
  }
}

function buildEventList(): HTMLElement {
  eventListEl = el('div', 'feed__event-list');

  eventListEl.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    // Aftershock toggle button click
    const toggleBtn = target.closest('.feed-item__aftershock-toggle') as HTMLElement | null;
    if (toggleBtn) {
      const mainshockId = toggleBtn.dataset.mainshockId;
      if (mainshockId) {
        if (expandedClusters.has(mainshockId)) {
          expandedClusters.delete(mainshockId);
        } else {
          expandedClusters.add(mainshockId);
        }
        // Re-render to show/hide aftershocks
        const selected = store.get('selectedEvent');
        const displayEvents = getDisplayEvents(currentEvents, currentClusters);
        renderEvents(displayEvents, selected?.id ?? null);
      }
      return;
    }

    const item = target.closest('.feed-item') as HTMLElement | null;
    if (!item) return;
    const eventId = item.dataset.eventId;
    if (!eventId) return;
    const event = currentEvents.find(ev => ev.id === eventId);
    if (event) store.set('selectedEvent', event);
  });

  return eventListEl;
}

function renderEventItem(event: EarthquakeEvent, isActive: boolean, cluster?: ClusteredEvent): HTMLElement {
  const isAfterShock = cluster?.role === 'aftershock';
  const className = `feed-item${isActive ? ' feed-item--active' : ''}${isAfterShock ? ' feed-item--aftershock' : ''}`;
  const item = el('div', className);
  item.dataset.eventId = event.id;
  if (isActive) item.style.borderLeftColor = depthToColor(event.depth_km);

  const selected = store.get('selectedEvent');
  const ai = store.get('ai');
  const tsunamiAssessment = selected?.id === event.id
    ? store.get('tsunamiAssessment')
    : (event.tsunami || event.magnitude >= 5.0 ? deriveTsunamiAssessmentFromEvent(event) : null);
  const summary = buildLiveFeedSummary({
    event,
    analysis: selected?.id === event.id ? ai.currentAnalysis : null,
    tsunamiAssessment,
    locale: getLocale(),
    now: Date.now(),
  });

  const top = el('div', 'feed-item__top');
  const left = el('div', 'feed-item__left');
  const mag = el('span', `feed-item__mag ${magColorClass(event.magnitude)}`);
  mag.textContent = event.magnitude.toFixed(1);
  left.appendChild(mag);
  left.appendChild(el('span', 'feed-item__location', summary.place));
  top.appendChild(left);
  const timeWrap = el('div', 'feed-item__time-wrap');
  timeWrap.appendChild(el('span', 'feed-item__relative', summary.relativeTime));
  timeWrap.appendChild(el('span', 'feed-item__time', formatTimeShort(event.time)));
  top.appendChild(timeWrap);
  item.appendChild(top);

  item.appendChild(el('div', 'feed-item__meaning', summary.meaning));

  const meta = el('div', 'feed-item__meta');
  meta.appendChild(el('span', 'feed-item__depth', `${Math.round(event.depth_km)}km`));

  const sourceTag = getListSourceTag(event.magnitude);
  if (sourceTag) {
    meta.appendChild(el('span', `source-tag ${sourceTag.className}`, sourceTag.label));
  }
  if (summary.tsunamiLabel) {
    meta.appendChild(el(
      'span',
      summary.tsunamiLabel === t('tsunami.label.high') || summary.tsunamiLabel === t('tsunami.label.moderate')
        ? 'feed-item__tsunami feed-item__tsunami--warn'
        : 'feed-item__tsunami',
      summary.tsunamiLabel,
    ));
  }

  // Aftershock badge for mainshock events
  if (cluster && cluster.role === 'mainshock' && cluster.aftershockCount > 0) {
    const expanded = expandedClusters.has(event.id);
    const badge = el('button', 'feed-item__aftershock-toggle');
    badge.dataset.mainshockId = event.id;
    badge.textContent = `${expanded ? '▾' : '▸'} ${cluster.aftershockCount}`;
    badge.title = `${cluster.aftershockCount} aftershocks`;
    meta.appendChild(badge);
  }
  item.appendChild(meta);

  return item;
}


/** Toggle active class on existing items without full re-render. */
function updateActiveState(selectedId: string | null): void {
  const items = eventListEl.querySelectorAll('.feed-item');
  for (const item of items) {
    const el = item as HTMLElement;
    const id = el.dataset.eventId;
    const isActive = id === selectedId;
    el.classList.toggle('feed-item--active', isActive);
    if (isActive && id) {
      const ev = currentEvents.find(e => e.id === id);
      if (ev) el.style.borderLeftColor = depthToColor(ev.depth_km);
    } else {
      el.style.borderLeftColor = 'transparent';
    }
  }
}

function renderEvents(events: EarthquakeEvent[], selectedId: string | null): void {
  // Full re-render for simplicity with clustering
  eventListEl.innerHTML = '';

  if (events.length === 0) {
    const msg = hasReceivedData ? t('sidebar.empty') : t('sidebar.loading');
    eventListEl.appendChild(el('div', 'empty-state', msg));
    return;
  }

  for (const ev of events) {
    const cluster = currentClusters.get(ev.id);
    const isActive = ev.id === selectedId;
    const item = renderEventItem(ev, isActive, cluster);
    eventListEl.appendChild(item);

    // If this is a mainshock and expanded, show aftershocks
    if (cluster && cluster.role === 'mainshock' && expandedClusters.has(ev.id)) {
      for (const as of cluster.aftershocks) {
        const asCluster = currentClusters.get(as.id);
        const asActive = as.id === selectedId;
        const asItem = renderEventItem(as, asActive, asCluster);
        eventListEl.appendChild(asItem);
      }
    }
  }
}

function buildCreditFooter(): HTMLElement {
  const credit = el('div', 'feed__credit');
  credit.appendChild(el('span', undefined, '\u00A9 \u56FD\u571F\u5730\u7406\u9662 \u00B7 USGS'));
  credit.appendChild(el('span', undefined, 'v0.4.0'));
  return credit;
}

// ── Public API ──

/**
 * Initialize the live feed. If container is provided, mounts into it directly.
 * Otherwise falls back to getTabPane('live') for the desktop left panel.
 */
export function initLiveFeed(container?: HTMLElement): void {
  const pane = container || getTabPane('live');
  if (!pane) return;

  feedEl = el('div', 'live-feed');
  feedEl.appendChild(buildHeader());
  feedEl.appendChild(buildStatusBar());
  feedEl.appendChild(buildEventList());
  feedEl.appendChild(buildCreditFooter());
  pane.appendChild(feedEl);

  // Subscribe to selected event changes for active state highlight
  unsubSelected = store.subscribe('selectedEvent', () => {
    const selected = store.get('selectedEvent');
    updateActiveState(selected?.id ?? null);
  });

  unsubLocale = onLocaleChange(() => {
    headerTitleEl.textContent = t('sidebar.title');
    alertBadgeEl.textContent = t('sidebar.alert');
    refreshStatusBar();
    if (currentEvents.length > 0) {
      headerCountEl.textContent = formatEventCount(currentEvents.length);
      const selected = store.get('selectedEvent');
      const displayEvents = getDisplayEvents(currentEvents, currentClusters);
      renderEvents(displayEvents, selected?.id ?? null);
    }
  });

  // Update status bar on network error changes
  unsubNetworkError = store.subscribe('networkError', () => {
    refreshStatusBar();
  });

  // Refresh "Updated X min ago" and card relative times periodically
  statusTimerId = setInterval(() => {
    refreshStatusBar();
    // Update all relative time labels in-place
    const items = eventListEl?.querySelectorAll('.feed-item');
    if (!items) return;
    for (const item of items) {
      const id = (item as HTMLElement).dataset.eventId;
      const ev = id ? currentEvents.find(e => e.id === id) : null;
      if (!ev) continue;
      const relEl = item.querySelector('.feed-item__relative');
      if (relEl) relEl.textContent = formatRelativeTime(ev.time);
    }
  }, 30_000);
}

export function updateLiveFeed(
  events: EarthquakeEvent[],
  selectedEvent?: EarthquakeEvent | null,
  _intensitySource: IntensitySource = 'none',
): void {
  currentEvents = events;
  hasReceivedData = true;
  currentClusters = clusterEvents(events);

  // Guard: DOM not yet created (orchestrator may fire before initLiveFeed)
  if (!headerCountEl) return;

  headerCountEl.textContent = formatEventCount(events.length);
  const hasM5 = events.some(e => e.magnitude >= 5.0);
  alertBadgeEl.style.display = hasM5 ? 'block' : 'none';

  refreshStatusBar();

  const displayEvents = getDisplayEvents(events, currentClusters);
  renderEvents(displayEvents, selectedEvent?.id ?? null);
}

/** Expose current events for other modules (e.g. mobileSheet peek). */
export function getLiveFeedEvents(): EarthquakeEvent[] {
  return currentEvents;
}

export function disposeLiveFeed(): void {
  unsubLocale?.();
  unsubLocale = null;
  unsubSelected?.();
  unsubSelected = null;
  unsubNetworkError?.();
  unsubNetworkError = null;
  if (statusTimerId !== null) {
    clearInterval(statusTimerId);
    statusTimerId = null;
  }
  currentEvents = [];
  currentClusters = new Map();
  expandedClusters = new Set();
  hasReceivedData = false;
}
