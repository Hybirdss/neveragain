/**
 * Intensity Legend — dynamic JMA seismic intensity scale.
 *
 * Shows ONLY the intensity levels present in the current grid.
 * Compact horizontal bar positioned bottom-left of the map.
 * Colors match intensityLayer.ts intensityToColor() exactly.
 */

import { consoleStore } from '../core/store';
import type { IntensityGrid } from '../types';

// JMA intensity scale — ordered low to high for horizontal layout.
// RGB values match intensityLayer.ts intensityToColor() thresholds.
const JMA_LEVELS: Array<{ min: number; label: string; color: string }> = [
  { min: 0.5, label: '1',  color: 'rgb(40, 80, 140)' },
  { min: 1.5, label: '2',  color: 'rgb(60, 130, 200)' },
  { min: 2.5, label: '3',  color: 'rgb(80, 200, 100)' },
  { min: 3.5, label: '4',  color: 'rgb(255, 220, 0)' },
  { min: 4.5, label: '5\u5F31', color: 'rgb(255, 160, 0)' },
  { min: 5.0, label: '5\u5F37', color: 'rgb(255, 100, 0)' },
  { min: 5.5, label: '6\u5F31', color: 'rgb(239, 50, 0)' },
  { min: 6.0, label: '6\u5F37', color: 'rgb(200, 0, 0)' },
  { min: 6.5, label: '7',  color: 'rgb(150, 0, 80)' },
];

/**
 * Scan the grid to find which JMA levels are present.
 * Returns a Set of level indices into JMA_LEVELS.
 */
function detectPresentLevels(grid: IntensityGrid): Set<number> {
  const present = new Set<number>();
  const data = grid.data;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v < 0.5) continue;
    // Find which JMA level this value maps to
    for (let j = JMA_LEVELS.length - 1; j >= 0; j--) {
      if (v >= JMA_LEVELS[j].min) {
        present.add(j);
        break;
      }
    }
  }
  return present;
}

function renderLegend(grid: IntensityGrid | null): string {
  if (!grid) return '';

  const present = detectPresentLevels(grid);
  if (present.size === 0) return '';

  const chips = JMA_LEVELS
    .map((level, idx) => {
      if (!present.has(idx)) return '';
      return `<div class="nz-intensity-legend__chip">
        <div class="nz-intensity-legend__swatch" style="background:${level.color}"></div>
        <span class="nz-intensity-legend__label">${level.label}</span>
      </div>`;
    })
    .filter(Boolean)
    .join('');

  return `<span class="nz-intensity-legend__title">\u9707\u5EA6</span>${chips}`;
}

export function mountIntensityLegend(container: HTMLElement): () => void {
  container.className = 'nz-intensity-legend';
  container.setAttribute('hidden', '');

  function update(grid: IntensityGrid | null) {
    if (grid) {
      container.innerHTML = renderLegend(grid);
      if (container.innerHTML) {
        container.removeAttribute('hidden');
      } else {
        container.setAttribute('hidden', '');
      }
    } else {
      container.setAttribute('hidden', '');
    }
  }

  const unsub = consoleStore.subscribe('intensityGrid', update);

  // Check initial state
  update(consoleStore.get('intensityGrid'));

  return () => {
    unsub();
    container.remove();
  };
}
