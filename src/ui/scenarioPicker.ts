/**
 * NeverAgain — Scenario Picker
 *
 * Modal overlay with a card grid of historical earthquake presets.
 * Pure DOM — no framework dependencies.
 */

import type { HistoricalPreset } from '../types';
import { t, onLocaleChange } from '../i18n/index';

let overlayEl: HTMLElement | null = null;
let gridEl: HTMLElement;
let headerEl: HTMLElement;
let selectCallback: ((preset: HistoricalPreset) => void) | null = null;
let escapeHandler: ((e: KeyboardEvent) => void) | null = null;
let unsubLocale: (() => void) | null = null;

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

function buildCard(preset: HistoricalPreset): HTMLElement {
  const card = el('div', 'scenario-card');

  const body = el('div', 'scenario-card__body');

  body.appendChild(el('div', 'scenario-card__title', preset.name));

  const meta: string[] = [`Mw ${preset.Mw.toFixed(1)}`];
  if (preset.startTime) {
    meta.push(preset.startTime.slice(0, 10));
  }
  meta.push(preset.faultType);
  body.appendChild(el('div', 'scenario-card__meta', meta.join(' \u2014 ')));

  body.appendChild(el('div', 'scenario-card__desc', preset.description));

  card.appendChild(body);

  card.addEventListener('click', () => {
    selectCallback?.(preset);
    hidePicker();
  });

  return card;
}

export function initScenarioPicker(
  container: HTMLElement,
  onSelect: (preset: HistoricalPreset) => void,
  presets: HistoricalPreset[] = [],
): void {
  selectCallback = onSelect;

  overlayEl = el('div', 'scenario-overlay scenario-overlay--hidden');

  // Close button
  const closeBtn = el('button', 'scenario-overlay__close', '\u00d7');
  closeBtn.addEventListener('click', hidePicker);
  overlayEl.appendChild(closeBtn);

  // Header
  headerEl = el('div', 'scenario-overlay__header', t('scenario.title'));
  overlayEl.appendChild(headerEl);

  // Grid
  gridEl = el('div', 'scenario-grid');
  overlayEl.appendChild(gridEl);

  // Populate cards
  for (const preset of presets) {
    gridEl.appendChild(buildCard(preset));
  }

  // Click backdrop to close
  overlayEl.addEventListener('click', (e: Event) => {
    if (e.target === overlayEl) hidePicker();
  });

  // Escape key to close
  escapeHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') hidePicker();
  };
  document.addEventListener('keydown', escapeHandler);

  container.appendChild(overlayEl);

  // Subscribe to locale changes
  unsubLocale = onLocaleChange(() => {
    if (headerEl) headerEl.textContent = t('scenario.title');
  });
}

export function showPicker(): void {
  overlayEl?.classList.remove('scenario-overlay--hidden');
}

export function hidePicker(): void {
  overlayEl?.classList.add('scenario-overlay--hidden');
}

/**
 * Dynamically update the preset list after initialization.
 */
export function setPresets(presets: HistoricalPreset[]): void {
  if (!gridEl) return;
  gridEl.innerHTML = '';
  for (const preset of presets) {
    gridEl.appendChild(buildCard(preset));
  }
}

export function disposeScenarioPicker(): void {
  if (escapeHandler) {
    document.removeEventListener('keydown', escapeHandler);
    escapeHandler = null;
  }
  if (unsubLocale) {
    unsubLocale();
    unsubLocale = null;
  }
}
