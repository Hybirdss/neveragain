/**
 * Namazue — Timeline Controller
 *
 * Play/pause/speed controls with scrub bar.
 * Uses requestAnimationFrame for playback — NOT setInterval.
 */

import type { TimelineState } from '../types';
import { t, onLocaleChange } from '../i18n/index';

// ---- Internal references ----
let timelineEl: HTMLElement;
let playBtn: HTMLButtonElement;
let prevBtn: HTMLButtonElement;
let nextBtn: HTMLButtonElement;
let scrubTrack: HTMLElement;
let scrubProgress: HTMLElement;
let scrubHandle: HTMLElement;
let scrubContainer: HTMLElement;
let timeDisplay: HTMLElement;
let markerContainer: HTMLElement;
let markerRenderSignature = '';
let suppressClickUntil = 0;

const speedButtons: Map<number, HTMLElement> = new Map();
const SPEEDS = [1, 10, 100, 1000];

// Playback state
let animFrameId: number | null = null;
let lastFrameTime: number | null = null;
let currentState: TimelineState | null = null;

// Stored window-level handlers for cleanup
let pointerDownHandler: ((e: PointerEvent) => void) | null = null;
let pointerMoveHandler: ((e: PointerEvent) => void) | null = null;
let pointerUpHandler: ((e: PointerEvent) => void) | null = null;
let scrubClickHandler: ((e: MouseEvent) => void) | null = null;
let scrubKeyDownHandler: ((e: KeyboardEvent) => void) | null = null;
let unsubLocale: (() => void) | null = null;

// Callbacks
let onPlay: (() => void) | null = null;
let onPause: (() => void) | null = null;
let onSeek: ((time: number) => void) | null = null;
let onSpeedChange: ((speed: number) => void) | null = null;
let onPrev: (() => void) | null = null;
let onNext: (() => void) | null = null;

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

function formatTime(ts: number): string {
  const d = new Date(ts);
  // Display in JST (UTC+9) for consistency with top bar and sidebar
  const jst = new Date(d.getTime() + 9 * 3600_000);
  const y = jst.getUTCFullYear();
  const mo = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(jst.getUTCDate()).padStart(2, '0');
  const hh = String(jst.getUTCHours()).padStart(2, '0');
  const mm = String(jst.getUTCMinutes()).padStart(2, '0');
  const ss = String(jst.getUTCSeconds()).padStart(2, '0');
  return `${y}-${mo}-${dd} ${hh}:${mm}:${ss}`;
}

function getProgress(state: TimelineState): number {
  const [start, end] = state.timeRange;
  const span = end - start;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (state.currentTime - start) / span));
}

function buildPlaybackControls(): HTMLElement {
  const controls = el('div', 'playback-controls');

  prevBtn = el('button', 'playback-btn') as HTMLButtonElement;
  prevBtn.type = 'button';
  prevBtn.textContent = '⏮';
  prevBtn.title = t('timeline.prev');
  prevBtn.setAttribute('aria-label', t('timeline.prev'));
  prevBtn.addEventListener('click', () => onPrev?.());
  controls.appendChild(prevBtn);

  playBtn = el('button', 'playback-btn') as HTMLButtonElement;
  playBtn.type = 'button';
  playBtn.textContent = '▶';
  playBtn.title = `${t('timeline.play')} / ${t('timeline.pause')}`;
  playBtn.setAttribute('aria-label', `${t('timeline.play')} / ${t('timeline.pause')}`);
  playBtn.setAttribute('aria-pressed', 'false');
  playBtn.addEventListener('click', () => {
    if (currentState?.isPlaying) {
      onPause?.();
    } else {
      onPlay?.();
    }
  });
  controls.appendChild(playBtn);

  nextBtn = el('button', 'playback-btn') as HTMLButtonElement;
  nextBtn.type = 'button';
  nextBtn.textContent = '⏭';
  nextBtn.title = t('timeline.next');
  nextBtn.setAttribute('aria-label', t('timeline.next'));
  nextBtn.addEventListener('click', () => onNext?.());
  controls.appendChild(nextBtn);

  return controls;
}

