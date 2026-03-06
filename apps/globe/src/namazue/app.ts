import './styles.css';

import type { ConsoleStateId } from './content';
import type { AppRoute, LabTabId } from './routeModel';
import { resolveLabTab } from './routeModel';
import { renderLabView, renderServiceView } from './templates';

type NamazueRoute = Exclude<AppRoute, 'legacy'>;

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

export function bootstrapNamazueApp(route: NamazueRoute): void {
  const app = document.getElementById('app');
  if (!app) {
    throw new Error('Missing #app root element');
  }
  const root = app;

  removeLegacyLoadingScreen();
  document.title = titleForRoute(route);
  document.body.classList.add('namazue-body');

  const state: {
    consoleState: ConsoleStateId;
    labTab: LabTabId;
  } = {
    consoleState: 'calm',
    labTab: route === 'lab' ? resolveLabTab(window.location.pathname) : 'console',
  };

  function render(): void {
    root.className = 'namazue-app';
    root.innerHTML = route === 'service'
      ? renderServiceView(state.consoleState)
      : renderLabView(state.consoleState, state.labTab);

    bindConsoleStateButtons();
    if (route === 'lab') {
      bindLabTabs();
    }
  }

  function bindConsoleStateButtons(): void {
    root.querySelectorAll<HTMLButtonElement>('[data-console-state]').forEach((button) => {
      button.addEventListener('click', () => {
        const nextState = button.dataset.consoleState as ConsoleStateId | undefined;
        if (!nextState || nextState === state.consoleState) {
          return;
        }
        state.consoleState = nextState;
        render();
      });
    });
  }

  function bindLabTabs(): void {
    root.querySelectorAll<HTMLButtonElement>('[data-lab-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        const nextTab = button.dataset.labTab as LabTabId | undefined;
        if (!nextTab || nextTab === state.labTab) {
          return;
        }
        state.labTab = nextTab;
        const nextPath = nextTab === 'console' ? '/lab' : `/lab/${nextTab}`;
        window.history.pushState({ tab: nextTab }, '', nextPath);
        render();
      });
    });
  }

  function handlePopState(): void {
    if (route !== 'lab') {
      return;
    }
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
