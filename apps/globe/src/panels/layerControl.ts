import {
  applyOperatorViewPreset,
  getAllBundleDefinitions,
  getAllOperatorViewPresets,
  getBundleDefinition,
  getOperatorViewPreset,
  isLayerEffectivelyVisible,
  type BundleDensity,
} from '../layers/bundleRegistry';
import { getLayerDefinition, type BundleId, type LayerId, type LegendEntry } from '../layers/layerRegistry';
import { consoleStore, type ConsoleState } from '../core/store';
import type {
  OperatorBundleCounter,
  OperatorBundleDomain,
  OperatorBundleSignal,
  OperatorBundleSummary,
} from '@namazue/ops/ops/readModelTypes';
import { createEmptyServiceReadModel } from '@namazue/ops/ops/serviceReadModel';

export type BundleSummary = Pick<
  OperatorBundleSummary,
  'title' | 'metric' | 'detail' | 'trust' | 'counters' | 'signals' | 'domains'
>;

export interface LayerControlRow {
  id: LayerId;
  label: string;
  availability: 'live' | 'planned';
  visible: boolean;
  effectiveVisible: boolean;
}

export interface LayerControlModel {
  activeBundle: {
    id: BundleId;
    label: string;
    description: string;
  };
  activeView: {
    id: string;
    label: string;
  };
  bundleSummaries: Array<{
    id: BundleId;
    enabled: boolean;
    summary: BundleSummary;
  }>;
  operatorViews: ReturnType<typeof getAllOperatorViewPresets>;
  layerRows: LayerControlRow[];
}

export function buildBundleSummary(bundleId: BundleId, state: ConsoleState): BundleSummary {
  const readModel = state.readModel;
  const backendSummary = readModel.bundleSummaries[bundleId]
    ?? createEmptyServiceReadModel(state.realtimeStatus).bundleSummaries[bundleId];

  if (backendSummary) {
    return {
      title: backendSummary.title,
      metric: backendSummary.metric,
      detail: backendSummary.detail,
      trust: backendSummary.trust,
      counters: backendSummary.counters,
      signals: backendSummary.signals,
      domains: backendSummary.domains,
    };
  }

  const definition = getBundleDefinition(bundleId);
  return {
    title: definition.label,
    metric: 'Bundle truth syncing',
    detail: `${definition.description} Awaiting initial backend summary.`,
    trust: 'pending',
    counters: [],
    signals: [],
    domains: [],
  };
}

function renderCounter(counter: OperatorBundleCounter): string {
  return `
    <span class="nz-bundle-counter nz-bundle-counter--${counter.tone}">
      <span class="nz-bundle-counter__label">${counter.label}</span>
      <span class="nz-bundle-counter__value">${counter.value}</span>
    </span>
  `;
}

function renderSummaryMeta(summary: BundleSummary): string {
  return `
    <div class="nz-bundle-summary-meta">
      <span class="nz-bundle-trust nz-bundle-trust--${summary.trust}">${summary.trust}</span>
      ${summary.counters.map(renderCounter).join('')}
    </div>
  `;
}

function renderSignal(signal: OperatorBundleSignal): string {
  return `
    <div class="nz-bundle-signal nz-bundle-signal--${signal.tone}">
      <span class="nz-bundle-signal__label">${signal.label}</span>
      <span class="nz-bundle-signal__value">${signal.value}</span>
    </div>
  `;
}

function renderSignals(summary: BundleSummary): string {
  if (summary.signals.length === 0) {
    return '';
  }

  return `
    <div class="nz-bundle-signals">
      ${summary.signals.map(renderSignal).join('')}
    </div>
  `;
}

function renderDomain(domain: OperatorBundleDomain): string {
  return `
    <div class="nz-bundle-card">
      <div class="nz-bundle-card__label">${domain.label}</div>
      <div class="nz-bundle-card__metric">${domain.metric}</div>
      <div class="nz-bundle-card__detail">${domain.detail}</div>
      ${domain.signals.length > 0 ? `
        <div class="nz-bundle-signals">
          ${domain.signals.map(renderSignal).join('')}
        </div>
      ` : ''}
      <div class="nz-bundle-summary-meta">
        <span class="nz-bundle-trust nz-bundle-trust--${domain.trust}">${domain.trust}</span>
        ${domain.counters.map(renderCounter).join('')}
      </div>
    </div>
  `;
}

