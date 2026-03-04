/**
 * Live Feed — Event list for the "Live" tab pane.
 *
 * Renders real-time earthquake events as a scrollable list.
 * Mounts into the left panel's "live" pane via getTabPane('live').
 */

import type { EarthquakeEvent, IntensitySource, JmaClass } from '../types';
import { computeGmpe } from '../engine/gmpe';
import { store } from '../store/appState';
import { t, onLocaleChange } from '../i18n/index';
import { depthToColor } from './depthScale';
import { getPlaceText } from '../utils/earthquakeUtils';
import { MMI_COLORS } from '../utils/colorScale';
import { getTabPane } from './leftPanel';
import { getLastUpdatedAt } from '../data/usgsRealtime';

// ── DOM refs ──

let feedEl: HTMLElement;
let headerTitleEl: HTMLElement;
let headerCountEl: HTMLElement;
let alertBadgeEl: HTMLElement;
let eventListEl: HTMLElement;

// Detail panel elements
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
let cinematicBtn: HTMLElement;

let statusBarEl: HTMLElement;
let unsubLocale: (() => void) | null = null;
let unsubSelected: (() => void) | null = null;
let unsubNetworkError: (() => void) | null = null;
let statusTimerId: ReturnType<typeof setInterval> | null = null;
let currentEvents: EarthquakeEvent[] = [];
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
    const item = target.closest('.feed-item') as HTMLElement | null;
    if (!item) return;
    const eventId = item.dataset.eventId;
    if (!eventId) return;
    const event = currentEvents.find(ev => ev.id === eventId);
    if (event) store.set('selectedEvent', event);
  });

  return eventListEl;
}

function renderEventItem(event: EarthquakeEvent, isActive: boolean): HTMLElement {
  const item = el('div', `feed-item${isActive ? ' feed-item--active' : ''}`);
  item.dataset.eventId = event.id;
  if (isActive) item.style.borderLeftColor = depthToColor(event.depth_km);

  const top = el('div', 'feed-item__top');
  const left = el('div', 'feed-item__left');
  const mag = el('span', `feed-item__mag ${magColorClass(event.magnitude)}`);
  mag.textContent = event.magnitude.toFixed(1);
  left.appendChild(mag);
  left.appendChild(el('span', 'feed-item__location', getPlaceText(event.place)));
  top.appendChild(left);
  top.appendChild(el('span', 'feed-item__time', formatTimeShort(event.time)));
  item.appendChild(top);

  const meta = el('div', 'feed-item__meta');
  meta.appendChild(el('span', 'feed-item__depth', `${event.depth_km}km`));
  const dot = el('div', 'feed-item__depth-dot');
  dot.style.background = depthToColor(event.depth_km);
  meta.appendChild(dot);
  const coords = el('span', 'feed-item__coords');
  const latDir = event.lat >= 0 ? 'N' : 'S';
  const lngDir = event.lng >= 0 ? 'E' : 'W';
  coords.textContent = `${Math.abs(event.lat).toFixed(2)}\u00B0${latDir} ${Math.abs(event.lng).toFixed(2)}\u00B0${lngDir}`;
  meta.appendChild(coords);

  const sourceTag = getListSourceTag(event.magnitude);
  if (sourceTag) {
    meta.appendChild(el('span', `source-tag ${sourceTag.className}`, sourceTag.label));
  }
  item.appendChild(meta);

  return item;
}

function updateEventItem(item: HTMLElement, event: EarthquakeEvent, isActive: boolean): void {
  item.className = `feed-item${isActive ? ' feed-item--active' : ''}`;
  item.style.borderLeftColor = isActive ? depthToColor(event.depth_km) : '';
  const magEl = item.querySelector('.feed-item__mag');
  if (magEl) {
    magEl.className = `feed-item__mag ${magColorClass(event.magnitude)}`;
    magEl.textContent = event.magnitude.toFixed(1);
  }
  const locEl = item.querySelector('.feed-item__location');
  if (locEl) locEl.textContent = getPlaceText(event.place);
  const timeEl = item.querySelector('.feed-item__time');
  if (timeEl) timeEl.textContent = formatTimeShort(event.time);
  const depthEl = item.querySelector('.feed-item__depth');
  if (depthEl) depthEl.textContent = `${event.depth_km}km`;
  const dotEl = item.querySelector('.feed-item__depth-dot') as HTMLElement | null;
  if (dotEl) dotEl.style.background = depthToColor(event.depth_km);
}

function renderEvents(events: EarthquakeEvent[], selectedId: string | null): void {
  if (events.length > 0) eventListEl.querySelector('.empty-state')?.remove();

  const existing = new Map<string, HTMLElement>();
  for (const child of Array.from(eventListEl.children)) {
    const id = (child as HTMLElement).dataset.eventId;
    if (id) existing.set(id, child as HTMLElement);
  }

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const isActive = ev.id === selectedId;
    let item = existing.get(ev.id);

    if (item) {
      existing.delete(ev.id);
      updateEventItem(item, ev, isActive);
    } else {
      item = renderEventItem(ev, isActive);
    }

    if (eventListEl.children[i] !== item) {
      eventListEl.insertBefore(item, eventListEl.children[i] || null);
    }
  }

  for (const stale of existing.values()) stale.remove();

  if (events.length === 0 && !eventListEl.querySelector('.empty-state')) {
    const msg = hasReceivedData ? t('sidebar.empty') : t('sidebar.loading');
    eventListEl.appendChild(el('div', 'empty-state', msg));
  }
}

// ── Detail Panel ──

