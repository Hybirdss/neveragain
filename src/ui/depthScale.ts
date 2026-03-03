/**
 * NeverAgain — Depth Scale Bar
 *
 * Horizontal color bar at bottom-center showing depth-to-color mapping.
 * Inspired by reference UI depth legend pattern.
 */

const DEPTH_COLORS = [
  { depth: 0, color: '#FFE633' },
  { depth: 70, color: '#FFA033' },
  { depth: 150, color: '#FF4444' },
  { depth: 300, color: '#CC22AA' },
  { depth: 500, color: '#7744DD' },
  { depth: 700, color: '#3344BB' },
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

/** Get color for a given depth in km */
export function depthToColor(depth: number): string {
  for (let i = DEPTH_COLORS.length - 1; i >= 0; i--) {
    if (depth >= DEPTH_COLORS[i].depth) return DEPTH_COLORS[i].color;
  }
  return DEPTH_COLORS[0].color;
}
