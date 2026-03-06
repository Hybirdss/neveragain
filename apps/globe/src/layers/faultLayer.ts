/**
 * Fault Layer — Active fault lines across Japan.
 *
 * Static data (loaded once from /data/active-faults.json).
 * Renders as thin red PathLayer lines. Width scales with estimated Mw.
 * Pickable: click a fault to see its name and properties.
 */

import { PathLayer } from '@deck.gl/layers';
import type { ActiveFault } from '../types';

type RGBA = [number, number, number, number];

const FAULT_COLOR: RGBA = [239, 68, 68, 160]; // visible red
const FAULT_COLOR_HOVER: RGBA = [255, 100, 100, 230]; // bright on hover
const HIGHLIGHT_COLOR: RGBA = [255, 130, 130, 200]; // auto-highlight

function faultWidth(mw: number): number {
  if (mw >= 8.0) return 4;
  if (mw >= 7.0) return 3;
  return 2;
}

export function createFaultLayer(
  faults: ActiveFault[],
  selectedFaultId: string | null = null,
): PathLayer<ActiveFault> | null {
  if (faults.length === 0) return null;

  return new PathLayer<ActiveFault>({
    id: 'active-faults',
    data: faults,
    pickable: true,
    autoHighlight: true,
    highlightColor: HIGHLIGHT_COLOR,
    widthUnits: 'pixels',
    widthMinPixels: 2,
    getPath: (d) => d.segments.map(([lng, lat]) => [lng, lat] as [number, number]),
    getWidth: (d) => faultWidth(d.estimatedMw),
    getColor: (d) => d.id === selectedFaultId ? FAULT_COLOR_HOVER : FAULT_COLOR,
    updateTriggers: {
      getColor: [selectedFaultId],
    },
  });
}
