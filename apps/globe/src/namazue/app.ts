import './styles.css';

import type { ConsoleStateId } from './content';
import type { LabTabId } from './routeModel';
import { resolveLabTab } from './routeModel';
import { renderLabView } from './templates';

function removeLegacyLoadingScreen(): void {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.remove();
  }
}

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

export function bootstrapNamazueApp(): void {
  const app = document.getElementById('app');
  if (!app) {
    throw new Error('Missing #app root element');
  }

  removeLegacyLoadingScreen();
  document.title = 'namazue.dev / lab — Console Workbench';
  document.body.classList.add('namazue-body');
  bootstrapLabRoute(app);
}
