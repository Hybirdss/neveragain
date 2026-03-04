/**
 * Left Panel — Single-pane container for the Live feed.
 *
 * Previously had tab navigation (Live / Ask), now simplified to a single pane.
 */

import { t, onLocaleChange } from '../i18n/index';

// ── DOM refs ──

let panelEl: HTMLElement | null = null;
let contentEl: HTMLElement | null = null;
let livePaneEl: HTMLElement | null = null;
let titleEl: HTMLElement | null = null;
let unsubLocale: (() => void) | null = null;

// ── Public API ──

export function initLeftPanel(container: HTMLElement): void {
  panelEl = document.createElement('div');
  panelEl.className = 'left-panel';

  // Header
  titleEl = document.createElement('div');
  titleEl.className = 'panel-header';
  titleEl.textContent = t('panel.tab.live');
  panelEl.appendChild(titleEl);

  // Single content pane
  contentEl = document.createElement('div');
  contentEl.className = 'panel-content';

  livePaneEl = document.createElement('div');
  livePaneEl.className = 'panel-pane panel-pane--active';
  livePaneEl.dataset.pane = 'live';
  contentEl.appendChild(livePaneEl);

  panelEl.appendChild(contentEl);
  container.appendChild(panelEl);

  // i18n
  unsubLocale = onLocaleChange(() => {
    if (titleEl) titleEl.textContent = t('panel.tab.live');
  });
}

/**
 * Get the pane element for the live feed to mount into.
 */
export function getTabPane(_tab?: string): HTMLElement | null {
  return livePaneEl ?? null;
}

export function disposeLeftPanel(): void {
  unsubLocale?.();
  unsubLocale = null;
  livePaneEl = null;
  contentEl = null;
  titleEl = null;
  panelEl?.remove();
  panelEl = null;
}
