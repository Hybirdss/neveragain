/**
 * Namazue — Sidebar Component (Reference-quality design)
 *
 * Event list with rich items, refined detail panel with MMI bar,
 * and credit footer. Inspired by namazue-ui.jsx reference.
 * Pure DOM manipulation — no frameworks.
 */

import type { EarthquakeEvent, IntensitySource, JmaClass } from '../types';
import { computeGmpe } from '../engine/gmpe';
import { store } from '../store/appState';
import { t, onLocaleChange } from '../i18n/index';
import { depthToColor } from './depthScale';
import { getPlaceText } from '../utils/earthquakeUtils';

import { MMI_COLORS } from '../utils/colorScale';

// ---- Internal references ----
let sidebarEl: HTMLElement;
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
let crossSectionBtn: HTMLElement;
let cinematicBtn: HTMLElement;

let unsubLocale: (() => void) | null = null;

// Track current events for click handlers
let currentEvents: EarthquakeEvent[] = [];

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
  const h = String((d.getUTCHours() + 9) % 24).padStart(2, '0'); // JST = UTC+9
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function magColorClass(mag: number): string {
  if (mag >= 6) return 'sidebar-item__mag--high';
  if (mag >= 5) return 'sidebar-item__mag--mid';
  return 'sidebar-item__mag--low';
}

function buildHeader(): HTMLElement {
  const header = el('div', 'sidebar__header');

  const left = el('div', 'sidebar__header-left');
  headerTitleEl = el('div', 'sidebar__header-title', t('sidebar.title'));
  left.appendChild(headerTitleEl);
  headerCountEl = el('div', 'sidebar__header-count');
  left.appendChild(headerCountEl);
  header.appendChild(left);

  alertBadgeEl = el('div', 'sidebar__alert-badge', 'M5+ ALERT');
  alertBadgeEl.style.display = 'none';
  header.appendChild(alertBadgeEl);

  return header;
}

function buildEventList(): HTMLElement {
  eventListEl = el('div', 'sidebar__event-list');
  return eventListEl;
}

function renderEventItem(event: EarthquakeEvent, index: number, isActive: boolean): HTMLElement {
  const item = el('div', `sidebar-item${isActive ? ' sidebar-item--active' : ''}`);
  item.dataset.eventId = event.id;
  if (isActive) {
    item.style.borderLeftColor = depthToColor(event.depth_km);
  }
  // Keep list updates stable and non-distracting.
  void index;

  // Top row: mag + location | time
  const top = el('div', 'sidebar-item__top');

  const left = el('div', 'sidebar-item__left');
  const mag = el('span', `sidebar-item__mag ${magColorClass(event.magnitude)}`);
  mag.textContent = event.magnitude.toFixed(1);
  left.appendChild(mag);
  const loc = el('span', 'sidebar-item__location', getPlaceText(event.place));
  left.appendChild(loc);
  top.appendChild(left);

  const time = el('span', 'sidebar-item__time', formatTimeShort(event.time));
  top.appendChild(time);
  item.appendChild(top);

  // Meta row: depth + dot + coords + source tag
  const meta = el('div', 'sidebar-item__meta');

  const depth = el('span', 'sidebar-item__depth', `${event.depth_km}km`);
  meta.appendChild(depth);

  const dot = el('div', 'sidebar-item__depth-dot');
  dot.style.background = depthToColor(event.depth_km);
  meta.appendChild(dot);

  const coords = el('span', 'sidebar-item__coords');
  const latDir = event.lat >= 0 ? 'N' : 'S';
  const lngDir = event.lng >= 0 ? 'E' : 'W';
  coords.textContent = `${Math.abs(event.lat).toFixed(2)}°${latDir} ${Math.abs(event.lng).toFixed(2)}°${lngDir}`;
  meta.appendChild(coords);

  // Source tag (if ShakeMap data available for M5+)
  if (event.magnitude >= 5.0) {
    const tag = el('span', 'source-tag source-tag--shakemap', 'ShakeMap');
    meta.appendChild(tag);
  } else if (event.magnitude >= 4.0) {
    const tag = el('span', 'source-tag source-tag--gmpe', 'GMPE');
    meta.appendChild(tag);
  }

  item.appendChild(meta);

  // Click handler
  item.addEventListener('click', () => {
    store.set('selectedEvent', event);
  });

  return item;
}

