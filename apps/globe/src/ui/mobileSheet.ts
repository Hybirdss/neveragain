/**
 * Mobile Sheet — Google Maps-style draggable peek sheet.
 *
 * Replaces mobileShell tab bar on mobile. The globe is always visible;
 * the sheet sits at the bottom with 3 snap points (peek / half / full).
 *
 * - Peek (130px): handle + latest earthquake summary
 * - Half (45vh): list or detail card, globe 55% visible
 * - Full (85vh): full list or AI analysis, globe 15% visible
 */

import type { EarthquakeEvent } from '../types';
import { store } from '../store/appState';
import { t, getLocale, onLocaleChange } from '../i18n/index';
import { getJapanPlaceName } from '../utils/japanGeo';
import { getLiveFeedEvents, formatRelativeTime } from './liveFeed';

// ── Constants ──

const PEEK_HEIGHT = 130;
const HALF_RATIO = 0.45;
const FULL_RATIO = 0.85;
const VELOCITY_THRESHOLD = 5; // px/frame
const MIN_HEIGHT = 80;

type SnapPoint = 'peek' | 'half' | 'full';

// ── State ──

let sheetEl: HTMLElement;
let handleEl: HTMLElement;
let peekEl: HTMLElement;
let bodyEl: HTMLElement;
let listEl: HTMLElement;
let detailEl: HTMLElement;

let currentSnap: SnapPoint = 'peek';
let sheetHeight = PEEK_HEIGHT;
let dragging = false;
let startY = 0;
let startHeight = 0;
let lastDelta = 0;
let lastVelocity = 0;

let sheetRevealed = false;
let unsubSelected: (() => void) | null = null;
let unsubTimeline: (() => void) | null = null;
let unsubLocale: (() => void) | null = null;
let peekTimerId: ReturnType<typeof setInterval> | null = null;

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

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getSnapHeight(snap: SnapPoint): number {
  switch (snap) {
    case 'peek': return PEEK_HEIGHT;
    case 'half': return window.innerHeight * HALF_RATIO;
    case 'full': return window.innerHeight * FULL_RATIO;
  }
}

function getMaxHeight(): number {
  return window.innerHeight * FULL_RATIO;
}

// ── Sheet Positioning ──

function setSheetPosition(height: number, animate = true): void {
  const translateY = window.innerHeight - height;
  sheetEl.style.transition = animate
    ? 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)' : 'none';
  sheetEl.style.transform = `translateY(${translateY}px)`;
  sheetHeight = height;
}

function snapTo(snap: SnapPoint): void {
  currentSnap = snap;
  setSheetPosition(getSnapHeight(snap), true);
}

/** Determine snap target based on current position and velocity. */
function velocitySnap(height: number, velocity: number): SnapPoint {
  const peekH = PEEK_HEIGHT;
  const halfH = getSnapHeight('half');
  const fullH = getSnapHeight('full');

  // Fast swipe — jump to next/prev snap
  if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
    if (velocity > 0) {
      // Swiping up
      if (height < halfH) return 'half';
      return 'full';
    } else {
      // Swiping down
      if (height > halfH) return 'half';
      return 'peek';
    }
  }

  // Slow drag — nearest snap
  const dPeek = Math.abs(height - peekH);
  const dHalf = Math.abs(height - halfH);
  const dFull = Math.abs(height - fullH);

  if (dPeek <= dHalf && dPeek <= dFull) return 'peek';
  if (dHalf <= dFull) return 'half';
  return 'full';
}

// ── Gesture Handling ──

function onDragStart(e: PointerEvent): void {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  dragging = true;
  startY = e.clientY;
  startHeight = sheetHeight;
  lastDelta = 0;
  lastVelocity = 0;
  handleEl.setPointerCapture(e.pointerId);
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd);
}

function onDragMove(e: PointerEvent): void {
  if (!dragging) return;
  const deltaY = startY - e.clientY; // up = positive
  const newHeight = clamp(startHeight + deltaY, MIN_HEIGHT, getMaxHeight());
  setSheetPosition(newHeight, false);
  lastVelocity = deltaY - lastDelta;
  lastDelta = deltaY;
}

function onDragEnd(_e: PointerEvent): void {
  if (!dragging) return;
  dragging = false;
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  const target = velocitySnap(sheetHeight, lastVelocity);
  snapTo(target);
}

// Body scroll-to-drag: when at scrollTop 0, pulling down shrinks the sheet
function onBodyTouchStart(e: TouchEvent): void {
  if (bodyEl.scrollTop > 0) return;
  const startTouchY = e.touches[0].clientY;
  const startH = sheetHeight;

  function onMove(ev: TouchEvent) {
    const delta = startTouchY - ev.touches[0].clientY;
    if (delta < 0 && bodyEl.scrollTop === 0) {
      // Pulling down — shrink sheet
      ev.preventDefault();
      const newHeight = clamp(startH + delta, MIN_HEIGHT, getMaxHeight());
      setSheetPosition(newHeight, false);
      lastVelocity = delta - lastDelta;
      lastDelta = delta;
    }
  }

  function onEnd() {
    bodyEl.removeEventListener('touchmove', onMove);
    bodyEl.removeEventListener('touchend', onEnd);
    if (sheetHeight < startH - 20) {
      // User dragged down meaningfully
      const target = velocitySnap(sheetHeight, lastVelocity);
      snapTo(target);
    }
    lastDelta = 0;
    lastVelocity = 0;
  }

  bodyEl.addEventListener('touchmove', onMove, { passive: false });
  bodyEl.addEventListener('touchend', onEnd);
}

