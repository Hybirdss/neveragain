/**
 * NeverAgain — Mode Switcher Bar
 *
 * Provides REALTIME | TIMELINE | SCENARIO mode buttons plus
 * a date-range picker that appears when TIMELINE mode is active.
 *
 * Does NOT wire into main.ts — integration happens separately.
 */

import type { AppMode } from '../types';
import { store } from '../store/appState';
import { t, onLocaleChange } from '../i18n/index';

// ── Internal references ─────────────────────────────────────────
let barEl: HTMLElement | null = null;
let datePickerEl: HTMLElement | null = null;
let startInput: HTMLInputElement | null = null;
let endInput: HTMLInputElement | null = null;
let loadBtn: HTMLButtonElement | null = null;

const modeButtons = new Map<AppMode, HTMLButtonElement>();

const MODES: { key: AppMode; i18nKey: string }[] = [
  { key: 'realtime', i18nKey: 'mode.realtime' },
  { key: 'timeline', i18nKey: 'mode.timeline' },
  { key: 'scenario', i18nKey: 'mode.scenario' },
];

let startLabelEl: HTMLElement | null = null;
let endLabelEl: HTMLElement | null = null;
let unsubLocale: (() => void) | null = null;

// ── Callbacks ───────────────────────────────────────────────────
type LoadCallback = (start: string, end: string) => void;
let onLoadTimeline: LoadCallback | null = null;

// ── Helpers ─────────────────────────────────────────────────────

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

/** Default "end" = today, "start" = 7 days ago (ISO date strings). */
function defaultDateRange(): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const start = weekAgo.toISOString().slice(0, 10);
  return { start, end };
}

// ── Highlight active mode ───────────────────────────────────────

function highlightMode(mode: AppMode): void {
  for (const [key, btn] of modeButtons) {
    if (key === mode) {
      btn.classList.add('mode-btn--active');
    } else {
      btn.classList.remove('mode-btn--active');
    }
  }

  // Show/hide date-range picker
  if (datePickerEl) {
    datePickerEl.style.display = mode === 'timeline' ? 'flex' : 'none';
  }
}

// ── Build DOM ───────────────────────────────────────────────────

function buildModeBar(): HTMLElement {
  const bar = el('div', 'mode-switcher');

  for (const { key, i18nKey } of MODES) {
    const btn = el('button', 'mode-btn', t(i18nKey)) as HTMLButtonElement;
    btn.dataset.mode = key;
    btn.addEventListener('click', () => {
      store.set('mode', key);
    });
    modeButtons.set(key, btn);
    bar.appendChild(btn);
  }

  return bar;
}

function buildDatePicker(): HTMLElement {
  const picker = el('div', 'mode-date-picker');
  picker.style.display = 'none'; // hidden by default

  const defaults = defaultDateRange();

  startLabelEl = el('label', 'mode-date-picker__label', t('mode.from'));
  startInput = document.createElement('input');
  startInput.type = 'date';
  startInput.className = 'mode-date-picker__input';
  startInput.value = defaults.start;
  startLabelEl.appendChild(startInput);
  picker.appendChild(startLabelEl);

  endLabelEl = el('label', 'mode-date-picker__label', t('mode.to'));
  endInput = document.createElement('input');
  endInput.type = 'date';
  endInput.className = 'mode-date-picker__input';
  endInput.value = defaults.end;
  endLabelEl.appendChild(endInput);
  picker.appendChild(endLabelEl);

  loadBtn = el('button', 'mode-date-picker__load', t('mode.load')) as HTMLButtonElement;
  loadBtn.addEventListener('click', () => {
    if (!startInput || !endInput) return;
    const s = startInput.value;
    const e = endInput.value;
    if (!s || !e) return;
    onLoadTimeline?.(s, e);
  });
  picker.appendChild(loadBtn);

  return picker;
}

// ── Public API ──────────────────────────────────────────────────

export interface ModeSwitcherOptions {
  /** Called when the user clicks "Load" in timeline mode. */
  onLoadTimeline?: LoadCallback;
}

/**
 * Create and mount the mode switcher bar (+ date picker)
 * inside the given container element.
 */
export function initModeSwitcher(
  container: HTMLElement,
  options: ModeSwitcherOptions = {},
): void {
  onLoadTimeline = options.onLoadTimeline ?? null;

  const wrapper = el('div', 'mode-switcher-wrapper');

  barEl = buildModeBar();
  wrapper.appendChild(barEl);

  datePickerEl = buildDatePicker();
  wrapper.appendChild(datePickerEl);

  container.appendChild(wrapper);

  // Set initial highlight
  highlightMode(store.get('mode'));

  // React to external mode changes (e.g. scenario picker sets mode)
  store.subscribe('mode', (mode: AppMode) => {
    highlightMode(mode);
  });

  // Subscribe to locale changes
  unsubLocale = onLocaleChange(() => {
    for (const { key, i18nKey } of MODES) {
      const btn = modeButtons.get(key);
      if (btn) btn.textContent = t(i18nKey);
    }
    // Update date picker labels — labels contain both text node and input child
    if (startLabelEl && startInput) {
      startLabelEl.firstChild!.textContent = t('mode.from');
    }
    if (endLabelEl && endInput) {
      endLabelEl.firstChild!.textContent = t('mode.to');
    }
    if (loadBtn) loadBtn.textContent = t('mode.load');
  });
}

export function disposeModeSwitcher(): void {
  unsubLocale?.();
  unsubLocale = null;
}
