/**
 * Namazue — View State Machine
 *
 * Manages all UI state transitions with strict rules.
 * Every screen change goes through dispatch() — no ad-hoc store.set('route', ...).
 *
 * States:
 *   idle         → Globe + earthquake list (default)
 *   detail       → Earthquake selected, AI panel open
 *   analysis     → Layer 3 expanded from detail
 *   search       → Search modal open
 *   regionReport → AI region report
 *   newQuake     → New earthquake notification (auto for M5.5+)
 *   presentation → All panels hidden, fullscreen globe
 *
 * Safety:
 *   - Invalid transitions are silently ignored (state doesn't change)
 *   - Every transition is logged in dev mode for debugging
 *   - State history is kept for BACK action support
 */

import { store } from './appState';
import type { ViewState, ViewAction } from '../types';

// ============================================================
// Pure Transition Function (no side effects)
// ============================================================

export function transition(current: ViewState, action: ViewAction): ViewState {
  switch (current.type) {
    case 'idle':
      switch (action.type) {
        case 'SELECT_EARTHQUAKE':
          return { type: 'detail', earthquakeId: action.id };
        case 'OPEN_SEARCH':
          return { type: 'search', query: '' };
        case 'SEARCH':
          return { type: 'search', query: action.query };
        case 'NEW_EARTHQUAKE':
          return { type: 'newQuake', earthquakeId: action.id, magnitude: action.magnitude };
        case 'ENTER_PRESENTATION':
          return { type: 'presentation', earthquakeId: null };
        default:
          return current;
      }

    case 'detail':
      switch (action.type) {
        case 'EXPAND_ANALYSIS':
          return { type: 'analysis', earthquakeId: current.earthquakeId };
        case 'DESELECT':
        case 'CLOSE_OVERLAY':
        case 'BACK':
          return { type: 'idle' };
        case 'SELECT_EARTHQUAKE':
          return { type: 'detail', earthquakeId: action.id };
        case 'ENTER_PRESENTATION':
          return { type: 'presentation', earthquakeId: current.earthquakeId };
        case 'OPEN_SEARCH':
          return { type: 'search', query: '' };
        case 'NEW_EARTHQUAKE':
          // Big earthquake interrupts detail view
          if (action.magnitude >= 5.5) {
            return { type: 'newQuake', earthquakeId: action.id, magnitude: action.magnitude };
          }
          return current;
        default:
          return current;
      }

    case 'analysis':
      switch (action.type) {
        case 'COLLAPSE_ANALYSIS':
        case 'BACK':
          return { type: 'detail', earthquakeId: current.earthquakeId };
        case 'DESELECT':
        case 'CLOSE_OVERLAY':
          return { type: 'idle' };
        case 'SELECT_EARTHQUAKE':
          return { type: 'detail', earthquakeId: action.id };
        case 'ENTER_PRESENTATION':
          return { type: 'presentation', earthquakeId: current.earthquakeId };
        default:
          return current;
      }

    case 'search':
      switch (action.type) {
        case 'SEARCH':
          return { type: 'search', query: action.query };
        case 'SELECT_REGION':
          return { type: 'regionReport', regionId: action.regionId, query: current.query };
        case 'SELECT_EARTHQUAKE':
          return { type: 'detail', earthquakeId: action.id };
        case 'CLOSE_OVERLAY':
        case 'BACK':
          return { type: 'idle' };
        default:
          return current;
      }

    case 'regionReport':
      switch (action.type) {
        case 'BACK':
          return { type: 'search', query: current.query };
        case 'CLOSE_OVERLAY':
          return { type: 'idle' };
        case 'SELECT_EARTHQUAKE':
          return { type: 'detail', earthquakeId: action.id };
        default:
          return current;
      }

    case 'newQuake':
      switch (action.type) {
        // Auto-transition to detail after acknowledgment or timeout
        case 'SELECT_EARTHQUAKE':
          return { type: 'detail', earthquakeId: action.id };
        case 'DESELECT':
        case 'CLOSE_OVERLAY':
          return { type: 'idle' };
        case 'BACK':
          return { type: 'idle' };
        default:
          return current;
      }

    case 'presentation':
      switch (action.type) {
        case 'EXIT_PRESENTATION':
        case 'BACK':
          // Return to detail if an earthquake was selected, otherwise idle
          if (current.earthquakeId) {
            return { type: 'detail', earthquakeId: current.earthquakeId };
          }
          return { type: 'idle' };
        case 'NEW_EARTHQUAKE':
          // Critical: big earthquakes break through presentation mode
          if (action.magnitude >= 5.5) {
            return { type: 'newQuake', earthquakeId: action.id, magnitude: action.magnitude };
          }
          return current;
        default:
          return current;
      }

    default:
      return current;
  }
}

