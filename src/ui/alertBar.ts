/**
 * NeverAgain — Alert Bar Component
 *
 * Full-width red pulsing alert bar for M7+ earthquake events.
 * Pure DOM manipulation — no frameworks.
 */

import type { EarthquakeEvent } from '../types';
import { t } from '../i18n/index';

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

  container.appendChild(alertBarEl);
}

/**
 * Show the alert bar for an earthquake event.
 * Only triggers for magnitude >= 7.0.
 * Auto-hides after 10 seconds.
 */
export function showAlert(event: EarthquakeEvent): void {
  if (event.magnitude < 7.0) return;

  // Clear any pending hide timer
  if (hideTimerId !== null) {
    clearTimeout(hideTimerId);
    hideTimerId = null;
  }

  alertTextEl.textContent = `${t('alert.prefix')} M ${event.magnitude.toFixed(1)} — ${event.place}`;
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
  alertBarEl.style.display = 'none';
}
