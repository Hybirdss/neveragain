/**
 * Namazue — Earthquake Tooltip
 *
 * Floating popup overlay displayed on earthquake click.
 * Positioned near click point, auto-dismisses after timeout.
 */

import type { EarthquakeEvent, JmaClass } from '../types';
import { computeGmpe } from '../engine/gmpe';
import { store } from '../store/appState';
import { t } from '../i18n/index';
import { getPlaceText } from '../utils/earthquakeUtils';
import { getJmaColor } from '../types';
import { createHelpButton } from './intensityGuide';

let tooltipEl: HTMLElement | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

const AUTO_DISMISS_MS = 5000;

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
  // Display in JST (UTC+9) for consistency with top bar, sidebar, and timeline
  const jst = new Date(ts + 9 * 3600_000);
  return jst.toISOString().replace('T', ' ').slice(0, 19);
}

function computeJmaForEvent(event: EarthquakeEvent): JmaClass {
  const result = computeGmpe({
    Mw: event.magnitude,
    depth_km: event.depth_km,
    distance_km: Math.max(event.depth_km, 1), // hypocentral distance at epicenter
    faultType: event.faultType,
  });
  return result.jmaClass;
}

function ensureContainer(): HTMLElement {
  if (!tooltipEl) {
    tooltipEl = el('div', 'earthquake-tooltip earthquake-tooltip--hidden');
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

function addRow(container: HTMLElement, key: string, value: string): void {
  const row = el('div', 'earthquake-tooltip__row');
  row.appendChild(el('span', 'earthquake-tooltip__key', key));
  row.appendChild(el('span', 'earthquake-tooltip__val', value));
  container.appendChild(row);
}

export function showTooltip(event: EarthquakeEvent, x: number, y: number): void {
  const tip = ensureContainer();

  // Clear previous content
  tip.innerHTML = '';

  // Title
  tip.appendChild(
    el('div', 'earthquake-tooltip__title', `M ${event.magnitude.toFixed(1)} \u2014 ${getPlaceText(event.place)}`),
  );

  // Rows
  addRow(tip, t('detail.time'), formatTime(event.time));
  addRow(
    tip,
    t('detail.location'),
    `${Math.abs(event.lat).toFixed(3)}\u00b0${event.lat >= 0 ? 'N' : 'S'} ` +
    `${Math.abs(event.lng).toFixed(3)}\u00b0${event.lng >= 0 ? 'E' : 'W'}`,
  );
  addRow(tip, t('detail.depth'), `${event.depth_km} km`);
  addRow(tip, t('detail.faultType'), event.faultType);

  // JMA badge row
  const jma = computeJmaForEvent(event);
  const jmaRow = el('div', 'earthquake-tooltip__row');
  jmaRow.appendChild(el('span', 'earthquake-tooltip__key', t('detail.jmaIntensity')));
  const badge = el('span', 'detail-panel__jma-badge');
  badge.textContent = jma;
  badge.style.backgroundColor = getJmaColor(jma, store.get('colorblind'));
  const brightClasses: JmaClass[] = ['3', '4', '5-', '5+'];
  badge.style.color = brightClasses.includes(jma) ? '#000' : '#fff';
  jmaRow.appendChild(badge);
  jmaRow.appendChild(createHelpButton());
  tip.appendChild(jmaRow);

  if (event.tsunami) {
    addRow(tip, t('detail.tsunami'), t('tsunami.warning'));
  }

  // Position — keep within viewport
  const margin = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  tip.classList.remove('earthquake-tooltip--hidden');
  tip.style.left = '0px';
  tip.style.top = '0px';

  // Force layout to get dimensions
  const tipW = tip.offsetWidth;
  const tipH = tip.offsetHeight;

  let posX = x + margin;
  let posY = y + margin;

  if (posX + tipW > vw - margin) posX = x - tipW - margin;
  if (posY + tipH > vh - margin) posY = y - tipH - margin;
  if (posX < margin) posX = margin;
  if (posY < margin) posY = margin;

  tip.style.left = `${posX}px`;
  tip.style.top = `${posY}px`;

  // Auto-dismiss
  if (dismissTimer !== null) clearTimeout(dismissTimer);
  dismissTimer = setTimeout(hideTooltip, AUTO_DISMISS_MS);
}

export function hideTooltip(): void {
  if (tooltipEl) {
    tooltipEl.classList.add('earthquake-tooltip--hidden');
  }
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
}