// ============================================================
// State history for BACK support
// ============================================================

const MAX_HISTORY = 20;
const history: ViewState[] = [];

// ============================================================
// Dispatch — the single entry point for all state changes
// ============================================================

export function dispatch(action: ViewAction): void {
  const current = store.get('viewState');
  const next = transition(current, action);

  // No-op if state didn't change
  if (next === current) {
    if (import.meta.env.DEV) {
      console.debug(`[stateMachine] Ignored: ${action.type} in ${current.type}`);
    }
    return;
  }

  // Push current state to history (for BACK support)
  if (action.type !== 'BACK') {
    history.push(current);
    if (history.length > MAX_HISTORY) history.shift();
  }

  if (import.meta.env.DEV) {
    console.debug(`[stateMachine] ${current.type} → ${next.type} (${action.type})`);
  }

  store.set('viewState', next);
}

// ============================================================
// URL Sync — bidirectional hash ↔ viewState
// ============================================================

function viewStateToHash(state: ViewState): string {
  switch (state.type) {
    case 'idle':
      return '#/';
    case 'detail':
    case 'analysis':
      return `#/eq/${state.earthquakeId}`;
    case 'search':
      return state.query ? `#/search?q=${encodeURIComponent(state.query)}` : '#/search';
    case 'regionReport':
      return `#/region/${state.regionId}`;
    case 'presentation':
      return state.earthquakeId ? `#/present/${state.earthquakeId}` : '#/present';
    case 'newQuake':
      return `#/eq/${state.earthquakeId}`;
    default:
      return '#/';
  }
}

function hashToAction(hash: string): ViewAction | null {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);

  if (segments.length === 0) return { type: 'DESELECT' };

  switch (segments[0]) {
    case 'eq':
      if (segments[1]) return { type: 'SELECT_EARTHQUAKE', id: segments[1] };
      return null;
    case 'search': {
      const params = queryPart ? new URLSearchParams(queryPart) : null;
      const q = params?.get('q') ?? '';
      return q ? { type: 'SEARCH', query: q } : { type: 'OPEN_SEARCH' };
    }
    case 'region':
      if (segments[1]) return { type: 'SELECT_REGION', regionId: segments[1] };
      return null;
    case 'present':
      return { type: 'ENTER_PRESENTATION' };
    default:
      return null;
  }
}

// ============================================================
// Init / Dispose
// ============================================================

let suppressHashChange = false;
let unsubViewState: (() => void) | null = null;

export function initStateMachine(): void {
  // Sync initial hash → state
  if (window.location.hash && window.location.hash !== '#/') {
    const action = hashToAction(window.location.hash);
    if (action) dispatch(action);
  }

  // viewState → hash
  unsubViewState = store.subscribe('viewState', (state: ViewState) => {
    const newHash = viewStateToHash(state);
    if (window.location.hash !== newHash) {
      suppressHashChange = true;
      window.location.hash = newHash;
    }
  });

  // hash → viewState (browser back/forward)
  window.addEventListener('hashchange', onHashChange);
}

function onHashChange(): void {
  if (suppressHashChange) {
    suppressHashChange = false;
    return;
  }
  const action = hashToAction(window.location.hash);
  if (action) dispatch(action);
}

export function disposeStateMachine(): void {
  window.removeEventListener('hashchange', onHashChange);
  unsubViewState?.();
  unsubViewState = null;
  history.length = 0;
}

// ============================================================
// Convenience helpers
// ============================================================

/** Get the currently selected earthquake ID (from any state that has one) */
export function getSelectedEarthquakeId(): string | null {
  const state = store.get('viewState');
  switch (state.type) {
    case 'detail':
    case 'analysis':
    case 'newQuake':
      return state.earthquakeId;
    case 'presentation':
      return state.earthquakeId;
    default:
      return null;
  }
}

/** Is the UI in a state where the globe should be unobstructed? */
export function isGlobeFullscreen(): boolean {
  const state = store.get('viewState');
  return state.type === 'idle' || state.type === 'presentation';
}
