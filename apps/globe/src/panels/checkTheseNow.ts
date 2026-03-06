/**
 * Check These Now — Right rail priority action queue.
 *
 * THE operational conclusion: ordered list of what to inspect first.
 * Consumes OpsPriority[] from the service engine.
 * Each item shows severity badge, title, and rationale.
 */

import { consoleStore } from '../core/store';
import type { ServiceReadModel } from '../ops/readModelTypes';
import type { OpsPriority, OpsSeverity } from '../ops/types';

function severityBadgeClass(sev: OpsSeverity): string {
  switch (sev) {
    case 'critical': return 'critical';
    case 'priority': return 'priority';
    case 'watch': return 'watch';
    default: return 'info';
  }
}

function renderEmpty(): string {
  return `
    <div class="nz-panel" id="nz-check-now">
      <div class="nz-panel__header">
        <span class="nz-panel__title">Check These Now</span>
      </div>
      <div class="nz-check__empty">All assets in clear posture</div>
    </div>
  `;
}

function renderPriorities(priorities: OpsPriority[]): string {
  const items = priorities.map((p, i) => {
    const badge = severityBadgeClass(p.severity);
    return `
      <div class="nz-check__item" data-asset-id="${p.assetId ?? ''}">
        <div class="nz-check__item-header">
          <span class="nz-check__rank">${i + 1}</span>
          <span class="nz-check__severity nz-check__severity--${badge}">${p.severity.toUpperCase()}</span>
        </div>
        <div class="nz-check__title">${p.title}</div>
        <div class="nz-check__rationale">${p.rationale}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="nz-panel" id="nz-check-now">
      <div class="nz-panel__header">
        <span class="nz-panel__title">Check These Now</span>
        <span class="nz-check__count">${priorities.length}</span>
      </div>
      <div class="nz-check__list">${items}</div>
    </div>
  `;
}

export function selectPriorityQueue(readModel: ServiceReadModel | null): OpsPriority[] {
  if (!readModel) {
    return [];
  }

  if (readModel.visiblePriorityQueue.length > 0) {
    return readModel.visiblePriorityQueue;
  }

  return readModel.nationalPriorityQueue;
}

export function mountCheckTheseNow(container: HTMLElement): () => void {
  function render(): void {
    const priorities = selectPriorityQueue(consoleStore.get('readModel'));
    if (!priorities || priorities.length === 0) {
      container.innerHTML = renderEmpty();
    } else {
      container.innerHTML = renderPriorities(priorities);
    }
  }

  render();
  const unsub = consoleStore.subscribe('readModel', render);

  return () => { unsub(); };
}