export function buildLayerControlModel(state: ConsoleState): LayerControlModel {
  const activeBundle = getBundleDefinition(state.activeBundleId);
  const activeView = getOperatorViewPreset(state.activeViewId);

  return {
    activeBundle: {
      id: activeBundle.id,
      label: activeBundle.label,
      description: activeBundle.description,
    },
    activeView: {
      id: activeView.id,
      label: activeView.label,
    },
    bundleSummaries: getAllBundleDefinitions().map((bundle) => ({
      id: bundle.id,
      enabled: state.bundleSettings[bundle.id].enabled,
      summary: buildBundleSummary(bundle.id, state),
    })),
    operatorViews: getAllOperatorViewPresets(),
    layerRows: activeBundle.layerIds.map((layerId) => ({
      id: layerId,
      label: getLayerDefinition(layerId).label,
      availability: getLayerDefinition(layerId).availability,
      visible: state.layerVisibility[layerId],
      effectiveVisible: isLayerEffectivelyVisible(
        layerId,
        state.layerVisibility[layerId],
        state.bundleSettings,
      ),
    })),
  };
}

function renderDock(state: ConsoleState, model: LayerControlModel): string {
  return `
    <div class="nz-bottom-bar__info">
      <span class="nz-bottom-bar__zoom">z${state.viewport.zoom.toFixed(1)}</span>
      <span class="nz-bottom-bar__tier">${state.viewport.tier}</span>
      ${state.showCoordinates ? `<span class="nz-bottom-bar__coords">
        ${state.viewport.center.lat.toFixed(3)}° ${state.viewport.center.lng.toFixed(3)}°
      </span>` : ''}
    </div>
    <div class="nz-bundle-dock">
      <div class="nz-bundle-dock__bundles">
        ${model.bundleSummaries.map((entry) => `
          <button
            class="nz-bundle-chip${state.activeBundleId === entry.id ? ' nz-bundle-chip--active' : ''}${entry.enabled ? ' nz-bundle-chip--enabled' : ''}"
            data-bundle="${entry.id}"
          >${entry.summary.title}</button>
        `).join('')}
      </div>
      <div class="nz-bundle-dock__actions">
        <span class="nz-bundle-dock__view">${model.activeView.label}</span>
        <button class="nz-scenario-btn${state.scenarioMode ? ' nz-scenario-btn--on' : ''}" data-action="scenario">
          Scenario
        </button>
        <button class="nz-drawer-toggle${state.bundleDrawerOpen ? ' nz-drawer-toggle--open' : ''}" data-action="drawer">
          ${state.bundleDrawerOpen ? 'Hide Controls' : 'Bundle Controls'}
        </button>
      </div>
    </div>
  `;
}

function renderLegendEntries(layerRows: LayerControlRow[]): string {
  const entries: Array<{ layerLabel: string; legend: LegendEntry[] }> = [];
  for (const row of layerRows) {
    if (!row.visible) continue;
    const def = getLayerDefinition(row.id);
    if (def.legend && def.legend.length > 0) {
      entries.push({ layerLabel: def.label, legend: def.legend });
    }
  }
  if (entries.length === 0) return '';

  return `
    <div class="nz-bundle-card">
      <div class="nz-bundle-card__label">Legend</div>
      <div class="nz-bundle-legend">
        ${entries.map((e) =>
          e.legend.map((entry) => `
            <div class="nz-bundle-legend__row">
              <span class="nz-bundle-legend__swatch" style="background:${entry.color}"></span>
              <span class="nz-bundle-legend__label">${entry.label}</span>
            </div>
          `).join('')
        ).join('')}
      </div>
    </div>
  `;
}

