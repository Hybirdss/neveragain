/**
 * DOM Layout — Creates the application shell DOM structure.
 *
 * Extracted from main.ts createLayout().
 */

import { store } from '../store/appState';
import { t, onLocaleChange } from '../i18n/index';
import { HISTORICAL_PRESETS } from '../engine/presets';
import { showPicker } from '../ui/scenarioPicker';

export interface LayoutContainers {
  globeContainer: HTMLElement;
  globeArea: HTMLElement;
  panelContainer: HTMLElement;
  sidebarContainer: HTMLElement;
  timelineContainer: HTMLElement;
  legendContainer: HTMLElement;
  disposeLayout: () => void;
}

export function createLayout(): LayoutContainers {
  const app = document.getElementById('app')!;
  app.className = 'dashboard';
  app.innerHTML = '';

  // Left panel container (tabs: Live / Ask)
  const panelContainer = document.createElement('div');
  panelContainer.id = 'panel-container';
  app.appendChild(panelContainer);

  // Globe area (wraps globe-container for relative positioning of HUD/legend)
  const globeArea = document.createElement('div');
  globeArea.className = 'globe-area';
  const globeContainer = document.createElement('div');
  globeContainer.id = 'globe-container';
  globeArea.appendChild(globeContainer);
  app.appendChild(globeArea);

  // Hidden container for impact panel (invisible, provides data only)
  const sidebarContainer = document.createElement('div');
  sidebarContainer.id = 'sidebar-container';
  sidebarContainer.style.display = 'none';
  app.appendChild(sidebarContainer);

  // Timeline
  const timelineContainer = document.createElement('div');
  timelineContainer.id = 'timeline-container';
  timelineContainer.style.gridArea = 'timeline';
  app.appendChild(timelineContainer);

  // Legend (positioned inside globe area for correct CSS placement)
  const legendContainer = document.createElement('div');
  legendContainer.id = 'legend-container';
  globeArea.appendChild(legendContainer);

  // Top bar (branding + live status)
  const topBar = document.createElement('div');
  topBar.className = 'top-bar';
  topBar.innerHTML = `
    <div class="top-bar__left">
      <div class="top-bar__brand">
        <div class="top-bar__dot"></div>
        <span class="top-bar__name">鯰 Namazue</span>
        <span class="top-bar__tag mono">4D</span>
      </div>
      <div class="top-bar__divider"></div>
      <span class="top-bar__date mono" id="top-bar-date"></span>
      <span class="top-bar__clock" id="top-bar-clock"></span>
    </div>
    <div class="top-bar__right">
      <div class="top-bar__live-dot"></div>
      <span class="mono" style="font-size:var(--text-2xs);color:var(--text-disabled)">USGS LIVE</span>
    </div>
  `;
  globeArea.appendChild(topBar);

  // Live clock & Date
  const dateEl = topBar.querySelector('#top-bar-date') as HTMLElement;
  const clockEl = topBar.querySelector('#top-bar-clock') as HTMLElement;

  const dateFormatter = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeFormatter = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  function updateClock() {
    const now = new Date();
    dateEl.textContent = dateFormatter.format(now).replace(/\//g, '-');
    clockEl.textContent = `${timeFormatter.format(now)} JST`;
  }
  updateClock();
  const clockIntervalId = window.setInterval(updateClock, 1000);

  // Network error indicator
  const liveDot = topBar.querySelector('.top-bar__live-dot') as HTMLElement;
  const liveLabel = topBar.querySelector('.top-bar__right .mono') as HTMLElement;
  const unsubNetworkError = store.subscribe('networkError', (err) => {
    if (err) {
      liveDot.style.background = 'var(--accent-danger)';
      liveLabel.textContent = 'OFFLINE';
      liveLabel.style.color = 'var(--accent-danger)';
    } else {
      liveDot.style.background = 'var(--accent-positive)';
      liveLabel.textContent = 'USGS LIVE';
      liveLabel.style.color = 'var(--text-disabled)';
    }
  });

  // Scenario trigger button (globe HUD)
  const scenarioBtn = document.createElement('button');
  scenarioBtn.className = 'training-entry-btn';
  scenarioBtn.textContent = `${t('sidebar.training')} (${HISTORICAL_PRESETS.length})`;
  scenarioBtn.addEventListener('click', () => showPicker());
  globeArea.appendChild(scenarioBtn);

  const unsubScenarioLocale = onLocaleChange(() => {
    scenarioBtn.textContent = `${t('sidebar.training')} (${HISTORICAL_PRESETS.length})`;
  });

  return {
    globeContainer,
    globeArea,
    panelContainer,
    sidebarContainer,
    timelineContainer,
    legendContainer,
    disposeLayout: () => {
      window.clearInterval(clockIntervalId);
      unsubNetworkError();
      unsubScenarioLocale();
    },
  };
}
