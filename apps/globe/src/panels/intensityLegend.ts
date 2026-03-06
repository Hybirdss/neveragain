/**
 * Intensity Legend — JMA seismic intensity scale color reference.
 *
 * Floating legend panel showing JMA intensity scale colors.
 * Only visible when an intensity grid is active (event selected).
 * Colors match intensityLayer.ts exactly.
 */

import { consoleStore } from '../core/store';

// JMA intensity scale with colors matching intensityLayer.ts intensityToColor()
const JMA_SCALE: Array<{ label: string; color: string }> = [
  { label: '7',  color: 'rgb(150, 0, 80)' },
  { label: '6\u5F37', color: 'rgb(200, 0, 0)' },
  { label: '6\u5F31', color: 'rgb(239, 50, 0)' },
  { label: '5\u5F37', color: 'rgb(255, 100, 0)' },
  { label: '5\u5F31', color: 'rgb(255, 160, 0)' },
  { label: '4',  color: 'rgb(255, 220, 0)' },
  { label: '3',  color: 'rgb(80, 200, 100)' },
  { label: '2',  color: 'rgb(60, 130, 200)' },
  { label: '1',  color: 'rgb(40, 80, 140)' },
];

function renderLegend(): string {
  const rows = JMA_SCALE.map(({ label, color }) =>
    `<div class="nz-intensity-legend__row">
      <div class="nz-intensity-legend__swatch" style="background:${color}"></div>
      <span class="nz-intensity-legend__label">${label}</span>
    </div>`
  ).join('');

  return `
    <div class="nz-intensity-legend__title">\u9707\u5EA6 JMA</div>
    ${rows}
  `;
}

export function mountIntensityLegend(container: HTMLElement): () => void {
  container.className = 'nz-intensity-legend';
  container.setAttribute('hidden', '');
  container.innerHTML = renderLegend();

  const unsub = consoleStore.subscribe('intensityGrid', (grid) => {
    if (grid) {
      container.removeAttribute('hidden');
    } else {
      container.setAttribute('hidden', '');
    }
  });

  // Check initial state
  if (consoleStore.get('intensityGrid')) {
    container.removeAttribute('hidden');
  }

  return () => {
    unsub();
    container.remove();
  };
}
