import './styles.css';

import type { ConsoleStateId } from './content';
import type { AppRoute, LabTabId } from './routeModel';
import { resolveLabTab } from './routeModel';
import { renderLabView, renderLiveServiceView } from './templates';
import {
  computeServiceState,
  createInitialState,
  fetchEvents,
  type ServiceState,
} from './serviceEngine';

type NamazueRoute = Exclude<AppRoute, 'legacy'>;

const POLL_INTERVAL_MS = 60_000;

function removeLegacyLoadingScreen(): void {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.remove();
  }
}

function titleForRoute(route: NamazueRoute): string {
  return route === 'service'
    ? 'namazue.dev — Earthquake Operations Console'
    : 'namazue.dev / lab — Console Workbench';
}

// ── Service Route Bootstrap ─────────────────────────────────────

function bootstrapServiceRoute(root: HTMLElement): void {
  let state: ServiceState = createInitialState();
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  function render(): void {
    root.className = 'namazue-app';
    root.innerHTML = renderLiveServiceView(state);
  }

  async function refresh(): Promise<void> {
    try {
      const events = await fetchEvents();
      const computed = computeServiceState(events);
      state = {
        ...computed,
        status: 'ready',
        lastUpdated: Date.now(),
        error: null,
      };
    } catch (err) {
      console.error('[namazue] Fetch failed:', err);
      if (state.status === 'loading') {
        state = {
          ...state,
          status: 'error',
          error: 'Failed to connect to earthquake data feeds.',
        };
      }
    }
    render();
  }

  // Initial render (loading state)
  render();

  // Fetch data immediately
  refresh();

  // Poll every 60 seconds
  pollTimer = setInterval(refresh, POLL_INTERVAL_MS);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      if (pollTimer) clearInterval(pollTimer);
    });
  }
}

// ── Lab Route Bootstrap ─────────────────────────────────────────

function bootstrapLabRoute(root: HTMLElement): void {
  const state: {
    consoleState: ConsoleStateId;
    labTab: LabTabId;
  } = {
    consoleState: 'calm',
    labTab: resolveLabTab(window.location.pathname),
  };

  function render(): void {
    root.className = 'namazue-app';
    root.innerHTML = renderLabView(state.consoleState, state.labTab);
    bindConsoleStateButtons();
    bindLabTabs();
  }

  function bindConsoleStateButtons(): void {
    root.querySelectorAll<HTMLButtonElement>('[data-console-state]').forEach((button) => {
      button.addEventListener('click', () => {
        const nextState = button.dataset.consoleState as ConsoleStateId | undefined;
        if (!nextState || nextState === state.consoleState) return;
        state.consoleState = nextState;
        render();
      });
    });
  }

  function bindLabTabs(): void {
    root.querySelectorAll<HTMLButtonElement>('[data-lab-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        const nextTab = button.dataset.labTab as LabTabId | undefined;
        if (!nextTab || nextTab === state.labTab) return;
        state.labTab = nextTab;
        const nextPath = nextTab === 'console' ? '/lab' : `/lab/${nextTab}`;
        window.history.pushState({ tab: nextTab }, '', nextPath);
        render();
      });
    });
  }

  function handlePopState(): void {
    state.labTab = resolveLabTab(window.location.pathname);
    render();
  }

  window.addEventListener('popstate', handlePopState);
  render();

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      window.removeEventListener('popstate', handlePopState);
    });
  }
}

// ── Entry ───────────────────────────────────────────────────────

export function bootstrapNamazueApp(route: NamazueRoute): void {
  const app = document.getElementById('app');
  if (!app) {
    throw new Error('Missing #app root element');
  }

  removeLegacyLoadingScreen();
  document.title = titleForRoute(route);
  document.body.classList.add('namazue-body');

  if (route === 'service') {
    bootstrapServiceRoute(app);
  } else {
    bootstrapLabRoute(app);
  }
}
