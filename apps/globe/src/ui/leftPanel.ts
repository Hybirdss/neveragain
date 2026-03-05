/**
 * Left Panel — Single-pane container for the Live feed.
 *
 * Contains:
 *  - Header (title changes with mode: LIVE / ARCHIVE)
 *  - Toolbar (mode switcher mount slot + inline search trigger)
 *  - Content pane (live feed)
 */

import { t, onLocaleChange } from '../i18n/index';
import { store } from '../store/appState';
import { openSearch } from './searchBar';
import { initHeroCard, disposeHeroCard } from './heroCard';

// ── DOM refs ──

let panelEl: HTMLElement | null = null;
let toolbarEl: HTMLElement | null = null;
let modeSwitcherSlotEl: HTMLElement | null = null;
let contentEl: HTMLElement | null = null;
let livePaneEl: HTMLElement | null = null;
let titleEl: HTMLElement | null = null;
let searchHintEl: HTMLElement | null = null;
let heroSlotEl: HTMLElement | null = null;
let unsubLocale: (() => void) | null = null;
let unsubMode: (() => void) | null = null;

// ── Helpers ──

function updateTitle(): void {
  if (!titleEl) return;
  const mode = store.get('mode');
  titleEl.textContent = mode === 'realtime' ? t('panel.tab.live') : t('panel.tab.archive');
}

// ── Public API ──

export function initLeftPanel(container: HTMLElement): void {
  panelEl = document.createElement('div');
  panelEl.className = 'left-panel';

  // Header
  titleEl = document.createElement('div');
  titleEl.className = 'panel-header';
  updateTitle();
  panelEl.appendChild(titleEl);

  // Toolbar (mode switcher slot + search row)
  toolbarEl = document.createElement('div');
  toolbarEl.className = 'panel-toolbar';

  // Mode switcher mount slot (initModeSwitcher appends into this)
  modeSwitcherSlotEl = document.createElement('div');
  toolbarEl.appendChild(modeSwitcherSlotEl);

  // Search trigger row
  const searchRow = document.createElement('div');
  searchRow.className = 'panel-search-row';
  searchRow.addEventListener('click', () => openSearch());

  const searchIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  searchIcon.setAttribute('width', '14');
  searchIcon.setAttribute('height', '14');
  searchIcon.setAttribute('viewBox', '0 0 16 16');
  searchIcon.setAttribute('fill', 'none');
  searchIcon.classList.add('panel-search-icon');
  searchIcon.innerHTML =
    '<circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/>' +
    '<path d="M11 11L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
  searchRow.appendChild(searchIcon);

  searchHintEl = document.createElement('span');
  searchHintEl.className = 'panel-search-hint';
  searchHintEl.textContent = t('search.inlineHint');
  searchRow.appendChild(searchHintEl);

  const kbd = document.createElement('kbd');
  kbd.className = 'panel-search-kbd';
  kbd.textContent = '\u2318K';
  searchRow.appendChild(kbd);

  toolbarEl.appendChild(searchRow);
  panelEl.appendChild(toolbarEl);

  heroSlotEl = document.createElement('div');
  heroSlotEl.className = 'panel-hero-slot';
  panelEl.appendChild(heroSlotEl);
  initHeroCard(heroSlotEl);

  // Single content pane
  contentEl = document.createElement('div');
  contentEl.className = 'panel-content';

  livePaneEl = document.createElement('div');
  livePaneEl.className = 'panel-pane panel-pane--active';
  livePaneEl.dataset.pane = 'live';
  contentEl.appendChild(livePaneEl);

  panelEl.appendChild(contentEl);
  container.appendChild(panelEl);

  // Mode → header title sync
  unsubMode = store.subscribe('mode', () => updateTitle());

  // i18n
  unsubLocale = onLocaleChange(() => {
    updateTitle();
    if (searchHintEl) searchHintEl.textContent = t('search.inlineHint');
  });
}

/**
 * Get the slot element where the mode switcher should mount.
 */
export function getToolbarSlot(): HTMLElement | null {
  return modeSwitcherSlotEl ?? null;
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
  unsubMode?.();
  unsubMode = null;
  livePaneEl = null;
  contentEl = null;
  toolbarEl = null;
  modeSwitcherSlotEl = null;
  titleEl = null;
  searchHintEl = null;
  heroSlotEl = null;
  disposeHeroCard();
  panelEl?.remove();
  panelEl = null;
}