function buildDetailPanel(): HTMLElement {
  detailPanel = el('div', 'detail-panel detail-panel--hidden');

  // Header: mag + location on left, source tag on right
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

  detailPanel.appendChild(header);

  // MMI Bar
  mmiBarContainer = el('div');
  mmiBarContainer.style.marginTop = '10px';
  mmiBarContainer.style.display = 'none';

  const mmiTitle = el('div', 'mmi-bar__title', 'MODIFIED MERCALLI INTENSITY');
  mmiBarContainer.appendChild(mmiTitle);

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
  crossSectionBtn.addEventListener('click', () => {
    store.set('viewPreset', 'crossSection');
  });
  actions.appendChild(crossSectionBtn);

  cinematicBtn = el('button', 'detail-action-btn');
  cinematicBtn.textContent = `▶ ${t('sidebar.cinematic')}`;
  cinematicBtn.addEventListener('click', () => {
    store.set('viewPreset', 'cinematic');
  });
  actions.appendChild(cinematicBtn);

  detailPanel.appendChild(actions);

  return detailPanel;
}

function buildCreditFooter(): HTMLElement {
  const credit = el('div', 'sidebar__credit');
  const left = el('span', undefined, '© 国土地理院 · USGS');
  const right = el('span', undefined, 'v0.4.0');
  credit.appendChild(left);
  credit.appendChild(right);
  return credit;
}

function computeJmaForEvent(event: EarthquakeEvent): JmaClass {
  const result = computeGmpe({
    Mw: event.magnitude,
    depth_km: event.depth_km,
    distance_km: Math.max(event.depth_km, 1),
    faultType: event.faultType,
  });
  return result.jmaClass;
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

// ---- Public API ----

export function initSidebar(container: HTMLElement): void {
  sidebarEl = el('div', 'sidebar');

  sidebarEl.appendChild(buildHeader());
  sidebarEl.appendChild(buildEventList());
  sidebarEl.appendChild(buildDetailPanel());
  sidebarEl.appendChild(buildCreditFooter());

  container.appendChild(sidebarEl);

  // Mobile hamburger toggle
  const toggleBtn = el('button', 'sidebar-toggle');
  toggleBtn.textContent = '\u2630';
  toggleBtn.setAttribute('aria-label', 'Toggle sidebar');
  toggleBtn.addEventListener('click', () => {
    sidebarEl.classList.toggle('sidebar--open');
  });
  container.appendChild(toggleBtn);

  // Subscribe to locale changes
  unsubLocale = onLocaleChange(() => {
    headerTitleEl.textContent = t('sidebar.title');
    crossSectionBtn.textContent = t('detail.crossSection');
    cinematicBtn.textContent = `▶ ${t('sidebar.cinematic')}`;
    // Re-render event list with new locale
    if (currentEvents.length > 0) {
      const selected = store.get('selectedEvent');
      renderEvents(currentEvents, selected);
    }
  });
}

export function disposeSidebar(): void {
  unsubLocale?.();
  unsubLocale = null;
}

function renderEvents(events: EarthquakeEvent[], selectedEvent?: EarthquakeEvent | null): void {
  const selectedId = selectedEvent?.id ?? null;

  // Build a map of existing items by event ID
  const existing = new Map<string, HTMLElement>();
  for (const child of Array.from(eventListEl.children)) {
    const id = (child as HTMLElement).dataset.eventId;
    if (id) existing.set(id, child as HTMLElement);
  }

  // Update or create items in order
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const isActive = ev.id === selectedId;
    let item = existing.get(ev.id);

    if (item) {
      // Update existing item in-place
      existing.delete(ev.id);
      updateEventItem(item, ev, isActive);
    } else {
      // Create new item
      item = renderEventItem(ev, i, isActive);
    }

    // Ensure correct order: if item isn't at position i, move it
    if (eventListEl.children[i] !== item) {
      eventListEl.insertBefore(item, eventListEl.children[i] || null);
    }
  }

  // Remove stale items
  for (const stale of existing.values()) stale.remove();

  // Empty state
  if (events.length === 0) {
    if (!eventListEl.querySelector('.empty-state')) {
      const empty = el('div', 'empty-state', 'No earthquakes in current view');
      eventListEl.appendChild(empty);
    }
  }
}

