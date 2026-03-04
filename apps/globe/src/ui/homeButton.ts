/**
 * homeButton.ts — "Return to Japan" floating button
 *
 * Appears when the camera moves outside the Japan bounding box.
 * Calls flyToJapan() on click to smoothly return.
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globe/globeInstance';
import { flyToJapan } from '../globe/globeInstance';
import { t, onLocaleChange } from '../i18n/index';

// Japan bounding box (generous)
const JAPAN_BOUNDS = { minLat: 20, maxLat: 50, minLng: 120, maxLng: 152 };

let btnEl: HTMLButtonElement | null = null;
let removeListener: Cesium.Event.RemoveCallback | null = null;
let unsubLocale: (() => void) | null = null;
let visible = false;

function isOutsideJapan(viewer: GlobeInstance): boolean {
  const carto = viewer.camera.positionCartographic;
  const lat = Cesium.Math.toDegrees(carto.latitude);
  const lng = Cesium.Math.toDegrees(carto.longitude);
  return lat < JAPAN_BOUNDS.minLat || lat > JAPAN_BOUNDS.maxLat ||
         lng < JAPAN_BOUNDS.minLng || lng > JAPAN_BOUNDS.maxLng;
}

function setVisible(show: boolean): void {
  if (!btnEl || visible === show) return;
  visible = show;
  btnEl.classList.toggle('home-button--visible', show);
}

export function initHomeButton(container: HTMLElement, viewer: GlobeInstance): void {
  btnEl = document.createElement('button');
  btnEl.className = 'home-button';
  btnEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8.5L8 3l6 5.5M4 7.5V13h3v-3h2v3h3V7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> ${t('nav.returnToJapan')}`;

  btnEl.addEventListener('click', () => {
    flyToJapan(viewer);
  });

  container.appendChild(btnEl);

  // Check camera position on moveEnd
  removeListener = viewer.camera.moveEnd.addEventListener(() => {
    setVisible(isOutsideJapan(viewer));
  });

  unsubLocale = onLocaleChange(() => {
    if (btnEl) {
      btnEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8.5L8 3l6 5.5M4 7.5V13h3v-3h2v3h3V7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> ${t('nav.returnToJapan')}`;
    }
  });
}

export function disposeHomeButton(): void {
  removeListener?.();
  removeListener = null;
  unsubLocale?.();
  unsubLocale = null;
  btnEl?.remove();
  btnEl = null;
  visible = false;
}
