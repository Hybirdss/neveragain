/**
 * layerToggles.ts — Dot-style toggle panel for globe layer visibility.
 *
 * Renders a floating panel with dot toggles (inspired by reference UI),
 * a Japan focus button, and a PLATEAU city selector.
 *
 * GSI layers are split into two groups:
 *   - Base maps (relief/slope/pale): radio group — one at a time
 *   - Overlays (faults/boundary/hazard): independent checkboxes
 *
 * Uses CSS classes from style.css .layer-toggles block.
 */

import { store } from '../store/appState';
import type { LayerVisibility } from '../types';
import type { GlobeInstance } from '../globe/globeInstance';
import { flyToJapan } from '../globe/globeInstance';
import { t, onLocaleChange } from '../i18n/index';
import type { PlateauCityId } from '../types';
import { PLATEAU_CITIES } from '../globe/features/plateauBuildings';

// ── Layer definitions ───────────────────────────────────────────

// Core analysis layers (independent toggles)
const LAYER_LABELS: { key: keyof LayerVisibility; i18nKey: string; color?: string }[] = [
  { key: 'tectonicPlates', i18nKey: 'layer.plates', color: '#666' },
  { key: 'seismicPoints', i18nKey: 'layer.quakes', color: '#ff4444' },
  { key: 'waveRings', i18nKey: 'layer.waves', color: '#4488ff' },
  { key: 'isoseismalContours', i18nKey: 'layer.contours', color: '#FAC611' },
  { key: 'shakeMapContours', i18nKey: 'layer.shakeMap', color: '#FAC611' },
  { key: 'slab2Contours', i18nKey: 'layer.slab2', color: '#ff4444' },
  { key: 'plateauBuildings', i18nKey: 'layer.plateau', color: '#888' },
  { key: 'labels', i18nKey: 'layer.labels', color: '#888' },
];

// GSI base maps (mutually exclusive — radio behavior)
const GSI_BASE_KEYS: (keyof LayerVisibility)[] = ['gsiRelief', 'gsiSlope', 'gsiPale'];
const GSI_BASE_LABELS: { key: keyof LayerVisibility; i18nKey: string; color?: string }[] = [
  { key: 'gsiRelief', i18nKey: 'layer.gsiRelief', color: '#22cc44' },
  { key: 'gsiSlope', i18nKey: 'layer.gsiSlope', color: '#FAC611' },
  { key: 'gsiPale', i18nKey: 'layer.gsiPale', color: '#888' },
];

// GSI overlays (independent toggles, stack on top)
const GSI_OVERLAY_LABELS: { key: keyof LayerVisibility; i18nKey: string; color?: string }[] = [
  { key: 'gsiFaults', i18nKey: 'layer.gsiFaults', color: '#ff4444' },
  { key: 'adminBoundary', i18nKey: 'layer.adminBoundary', color: '#4488ff' },
  { key: 'jshisHazard', i18nKey: 'layer.jshisHazard', color: '#ff8800' },
  { key: 'activeFaults', i18nKey: 'layer.activeFaults', color: '#ff6644' },
  { key: 'hazardComparison', i18nKey: 'layer.hazardComparison', color: '#aa44ff' },
  { key: 'landslideRisk', i18nKey: 'layer.landslideRisk', color: '#cc8800' },
];

// ── State ───────────────────────────────────────────────────────

let panelEl: HTMLElement | null = null;
let toggleEls: Map<keyof LayerVisibility, { row: HTMLElement; dot: HTMLElement; label: HTMLElement }> = new Map();
let unsubscribe: (() => void) | null = null;
let unsubLocale: (() => void) | null = null;
let titleEl: HTMLElement | null = null;
let gsiBaseTitleEl: HTMLElement | null = null;
let gsiOverlayTitleEl: HTMLElement | null = null;
let viewerRef: GlobeInstance | null = null;
let citySelect: HTMLSelectElement | null = null;

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

function createSeparator(): HTMLDivElement {
  const sep = document.createElement('div');
  sep.className = 'layer-toggles__separator';
  return sep;
}

function createGroupTitle(i18nKey: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'layer-toggles__title';
  el.textContent = t(i18nKey);
  return el;
}

// ── Init ────────────────────────────────────────────────────────

