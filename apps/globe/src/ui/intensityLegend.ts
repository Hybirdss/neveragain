/**
 * Namazue — JMA Intensity Color Legend
 *
 * Fixed-position vertical strip showing JMA 0-7 intensity colors.
 * Imports JMA_COLORS from types.ts — does not redefine color values.
 */

import type { JmaClass, LayerVisibility } from '../types';
import { JMA_COLORS } from '../types';
import { store } from '../store/appState';
import { t, onLocaleChange } from '../i18n/index';

const JMA_SCALE_ENTRIES: Array<{ key: JmaClass; i18nKey: string }> = [
  { key: '7',  i18nKey: 'legend.violent' },
  { key: '6+', i18nKey: 'legend.severe' },
  { key: '6-', i18nKey: 'legend.strongPlus' },
  { key: '5+', i18nKey: 'legend.veryStrong' },
  { key: '5-', i18nKey: 'legend.ratherStrong' },
  { key: '4',  i18nKey: 'legend.strong' },
  { key: '3',  i18nKey: 'legend.moderate' },
  { key: '2',  i18nKey: 'legend.weak' },
  { key: '1',  i18nKey: 'legend.slight' },
  { key: '0',  i18nKey: 'legend.notFelt' },
];

function buildLegendLabel(jmaKey: JmaClass, i18nKey: string): string {
  return `${jmaKey} \u2014 ${t(i18nKey)}`;
}

let legendEl: HTMLElement | null = null;
let legendTitleEl: HTMLElement;
let legendLabelEls: Array<{ el: HTMLElement; jmaKey: JmaClass; i18nKey: string }> = [];
let unsubLocale: (() => void) | null = null;
let unsubLayers: (() => void) | null = null;

function updateVisibility(layers: LayerVisibility): void {
  if (!legendEl) return;
  const show = layers.isoseismalContours || layers.shakeMapContours;
  legendEl.style.display = show ? '' : 'none';
}

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

export function initIntensityLegend(container: HTMLElement): void {
  legendEl = el('div', 'intensity-legend');
  legendEl.style.display = 'none'; // hidden until contour/shakemap layer is on

  legendTitleEl = el('div', 'intensity-legend__title', t('legend.title'));
  legendEl.appendChild(legendTitleEl);

  legendLabelEls = [];
  for (const entry of JMA_SCALE_ENTRIES) {
    const item = el('div', 'intensity-legend__item');

    const swatch = el('div', 'intensity-legend__swatch');
    swatch.style.backgroundColor = JMA_COLORS[entry.key];
    item.appendChild(swatch);

    const labelEl = el('span', 'intensity-legend__label', buildLegendLabel(entry.key, entry.i18nKey));
    legendLabelEls.push({ el: labelEl, jmaKey: entry.key, i18nKey: entry.i18nKey });
    item.appendChild(labelEl);

    legendEl.appendChild(item);
  }

  container.appendChild(legendEl);

  // Show/hide based on relevant layers
  updateVisibility(store.get('layers'));
  unsubLayers = store.subscribe('layers', updateVisibility);

  // Subscribe to locale changes
  unsubLocale = onLocaleChange(() => {
    legendTitleEl.textContent = t('legend.title');
    for (const item of legendLabelEls) {
      item.el.textContent = buildLegendLabel(item.jmaKey, item.i18nKey);
    }
  });
}

export function disposeIntensityLegend(): void {
  unsubLocale?.();
  unsubLocale = null;
  unsubLayers?.();
  unsubLayers = null;
  legendEl?.remove();
  legendEl = null;
  legendLabelEls = [];
}
