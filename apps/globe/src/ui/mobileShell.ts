/**
 * mobileShell.ts — Native-style mobile navigation shell
 *
 * Phone UX is intentionally different from desktop:
 * map-first canvas + bottom tab dock for key flows.
 */

import { t, onLocaleChange } from '../i18n/index';
import { store } from '../store/appState';

type MobileTab = 'map' | 'live' | 'ask';

let rootEl: HTMLElement | null = null;
let tabButtons = new Map<MobileTab, HTMLButtonElement>();
let viewportQuery: MediaQueryList | null = null;
let unsubLocale: (() => void) | null = null;
let unsubPanel: (() => void) | null = null;
let onViewportChange: ((event: MediaQueryListEvent) => void) | null = null;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function isMobileViewport(): boolean {
  if (viewportQuery) return viewportQuery.matches;
  return window.matchMedia('(max-width: 768px)').matches;
}

function setActiveTab(tab: MobileTab): void {
  for (const [key, btn] of tabButtons) {
    btn.classList.toggle('mobile-shell__btn--active', key === tab);
    btn.setAttribute('aria-pressed', String(key === tab));
    btn.setAttribute('aria-current', key === tab ? 'page' : 'false');
  }
}

function syncActiveTab(): void {
  if (!isMobileViewport()) return;
  const panel = store.get('activePanel');
  if (panel === 'live') {
    setActiveTab('live');
  } else if (panel === 'ask') {
    setActiveTab('ask');
  } else {
    setActiveTab('map');
  }
}

function applyViewportState(): void {
  if (!rootEl) return;
  const mobile = isMobileViewport();
  rootEl.style.display = mobile ? 'grid' : 'none';
  if (!mobile) {
    setActiveTab('map');
  } else {
    syncActiveTab();
  }
}

function focusMap(): void {
  setActiveTab('map');
  // On mobile, hide panel by toggling a body class
  document.body.classList.remove('mobile-panel-visible');
}

function focusLive(): void {
  store.set('activePanel', 'live');
  store.set('route', { ...store.get('route'), tab: 'live' });
  document.body.classList.add('mobile-panel-visible');
  setActiveTab('live');
}

function focusAsk(): void {
  store.set('activePanel', 'ask');
  store.set('route', { ...store.get('route'), tab: 'ask' });
  document.body.classList.add('mobile-panel-visible');
  setActiveTab('ask');
}

function createTab(tab: MobileTab, labelKey: string, handler: () => void): HTMLButtonElement {
  const btn = el('button', 'mobile-shell__btn', t(labelKey)) as HTMLButtonElement;
  btn.type = 'button';
  btn.dataset.tab = tab;
  btn.setAttribute('aria-label', t(labelKey));
  btn.addEventListener('click', handler);
  tabButtons.set(tab, btn);
  return btn;
}

function refreshLabels(): void {
  const keyMap: Record<MobileTab, string> = {
    map: 'mobile.tab.map',
    live: 'mobile.tab.live',
    ask: 'mobile.tab.ask',
  };

  for (const [tab, btn] of tabButtons) {
    const label = t(keyMap[tab]);
    btn.textContent = label;
    btn.setAttribute('aria-label', label);
  }
  if (rootEl) {
    rootEl.setAttribute('aria-label', t('mobile.nav.label'));
  }
}

export function initMobileShell(container: HTMLElement): void {
  void container;

  rootEl = el('nav', 'mobile-shell');
  rootEl.setAttribute('aria-label', t('mobile.nav.label'));

  rootEl.append(
    createTab('map', 'mobile.tab.map', focusMap),
    createTab('live', 'mobile.tab.live', focusLive),
    createTab('ask', 'mobile.tab.ask', focusAsk),
  );

  document.body.appendChild(rootEl);

  viewportQuery = window.matchMedia('(max-width: 768px)');
  onViewportChange = () => applyViewportState();
  viewportQuery.addEventListener('change', onViewportChange);

  unsubLocale = onLocaleChange(() => {
    refreshLabels();
  });

  unsubPanel = store.subscribe('activePanel', () => {
    syncActiveTab();
  });

  refreshLabels();
  applyViewportState();
}

export function disposeMobileShell(): void {
  unsubLocale?.();
  unsubLocale = null;
  unsubPanel?.();
  unsubPanel = null;
  if (viewportQuery && onViewportChange) {
    viewportQuery.removeEventListener('change', onViewportChange);
  }
  viewportQuery = null;
  onViewportChange = null;
  tabButtons.clear();
  rootEl?.remove();
  rootEl = null;
}
