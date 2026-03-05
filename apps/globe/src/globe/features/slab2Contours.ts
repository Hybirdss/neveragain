/**
 * slab2Contours.ts — Slab2 subduction zone depth data
 *
 * Loads USGS Slab2 depth contour GeoJSON for Japan's 3 subduction slabs:
 * - kur (Kuril-Kamchatka): Hokkaido → Tohoku
 * - izu (Izu-Bonin): Kanto → south
 * - ryu (Ryukyu): Kyushu → Okinawa
 *
 * Provides getSlabDepthAt() for cross-section and other consumers.
 * Globe contour rendering removed — slab data is now visualization-agnostic.
 *
 * Data source: Hayes et al. (2018), USGS Slab2, Public Domain.
 */

// ── Configuration ────────────────────────────────────────────────

interface SlabConfig {
  id: string;
  url: string;
}

const SLAB_CONFIGS: SlabConfig[] = [
  { id: 'kur', url: '/data/slab2/kur_contours.json' },
  { id: 'izu', url: '/data/slab2/izu_contours.json' },
  { id: 'ryu', url: '/data/slab2/ryu_contours.json' },
];

// ── Slab depth lookup grid (0.5° resolution) ────────────────────

const GRID_STEP = 0.5; // degrees
const LAT_MIN = 20;
const LAT_MAX = 50;
const LNG_MIN = 120;
const LNG_MAX = 155;
const GRID_COLS = Math.ceil((LNG_MAX - LNG_MIN) / GRID_STEP);
const GRID_ROWS = Math.ceil((LAT_MAX - LAT_MIN) / GRID_STEP);

/** Sparse grid storing slab depth (km) per cell. Multiple slabs may overlap — keep shallowest. */
const slabDepthGrid = new Float32Array(GRID_ROWS * GRID_COLS).fill(NaN);

function gridIndex(lat: number, lng: number): number {
  const row = Math.floor((lat - LAT_MIN) / GRID_STEP);
  const col = Math.floor((lng - LNG_MIN) / GRID_STEP);
  if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return -1;
  return row * GRID_COLS + col;
}

function insertSlabDepth(lat: number, lng: number, depthKm: number): void {
  const idx = gridIndex(lat, lng);
  if (idx < 0) return;
  const existing = slabDepthGrid[idx];
  if (isNaN(existing) || depthKm < existing) {
    slabDepthGrid[idx] = depthKm;
  }
}

/**
 * Query the nearest slab depth at a given location.
 * Returns NaN if no slab data exists near this point.
 */
export function getSlabDepthAt(lat: number, lng: number): number {
  const idx = gridIndex(lat, lng);
  if (idx < 0) return NaN;
  return slabDepthGrid[idx];
}

// ── State ────────────────────────────────────────────────────────

let loaded = false;

// ── Public API ───────────────────────────────────────────────────

/**
 * Load Slab2 depth data into the lookup grid.
 * No Cesium dependency — pure data loading.
 */
export async function initSlab2Data(): Promise<void> {
  const results = await Promise.allSettled(
    SLAB_CONFIGS.map(async (config) => {
      try {
        const resp = await fetch(config.url);
        if (!resp.ok) {
          console.warn(`[slab2] Failed to load ${config.id}: ${resp.status}`);
          return;
        }
        const contentType = resp.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json') && !contentType.includes('text/json')) {
          console.warn(`[slab2] ${config.id} data not available (file not built yet)`);
          return;
        }
        const geojson: GeoJSON.FeatureCollection = await resp.json();
        populateGrid(geojson);
        console.log(`[slab2] Loaded ${config.id}: ${geojson.features.length} contours`);
      } catch (err) {
        console.warn(`[slab2] Error loading ${config.id}:`, err);
      }
    })
  );

  loaded = true;
  const successCount = results.filter(r => r.status === 'fulfilled').length;
  console.log(`[slab2] ${successCount}/${SLAB_CONFIGS.length} slabs loaded`);
}

export function isSlab2Loaded(): boolean {
  return loaded;
}

// ── Internal ─────────────────────────────────────────────────────

function populateGrid(geojson: GeoJSON.FeatureCollection): void {
  for (const feature of geojson.features) {
    const geom = feature.geometry;
    if (!geom) continue;

    const depthKm = Math.abs(Number(feature.properties?.depth ?? feature.properties?.value ?? 0));

    const lines: number[][][] =
      geom.type === 'MultiLineString'
        ? (geom as GeoJSON.MultiLineString).coordinates
        : geom.type === 'LineString'
          ? [(geom as GeoJSON.LineString).coordinates]
          : [];

    for (const line of lines) {
      for (const [lon, lat] of line) {
        insertSlabDepth(lat, lon, depthKm);
      }
    }
  }
}
