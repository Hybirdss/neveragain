/**
 * Fault Catalog Panel — Right rail, toggleable fault database.
 *
 * Shows active faults visible in the current viewport.
 * Sorted by estimated Mw (highest risk first).
 * Scenario mode: click a fault → run scenario.
 * Normal mode: read-only info display.
 */

import { consoleStore } from '../core/store';
import { filterFaultsByZoom } from '../layers/faultLayer';
import type { ActiveFault } from '../types';

type FaultClickHandler = (fault: ActiveFault) => void;

function faultTypeLabel(type: string): string {
  switch (type) {
    case 'crustal': return 'Crustal';
    case 'interface': return 'Interface';
    case 'intraslab': return 'Intraslab';
    default: return type;
  }
}

function riskClass(mw: number): string {
  if (mw >= 8.0) return 'critical';
  if (mw >= 7.0) return 'priority';
  if (mw >= 6.5) return 'watch';
  return 'info';
}

function filterByViewport(faults: ActiveFault[], bounds: number[]): ActiveFault[] {
  const [west, south, east, north] = bounds;
  return faults.filter((f) =>
    f.segments.some(([lng, lat]) =>
      lng >= west && lng <= east && lat >= south && lat <= north
    )
  );
}

function renderCatalog(
  faults: ActiveFault[],
  selectedEventId: string | null,
  scenarioMode: boolean,
): string {
  // In normal mode, only show M7.0+ to avoid clutter
  const displayFaults = scenarioMode ? faults : faults.filter((f) => f.estimatedMw >= 7.0);

  if (displayFaults.length === 0) {
    return `
      <div class="nz-panel nz-panel--collapsed" id="nz-fault-catalog">
        <div class="nz-panel__header">
          <span class="nz-panel__title">Active Faults</span>
          <span class="nz-fault__count">${faults.length} in view</span>
        </div>
        <div class="nz-fault__empty">Zoom in to see smaller faults</div>
      </div>
    `;
  }

  const items = displayFaults.map((f) => {
    const risk = riskClass(f.estimatedMw);
    const isSelected = selectedEventId === `scenario-${f.id}`;
    const activeClass = isSelected ? ' nz-fault__item--active' : '';
    const clickable = scenarioMode ? ' nz-fault__item--clickable' : '';

    return `
      <div class="nz-fault__item${activeClass}${clickable}" data-fault-id="${f.id}">
        <div class="nz-fault__item-top">
          <span class="nz-fault__mw nz-fault__mw--${risk}">M${f.estimatedMw.toFixed(1)}</span>
          <span class="nz-fault__name">${f.name}</span>
        </div>
        <div class="nz-fault__item-meta">
          <span class="nz-fault__type">${faultTypeLabel(f.faultType)}</span>
          <span class="nz-fault__sep">·</span>
          <span class="nz-fault__depth">${f.depthKm}km</span>
          <span class="nz-fault__sep">·</span>
          <span class="nz-fault__length">${Math.round(f.lengthKm)}km</span>
          <span class="nz-fault__sep">·</span>
          <span class="nz-fault__prob">${f.probability30yr}</span>
        </div>
      </div>
    `;
  }).join('');

  const modeLabel = scenarioMode ? 'SCENARIO MODE' : '';
  const totalLabel = displayFaults.length < faults.length
    ? `${displayFaults.length}/${faults.length} shown`
    : `${faults.length} in view`;

  return `
    <div class="nz-panel" id="nz-fault-catalog">
      <div class="nz-panel__header">
        <span class="nz-panel__title">Active Faults</span>
        <span class="nz-fault__count">${modeLabel ? `<span class="nz-fault__mode">${modeLabel}</span> ` : ''}${totalLabel}</span>
      </div>
      <div class="nz-fault__list">${items}</div>
    </div>
  `;
}

export function mountFaultCatalog(
  container: HTMLElement,
  onFaultClick: FaultClickHandler,
): () => void {
  let visibleFaults: ActiveFault[] = [];

  function render(): void {
    const faults = consoleStore.get('faults');
    const vp = consoleStore.get('viewport');
    const selectedEventId = consoleStore.get('selectedEvent')?.id ?? null;
    const vis = consoleStore.get('layerVisibility');
    const scenarioMode = consoleStore.get('scenarioMode');

    if (!vis.faults || faults.length === 0) {
      container.innerHTML = '';
      return;
    }

    // Apply same zoom-based filtering as the map layer
    const zoomFiltered = filterFaultsByZoom(faults, vp.zoom);
    visibleFaults = filterByViewport(zoomFiltered, vp.bounds);
    visibleFaults.sort((a, b) => b.estimatedMw - a.estimatedMw);

    container.innerHTML = renderCatalog(visibleFaults, selectedEventId, scenarioMode);

    // Only bind click handlers in scenario mode
    if (scenarioMode) {
      container.querySelectorAll<HTMLElement>('.nz-fault__item').forEach((el) => {
        el.addEventListener('click', () => {
          const faultId = el.dataset.faultId;
          const fault = visibleFaults.find((f) => f.id === faultId);
          if (fault) onFaultClick(fault);
        });
      });
    }
  }

  render();
  const unsub1 = consoleStore.subscribe('faults', render);
  const unsub2 = consoleStore.subscribe('viewport', render);
  const unsub3 = consoleStore.subscribe('selectedEvent', render);
  const unsub4 = consoleStore.subscribe('layerVisibility', render);
  const unsub5 = consoleStore.subscribe('scenarioMode', render);

  return () => {
    unsub1();
    unsub2();
    unsub3();
    unsub4();
    unsub5();
  };
}
