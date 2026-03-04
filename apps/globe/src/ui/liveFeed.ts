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
import { depthToColor } from '../utils/colorScale';
import { getJapanPlaceName } from '../utils/japanGeo';
import { clusterEvents, getDisplayEvents, type ClusteredEvent } from '../utils/aftershockCluster';
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
let aiSectionEl: HTMLElement;
let aiOneLinerEl: HTMLElement;
let aiWhyEl: HTMLElement;
let aiDisclaimerEl: HTMLElement;
let aiSkeletonEl: HTMLElement;

let statusBarEl: HTMLElement;
let unsubLocale: (() => void) | null = null;
let unsubSelected: (() => void) | null = null;
let unsubNetworkError: (() => void) | null = null;
let unsubAi: (() => void) | null = null;
let statusTimerId: ReturnType<typeof setInterval> | null = null;
let currentEvents: EarthquakeEvent[] = [];
let currentClusters: Map<string, ClusteredEvent> = new Map();
let expandedClusters: Set<string> = new Set();
let hasReceivedData = false;

/** Get Japanese place name for an event. */
function eventPlaceName(event: EarthquakeEvent): string {
  return getJapanPlaceName(event.lat, event.lng).ja;
}

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

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
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

  const top = el('div', 'feed-item__top');
  const left = el('div', 'feed-item__left');
  const mag = el('span', `feed-item__mag ${magColorClass(event.magnitude)}`);
  mag.textContent = event.magnitude.toFixed(1);
  left.appendChild(mag);
  left.appendChild(el('span', 'feed-item__location', eventPlaceName(event)));
  top.appendChild(left);
  const timeWrap = el('div', 'feed-item__time-wrap');
  timeWrap.appendChild(el('span', 'feed-item__relative', formatRelativeTime(event.time)));
  timeWrap.appendChild(el('span', 'feed-item__time', formatTimeShort(event.time)));
  top.appendChild(timeWrap);
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
  if (event.tsunami) {
    meta.appendChild(el('span', 'feed-item__tsunami', '津波'));
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

  // AI Analysis Section
  aiSectionEl = el('div', 'detail-ai');
  aiSectionEl.style.display = 'none';

  aiSkeletonEl = el('div', 'detail-ai__skeleton');
  aiSkeletonEl.innerHTML = '<div class="skeleton-line"></div><div class="skeleton-line skeleton-line--short"></div>';
  aiSectionEl.appendChild(aiSkeletonEl);

  aiOneLinerEl = el('div', 'detail-ai__one-liner');
  aiSectionEl.appendChild(aiOneLinerEl);

  aiWhyEl = el('div', 'detail-ai__why');
  aiSectionEl.appendChild(aiWhyEl);

  aiDisclaimerEl = el('div', 'detail-ai__disclaimer', '⚠ AI分析は参考情報です。公式情報は気象庁をご確認ください。');
  aiSectionEl.appendChild(aiDisclaimerEl);

  detailPanel.appendChild(aiSectionEl);

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
    const displayEvents = getDisplayEvents(currentEvents, currentClusters);
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
      const displayEvents = getDisplayEvents(currentEvents, currentClusters);
      renderEvents(displayEvents, selected?.id ?? null);
    }
  });

  // Update status bar on network error changes
  unsubNetworkError = store.subscribe('networkError', () => {
    refreshStatusBar();
  });

  // Update detail panel when AI analysis arrives
  unsubAi = store.subscribe('ai', () => {
    const selected = store.get('selectedEvent');
    if (selected) {
      const intensitySource = store.get('intensitySource');
      refreshDetailPanel(selected, intensitySource);
    }
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
  intensitySource: IntensitySource = 'none',
): void {
  currentEvents = events;
  hasReceivedData = true;
  currentClusters = clusterEvents(events);

  headerCountEl.textContent = formatEventCount(events.length);
  const hasM5 = events.some(e => e.magnitude >= 5.0);
  alertBadgeEl.style.display = hasM5 ? 'block' : 'none';

  refreshStatusBar();

  const displayEvents = getDisplayEvents(events, currentClusters);
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
    detailPlaceEl.textContent = eventPlaceName(selectedEvent);

    detailMetaEl.textContent = '';
    detailMetaEl.appendChild(el('span', undefined, formatRelativeTime(selectedEvent.time)));
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
    if (selectedEvent.tsunami) {
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

    // AI Analysis rendering
    const aiState = store.get('ai');
    if (aiState.analysisLoading) {
      aiSectionEl.style.display = 'block';
      aiSkeletonEl.style.display = 'block';
      aiOneLinerEl.style.display = 'none';
      aiWhyEl.style.display = 'none';
      aiDisclaimerEl.style.display = 'none';
    } else if (aiState.currentAnalysis) {
      const a = aiState.currentAnalysis as any;
      aiSectionEl.style.display = 'block';
      aiSkeletonEl.style.display = 'none';

      const oneLiner = a.dashboard?.one_liner?.ja || a.dashboard?.one_liner?.en || '';
      if (oneLiner) {
        aiOneLinerEl.textContent = oneLiner;
        aiOneLinerEl.style.display = 'block';
      } else {
        aiOneLinerEl.style.display = 'none';
      }

      const why = a.public?.why?.ja || a.public?.why?.en || '';
      if (why) {
        aiWhyEl.textContent = why;
        aiWhyEl.style.display = 'block';
      } else {
        aiWhyEl.style.display = 'none';
      }

      aiDisclaimerEl.style.display = 'block';
    } else {
      aiSectionEl.style.display = 'none';
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
  unsubAi?.();
  unsubAi = null;
  if (statusTimerId !== null) {
    clearInterval(statusTimerId);
    statusTimerId = null;
  }
  currentEvents = [];
  hasReceivedData = false;
}