function buildScrubBar(): HTMLElement {
  scrubContainer = el('div', 'scrub-bar');

  scrubTrack = el('div', 'scrub-bar__track');
  scrubProgress = el('div', 'scrub-bar__progress');
  scrubTrack.appendChild(scrubProgress);
  scrubContainer.appendChild(scrubTrack);

  scrubHandle = el('div', 'scrub-bar__handle');
  scrubContainer.appendChild(scrubHandle);

  // Marker container for earthquake events on the timeline
  markerContainer = el('div');
  markerContainer.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
  scrubContainer.appendChild(markerContainer);
  scrubContainer.tabIndex = 0;
  scrubContainer.setAttribute('role', 'slider');
  scrubContainer.setAttribute('aria-label', t('timeline.scrub'));
  scrubContainer.setAttribute('aria-valuemin', '0');
  scrubContainer.setAttribute('aria-valuemax', '100');

  const seekFromClientX = (clientX: number): void => {
    if (!currentState) return;
    const rect = scrubContainer.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const [start, end] = currentState.timeRange;
    const time = start + pct * (end - start);
    onSeek?.(time);
  };

  // Click-to-seek
  scrubClickHandler = (e: MouseEvent) => {
    if (Date.now() < suppressClickUntil) return;
    seekFromClientX(e.clientX);
  };
  scrubContainer.addEventListener('click', scrubClickHandler);

  // Pointer drag support (mouse + touch + pen)
  let dragging = false;
  let activePointerId: number | null = null;
  let movedDuringDrag = false;
  pointerDownHandler = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    movedDuringDrag = false;
    activePointerId = e.pointerId;
    scrubContainer.setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', pointerMoveHandler!);
    window.addEventListener('pointerup', pointerUpHandler!);
    window.addEventListener('pointercancel', pointerUpHandler!);
    seekFromClientX(e.clientX);
    e.preventDefault();
  };
  pointerMoveHandler = (e: PointerEvent) => {
    if (!dragging || !currentState) return;
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    movedDuringDrag = true;
    seekFromClientX(e.clientX);
  };
  pointerUpHandler = (e: PointerEvent) => {
    if (!dragging) return;
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    dragging = false;
    if (movedDuringDrag) {
      suppressClickUntil = Date.now() + 200;
    }
    if (activePointerId !== null && scrubContainer.hasPointerCapture(activePointerId)) {
      scrubContainer.releasePointerCapture(activePointerId);
    }
    activePointerId = null;
    window.removeEventListener('pointermove', pointerMoveHandler!);
    window.removeEventListener('pointerup', pointerUpHandler!);
    window.removeEventListener('pointercancel', pointerUpHandler!);
  };
  scrubContainer.addEventListener('pointerdown', pointerDownHandler);
  scrubContainer.addEventListener('pointerup', pointerUpHandler);
  scrubContainer.addEventListener('pointercancel', pointerUpHandler);

  scrubKeyDownHandler = (e: KeyboardEvent) => {
    if (!currentState) return;
    const [start, end] = currentState.timeRange;
    const span = end - start;
    if (span <= 0) return;
    const coarseStep = Math.max(60_000, span / 20);
    const fineStep = Math.max(1_000, span / 200);
    const seekBy = (delta: number) => {
      const next = Math.max(start, Math.min(end, currentState!.currentTime + delta));
      onSeek?.(next);
    };

    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      seekBy(fineStep);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      seekBy(-fineStep);
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      seekBy(coarseStep);
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      seekBy(-coarseStep);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onSeek?.(start);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSeek?.(end);
    }
  };
  scrubContainer.addEventListener('keydown', scrubKeyDownHandler);

  return scrubContainer;
}

function buildSpeedSelector(): HTMLElement {
  const container = el('div', 'speed-selector');

  for (const spd of SPEEDS) {
    const btn = el('button', 'speed-btn', `${spd}x`);
    btn.addEventListener('click', () => onSpeedChange?.(spd));
    speedButtons.set(spd, btn);
    container.appendChild(btn);
  }

  return container;
}

function renderMarkers(state: TimelineState): void {
  // Clear previous markers
  markerContainer.innerHTML = '';

  const [start, end] = state.timeRange;
  const span = end - start;
  if (span <= 0) return;

  for (const ev of state.events) {
    const pct = ((ev.time - start) / span) * 100;
    if (pct < 0 || pct > 100) continue;

    const marker = el('div', 'scrub-bar__marker');
    if (ev.magnitude >= 7) {
      marker.classList.add('scrub-bar__marker--large');
    } else if (ev.magnitude >= 5) {
      marker.classList.add('scrub-bar__marker--medium');
    } else {
      marker.classList.add('scrub-bar__marker--small');
    }
    marker.style.left = `${pct}%`;
    markerContainer.appendChild(marker);
  }
}

function getMarkerSignature(state: TimelineState): string {
  const [start, end] = state.timeRange;
  const first = state.events[0];
  const last = state.events[state.events.length - 1];
  return [
    start,
    end,
    state.events.length,
    first?.id ?? '',
    first?.time ?? 0,
    last?.id ?? '',
    last?.time ?? 0,
  ].join('|');
}

// ---- RAF-based playback loop ----
function playbackLoop(frameTime: number): void {
  if (!currentState || !currentState.isPlaying) {
    animFrameId = null;
    lastFrameTime = null;
    return;
  }

  if (lastFrameTime !== null) {
    const dtReal = frameTime - lastFrameTime; // ms elapsed in real time
    const dtSim = dtReal * currentState.speed;  // ms elapsed in sim time
    const newTime = currentState.currentTime + dtSim;
    const [, end] = currentState.timeRange;

    if (newTime >= end) {
      onSeek?.(end);
      onPause?.();
      animFrameId = null;
      lastFrameTime = null;
      return;
    }

    onSeek?.(newTime);
  }

  lastFrameTime = frameTime;
  animFrameId = requestAnimationFrame(playbackLoop);
}

