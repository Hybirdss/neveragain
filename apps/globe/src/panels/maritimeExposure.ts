/**
 * Maritime Exposure Panel — Left rail, below asset exposure.
 *
 * During event mode: shows vessel count in impact zone,
 * broken down by type with operational priority indicators.
 * Calm mode: shows total tracked vessel count.
 */

import { consoleStore } from '../core/store';
import {
  computeMaritimeExposure,
  type MaritimeExposure,
} from '../layers/aisLayer';
import { buildMaritimeOverview } from '../ops/maritimeTelemetry';

function renderCalm(vesselCount: number): string {
  if (vesselCount === 0) return '';
  const overview = buildMaritimeOverview(consoleStore.get('vessels'));
  return `
    <div class="nz-panel" id="nz-maritime">
      <div class="nz-panel__header">
        <span class="nz-panel__title">Maritime</span>
        <span class="nz-maritime__count">${overview.totalTracked} tracked</span>
      </div>
      <div class="nz-maritime__summary">${overview.summary}</div>
    </div>
  `;
}

function renderExposure(exposure: MaritimeExposure, vesselCount: number): string {
  const rows: string[] = [];

  if (exposure.passengerCount > 0) {
    rows.push(`
      <div class="nz-maritime__row nz-maritime__row--critical">
        <span class="nz-maritime__type-dot" style="background:#7dd3fc"></span>
        <span class="nz-maritime__type-label">Passenger</span>
        <span class="nz-maritime__type-count">${exposure.passengerCount}</span>
        <span class="nz-maritime__type-sev">HIGH PRIORITY</span>
      </div>
    `);
  }
  if (exposure.tankerCount > 0) {
    rows.push(`
      <div class="nz-maritime__row nz-maritime__row--priority">
        <span class="nz-maritime__type-dot" style="background:#fbbf24"></span>
        <span class="nz-maritime__type-label">Tanker</span>
        <span class="nz-maritime__type-count">${exposure.tankerCount}</span>
        <span class="nz-maritime__type-sev">HAZMAT</span>
      </div>
    `);
  }
  if (exposure.cargoCount > 0) {
    rows.push(`
      <div class="nz-maritime__row">
        <span class="nz-maritime__type-dot" style="background:#94a3b8"></span>
        <span class="nz-maritime__type-label">Cargo</span>
        <span class="nz-maritime__type-count">${exposure.cargoCount}</span>
      </div>
    `);
  }
  if (exposure.fishingCount > 0) {
    rows.push(`
      <div class="nz-maritime__row">
        <span class="nz-maritime__type-dot" style="background:#6ee7b7"></span>
        <span class="nz-maritime__type-label">Fishing</span>
        <span class="nz-maritime__type-count">${exposure.fishingCount}</span>
      </div>
    `);
  }

  return `
    <div class="nz-panel" id="nz-maritime">
      <div class="nz-panel__header">
        <span class="nz-panel__title">Maritime Exposure</span>
        <span class="nz-maritime__count nz-maritime__count--alert">${exposure.totalInZone} in zone</span>
      </div>
      <div class="nz-maritime__summary">${exposure.summary}</div>
      <div class="nz-maritime__breakdown">${rows.join('')}</div>
      <div class="nz-maritime__total">${vesselCount} vessels tracked total</div>
    </div>
  `;
}

export function mountMaritimeExposure(container: HTMLElement): () => void {
  function render(): void {
    const vessels = consoleStore.get('vessels');
    const selectedEvent = consoleStore.get('selectedEvent');

    if (vessels.length === 0) {
      container.innerHTML = '';
      return;
    }

    const exposure = computeMaritimeExposure(vessels, selectedEvent);

    if (exposure.totalInZone > 0) {
      container.innerHTML = renderExposure(exposure, vessels.length);
    } else {
      container.innerHTML = renderCalm(vessels.length);
    }
  }

  let renderScheduled = false;
  const scheduleRender = (): void => {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      render();
    });
  };

  render();
  const unsub1 = consoleStore.subscribe('vessels', scheduleRender);
  const unsub2 = consoleStore.subscribe('selectedEvent', scheduleRender);

  return () => {
    unsub1();
    unsub2();
  };
}