// ── Peek Summary ──

function updatePeekSummary(event: EarthquakeEvent | null): void {
  peekEl.innerHTML = '';

  if (event) {
    // ── Detail mode ──
    const headerRow = el('div', 'peek__header');
    headerRow.appendChild(el('span', 'peek__mag', event.magnitude.toFixed(1)));
    headerRow.appendChild(el('span', 'peek__place', eventPlaceName(event)));
    headerRow.appendChild(el('span', 'peek__meta', `${Math.round(event.depth_km)}km`));
    peekEl.appendChild(headerRow);

    const metaRow = el('div', 'peek__meta-row');
    metaRow.appendChild(el('span', 'peek__time', formatRelativeTime(event.time)));
    peekEl.appendChild(metaRow);
  } else {
    // ── List mode ──
    const events = getLiveFeedEvents();
    const latest = events[0];
    if (!latest) return; // Sheet is hidden when no data

    const count = events.length;

    const headerRow = el('div', 'peek__header');
    headerRow.appendChild(el('span', 'peek__title', t('sheet.recentTitle')));
    headerRow.appendChild(el('span', 'peek__chevron', '\u25B2'));
    peekEl.appendChild(headerRow);

    const summaryRow = el('div', 'peek__summary');
    summaryRow.appendChild(el('span', 'peek__mag', latest.magnitude.toFixed(1)));
    summaryRow.appendChild(el('span', 'peek__place', eventPlaceName(latest)));
    summaryRow.appendChild(el('span', 'peek__time', formatRelativeTime(latest.time)));
    summaryRow.appendChild(el('span', 'peek__count', `${count}${t('sheet.countSuffix')}`));
    peekEl.appendChild(summaryRow);
  }
}

// ── Content Mode Switching ──

function showListMode(): void {
  listEl.style.display = 'block';
  detailEl.style.display = 'none';
  updatePeekSummary(null);
}

function showDetailMode(event: EarthquakeEvent): void {
  listEl.style.display = 'none';
  detailEl.style.display = 'block';
  updatePeekSummary(event);
  if (currentSnap === 'peek') snapTo('half');
}

// ── Public API ──

export interface SheetContainers {
  listContainer: HTMLElement;
  detailContainer: HTMLElement;
}

export function initMobileSheet(): SheetContainers {
  // Build DOM structure
  sheetEl = el('div', 'mobile-sheet');

  handleEl = el('div', 'mobile-sheet__handle');
  handleEl.appendChild(el('div', 'mobile-sheet__handle-bar'));
  sheetEl.appendChild(handleEl);

  peekEl = el('div', 'mobile-sheet__peek');
  sheetEl.appendChild(peekEl);

  bodyEl = el('div', 'mobile-sheet__body');

  listEl = el('div', 'mobile-sheet__list');
  detailEl = el('div', 'mobile-sheet__detail');
  detailEl.style.display = 'none';

  bodyEl.appendChild(listEl);
  bodyEl.appendChild(detailEl);
  sheetEl.appendChild(bodyEl);

  document.body.appendChild(sheetEl);

  // Start hidden — reveal when data arrives
  sheetEl.style.transform = 'translateY(100vh)';

  // Gesture handling on handle
  handleEl.addEventListener('pointerdown', onDragStart);

  // Peek tap → expand to half
  peekEl.addEventListener('click', () => {
    if (currentSnap === 'peek') snapTo('half');
  });

  // Body scroll-to-drag
  bodyEl.addEventListener('touchstart', onBodyTouchStart, { passive: true });

  // Subscribe to event selection
  unsubSelected = store.subscribe('selectedEvent', (event) => {
    if (event) {
      showDetailMode(event);
    } else {
      showListMode();
    }
  });

  // Reveal sheet when earthquake data arrives
  unsubTimeline = store.subscribe('timeline', (tl) => {
    if (!sheetRevealed && tl.events.length > 0) {
      sheetRevealed = true;
      sheetEl.style.transition = 'transform 500ms cubic-bezier(0.32, 0.72, 0, 1)';
      setSheetPosition(PEEK_HEIGHT, true);
      peekTimerId = setInterval(() => {
        if (!store.get('selectedEvent')) updatePeekSummary(null);
      }, 30_000);
    }
    if (sheetRevealed && !store.get('selectedEvent')) {
      updatePeekSummary(null);
    }
  });

  // i18n refresh
  unsubLocale = onLocaleChange(() => {
    const selected = store.get('selectedEvent');
    updatePeekSummary(selected);
  });

  return {
    listContainer: listEl,
    detailContainer: detailEl,
  };
}

export function disposeMobileSheet(): void {
  unsubSelected?.();
  unsubSelected = null;
  unsubTimeline?.();
  unsubTimeline = null;
  unsubLocale?.();
  unsubLocale = null;
  if (peekTimerId) { clearInterval(peekTimerId); peekTimerId = null; }
  sheetRevealed = false;
  handleEl?.removeEventListener('pointerdown', onDragStart);
  sheetEl?.remove();
}
