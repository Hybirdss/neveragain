/**
 * Fault Layer — Active fault lines with magnitude-based visual hierarchy.
 *
 * Visual tiers:
 *   MEGA  (M8.0+): 5px, bright magenta, always visible
 *   MAJOR (M7.0+): 3px, red-orange, visible z5+
 *   MOD   (M6.5+): 2px, muted red, visible z7+
 *   MINOR (< M6.5): 1px, dim, visible z9+
 *
 * Scenario mode: selected fault highlighted bright.
 */

import { PathLayer } from '@deck.gl/layers';
import type { ActiveFault } from '../types';

type RGBA = [number, number, number, number];

// ── Visual Tiers ────────────────────────────────────────────

const MEGA_COLOR:  RGBA = [220, 50, 130, 220]; // bright magenta
const MAJOR_COLOR: RGBA = [239, 90, 50, 180];  // red-orange
const MOD_COLOR:   RGBA = [200, 80, 70, 120];  // muted red
const MINOR_COLOR: RGBA = [160, 70, 70, 70];   // dim

const SELECTED_COLOR: RGBA = [255, 200, 60, 255]; // gold highlight
const HIGHLIGHT_COLOR: RGBA = [255, 160, 120, 200];

function faultColor(mw: number, isSelected: boolean): RGBA {
  if (isSelected) return SELECTED_COLOR;
  if (mw >= 8.0) return MEGA_COLOR;
  if (mw >= 7.0) return MAJOR_COLOR;
  if (mw >= 6.5) return MOD_COLOR;
  return MINOR_COLOR;
}

function faultWidth(mw: number): number {
  if (mw >= 8.0) return 5;
  if (mw >= 7.0) return 3;
  if (mw >= 6.5) return 2;
  return 1;
}

// ── Zoom-based Filtering ────────────────────────────────────

function minMwForZoom(zoom: number): number {
  if (zoom >= 9) return 0;    // show all
  if (zoom >= 7) return 6.5;  // moderate+
  if (zoom >= 5) return 7.0;  // major+
  return 8.0;                  // mega only
}

export function filterFaultsByZoom(faults: ActiveFault[], zoom: number): ActiveFault[] {
  const minMw = minMwForZoom(zoom);
  return faults.filter((f) => f.estimatedMw >= minMw);
}

// ── Tooltip Formatter ───────────────────────────────────────

export function formatFaultTooltip(fault: ActiveFault): string {
  const risk = fault.estimatedMw >= 8.0 ? 'MEGA' : fault.estimatedMw >= 7.0 ? 'MAJOR' : 'MOD';
  const riskColor = fault.estimatedMw >= 8.0 ? '#dc3282' : fault.estimatedMw >= 7.0 ? '#ef5a32' : '#c85046';
  return `
    <div style="font-weight:600;font-size:12px;margin-bottom:3px">${fault.name}</div>
    <div style="opacity:0.7;font-size:11px">${fault.nameEn}</div>
    <div style="margin-top:4px;display:flex;gap:12px">
      <span style="color:${riskColor};font-weight:700">M${fault.estimatedMw.toFixed(1)}</span>
      <span style="opacity:0.6">${Math.round(fault.lengthKm)}km</span>
      <span style="opacity:0.6">${fault.depthKm}km deep</span>
    </div>
    <div style="opacity:0.5;font-size:10px;margin-top:3px">
      ${risk} · ${fault.faultType} · 30yr: ${fault.probability30yr} · Interval: ${fault.interval}
    </div>
  `;
}

// ── Layer Factory ───────────────────────────────────────────

export function createFaultLayer(
  faults: ActiveFault[],
  zoom: number,
  selectedFaultId: string | null = null,
): PathLayer<ActiveFault> | null {
  const visible = filterFaultsByZoom(faults, zoom);
  if (visible.length === 0) return null;

  return new PathLayer<ActiveFault>({
    id: 'active-faults',
    data: visible,
    pickable: true,
    autoHighlight: true,
    highlightColor: HIGHLIGHT_COLOR,
    widthUnits: 'pixels',
    widthMinPixels: 1,
    getPath: (d) => d.segments.map(([lng, lat]) => [lng, lat] as [number, number]),
    getWidth: (d) => faultWidth(d.estimatedMw),
    getColor: (d) => faultColor(d.estimatedMw, d.id === selectedFaultId),
    updateTriggers: {
      getColor: [selectedFaultId],
    },
  });
}
