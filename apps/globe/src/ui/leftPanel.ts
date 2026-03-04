/**
 * Left Panel — Tab container shell for Live / Ask
 *
 * Manages the tab bar and swaps active tab pane.
 * Each tab pane is initialized lazily by the respective module.
 */

import { store } from '../store/appState';
import type { PanelTab } from '../types';
import { t, onLocaleChange } from '../i18n/index';

// ── DOM refs ──

let panelEl: HTMLElement;
let tabBar: HTMLElement;
let contentEl: HTMLElement;
let panes: Map<PanelTab, HTMLElement> = new Map();
let tabButtons: Map<PanelTab, HTMLButtonElement> = new Map();
let unsubPanel: (() => void) | null = null;
let unsubLocale: (() => void) | null = null;

// ── Tab config ──

interface TabConfig {
  id: PanelTab;
  labelKey: string;
  icon: string; // SVG path
}

const TABS: TabConfig[] = [
  {
    id: 'live',
    labelKey: 'panel.tab.live',
    icon: '<circle cx="5" cy="5" r="3" fill="currentColor"/><circle cx="5" cy="5" r="5" stroke="currentColor" fill="none" stroke-width="1"/>',
  },
  {
    id: 'ask',
    labelKey: 'panel.tab.ask',
    icon: '<path d="M2 3h10a1 1 0 011 1v6a1 1 0 01-1 1H5l-3 2V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" fill="none"/>',
  },
];

// ── Helpers ──

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ── Build UI ──

function buildTabBar(): HTMLElement {
  tabBar = el('div', 'panel-tabs');

  for (const tab of TABS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'panel-tab';
    btn.dataset.tab = tab.id;

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'panel-tab__icon');
    icon.setAttribute('viewBox', '0 0 14 14');
    icon.setAttribute('fill', 'none');
    icon.innerHTML = tab.icon;

    const label = document.createElement('span');
    label.textContent = t(tab.labelKey);
    label.dataset.i18nKey = tab.labelKey;

    btn.appendChild(icon);
    btn.appendChild(label);

    btn.addEventListener('click', () => {
      store.set('activePanel', tab.id);
      store.set('route', { ...store.get('route'), tab: tab.id });
    });

    tabButtons.set(tab.id, btn);
    tabBar.appendChild(btn);
  }

  return tabBar;
}

function buildContent(): HTMLElement {
  contentEl = el('div', 'panel-content');

  for (const tab of TABS) {
    const pane = el('div', 'panel-pane');
    pane.dataset.pane = tab.id;
    panes.set(tab.id, pane);
    contentEl.appendChild(pane);
  }

  return contentEl;
}

function syncActiveTab(tab: PanelTab): void {
  for (const [id, btn] of tabButtons) {
    btn.classList.toggle('panel-tab--active', id === tab);
  }
  for (const [id, pane] of panes) {
    pane.classList.toggle('panel-pane--active', id === tab);
  }
}

// ── Public API ──

export function initLeftPanel(container: HTMLElement): void {
  panelEl = el('div', 'left-panel');
  panelEl.appendChild(buildTabBar());
  panelEl.appendChild(buildContent());
  container.appendChild(panelEl);

  // Set initial active tab
  syncActiveTab(store.get('activePanel'));

  // Subscribe to tab changes
  unsubPanel = store.subscribe('activePanel', syncActiveTab);

  // i18n
  unsubLocale = onLocaleChange(() => {
    for (const [, btn] of tabButtons) {
      const label = btn.querySelector('span[data-i18n-key]') as HTMLElement | null;
      if (label) {
        const key = label.dataset.i18nKey!;
        label.textContent = t(key);
      }
    }
  });
}

/**
 * Get the pane element for a specific tab, for child components to mount into.
 */
export function getTabPane(tab: PanelTab): HTMLElement | null {
  return panes.get(tab) ?? null;
}

export function disposeLeftPanel(): void {
  unsubPanel?.();
  unsubPanel = null;
  unsubLocale?.();
  unsubLocale = null;
  panes.clear();
  tabButtons.clear();
}
