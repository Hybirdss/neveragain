/**
 * Namazue — Depth Scale Bar
 *
 * Horizontal color bar at bottom-center showing depth-to-color mapping.
 * Inspired by reference UI depth legend pattern.
 */

// Must match DEPTH_BANDS in seismicPoints.ts for visual consistency
const DEPTH_COLORS = [
  { depth: 0,   color: '#ff4444' },  // Shallow (0-30km)
  { depth: 30,  color: '#ff7722' },  // Upper crust (30-70km)
  { depth: 70,  color: '#ffaa00' },  // Lower crust (70-150km)
  { depth: 150, color: '#44aaff' },  // Upper mantle (150-300km)
  { depth: 300, color: '#3355cc' },  // Deep (300-700km)
];

let panelEl: HTMLElement | null = null;

export function initDepthScale(container: HTMLElement): void {
  panelEl = document.createElement('div');
  panelEl.className = 'depth-scale';

  const labelLeft = document.createElement('span');
  labelLeft.className = 'depth-scale__label depth-scale__label--left';
  labelLeft.textContent = '0km';
  panelEl.appendChild(labelLeft);

  for (const { color } of DEPTH_COLORS) {
    const seg = document.createElement('div');
    seg.className = 'depth-scale__segment';
    seg.style.background = color;
    panelEl.appendChild(seg);
  }

  const labelRight = document.createElement('span');
  labelRight.className = 'depth-scale__label depth-scale__label--right';
  labelRight.textContent = '700km';
  panelEl.appendChild(labelRight);

  container.appendChild(panelEl);
}

export function disposeDepthScale(): void {
  panelEl?.remove();
  panelEl = null;
}

