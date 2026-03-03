/**
 * NeverAgain — JMA Intensity Color Legend
 *
 * Fixed-position vertical strip showing JMA 0-7 intensity colors.
 * Imports JMA_COLORS from types.ts — does not redefine color values.
 */

import type { JmaClass } from '../types';
import { JMA_COLORS } from '../types';
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

let legendTitleEl: HTMLElement;
let legendLabelEls: Array<{ el: HTMLElement; jmaKey: JmaClass; i18nKey: string }> = [];
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

export function initIntensityLegend(container: HTMLElement): void {
  const legend = el('div', 'intensity-legend');

  legendTitleEl = el('div', 'intensity-legend__title', t('legend.title'));
  legend.appendChild(legendTitleEl);

  legendLabelEls = [];
  for (const entry of JMA_SCALE_ENTRIES) {
    const item = el('div', 'intensity-legend__item');

    const swatch = el('div', 'intensity-legend__swatch');
    swatch.style.backgroundColor = JMA_COLORS[entry.key];
    item.appendChild(swatch);

    const labelEl = el('span', 'intensity-legend__label', buildLegendLabel(entry.key, entry.i18nKey));
    legendLabelEls.push({ el: labelEl, jmaKey: entry.key, i18nKey: entry.i18nKey });
    item.appendChild(labelEl);

    legend.appendChild(item);
  }

  container.appendChild(legend);

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
  legendLabelEls = [];
}
