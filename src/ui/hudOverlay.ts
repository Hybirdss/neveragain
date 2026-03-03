/**
 * NeverAgain — HUD Overlay Component
 *
 * Bottom-left heads-up display showing camera position,
 * simulation time, and zoom level.
 * Pure DOM manipulation — no frameworks.
 */

import { t, onLocaleChange } from '../i18n/index';

let cameraVal: HTMLElement;
let simTimeVal: HTMLElement;
let zoomVal: HTMLElement;
let camLabelEl: HTMLElement;
let timeLabelEl: HTMLElement;
let zoomLabelEl: HTMLElement;
let unsubLocale: (() => void) | null = null;

function createRow(
  parent: HTMLElement,
  label: string,
): { valueEl: HTMLElement; labelEl: HTMLElement } {
  const row = document.createElement('div');
  row.className = 'hud-overlay__row';

  const labelEl = document.createElement('span');
  labelEl.className = 'hud-overlay__label';
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const valueEl = document.createElement('span');
  valueEl.className = 'hud-overlay__value';
  valueEl.textContent = '--';
  row.appendChild(valueEl);

  parent.appendChild(row);
  return { valueEl, labelEl };
}

/**
 * Create the HUD overlay DOM and append to container.
 * Displays 3 rows: Camera Position, Sim Time, Zoom Level.
 */
export function initHudOverlay(container: HTMLElement): void {
  const overlay = document.createElement('div');
  overlay.className = 'hud-overlay';

  const camRow = createRow(overlay, t('hud.cam'));
  cameraVal = camRow.valueEl;
  camLabelEl = camRow.labelEl;

  const timeRow = createRow(overlay, t('hud.time'));
  simTimeVal = timeRow.valueEl;
  timeLabelEl = timeRow.labelEl;

  const zoomRow = createRow(overlay, t('hud.zoom'));
  zoomVal = zoomRow.valueEl;
  zoomLabelEl = zoomRow.labelEl;

  container.appendChild(overlay);

  // Subscribe to locale changes
  unsubLocale = onLocaleChange(() => {
    camLabelEl.textContent = t('hud.cam');
    timeLabelEl.textContent = t('hud.time');
    zoomLabelEl.textContent = t('hud.zoom');
  });
}

export function disposeHudOverlay(): void {
  unsubLocale?.();
  unsubLocale = null;
}

/**
 * Format latitude with N/S suffix.
 */
function formatLat(lat: number): string {
  const suffix = lat >= 0 ? 'N' : 'S';
  return `${Math.abs(lat).toFixed(2)}\u00b0${suffix}`;
}

/**
 * Format longitude with E/W suffix.
 */
function formatLng(lng: number): string {
  const suffix = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lng).toFixed(2)}\u00b0${suffix}`;
}

/**
 * Format simTime (unix ms) as ISO-like string: YYYY-MM-DD HH:MM:SS
 */
function formatSimTime(ms: number): string {
  const d = new Date(ms);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Update all HUD values.
 */
export function updateHud(data: {
  lat: number;
  lng: number;
  altitude: number;
  simTime: number;
}): void {
  cameraVal.textContent = `${formatLat(data.lat)} ${formatLng(data.lng)}`;
  simTimeVal.textContent = formatSimTime(data.simTime);
  const altKm = data.altitude * 6371; // fraction of Earth radius → km
  zoomVal.textContent = altKm >= 1000 ? `${(altKm / 1000).toFixed(1)}k km` : `${altKm.toFixed(0)} km`;
}
