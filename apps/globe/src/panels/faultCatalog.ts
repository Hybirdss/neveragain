/**
 * Fault Catalog Panel — Scenario mode HERP fault selector.
 *
 * In scenario mode (S key): Shows ALL 22 HERP-evaluated faults as a selectable
 * list, like the recent feed. Click a fault → run scenario.
 *
 * In normal mode: hidden by bootstrap (display:none on container).
 */

import { consoleStore } from '../core/store';
import type { ActiveFault } from '../types';

type FaultClickHandler = (fault: ActiveFault) => void;

function riskClass(mw: number): string {
  if (mw >= 8.0) return 'critical';
  if (mw >= 7.0) return 'priority';
  if (mw >= 6.5) return 'watch';
  return 'info';
}

function faultTypeTag(type: string): string {
  switch (type) {
    case 'interface': return '海溝型';
    case 'intraslab': return 'スラブ内';
    case 'crustal': return '活断層';
    default: return type;
  }
}

function probColor(prob: string): string {
  if (prob.includes('70') || prob.includes('80') || prob.includes('90')) return 'nz-fault__prob--high';
  if (prob.includes('14') || prob.includes('30') || prob.includes('16')) return 'nz-fault__prob--mid';
  if (prob.includes('未評価') || prob.includes('不明')) return 'nz-fault__prob--unknown';
  return '';
}

function renderScenarioList(
  allFaults: ActiveFault[],
  selectedEventId: string | null,
): string {
  const sorted = [...allFaults].sort((a, b) => {
    if (a.faultType === 'interface' && b.faultType !== 'interface') return -1;
    if (b.faultType === 'interface' && a.faultType !== 'interface') return 1;
    return b.estimatedMw - a.estimatedMw;
  });

  const items = sorted.map((f) => {
    const risk = riskClass(f.estimatedMw);
    const isSelected = selectedEventId === `scenario-${f.id}`;
    const activeClass = isSelected ? ' nz-fault__item--active' : '';

    return `
      <div class="nz-fault__item nz-fault__item--clickable${activeClass}" data-fault-id="${f.id}">
        <div class="nz-fault__item-top">
          <span class="nz-fault__dot nz-fault__dot--${risk}"></span>
          <span class="nz-fault__mw nz-fault__mw--${risk}">M${f.estimatedMw.toFixed(1)}</span>
          <span class="nz-fault__name">${f.name}</span>
        </div>
        <div class="nz-fault__item-bottom">
          <span class="nz-fault__type-tag">${faultTypeTag(f.faultType)}</span>
          <span class="nz-fault__prob-value ${probColor(f.probability30yr)}">${f.probability30yr}</span>
          <span class="nz-fault__interval">${f.interval}</span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="nz-panel nz-panel--scenario-faults" id="nz-fault-catalog">
      <div class="nz-panel__header">
        <span class="nz-panel__title">HERP 活断層シナリオ</span>
        <span class="nz-fault__count">${allFaults.length}</span>
      </div>
      <div class="nz-fault__hint">クリックでシナリオ実行</div>
      <div class="nz-fault__list nz-fault__list--scenario">${items}</div>
    </div>
  `;
}

export function mountFaultCatalog(
  container: HTMLElement,
  onFaultClick: FaultClickHandler,
): () => void {
  function render(): void {
    const faults = consoleStore.get('faults');
    const selectedEventId = consoleStore.get('selectedEvent')?.id ?? null;
    const scenarioMode = consoleStore.get('scenarioMode');

    if (!scenarioMode) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = renderScenarioList(faults, selectedEventId);
    container.querySelectorAll<HTMLElement>('.nz-fault__item').forEach((el) => {
      el.addEventListener('click', () => {
        const faultId = el.dataset.faultId;
        const fault = faults.find((f) => f.id === faultId);
        if (fault) onFaultClick(fault);
      });
    });
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
  const unsub1 = consoleStore.subscribe('faults', scheduleRender);
  const unsub2 = consoleStore.subscribe('selectedEvent', scheduleRender);
  const unsub3 = consoleStore.subscribe('scenarioMode', scheduleRender);

  return () => {
    unsub1();
    unsub2();
    unsub3();
  };
}
