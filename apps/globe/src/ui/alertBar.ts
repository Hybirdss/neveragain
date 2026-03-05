/**
 * Namazue — Alert Bar Component
 *
 * Full-width red pulsing alert bar for M7+ earthquake events.
 * Pure DOM manipulation — no frameworks.
 */

import type { EarthquakeEvent } from '../types';
import { t } from '../i18n/index';
import { getPlaceText } from '../utils/earthquakeUtils';

let alertBarEl: HTMLElement;
let alertTextEl: HTMLElement;
let hideTimerId: ReturnType<typeof setTimeout> | null = null;

/**
 * Create the alert bar DOM element and append to container.
 * Starts hidden (display: none).
 */
export function initAlertBar(container: HTMLElement): void {
  alertBarEl = document.createElement('div');
  alertBarEl.className = 'alert-bar';
  alertBarEl.style.display = 'none';

  alertTextEl = document.createElement('span');
  alertTextEl.className = 'alert-bar__text';
  alertBarEl.appendChild(alertTextEl);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'alert-bar__close';
  closeBtn.type = 'button';
  closeBtn.innerHTML = '\u00d7';
  closeBtn.setAttribute('aria-label', 'Dismiss alert');
  closeBtn.addEventListener('click', () => hideAlert());
  alertBarEl.appendChild(closeBtn);

  container.appendChild(alertBarEl);
}

/**
 * Show the alert bar for an earthquake event.
 * Only triggers for magnitude >= 7.0.
 * Auto-hides after 10 seconds.
 */
export function showAlert(event: EarthquakeEvent): void {
  if (!alertBarEl) return;
  if (event.magnitude < 7.0) return;

  // Clear any pending hide timer
  if (hideTimerId !== null) {
    clearTimeout(hideTimerId);
    hideTimerId = null;
  }

  alertTextEl.textContent = `${t('alert.prefix')} M ${event.magnitude.toFixed(1)} — ${getPlaceText(event.place)}`;
  alertBarEl.style.display = 'flex';

  hideTimerId = setTimeout(() => {
    hideAlert();
  }, 10_000);
}

/**
 * Immediately hide the alert bar.
 */
export function hideAlert(): void {
  if (hideTimerId !== null) {
    clearTimeout(hideTimerId);
    hideTimerId = null;
  }
  if (alertBarEl) alertBarEl.style.display = 'none';
}
