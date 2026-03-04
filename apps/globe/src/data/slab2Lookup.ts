/**
 * Slab2 Lookup — Standalone depth/dip query from contour GeoJSON
 *
 * Reuses the same GeoJSON files as slab2Contours.ts but without Cesium dependency.
 * Can be used by both the globe app and context builder (via Worker).
 *
 * Data source: Hayes et al. (2018), USGS Slab2, Public Domain.
 */

export interface Slab2Data {
  depth_at_point: number | null;    // km below surface
  distance_to_slab: number | null;  // km to nearest contour
  dip_angle: number | null;         // degrees (estimated from depth gradient)
}

// ── Grid configuration (0.5° resolution) ──

const GRID_STEP = 0.5;
const LAT_MIN = 20;
const LAT_MAX = 50;
const LNG_MIN = 120;
const LNG_MAX = 155;
const GRID_COLS = Math.ceil((LNG_MAX - LNG_MIN) / GRID_STEP);
const GRID_ROWS = Math.ceil((LAT_MAX - LAT_MIN) / GRID_STEP);

/** Depth grid (km). NaN = no slab data. */
const depthGrid = new Float32Array(GRID_ROWS * GRID_COLS).fill(NaN);
let initialized = false;

function gridIndex(lat: number, lng: number): number {
  const row = Math.floor((lat - LAT_MIN) / GRID_STEP);
  const col = Math.floor((lng - LNG_MIN) / GRID_STEP);
  if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return -1;
  return row * GRID_COLS + col;
}

/**
 * Load slab2 contour GeoJSON files and populate the depth grid.
 * Call once at startup. Idempotent.
 */
export async function initSlab2Grid(basePath = '/data/slab2'): Promise<void> {
  if (initialized) return;

  const slabs = ['kur', 'izu', 'ryu'];

  await Promise.allSettled(
    slabs.map(async (slab) => {
      try {
        const resp = await fetch(`${basePath}/${slab}_contours.json`);
        if (!resp.ok) return;
        const ct = resp.headers.get('content-type') ?? '';
        if (!ct.includes('json')) return;

        const geojson = await resp.json() as {
          features: Array<{
            properties?: { depth_km?: number; depth?: number };
            geometry?: { type: string; coordinates: number[][] | number[][][] };
          }>;
        };

        for (const feature of geojson.features) {
          const geom = feature.geometry;
          if (!geom) continue;
          const depthKm = Math.abs(
            Number(feature.properties?.depth_km ?? feature.properties?.depth ?? 0)
          );

          const lines: number[][] =
            geom.type === 'MultiLineString'
              ? (geom.coordinates as number[][][]).flat()
              : geom.type === 'LineString'
                ? geom.coordinates as number[][]
                : [];

          for (const coord of lines) {
            const [lon, lat] = coord;
            const idx = gridIndex(lat, lon);
            if (idx < 0) continue;
            const existing = depthGrid[idx];
            if (isNaN(existing) || depthKm < existing) {
              depthGrid[idx] = depthKm;
            }
          }
        }
      } catch {
        // Slab data not available — non-fatal
      }
    })
  );

  initialized = true;
}

/**
 * Query slab depth at a given coordinate.
 * Returns Slab2Data with depth/dip estimates, or nulls if no slab data.
 */
export function lookupSlab2(lat: number, lng: number): Slab2Data {
  const idx = gridIndex(lat, lng);
  if (idx < 0) return { depth_at_point: null, distance_to_slab: null, dip_angle: null };

  const depth = depthGrid[idx];
  if (isNaN(depth)) {
    return { depth_at_point: null, distance_to_slab: null, dip_angle: null };
  }

  // Estimate dip angle from depth gradient (adjacent cells)
  const row = Math.floor((lat - LAT_MIN) / GRID_STEP);
  const col = Math.floor((lng - LNG_MIN) / GRID_STEP);
  let dip: number | null = null;

  // Check east-west gradient
  const idxE = (col + 1 < GRID_COLS) ? row * GRID_COLS + (col + 1) : -1;
  const idxW = (col - 1 >= 0) ? row * GRID_COLS + (col - 1) : -1;

  if (idxE >= 0 && idxW >= 0 && !isNaN(depthGrid[idxE]) && !isNaN(depthGrid[idxW])) {
    const dDepth = Math.abs(depthGrid[idxE] - depthGrid[idxW]);
    const dDist = 2 * GRID_STEP * 111; // km (approximate)
    dip = Math.atan2(dDepth, dDist) * (180 / Math.PI);
  }

  return {
    depth_at_point: Math.round(depth),
    distance_to_slab: 0, // Point is on the slab
    dip_angle: dip !== null ? Math.round(dip * 10) / 10 : null,
  };
}

/**
 * Direct depth query (compatibility with existing getSlabDepthAt pattern).
 */
export function getSlabDepthAt(lat: number, lng: number): number {
  const idx = gridIndex(lat, lng);
  if (idx < 0) return NaN;
  return depthGrid[idx];
}
