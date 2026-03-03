/**
 * layerToggles.ts — Dot-style toggle panel for globe layer visibility.
 *
 * Renders a floating panel with dot toggles (inspired by reference UI),
 * a Japan focus button, and a PLATEAU city selector.
 * Uses CSS classes from style.css .layer-toggles block.
 */

import { store } from '../store/appState';
import type { LayerVisibility } from '../types';
import type { GlobeInstance } from '../globe/globeInstance';
import { flyToJapan } from '../globe/globeInstance';
import { t, onLocaleChange } from '../i18n/index';
import type { PlateauCityId } from '../types';
import { PLATEAU_CITIES } from '../globe/features/plateauBuildings';

// Layer key → i18n key
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

let panelEl: HTMLElement | null = null;
let toggleEls: Map<keyof LayerVisibility, { row: HTMLElement; dot: HTMLElement; label: HTMLElement }> = new Map();
let unsubscribe: (() => void) | null = null;
let unsubLocale: (() => void) | null = null;
let titleEl: HTMLElement | null = null;
let viewerRef: GlobeInstance | null = null;
let citySelect: HTMLSelectElement | null = null;

export function initLayerToggles(container: HTMLElement, viewer?: GlobeInstance): void {
  viewerRef = viewer ?? null;
  panelEl = document.createElement('div');
  panelEl.className = 'layer-toggles';

  // Title
  titleEl = document.createElement('div');
  titleEl.className = 'layer-toggles__title';
  titleEl.textContent = t('layer.title');
  panelEl.appendChild(titleEl);

  // Create dot toggles
  const currentLayers = store.get('layers');

  for (const { key, i18nKey, color } of LAYER_LABELS) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'layer-toggle';
    if (currentLayers[key]) row.classList.add('layer-toggle--on');
    if (color) row.style.color = color;

    const dot = document.createElement('div');
    dot.className = 'layer-toggle__dot';
    row.appendChild(dot);

    const label = document.createElement('span');
    label.textContent = t(i18nKey);
    row.appendChild(label);

    row.addEventListener('click', () => {
      const layers = store.get('layers');
      const updated: LayerVisibility = { ...layers, [key]: !layers[key] };
      store.set('layers', updated);
    });

    toggleEls.set(key, { row, dot, label });
    panelEl.appendChild(row);
  }

  // Separator
  const sep = document.createElement('div');
  sep.className = 'layer-toggles__separator';
  panelEl.appendChild(sep);

  // Japan Focus button
  const japanBtn = document.createElement('button');
  japanBtn.type = 'button';
  japanBtn.className = 'layer-toggles__action-btn';
  japanBtn.textContent = '🇯🇵 Japan';
  japanBtn.addEventListener('click', () => {
    if (viewerRef) flyToJapan(viewerRef);
  });
  panelEl.appendChild(japanBtn);

  // Separator (PLATEAU)
  const sep2 = document.createElement('div');
  sep2.className = 'layer-toggles__separator';
  panelEl.appendChild(sep2);

  // PLATEAU City Selector
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

  const currentCity = store.get('plateauCity');
  select.value = currentCity ?? '';

  select.addEventListener('change', () => {
    store.set('plateauCity', select.value as PlateauCityId || null);
  });

  store.subscribe('plateauCity', (val: PlateauCityId | null) => {
    select.value = val ?? '';
  });

  panelEl.appendChild(select);
  container.appendChild(panelEl);

  // Subscribe to store changes
  unsubscribe = store.subscribe('layers', (layers: LayerVisibility) => {
    for (const { key } of LAYER_LABELS) {
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

  // Subscribe to locale changes
  unsubLocale = onLocaleChange(() => {
    if (titleEl) titleEl.textContent = t('layer.title');
    for (const { key, i18nKey } of LAYER_LABELS) {
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
  citySelect = null;
  toggleEls.clear();
}
