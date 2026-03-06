/**
 * Icon Atlas — Shared infrastructure icon sprite sheet for deck.gl IconLayer.
 *
 * Uses Lucide icon SVG paths (ISC license) embedded as a single data-URL atlas.
 * mask: true on all icons — getColor provides severity/status tinting.
 *
 * 8 icons × 24×24 viewBox, rendered at 2x (48×48 pixels per icon).
 * Atlas: 384×48 pixels.
 *
 * Icon index:
 *   0: anchor      (port)
 *   1: train-front  (rail_hub)
 *   2: cross        (hospital)
 *   3: zap          (power_substation)
 *   4: droplets     (water_facility)
 *   5: radio-tower  (telecom_hub)
 *   6: building-2   (building_cluster)
 *   7: atom         (nuclear)
 */

import type { OpsAssetClass } from '../ops/types';

// ── Atlas SVG ────────────────────────────────────────────────
// All strokes white, mask mode renders getColor through alpha.
// Filled shapes use stroke="none" to avoid double-weight.

const ATLAS_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="384" height="48" viewBox="0 0 192 24"',
  ' fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',

  // 0: anchor (port)
  '<g transform="translate(0,0)">',
  '<circle cx="12" cy="4" r="2" fill="white"/>',
  '<path d="M12 6v16"/>',
  '<path d="m19 13 2-1a9 9 0 0 1-18 0l2 1"/>',
  '<path d="M9 11h6"/>',
  '</g>',

  // 1: train-front (rail_hub)
  '<g transform="translate(24,0)">',
  '<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/>',
  '<path d="m9 15-1-1"/>',
  '<path d="m15 15 1-1"/>',
  '<path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/>',
  '<path d="m8 19-2 3"/>',
  '<path d="m16 19 2 3"/>',
  '</g>',

  // 2: cross (hospital) — filled shape
  '<g transform="translate(48,0)">',
  '<path d="M4 9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a1 1 0 0 1 1 1v4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4a1 1 0 0 1 1-1h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-4a1 1 0 0 1-1-1V4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4a1 1 0 0 1-1 1z" fill="white" stroke="none"/>',
  '</g>',

  // 3: zap (power_substation) — filled shape
  '<g transform="translate(72,0)">',
  '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" fill="white" stroke="none"/>',
  '</g>',

  // 4: droplets (water_facility) — filled shapes
  '<g transform="translate(96,0)">',
  '<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" fill="white" stroke="none"/>',
  '<path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" fill="white" stroke="none"/>',
  '</g>',

  // 5: radio-tower (telecom_hub)
  '<g transform="translate(120,0)">',
  '<path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9"/>',
  '<path d="M7.8 4.7a6.14 6.14 0 0 0-.8 7.5"/>',
  '<circle cx="12" cy="9" r="2" fill="white"/>',
  '<path d="M16.2 4.8c2 2 2.26 5.11.8 7.47"/>',
  '<path d="M19.1 1.9a9.96 9.96 0 0 1 0 14.1"/>',
  '<path d="M9.5 18h5"/>',
  '<path d="m8 22 4-11 4 11"/>',
  '</g>',

  // 6: building-2 (building_cluster)
  '<g transform="translate(144,0)">',
  '<path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>',
  '<path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/>',
  '<path d="M14 21v-3a2 2 0 0 0-4 0v3"/>',
  '<path d="M10 12h4"/>',
  '<path d="M10 8h4"/>',
  '</g>',

  // 7: atom (nuclear)
  '<g transform="translate(168,0)">',
  '<circle cx="12" cy="12" r="1.5" fill="white"/>',
  '<path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/>',
  '<path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/>',
  '</g>',

  '</svg>',
].join('');

export const ICON_ATLAS_URL = `data:image/svg+xml,${encodeURIComponent(ATLAS_SVG)}`;

// ── Icon Mapping ─────────────────────────────────────────────
// Pixel coordinates in the 384×48 rendered atlas (2x the viewBox).

const CELL = 48; // 24 viewBox × 2x = 48px per cell

function cell(index: number) {
  return { x: index * CELL, y: 0, width: CELL, height: CELL, anchorY: CELL / 2, mask: true };
}

export const ICON_MAPPING: Record<string, { x: number; y: number; width: number; height: number; anchorY: number; mask: boolean }> = {
  port: cell(0),
  rail_hub: cell(1),
  hospital: cell(2),
  power_substation: cell(3),
  water_facility: cell(4),
  telecom_hub: cell(5),
  building_cluster: cell(6),
  nuclear: cell(7),
};

// Alias: thermal plants use the same zap icon as power_substation
ICON_MAPPING['thermal'] = ICON_MAPPING['power_substation'];

// ── Icon Sizes ───────────────────────────────────────────────
// Slightly larger than old ScatterplotLayer radii — icons need
// more pixels to be recognizable vs simple dots.

export const ASSET_ICON_SIZE: Record<OpsAssetClass, number> = {
  port: 20,
  rail_hub: 18,
  hospital: 18,
  power_substation: 18,
  water_facility: 16,
  telecom_hub: 16,
  building_cluster: 18,
};
