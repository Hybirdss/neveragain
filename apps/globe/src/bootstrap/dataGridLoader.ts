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

export async function loadAllDataGrids(): Promise<DataGrids> {
  console.log('[dataGridLoader] Loading data grids...');

  const [vs30Json, prefJson, faultJson] = await Promise.all([
    loadGridJson('/data/vs30-grid.json'),
    fetch('/data/prefectures.json').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('/data/active-faults.json').then(r => r.ok ? r.json() : null).catch(() => null),
  ]);

  const result: DataGrids = {
    vs30Grid: null,
    prefectures: [],
    activeFaults: [],
  };

  if (vs30Json) {
    result.vs30Grid = jsonToFloat32Grid(vs30Json);
    console.log(`[dataGridLoader] Vs30 grid: ${vs30Json.rows}x${vs30Json.cols}`);
  }
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