function renderDrawer(state: ConsoleState, model: LayerControlModel): string {
  const activeBundleEnabled = state.bundleSettings[state.activeBundleId].enabled;
  const activeSummary = buildBundleSummary(state.activeBundleId, state);
  const density = state.bundleSettings[state.activeBundleId].density;

  return `
    <div class="nz-bundle-drawer${state.bundleDrawerOpen ? ' nz-bundle-drawer--open' : ''}">
      <div class="nz-bundle-drawer__header">
        <div>
          <div class="nz-bundle-drawer__eyebrow">Operator View</div>
          <div class="nz-bundle-drawer__title">${model.activeBundle.label}</div>
          <div class="nz-bundle-drawer__detail">${model.activeBundle.description}</div>
          <div class="nz-bundle-drawer__density">
            <span class="nz-bundle-drawer__density-label">Density</span>
            <div class="nz-bundle-drawer__density-group">
              <button class="nz-density-btn${density === 'minimal' ? ' nz-density-btn--active' : ''}" data-density="minimal">Minimal</button>
              <button class="nz-density-btn${density === 'standard' ? ' nz-density-btn--active' : ''}" data-density="standard">Standard</button>
              <button class="nz-density-btn${density === 'dense' ? ' nz-density-btn--active' : ''}" data-density="dense">Dense</button>
            </div>
          </div>
        </div>
        <button
          class="nz-bundle-drawer__enable${activeBundleEnabled ? ' nz-bundle-drawer__enable--on' : ''}"
          data-action="toggle-bundle"
        >
          ${activeBundleEnabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      <div class="nz-bundle-drawer__views">
        ${model.operatorViews.map((view) => `
          <button
            class="nz-view-chip${state.activeViewId === view.id ? ' nz-view-chip--active' : ''}"
            data-view="${view.id}"
          >${view.label}</button>
        `).join('')}
      </div>

      <div class="nz-bundle-drawer__content">
        <div class="nz-bundle-drawer__primary">
          <div class="nz-bundle-card">
            <div class="nz-bundle-card__label">Active Summary</div>
            <div class="nz-bundle-card__metric">${activeSummary.metric}</div>
            <div class="nz-bundle-card__detail">${activeSummary.detail}</div>
            ${renderSignals(activeSummary)}
            ${renderSummaryMeta(activeSummary)}
          </div>
          ${activeSummary.domains.length > 0 ? `
            <div class="nz-bundle-card">
              <div class="nz-bundle-card__label">Domain Breakdown</div>
              ${activeSummary.domains.map(renderDomain).join('')}
            </div>
          ` : ''}
          <div class="nz-bundle-card">
            <div class="nz-bundle-card__label">Layers</div>
            <div class="nz-bundle-layer-list">
              ${model.layerRows.map((row) => `
                <button class="nz-bundle-layer-row${row.availability === 'planned' ? ' nz-bundle-layer-row--planned' : ''}" data-layer="${row.id}" ${row.availability === 'planned' ? 'disabled' : ''}>
                  <span class="nz-bundle-layer-row__copy">
                    <span class="nz-bundle-layer-row__title">${row.label}</span>
                    <span class="nz-bundle-layer-row__state">${row.availability === 'planned' ? 'Planned' : row.effectiveVisible ? 'Visible in view' : 'Hidden in view'}</span>
                  </span>
                  <span class="nz-bundle-layer-row__toggle${row.visible ? ' nz-bundle-layer-row__toggle--on' : ''}">
                    ${row.availability === 'planned' ? 'Soon' : row.visible ? 'On' : 'Off'}
                  </span>
                </button>
              `).join('')}
            </div>
          </div>
          ${renderLegendEntries(model.layerRows)}
        </div>

        <div class="nz-bundle-drawer__secondary">
          ${model.bundleSummaries.map((entry) => `
            <button class="nz-bundle-summary-card${state.activeBundleId === entry.id ? ' nz-bundle-summary-card--active' : ''}" data-bundle="${entry.id}">
              <span class="nz-bundle-summary-card__title">${entry.summary.title}</span>
              <span class="nz-bundle-summary-card__metric">${entry.summary.metric}</span>
              <span class="nz-bundle-summary-card__detail">${entry.summary.detail}</span>
              ${renderSignals(entry.summary)}
              ${renderSummaryMeta(entry.summary)}
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function toggleLayer(layerId: LayerId): void {
  const current = consoleStore.get('layerVisibility');
  consoleStore.set('layerVisibility', {
    ...current,
    [layerId]: !current[layerId],
  });
}

function toggleActiveBundle(): void {
  const current = consoleStore.get('bundleSettings');
  const activeBundleId = consoleStore.get('activeBundleId');
  consoleStore.set('bundleSettings', {
    ...current,
    [activeBundleId]: {
      ...current[activeBundleId],
      enabled: !current[activeBundleId].enabled,
    },
  });
}

function bindDockInteractions(dock: HTMLElement, drawer: HTMLElement): void {
  const bindBundleSelection = (button: HTMLButtonElement): void => {
    button.addEventListener('click', () => {
      const bundleId = button.dataset.bundle as BundleId;
      const current = consoleStore.get('activeBundleId');
      if (bundleId === current) {
        consoleStore.set('bundleDrawerOpen', !consoleStore.get('bundleDrawerOpen'));
        return;
      }
      consoleStore.set('activeBundleId', bundleId);
      consoleStore.set('bundleDrawerOpen', true);
    });
  };

  dock.querySelectorAll<HTMLButtonElement>('[data-bundle]').forEach(bindBundleSelection);
  drawer.querySelectorAll<HTMLButtonElement>('[data-bundle]').forEach(bindBundleSelection);

  dock.querySelector<HTMLButtonElement>('[data-action="scenario"]')?.addEventListener('click', () => {
    consoleStore.set('scenarioMode', !consoleStore.get('scenarioMode'));
  });

  dock.querySelector<HTMLButtonElement>('[data-action="drawer"]')?.addEventListener('click', () => {
    consoleStore.set('bundleDrawerOpen', !consoleStore.get('bundleDrawerOpen'));
  });

  drawer.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const viewId = button.dataset.view as ConsoleState['activeViewId'];
      consoleStore.set('activeViewId', viewId);
      consoleStore.set('bundleSettings', applyOperatorViewPreset(viewId, consoleStore.get('bundleSettings')));
      consoleStore.set('activeBundleId', getOperatorViewPreset(viewId).primaryBundle);
      consoleStore.set('bundleDrawerOpen', true);
    });
  });

  drawer.querySelector<HTMLButtonElement>('[data-action="toggle-bundle"]')?.addEventListener('click', () => {
    toggleActiveBundle();
  });

  drawer.querySelectorAll<HTMLButtonElement>('[data-layer]').forEach((button) => {
    button.addEventListener('click', () => {
      const layerId = button.dataset.layer as LayerId;
      toggleLayer(layerId);
    });
  });

  drawer.querySelectorAll<HTMLButtonElement>('[data-density]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const density = btn.dataset.density as BundleDensity;
      const activeBundleId = consoleStore.get('activeBundleId');
      const current = consoleStore.get('bundleSettings');
      consoleStore.set('bundleSettings', {
        ...current,
        [activeBundleId]: { ...current[activeBundleId], density },
      });
    });
  });
}

export function mountLayerControl(dock: HTMLElement, drawerHost: HTMLElement): () => void {
  const render = (): void => {
    const state = consoleStore.getState();
    const model = buildLayerControlModel(state);
    dock.innerHTML = renderDock(state, model);
    drawerHost.innerHTML = renderDrawer(state, model);
    bindDockInteractions(dock, drawerHost);
  };

  render();

  const unsubs = [
    consoleStore.subscribe('viewport', render),
    consoleStore.subscribe('scenarioMode', render),
    consoleStore.subscribe('activeBundleId', render),
    consoleStore.subscribe('activeViewId', render),
    consoleStore.subscribe('bundleSettings', render),
    consoleStore.subscribe('bundleDrawerOpen', render),
    consoleStore.subscribe('layerVisibility', render),
    consoleStore.subscribe('vessels', render),
    consoleStore.subscribe('readModel', render),
    consoleStore.subscribe('showCoordinates', render),
  ];

  return () => {
    for (const unsub of unsubs) unsub();
  };
}
