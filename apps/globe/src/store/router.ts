/**
 * Hash-based router — syncs URL hash with store state.
 *
 * Routes:
 *   #/live              → Live feed (default)
 *   #/live/us6000xyz    → Live + event selected
 *   #/search            → Search panel
 *   #/search?q=M6+tohoku → Search with query
 *   #/chat              → AI Chat
 */

import { store } from './appState';
import type { PanelTab, RouteState } from '../types';

const VALID_TABS: PanelTab[] = ['live', 'search', 'chat'];

// ---------------------------------------------------------------------------
// Parse hash → RouteState
// ---------------------------------------------------------------------------

function parseHash(hash: string): RouteState {
  // Remove leading #/ or #
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);

  const tab = (VALID_TABS.includes(segments[0] as PanelTab)
    ? segments[0]
    : 'live') as PanelTab;

  const eventId = segments[1] || null;

  let searchQuery: string | null = null;
  if (queryPart) {
    const params = new URLSearchParams(queryPart);
    searchQuery = params.get('q');
  }

  return { tab, eventId, searchQuery };
}

// ---------------------------------------------------------------------------
// RouteState → hash string
// ---------------------------------------------------------------------------

function serializeRoute(route: RouteState): string {
  let hash = `#/${route.tab}`;
  if (route.eventId) hash += `/${route.eventId}`;
  if (route.searchQuery) hash += `?q=${encodeURIComponent(route.searchQuery)}`;
  return hash;
}

// ---------------------------------------------------------------------------
// Sync logic
// ---------------------------------------------------------------------------

let suppressHashChange = false;

function onHashChange(): void {
  if (suppressHashChange) {
    suppressHashChange = false;
    return;
  }
  const route = parseHash(window.location.hash);
  store.set('activePanel', route.tab);
  store.set('route', route);
}

function onRouteChange(route: RouteState): void {
  const newHash = serializeRoute(route);
  if (window.location.hash !== newHash) {
    suppressHashChange = true;
    window.location.hash = newHash;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let unsubRoute: (() => void) | null = null;

export function initRouter(): void {
  // Set initial state from URL hash (if any)
  if (window.location.hash) {
    const route = parseHash(window.location.hash);
    store.set('activePanel', route.tab);
    store.set('route', route);
  }

  // Listen for browser back/forward
  window.addEventListener('hashchange', onHashChange);

  // Listen for store route changes → update URL
  unsubRoute = store.subscribe('route', onRouteChange);
}

export function disposeRouter(): void {
  window.removeEventListener('hashchange', onHashChange);
  unsubRoute?.();
  unsubRoute = null;
}

/**
 * Navigate to a specific tab, optionally with an event ID or search query.
 */
export function navigateTo(tab: PanelTab, opts?: { eventId?: string; searchQuery?: string }): void {
  const route: RouteState = {
    tab,
    eventId: opts?.eventId ?? null,
    searchQuery: opts?.searchQuery ?? null,
  };
  store.set('activePanel', tab);
  store.set('route', route);
}
