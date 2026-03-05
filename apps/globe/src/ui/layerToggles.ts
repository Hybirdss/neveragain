/**
 * layerToggles.ts — Dot-style toggle panel for globe layer visibility.
 *
 * Renders a floating panel with dot toggles for core analysis layers.
 * Uses CSS classes from style.css .layer-toggles block.
 */

import { store } from '../store/appState';
import type { LayerVisibility } from '../types';
import type { GlobeInstance } from '../globe/globeInstance';
import { t, onLocaleChange } from '../i18n/index';

// ── Layer definitions ───────────────────────────────────────────

const LAYER_LABELS: { key: keyof LayerVisibility; i18nKey: string; color?: string }[] = [
  { key: 'tectonicPlates', i18nKey: 'layer.plates', color: '#666' },
  { key: 'seismicPoints', i18nKey: 'layer.quakes', color: '#ff4444' },
  { key: 'waveRings', i18nKey: 'layer.waves', color: '#4488ff' },
  { key: 'isoseismalContours', i18nKey: 'layer.contours', color: '#FAC611' },
  { key: 'shakeMapContours', i18nKey: 'layer.shakeMap', color: '#FAC611' },
  { key: 'activeFaults', i18nKey: 'layer.activeFaults', color: '#ff6644' },
  { key: 'labels', i18nKey: 'layer.labels', color: '#888' },
];

// ── State ───────────────────────────────────────────────────────

let wrapperEl: HTMLElement | null = null;
let panelEl: HTMLElement | null = null;
let triggerBtn: HTMLButtonElement | null = null;
let expanded = false;
let toggleEls: Map<keyof LayerVisibility, { row: HTMLElement; dot: HTMLElement; label: HTMLElement }> = new Map();
let unsubscribe: (() => void) | null = null;
let unsubLocale: (() => void) | null = null;
let titleEl: HTMLElement | null = null;

function setExpanded(open: boolean): void {
  expanded = open;
  if (panelEl) panelEl.style.display = open ? '' : 'none';
  if (triggerBtn) triggerBtn.classList.toggle('layer-trigger--open', open);
}

// ── Helpers ─────────────────────────────────────────────────────

function createToggleRow(
  key: keyof LayerVisibility,
  i18nKey: string,
  color: string | undefined,
  isOn: boolean,
  onClick: () => void,
): HTMLButtonElement {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'layer-toggle';
  if (isOn) row.classList.add('layer-toggle--on');
  if (color) row.style.color = color;

  const dot = document.createElement('div');
  dot.className = 'layer-toggle__dot';
  row.appendChild(dot);

  const label = document.createElement('span');
  label.textContent = t(i18nKey);
  row.appendChild(label);

  row.addEventListener('click', onClick);
  toggleEls.set(key, { row, dot, label });
  return row;
}

// ── Init ────────────────────────────────────────────────────────

export function initLayerToggles(container: HTMLElement, _viewer?: GlobeInstance): void {
  // viewer param retained for future layer-specific globe integration

  // Wrapper holds trigger button + expandable panel
  wrapperEl = document.createElement('div');
  wrapperEl.className = 'layer-toggles-wrapper';

  // Trigger button (always visible)
  triggerBtn = document.createElement('button');
  triggerBtn.type = 'button';
  triggerBtn.className = 'layer-trigger';
  triggerBtn.title = t('layer.title');
  triggerBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  triggerBtn.addEventListener('click', () => setExpanded(!expanded));
  wrapperEl.appendChild(triggerBtn);

  // Expandable panel (hidden by default)
  panelEl = document.createElement('div');
  panelEl.className = 'layer-toggles';
  panelEl.style.display = 'none';

  const currentLayers = store.get('layers');

  // Section title
  titleEl = document.createElement('div');
  titleEl.className = 'layer-toggles__title';
  titleEl.textContent = t('layer.title');
  panelEl.appendChild(titleEl);

  // Core analysis layers
  for (const { key, i18nKey, color } of LAYER_LABELS) {
    const row = createToggleRow(key, i18nKey, color, currentLayers[key], () => {
      const layers = store.get('layers');
      store.set('layers', { ...layers, [key]: !layers[key] });
    });
    panelEl.appendChild(row);
  }

  wrapperEl.appendChild(panelEl);
  container.appendChild(wrapperEl);

  // ── Subscriptions ──
  unsubscribe = store.subscribe('layers', (layers: LayerVisibility) => {
    for (const { key } of LAYER_LABELS) {
      const els = toggleEls.get(key);
      if (els) {
        els.row.classList.toggle('layer-toggle--on', layers[key]);
      }
    }
  });

  unsubLocale = onLocaleChange(() => {
    if (titleEl) titleEl.textContent = t('layer.title');
    for (const { key, i18nKey } of LAYER_LABELS) {
      const els = toggleEls.get(key);
      if (els) els.label.textContent = t(i18nKey);
    }
  });
}

export function disposeLayerToggles(): void {
  unsubscribe?.();
  unsubscribe = null;
  unsubLocale?.();
  unsubLocale = null;
  wrapperEl?.remove();
  wrapperEl = null;
  panelEl = null;
  triggerBtn = null;
  titleEl = null;
  expanded = false;
  toggleEls.clear();
}
