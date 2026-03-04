/**
 * Impact Panel — Displays affected prefecture list with intensity + population
 *
 * Renders in the sidebar area showing which prefectures are affected,
 * their max JMA intensity, and exposed population.
 *
 * Feature 3: Administrative area × isoseismal → damage summary
 */

import type { PrefectureImpact, JmaClass } from '../types';
import { JMA_COLORS } from '../types';
import { store } from '../store/appState';
import { t, onLocaleChange } from '../i18n/index';

// ============================================================
// State
// ============================================================

let panelEl: HTMLElement | null = null;
let unsubImpact: (() => void) | null = null;
let unsubLocale: (() => void) | null = null;

// ============================================================
// Helpers
// ============================================================

function formatPopulation(pop: number): string {
  if (pop >= 1_000_000) return `${(pop / 1_000_000).toFixed(1)}M`;
  if (pop >= 1_000) return `${(pop / 1_000).toFixed(0)}K`;
  return pop.toLocaleString();
}

function jmaClassColor(jmaClass: JmaClass): string {
  return JMA_COLORS[jmaClass] || '#888';
}

// ============================================================
// Render
// ============================================================

function render(impacts: PrefectureImpact[] | null): void {
  if (!panelEl) return;

  if (!impacts || impacts.length === 0) {
    panelEl.style.display = 'none';
    return;
  }

  panelEl.style.display = 'block';

  // Filter to show only JMA 3+ prefectures, limit to top 10
  const visible = impacts.filter(p => p.maxIntensity >= 2.5).slice(0, 10);

  if (visible.length === 0) {
    panelEl.style.display = 'none';
    return;
  }

  // Total exposed uses only the visible prefectures (consistent with displayed rows)
  const totalExposed = visible.reduce((sum, p) => sum + p.exposedPopulation, 0);

  panelEl.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'impact-panel__header';
  header.textContent = t('impact.title');
  panelEl.appendChild(header);

  // Prefecture rows
  const list = document.createElement('div');
  list.className = 'impact-panel__list';

  for (const p of visible) {
    const row = document.createElement('div');
    row.className = 'impact-panel__row';

    const colorDot = document.createElement('span');
    colorDot.className = 'impact-panel__dot';
    colorDot.style.background = jmaClassColor(p.jmaClass);
    row.appendChild(colorDot);

    const classLabel = document.createElement('span');
    classLabel.className = 'impact-panel__class mono';
    classLabel.textContent = p.jmaClass;
    classLabel.style.color = jmaClassColor(p.jmaClass);
    row.appendChild(classLabel);

    const name = document.createElement('span');
    name.className = 'impact-panel__name';
    name.textContent = p.name;
    row.appendChild(name);

    const pop = document.createElement('span');
    pop.className = 'impact-panel__pop mono';
    pop.textContent = formatPopulation(p.population);
    row.appendChild(pop);

    list.appendChild(row);
  }

  panelEl.appendChild(list);

  // Total exposed
  if (totalExposed > 0) {
    const footer = document.createElement('div');
    footer.className = 'impact-panel__footer';
    footer.innerHTML = `${t('impact.totalExposed')}: <span class="mono" style="color:var(--accent)">${formatPopulation(totalExposed)}</span>`;
    panelEl.appendChild(footer);
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Initialize impact panel, appending to the given container.
 */
export function initImpactPanel(container: HTMLElement): void {
  panelEl = document.createElement('div');
  panelEl.className = 'impact-panel';
  panelEl.style.display = 'none';
  container.appendChild(panelEl);

  // Subscribe to impact results changes
  unsubImpact = store.subscribe('impactResults', render);

  unsubLocale = onLocaleChange(() => {
    render(store.get('impactResults'));
  });
}

/**
 * Clean up impact panel.
 */
export function disposeImpactPanel(): void {
  unsubImpact?.();
  unsubImpact = null;
  unsubLocale?.();
  unsubLocale = null;
  panelEl?.remove();
  panelEl = null;
}
