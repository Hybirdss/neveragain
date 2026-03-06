/**
 * Asset Exposure Panel — Left rail, below recent feed.
 *
 * Shows severity status of nearby infrastructure assets.
 * Each asset displays: severity badge, name, class icon, brief summary.
 * Only shows assets that are NOT "clear" (to save space).
 */

import { consoleStore } from '../core/store';
import type { ServiceReadModel } from '../ops/readModelTypes';
import type { OpsAssetExposure } from '../ops/types';
import { OPS_ASSETS } from '../ops/assetCatalog';

const CLASS_ICONS: Record<string, string> = {
  port: '\u2693',      // anchor
  rail_hub: '\u{1F689}', // monorail (safe fallback)
  hospital: '\u271A',  // heavy greek cross
};

function severityBadge(sev: string): string {
  return `<span class="nz-expo__sev nz-expo__sev--${sev}">${sev.toUpperCase()}</span>`;
}

function renderEmpty(message: string): string {
  return `
    <div class="nz-panel nz-panel--collapsed" id="nz-asset-exposure">
      <div class="nz-panel__header">
        <span class="nz-panel__title">Asset Exposure</span>
      </div>
      <div class="nz-expo__clear">${message}</div>
    </div>
  `;
}

export function buildExposureEmptyMessage(readModel: ServiceReadModel): string {
  return readModel.operationalOverview.impactSummary;
}

function renderExposures(exposures: OpsAssetExposure[]): string {
  const assetMap = new Map(OPS_ASSETS.map((a) => [a.id, a]));
  const affected = exposures.filter((e) => e.severity !== 'clear');

  if (affected.length === 0) return renderEmpty('All assets clear');

  const items = affected.map((exp) => {
    const asset = assetMap.get(exp.assetId);
    if (!asset) return '';
    const icon = CLASS_ICONS[asset.class] ?? '';

    return `
      <div class="nz-expo__item">
        <span class="nz-expo__icon">${icon}</span>
        <div class="nz-expo__info">
          <div class="nz-expo__name">${asset.name} ${severityBadge(exp.severity)}</div>
          <div class="nz-expo__summary">${exp.summary}</div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="nz-panel" id="nz-asset-exposure">
      <div class="nz-panel__header">
        <span class="nz-panel__title">Asset Exposure</span>
        <span class="nz-expo__count">${affected.length} affected</span>
      </div>
      <div class="nz-expo__list">${items}</div>
    </div>
  `;
}

export function selectExposureSummary(readModel: ServiceReadModel): OpsAssetExposure[] {
  if (readModel.visibleExposureSummary.length > 0) {
    return readModel.visibleExposureSummary;
  }

  return readModel.nationalExposureSummary;
}

export function mountAssetExposure(container: HTMLElement): () => void {
  function render(): void {
    const readModel = consoleStore.get('readModel');
    const exposures = selectExposureSummary(readModel);
    if (exposures.every((entry) => entry.severity === 'clear')) {
      container.innerHTML = renderEmpty(buildExposureEmptyMessage(readModel));
      return;
    }

    container.innerHTML = renderExposures(exposures);
  }

  render();
  const unsub = consoleStore.subscribe('readModel', render);
  return () => { unsub(); };
}