export function initLayerToggles(container: HTMLElement, viewer?: GlobeInstance): void {
  viewerRef = viewer ?? null;
  panelEl = document.createElement('div');
  panelEl.className = 'layer-toggles';

  const currentLayers = store.get('layers');

  // ── Section: Core analysis layers ──
  titleEl = createGroupTitle('layer.title');
  panelEl.appendChild(titleEl);

  for (const { key, i18nKey, color } of LAYER_LABELS) {
    const row = createToggleRow(key, i18nKey, color, currentLayers[key], () => {
      const layers = store.get('layers');
      store.set('layers', { ...layers, [key]: !layers[key] });
    });
    panelEl.appendChild(row);
  }

  // ── Section: Japan focus + PLATEAU ──
  panelEl.appendChild(createSeparator());

  const japanBtn = document.createElement('button');
  japanBtn.type = 'button';
  japanBtn.className = 'layer-toggles__action-btn';
  japanBtn.textContent = '🇯🇵 Japan';
  japanBtn.addEventListener('click', () => {
    if (viewerRef) flyToJapan(viewerRef);
  });
  panelEl.appendChild(japanBtn);

  panelEl.appendChild(createSeparator());

  const select = document.createElement('select');
  citySelect = select;
  select.className = 'layer-toggles__select';

  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = t('plateau.none');
  select.appendChild(noneOpt);

  for (const city of PLATEAU_CITIES) {
    const opt = document.createElement('option');
    opt.value = city.id;
    opt.textContent = t(city.nameKey);
    select.appendChild(opt);
  }

  select.value = store.get('plateauCity') ?? '';
  select.addEventListener('change', () => {
    store.set('plateauCity', select.value as PlateauCityId || null);
  });
  store.subscribe('plateauCity', (val: PlateauCityId | null) => {
    select.value = val ?? '';
  });
  panelEl.appendChild(select);

  // ── Section: GSI base maps (radio group) ──
  panelEl.appendChild(createSeparator());

  gsiBaseTitleEl = createGroupTitle('layer.gsiBaseGroup');
  panelEl.appendChild(gsiBaseTitleEl);

  for (const { key, i18nKey, color } of GSI_BASE_LABELS) {
    const row = createToggleRow(key, i18nKey, color, currentLayers[key], () => {
      const layers = store.get('layers');
      const isCurrentlyOn = layers[key];

      if (isCurrentlyOn) {
        // Just turn off
        store.set('layers', { ...layers, [key]: false });
      } else {
        // Turn on this one, turn off other base maps
        const updated = { ...layers };
        for (const bk of GSI_BASE_KEYS) {
          updated[bk] = bk === key;
        }
        store.set('layers', updated);
      }
    });
    panelEl.appendChild(row);
  }

  // ── Section: GSI overlays (independent) ──
  panelEl.appendChild(createSeparator());

  gsiOverlayTitleEl = createGroupTitle('layer.gsiOverlayGroup');
  panelEl.appendChild(gsiOverlayTitleEl);

  for (const { key, i18nKey, color } of GSI_OVERLAY_LABELS) {
    const row = createToggleRow(key, i18nKey, color, currentLayers[key], () => {
      const layers = store.get('layers');
      store.set('layers', { ...layers, [key]: !layers[key] });
    });
    panelEl.appendChild(row);
  }

  container.appendChild(panelEl);

  // ── Subscriptions ──
  const ALL_LABELS = [...LAYER_LABELS, ...GSI_BASE_LABELS, ...GSI_OVERLAY_LABELS];

  unsubscribe = store.subscribe('layers', (layers: LayerVisibility) => {
    for (const { key } of ALL_LABELS) {
      const els = toggleEls.get(key);
      if (els) {
        if (layers[key]) {
          els.row.classList.add('layer-toggle--on');
        } else {
          els.row.classList.remove('layer-toggle--on');
        }
      }
    }
  });

  unsubLocale = onLocaleChange(() => {
    if (titleEl) titleEl.textContent = t('layer.title');
    if (gsiBaseTitleEl) gsiBaseTitleEl.textContent = t('layer.gsiBaseGroup');
    if (gsiOverlayTitleEl) gsiOverlayTitleEl.textContent = t('layer.gsiOverlayGroup');
    for (const { key, i18nKey } of ALL_LABELS) {
      const els = toggleEls.get(key);
      if (els) els.label.textContent = t(i18nKey);
    }
    if (citySelect) {
      citySelect.options[0].textContent = t('plateau.none');
      for (let i = 0; i < PLATEAU_CITIES.length; i++) {
        citySelect.options[i + 1].textContent = t(PLATEAU_CITIES[i].nameKey);
      }
    }
  });
}

export function disposeLayerToggles(): void {
  unsubscribe?.();
  unsubscribe = null;
  unsubLocale?.();
  unsubLocale = null;
  panelEl?.remove();
  panelEl = null;
  titleEl = null;
  gsiBaseTitleEl = null;
  gsiOverlayTitleEl = null;
  citySelect = null;
  toggleEls.clear();
}