function updateEventItem(item: HTMLElement, event: EarthquakeEvent, isActive: boolean): void {
  item.className = `sidebar-item${isActive ? ' sidebar-item--active' : ''}`;
  item.style.borderLeftColor = isActive ? depthToColor(event.depth_km) : '';
  // Update text content
  const magEl = item.querySelector('.sidebar-item__mag');
  if (magEl) {
    magEl.className = `sidebar-item__mag ${magColorClass(event.magnitude)}`;
    magEl.textContent = event.magnitude.toFixed(1);
  }
  const locEl = item.querySelector('.sidebar-item__location');
  if (locEl) locEl.textContent = getPlaceText(event.place);
  const timeEl = item.querySelector('.sidebar-item__time');
  if (timeEl) timeEl.textContent = formatTimeShort(event.time);
  const depthEl = item.querySelector('.sidebar-item__depth');
  if (depthEl) depthEl.textContent = `${event.depth_km}km`;
  const dotEl = item.querySelector('.sidebar-item__depth-dot') as HTMLElement | null;
  if (dotEl) dotEl.style.background = depthToColor(event.depth_km);
}

export function updateSidebar(
  events: EarthquakeEvent[],
  selectedEvent?: EarthquakeEvent | null,
  intensitySource: IntensitySource = 'none',
): void {
  currentEvents = events;

  // Header count + alert badge
  headerCountEl.textContent = `${events.length} ${t('sidebar.eventCount')}`;
  const hasM5 = events.some(e => e.magnitude >= 5.0);
  alertBadgeEl.style.display = hasM5 ? 'block' : 'none';

  // Render event list
  renderEvents(events, selectedEvent);

  // Detail panel
  if (selectedEvent) {
    detailPanel.classList.remove('detail-panel--hidden');

    detailMagEl.textContent = `M${selectedEvent.magnitude.toFixed(1)}`;
    detailPlaceEl.textContent = getPlaceText(selectedEvent.place);

    // Meta row
    detailMetaEl.innerHTML = '';
    const depthSpan = el('span');
    depthSpan.innerHTML = `${t('detail.depth')} <span style="color:var(--text-secondary)">${selectedEvent.depth_km}km</span>`;
    detailMetaEl.appendChild(depthSpan);
    detailMetaEl.appendChild(el('span', undefined,
      `${Math.abs(selectedEvent.lat).toFixed(3)}°${selectedEvent.lat >= 0 ? 'N' : 'S'}`));
    detailMetaEl.appendChild(el('span', undefined,
      `${Math.abs(selectedEvent.lng).toFixed(3)}°${selectedEvent.lng >= 0 ? 'E' : 'W'}`));

    // Source tag
    if (intensitySource === 'shakemap') {
      detailSourceTag.className = 'source-tag source-tag--shakemap';
      detailSourceTag.textContent = 'USGS ShakeMap';
      detailSourceTag.style.display = 'inline-block';
      detailSourceTag.style.fontSize = 'var(--text-xs)';
    } else if (intensitySource === 'gmpe') {
      detailSourceTag.className = 'source-tag source-tag--gmpe';
      detailSourceTag.textContent = 'Estimated (GMPE)';
      detailSourceTag.style.display = 'inline-block';
      detailSourceTag.style.fontSize = 'var(--text-xs)';
    } else {
      detailSourceTag.style.display = 'none';
    }

    // MMI Bar
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

    // Action buttons visibility
    crossSectionBtn.style.display = selectedEvent.magnitude >= 4.0 ? 'block' : 'none';
    cinematicBtn.style.display = selectedEvent.magnitude >= 5.0 ? 'block' : 'none';
  } else {
    detailPanel.classList.add('detail-panel--hidden');
  }
}
