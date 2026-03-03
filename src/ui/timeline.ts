/**
 * NeverAgain — Timeline Controller
 *
 * Play/pause/speed controls with scrub bar.
 * Uses requestAnimationFrame for playback — NOT setInterval.
 */

import type { TimelineState } from '../types';
import { t, onLocaleChange } from '../i18n/index';

// ---- Internal references ----
let timelineEl: HTMLElement;
let playBtn: HTMLElement;
let prevBtn: HTMLElement;
let nextBtn: HTMLElement;
let scrubTrack: HTMLElement;
let scrubProgress: HTMLElement;
let scrubHandle: HTMLElement;
let scrubContainer: HTMLElement;
let timeDisplay: HTMLElement;
let markerContainer: HTMLElement;

const speedButtons: Map<number, HTMLElement> = new Map();
const SPEEDS = [1, 10, 100, 1000];

// Playback state
let animFrameId: number | null = null;
let lastFrameTime: number | null = null;
let currentState: TimelineState | null = null;

// Stored window-level handlers for cleanup
let windowMoveHandler: ((e: MouseEvent) => void) | null = null;
let windowUpHandler: (() => void) | null = null;
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

  prevBtn = el('button', 'playback-btn');
  prevBtn.innerHTML = '&#9198;'; // prev track ⏮
  prevBtn.title = t('timeline.prev');
  prevBtn.addEventListener('click', () => onPrev?.());
  controls.appendChild(prevBtn);

  playBtn = el('button', 'playback-btn');
  playBtn.innerHTML = '&#9654;'; // play triangle
  playBtn.title = `${t('timeline.play')} / ${t('timeline.pause')}`;
  playBtn.addEventListener('click', () => {
    if (currentState?.isPlaying) {
      onPause?.();
    } else {
      onPlay?.();
    }
  });
  controls.appendChild(playBtn);

  nextBtn = el('button', 'playback-btn');
  nextBtn.innerHTML = '&#9197;'; // next track ⏭
  nextBtn.title = t('timeline.next');
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

  // Click-to-seek
  scrubContainer.addEventListener('click', (e: MouseEvent) => {
    if (!currentState) return;
    const rect = scrubContainer.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const [start, end] = currentState.timeRange;
    const time = start + pct * (end - start);
    onSeek?.(time);
  });

  // Drag support
  let dragging = false;
  scrubContainer.addEventListener('mousedown', () => { dragging = true; });
  windowMoveHandler = (e: MouseEvent) => {
    if (!dragging || !currentState) return;
    const rect = scrubContainer.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const [start, end] = currentState.timeRange;
    onSeek?.(start + pct * (end - start));
  };
  windowUpHandler = () => { dragging = false; };
  window.addEventListener('mousemove', windowMoveHandler);
  window.addEventListener('mouseup', windowUpHandler);

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
    playBtn.title = `${t('timeline.play')} / ${t('timeline.pause')}`;
    nextBtn.title = t('timeline.next');
  });
}

export function updateTimeline(state: TimelineState): void {
  const prev = currentState;
  currentState = state;

  // Update progress bar
  const progress = getProgress(state);
  const pctStr = `${(progress * 100).toFixed(2)}%`;
  scrubProgress.style.width = pctStr;
  scrubHandle.style.left = pctStr;

  // Update time display
  timeDisplay.textContent = formatTime(state.currentTime);

  // Update play/pause button
  if (state.isPlaying) {
    playBtn.innerHTML = '&#9646;&#9646;'; // pause bars
    playBtn.classList.add('playback-btn--active');
  } else {
    playBtn.innerHTML = '&#9654;'; // play triangle
    playBtn.classList.remove('playback-btn--active');
  }

  // Update speed buttons
  for (const [spd, btn] of speedButtons) {
    if (spd === state.speed) {
      btn.classList.add('speed-btn--active');
    } else {
      btn.classList.remove('speed-btn--active');
    }
  }

  // Render markers only if events list changed
  if (!prev || prev.events !== state.events) {
    renderMarkers(state);
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
  if (windowMoveHandler) {
    window.removeEventListener('mousemove', windowMoveHandler);
    windowMoveHandler = null;
  }
  if (windowUpHandler) {
    window.removeEventListener('mouseup', windowUpHandler);
    windowUpHandler = null;
  }
  if (unsubLocale) {
    unsubLocale();
    unsubLocale = null;
  }
}
