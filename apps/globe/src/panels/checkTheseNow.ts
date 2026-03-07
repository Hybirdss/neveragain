/**
 * Check These Now — Right rail priority action queue.
 *
 * THE operational conclusion: ordered list of what to inspect first.
 * Consumes OpsPriority[] from the service engine.
 * Each item shows severity badge, title, and rationale.
 */

import { consoleStore } from '../core/store';
import { formatSeverityLabel, operatorText } from '../ops/operatorLocale';
import type { ServiceReadModel } from '../ops/readModelTypes';
import type { OpsPriority, OpsSeverity } from '../ops/types';

export const MAX_VISIBLE_PRIORITIES = 3;

function severityBadgeClass(sev: OpsSeverity): string {
  switch (sev) {
    case 'critical': return 'critical';
    case 'priority': return 'priority';
    case 'watch': return 'watch';
    default: return 'info';
  }
}

function renderEmpty(message: string): string {
  return `
    <div class="nz-panel" id="nz-check-now">
      <div class="nz-panel__header">
        <span class="nz-panel__title">${operatorText('panel.checkTheseNow')}</span>
      </div>
      <div class="nz-check__empty">${message}</div>
    </div>
  `;
}

export function buildPriorityEmptyMessage(readModel: ServiceReadModel): string {
  return readModel.operationalOverview.impactSummary;
}

export function trimPriorityQueue(
  priorities: OpsPriority[],
  limit: number = MAX_VISIBLE_PRIORITIES,
): OpsPriority[] {
  return priorities.slice(0, limit);
}

function renderPriorities(
  priorities: OpsPriority[],
  totalCount: number,
): string {
  const visiblePriorities = priorities;
  const overflowCount = Math.max(totalCount - visiblePriorities.length, 0);
  const items = visiblePriorities.map((p, i) => {
    const badge = severityBadgeClass(p.severity);
    return `
      <div class="nz-check__item" data-asset-id="${p.assetId ?? ''}">
        <div class="nz-check__item-header">
          <span class="nz-check__rank">${i + 1}</span>
          <span class="nz-check__severity nz-check__severity--${badge}">${formatSeverityLabel(p.severity, true)}</span>
        </div>
        <div class="nz-check__title">${p.title}</div>
        <div class="nz-check__rationale">${p.rationale}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="nz-panel" id="nz-check-now">
      <div class="nz-panel__header">
        <span class="nz-panel__title">${operatorText('panel.checkTheseNow')}</span>
        <span class="nz-check__count">${totalCount}</span>
      </div>
      <div class="nz-check__list">${items}</div>
      ${overflowCount > 0 ? `<div class="nz-check__empty">${operatorText('queue.more', { count: overflowCount })}</div>` : ''}
    </div>
  `;
}

export function selectPriorityQueue(readModel: ServiceReadModel): OpsPriority[] {
  if (readModel.visiblePriorityQueue.length > 0) {
    return readModel.visiblePriorityQueue;
  }

  return readModel.nationalPriorityQueue;
}

export function renderPriorityQueueMarkup(
  readModel: ServiceReadModel,
  limit: number = MAX_VISIBLE_PRIORITIES,
): string {
  const priorities = selectPriorityQueue(readModel);
  if (priorities.length === 0) {
    return renderEmpty(buildPriorityEmptyMessage(readModel));
  }

  return renderPriorities(trimPriorityQueue(priorities, limit), priorities.length);
}

export function mountCheckTheseNow(container: HTMLElement): () => void {
  function render(): void {
    const readModel = consoleStore.get('readModel');
    container.innerHTML = renderPriorityQueueMarkup(readModel);
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
  const unsub = consoleStore.subscribe('readModel', scheduleRender);

  return () => { unsub(); };
}
