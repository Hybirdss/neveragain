/**
 * Data Grid Loader — Loads static JSON grids at boot time.
 *
 * Vs30, prefecture, and active fault data.
 */

import type { Vs30Grid, Prefecture, ActiveFault } from '../types';

export interface DataGrids {
  vs30Grid: Vs30Grid | null;
  prefectures: Prefecture[];
  activeFaults: ActiveFault[];
}

interface GridJson {
  cols: number;
  rows: number;
  latMin: number;
  lngMin: number;
  step: number;
  data: number[];
}

async function loadGridJson(url: string): Promise<GridJson | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return await resp.json();
  } catch (err) {
    console.warn(`[dataGridLoader] Failed to load ${url}:`, err);
    return null;
  }
}

function jsonToFloat32Grid(json: GridJson) {
  return {
    data: new Float32Array(json.data),
    cols: json.cols,
    rows: json.rows,
    latMin: json.latMin,
    lngMin: json.lngMin,
    step: json.step,
  };
}

// ── Lazy Vs30 Grid ──────────────────────────────────────────
// Vs30 is ~500-800KB and only needed for GMPE calculation when user
// selects an earthquake. Load it on first demand, not at boot.
let vs30Promise: Promise<Vs30Grid | null> | null = null;

export function getVs30Grid(): Promise<Vs30Grid | null> {
  if (!vs30Promise) {
    vs30Promise = loadGridJson('/data/vs30-grid.json').then(json => {
      if (!json) return null;
      console.log(`[dataGridLoader] Vs30 grid: ${json.rows}x${json.cols}`);
      return jsonToFloat32Grid(json);
    });
  }
  return vs30Promise;
}

export async function loadAllDataGrids(): Promise<DataGrids> {
  console.log('[dataGridLoader] Loading data grids...');

  // Only load small grids at boot — vs30 is lazy-loaded on demand
  const [prefJson, faultJson] = await Promise.all([
    fetch('/data/prefectures.json').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('/data/active-faults.json').then(r => r.ok ? r.json() : null).catch(() => null),
  ]);

  // Kick off vs30 preload in background (don't await)
  getVs30Grid();

  const result: DataGrids = {
    vs30Grid: null,
    prefectures: [],
    activeFaults: [],
  };

  if (prefJson && Array.isArray(prefJson)) {
    result.prefectures = prefJson;
    console.log(`[dataGridLoader] Prefectures: ${result.prefectures.length}`);
  }
  if (faultJson && Array.isArray(faultJson)) {
    result.activeFaults = faultJson;
    console.log(`[dataGridLoader] Active faults: ${result.activeFaults.length}`);
  }

  return result;
}
