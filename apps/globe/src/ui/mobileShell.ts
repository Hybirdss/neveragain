/**
 * mobileShell.ts — Native-style mobile navigation shell
 *
 * Phone UX is intentionally different from desktop:
 * map-first canvas + bottom tab dock for key flows.
 */

import { t, onLocaleChange } from '../i18n/index';
import { store } from '../store/appState';
import { openAiPanel, closeAiPanel, isAiPanelOpen, onAiPanelOpenChange } from './aiPanel';
import { openSidebar, closeSidebar, isSidebarOpen, onSidebarOpenChange } from './sidebar';

type MobileTab = 'map' | 'events' | 'ai' | 'timeline' | 'training';

interface MobileShellOptions {
  onTraining?: () => void;
}

let rootEl: HTMLElement | null = null;
let tabButtons = new Map<MobileTab, HTMLButtonElement>();
let viewportQuery: MediaQueryList | null = null;
let unsubLocale: (() => void) | null = null;
let unsubAi: (() => void) | null = null;
let unsubSidebar: (() => void) | null = null;
let unsubMode: (() => void) | null = null;
let onViewportChange: ((event: MediaQueryListEvent) => void) | null = null;
let onTrainingAction: (() => void) | null = null;

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

function setTimelineVisible(visible: boolean): void {
  document.body.classList.toggle('mobile-timeline-visible', visible);
}

function isTimelineVisible(): boolean {
  return document.body.classList.contains('mobile-timeline-visible');
}

function setActiveTab(tab: MobileTab): void {
  for (const [key, btn] of tabButtons) {
    btn.classList.toggle('mobile-shell__btn--active', key === tab);
    btn.setAttribute('aria-pressed', String(key === tab));
  }
}

function syncActiveTab(): void {
  if (!isMobileViewport()) return;
  if (isAiPanelOpen()) {
    setActiveTab('ai');
    return;
  }
  if (isSidebarOpen()) {
    setActiveTab('events');
    return;
  }
  if (isTimelineVisible()) {
    setActiveTab('timeline');
    return;
  }
  setActiveTab('map');
}

function applyViewportState(): void {
  if (!rootEl) return;
  const mobile = isMobileViewport();
  rootEl.style.display = mobile ? 'grid' : 'none';
  if (!mobile) {
    setTimelineVisible(false);
    setActiveTab('map');
  } else {
    syncActiveTab();
  }
}

function focusMap(): void {
  closeAiPanel();
  closeSidebar();
  setTimelineVisible(false);
  setActiveTab('map');
}

function focusEvents(): void {
  closeAiPanel();
  setTimelineVisible(false);
  openSidebar();
  setActiveTab('events');
}

function focusAi(): void {
  closeSidebar();
  setTimelineVisible(false);
  openAiPanel();
  setActiveTab('ai');
}

function focusTimeline(): void {
  closeAiPanel();
  closeSidebar();
  const next = !isTimelineVisible();
  setTimelineVisible(next);
  if (next) {
    store.set('mode', 'timeline');
    setActiveTab('timeline');
  } else {
    setActiveTab('map');
  }
}

function openTraining(): void {
  closeAiPanel();
  closeSidebar();
  setTimelineVisible(false);
  setActiveTab('training');
  onTrainingAction?.();
  window.setTimeout(() => {
    if (!isAiPanelOpen() && !isSidebarOpen() && !isTimelineVisible()) {
      setActiveTab('map');
    }
  }, 250);
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
    events: 'mobile.tab.events',
    ai: 'mobile.tab.ai',
    timeline: 'mobile.tab.timeline',
    training: 'mobile.tab.training',
  };

  for (const [tab, btn] of tabButtons) {
    const label = t(keyMap[tab]);
    btn.textContent = label;
    btn.setAttribute('aria-label', label);
  }
}

export function initMobileShell(container: HTMLElement, options: MobileShellOptions = {}): void {
  onTrainingAction = options.onTraining ?? null;

  rootEl = el('nav', 'mobile-shell');
  rootEl.setAttribute('aria-label', 'Mobile Navigation');

  rootEl.append(
    createTab('map', 'mobile.tab.map', focusMap),
    createTab('events', 'mobile.tab.events', focusEvents),
    createTab('ai', 'mobile.tab.ai', focusAi),
    createTab('timeline', 'mobile.tab.timeline', focusTimeline),
    createTab('training', 'mobile.tab.training', openTraining),
  );

  container.appendChild(rootEl);

  viewportQuery = window.matchMedia('(max-width: 768px)');
  onViewportChange = () => applyViewportState();
  viewportQuery.addEventListener('change', onViewportChange);

  unsubLocale = onLocaleChange(() => {
    refreshLabels();
  });
  unsubAi = onAiPanelOpenChange(() => {
    syncActiveTab();
  });
  unsubSidebar = onSidebarOpenChange(() => {
    syncActiveTab();
  });
  unsubMode = store.subscribe('mode', (mode) => {
    if (!isMobileViewport()) return;
    if (mode !== 'timeline' && isTimelineVisible()) {
      setTimelineVisible(false);
    }
    syncActiveTab();
  });

  refreshLabels();
  applyViewportState();
}

export function disposeMobileShell(): void {
  unsubLocale?.();
  unsubLocale = null;
  unsubAi?.();
  unsubAi = null;
  unsubSidebar?.();
  unsubSidebar = null;
  unsubMode?.();
  unsubMode = null;
  if (viewportQuery && onViewportChange) {
    viewportQuery.removeEventListener('change', onViewportChange);
  }
  viewportQuery = null;
  onViewportChange = null;
  onTrainingAction = null;
  tabButtons.clear();
  rootEl?.remove();
  rootEl = null;
  document.body.classList.remove('mobile-timeline-visible');
}