function computeJmaForEvent(event: EarthquakeEvent): JmaClass {
  return computeGmpe({
    Mw: event.magnitude,
    depth_km: event.depth_km,
    distance_km: Math.max(event.depth_km, 1),
    faultType: event.faultType,
  }).jmaClass;
}

function jmaToMmi(jmaClass: JmaClass): number {
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

function buildDetailPanel(): HTMLElement {
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

  // Action buttons
  const actions = el('div', 'detail-actions');
  crossSectionBtn = el('button', 'detail-action-btn', t('detail.crossSection'));
  crossSectionBtn.addEventListener('click', () => store.set('viewPreset', 'crossSection'));
  actions.appendChild(crossSectionBtn);

  cinematicBtn = el('button', 'detail-action-btn');
  cinematicBtn.textContent = `\u25B6 ${t('sidebar.cinematic')}`;
  cinematicBtn.addEventListener('click', () => store.set('viewPreset', 'cinematic'));
  actions.appendChild(cinematicBtn);

  detailPanel.appendChild(actions);
  return detailPanel;
}

function buildCreditFooter(): HTMLElement {
  const credit = el('div', 'feed__credit');
  credit.appendChild(el('span', undefined, '\u00A9 \u56FD\u571F\u5730\u7406\u9662 \u00B7 USGS'));
  credit.appendChild(el('span', undefined, 'v0.4.0'));
  return credit;
}

// ── Public API ──

export function initLiveFeed(): void {
  const pane = getTabPane('live');
  if (!pane) return;

  feedEl = el('div', 'live-feed');
  feedEl.appendChild(buildHeader());
  feedEl.appendChild(buildStatusBar());
  feedEl.appendChild(buildEventList());
  feedEl.appendChild(buildDetailPanel());
  feedEl.appendChild(buildCreditFooter());
  pane.appendChild(feedEl);

  // Subscribe to selected event changes for detail panel
  unsubSelected = store.subscribe('selectedEvent', () => {
    const selected = store.get('selectedEvent');
    const intensitySource = store.get('intensitySource');
    refreshDetailPanel(selected, intensitySource);
    // Re-render list to update active state
    const displayEvents = [...currentEvents].sort((a, b) => b.time - a.time);
    renderEvents(displayEvents, selected?.id ?? null);
  });

  unsubLocale = onLocaleChange(() => {
    headerTitleEl.textContent = t('sidebar.title');
    alertBadgeEl.textContent = t('sidebar.alert');
    crossSectionBtn.textContent = t('detail.crossSection');
    cinematicBtn.textContent = `\u25B6 ${t('sidebar.cinematic')}`;
    mmiTitleEl.textContent = t('sidebar.mmiTitle');
    refreshStatusBar();
    if (currentEvents.length > 0) {
      headerCountEl.textContent = formatEventCount(currentEvents.length);
      const selected = store.get('selectedEvent');
      const displayEvents = [...currentEvents].sort((a, b) => b.time - a.time);
      renderEvents(displayEvents, selected?.id ?? null);
    }
  });

  // Update status bar on network error changes
  unsubNetworkError = store.subscribe('networkError', () => {
    refreshStatusBar();
  });

  // Refresh "Updated X min ago" periodically
  statusTimerId = setInterval(refreshStatusBar, 30_000);
}

export function updateLiveFeed(
  events: EarthquakeEvent[],
  selectedEvent?: EarthquakeEvent | null,
  intensitySource: IntensitySource = 'none',
): void {
  currentEvents = events;
  hasReceivedData = true;

  headerCountEl.textContent = formatEventCount(events.length);
  const hasM5 = events.some(e => e.magnitude >= 5.0);
  alertBadgeEl.style.display = hasM5 ? 'block' : 'none';

  refreshStatusBar();

  const displayEvents = [...events].sort((a, b) => b.time - a.time);
  renderEvents(displayEvents, selectedEvent?.id ?? null);

  refreshDetailPanel(selectedEvent ?? null, intensitySource);
}

function refreshDetailPanel(
  selectedEvent: EarthquakeEvent | null,
  intensitySource: IntensitySource,
): void {
  if (selectedEvent) {
    detailPanel.classList.remove('detail-panel--hidden');

    detailMagEl.textContent = `M${selectedEvent.magnitude.toFixed(1)}`;
    detailPlaceEl.textContent = getPlaceText(selectedEvent.place);

    detailMetaEl.textContent = '';
    const depthSpan = el('span');
    depthSpan.append(document.createTextNode(`${t('detail.depth')} `));
    const depthValue = el('span');
    depthValue.style.color = 'var(--text-secondary)';
    depthValue.textContent = `${selectedEvent.depth_km}km`;
    depthSpan.append(depthValue);
    detailMetaEl.appendChild(depthSpan);
    detailMetaEl.appendChild(el('span', undefined,
      `${Math.abs(selectedEvent.lat).toFixed(3)}\u00B0${selectedEvent.lat >= 0 ? 'N' : 'S'}`));
    detailMetaEl.appendChild(el('span', undefined,
      `${Math.abs(selectedEvent.lng).toFixed(3)}\u00B0${selectedEvent.lng >= 0 ? 'E' : 'W'}`));

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

    crossSectionBtn.style.display = selectedEvent.magnitude >= 4.0 ? 'block' : 'none';
    cinematicBtn.style.display = selectedEvent.magnitude >= 5.0 ? 'block' : 'none';
  } else {
    detailPanel.classList.add('detail-panel--hidden');
  }
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
  hasReceivedData = false;
}