function startPlayback(): void {
  if (animFrameId !== null) return;
  lastFrameTime = null;
  animFrameId = requestAnimationFrame(playbackLoop);
}

function stopPlayback(): void {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  lastFrameTime = null;
}

// ---- Public API ----

export interface TimelineCallbacks {
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
  onSpeedChange?: (speed: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export function initTimeline(
  container: HTMLElement,
  callbacks: TimelineCallbacks = {},
): void {
  onPlay = callbacks.onPlay ?? null;
  onPause = callbacks.onPause ?? null;
  onSeek = callbacks.onSeek ?? null;
  onSpeedChange = callbacks.onSpeedChange ?? null;
  onPrev = callbacks.onPrev ?? null;
  onNext = callbacks.onNext ?? null;

  timelineEl = el('div', 'timeline-bar');

  timelineEl.appendChild(buildPlaybackControls());
  timelineEl.appendChild(buildScrubBar());

  timeDisplay = el('div', 'time-display', '--:--:--');
  timelineEl.appendChild(timeDisplay);

  timelineEl.appendChild(buildSpeedSelector());

  container.appendChild(timelineEl);

  // Subscribe to locale changes to update tooltips
  unsubLocale = onLocaleChange(() => {
    prevBtn.title = t('timeline.prev');
    prevBtn.setAttribute('aria-label', t('timeline.prev'));
    playBtn.title = `${t('timeline.play')} / ${t('timeline.pause')}`;
    playBtn.setAttribute('aria-label', `${t('timeline.play')} / ${t('timeline.pause')}`);
    nextBtn.title = t('timeline.next');
    nextBtn.setAttribute('aria-label', t('timeline.next'));
    scrubContainer.setAttribute('aria-label', t('timeline.scrub'));
  });
}

export function updateTimeline(state: TimelineState): void {
  currentState = state;

  // Guard: DOM not yet created (orchestrator hydration runs before initTimeline)
  if (!scrubProgress) return;

  // Update progress bar
  const progress = getProgress(state);
  const pctStr = `${(progress * 100).toFixed(2)}%`;
  scrubProgress.style.width = pctStr;
  scrubHandle.style.left = pctStr;

  // Update time display
  timeDisplay.textContent = formatTime(state.currentTime);

  // Update play/pause button
  if (state.isPlaying) {
    playBtn.textContent = '▮▮';
    playBtn.classList.add('playback-btn--active');
    playBtn.setAttribute('aria-pressed', 'true');
  } else {
    playBtn.textContent = '▶';
    playBtn.classList.remove('playback-btn--active');
    playBtn.setAttribute('aria-pressed', 'false');
  }
  scrubContainer.setAttribute('aria-valuenow', (progress * 100).toFixed(2));
  scrubContainer.setAttribute('aria-valuetext', formatTime(state.currentTime));

  // Update speed buttons
  for (const [spd, btn] of speedButtons) {
    if (spd === state.speed) {
      btn.classList.add('speed-btn--active');
    } else {
      btn.classList.remove('speed-btn--active');
    }
  }

  // Render markers when event shape or time range changed.
  const signature = getMarkerSignature(state);
  if (signature !== markerRenderSignature) {
    renderMarkers(state);
    markerRenderSignature = signature;
  }

  // Start/stop RAF playback
  if (state.isPlaying) {
    startPlayback();
  } else {
    stopPlayback();
  }
}

export function disposeTimeline(): void {
  stopPlayback();
  if (scrubContainer) {
    if (scrubClickHandler) scrubContainer.removeEventListener('click', scrubClickHandler);
    if (scrubKeyDownHandler) scrubContainer.removeEventListener('keydown', scrubKeyDownHandler);
    if (pointerDownHandler) scrubContainer.removeEventListener('pointerdown', pointerDownHandler);
    if (pointerUpHandler) {
      scrubContainer.removeEventListener('pointerup', pointerUpHandler);
      scrubContainer.removeEventListener('pointercancel', pointerUpHandler);
    }
    if (pointerMoveHandler) window.removeEventListener('pointermove', pointerMoveHandler);
    if (pointerUpHandler) {
      window.removeEventListener('pointerup', pointerUpHandler);
      window.removeEventListener('pointercancel', pointerUpHandler);
    }
  }
  scrubClickHandler = null;
  scrubKeyDownHandler = null;
  pointerDownHandler = null;
  pointerMoveHandler = null;
  pointerUpHandler = null;
  markerRenderSignature = '';
  suppressClickUntil = 0;
  if (unsubLocale) {
    unsubLocale();
    unsubLocale = null;
  }
}
