/**
 * slab2Contours.ts — Slab2 subduction zone depth contour visualization
 *
 * Loads USGS Slab2 depth contour GeoJSON for Japan's 3 subduction slabs:
 * - kur (Kuril-Kamchatka): Hokkaido → Tohoku
 * - izu (Izu-Bonin): Kanto → south
 * - ryu (Ryukyu): Kyushu → Okinawa
 *
 * Contour files are pre-converted from *.contours.in text format to GeoJSON
 * LineStrings and hosted on R2. Each line represents a depth isoline
 * (20km, 40km, ... intervals).
 *
 * Data source: Hayes et al. (2018), USGS Slab2, Public Domain.
 * https://www.sciencebase.gov/catalog/item/5aa1b00ee4b0b1c392e86467
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globeInstance';
import { depthToColor } from '../../utils/colorScale';

// ── Configuration ────────────────────────────────────────────────

interface SlabConfig {
  id: string;
  label: string;
  url: string;
}

// URLs to be updated once R2 hosting is configured.
// For now, use placeholder paths that can be served from public/data/slab2/
const SLAB_CONFIGS: SlabConfig[] = [
  { id: 'kur', label: 'Kuril', url: '/data/slab2/kur_contours.json' },
  { id: 'izu', label: 'Izu-Bonin', url: '/data/slab2/izu_contours.json' },
  { id: 'ryu', label: 'Ryukyu', url: '/data/slab2/ryu_contours.json' },
];

// §3-3: Slab2 color = depthToColor(contourDepth_km) with uniform alpha 0.7
function depthContourColor(depthKm: number): Cesium.Color {
  return Cesium.Color.fromCssColorString(depthToColor(depthKm)).withAlpha(0.7);
}

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

let dataSource: Cesium.CustomDataSource | null = null;
let loaded = false;

// ── Public API ───────────────────────────────────────────────────

/**
 * Initialize Slab2 contour layer and start async data loading.
 * Non-blocking — contours appear when data arrives.
 */
export async function initSlab2Contours(viewer: GlobeInstance): Promise<void> {
  dataSource = new Cesium.CustomDataSource('slab2-contours');
  dataSource.show = false; // Hidden by default, enabled via ViewPreset
  viewer.dataSources.add(dataSource);

  // Load all slabs in parallel
  const results = await Promise.allSettled(
    SLAB_CONFIGS.map(async (config) => {
      try {
        const resp = await fetch(config.url);
        if (!resp.ok) {
          console.warn(`[slab2] Failed to load ${config.id}: ${resp.status}`);
          return;
        }
        // Vite SPA fallback serves index.html for missing routes (200 OK but HTML)
        const contentType = resp.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json') && !contentType.includes('text/json')) {
          console.warn(`[slab2] ${config.id} data not available (file not built yet)`);
          return;
        }
        const geojson: GeoJSON.FeatureCollection = await resp.json();
        renderSlabContours(geojson, config);
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

export function setSlab2Visible(visible: boolean): void {
  if (dataSource) dataSource.show = visible;
}

export function disposeSlab2(): void {
  if (dataSource) {
    dataSource.entities.removeAll();
    dataSource = null;
  }
  loaded = false;
}

export function isSlab2Loaded(): boolean {
  return loaded;
}

// ── Internal rendering ───────────────────────────────────────────

function renderSlabContours(
  geojson: GeoJSON.FeatureCollection,
  config: SlabConfig,
): void {
  if (!dataSource) return;

  for (const feature of geojson.features) {
    const geom = feature.geometry;
    if (!geom) continue;

    const depthKm = Math.abs(Number(feature.properties?.depth ?? feature.properties?.value ?? 0));
    const color = depthContourColor(depthKm);

    // §3-3: width 1.5px (thicker at 100km intervals for labels)
    const isKeyDepth = depthKm % 100 === 0;
    const width = isKeyDepth ? 3 : 1.5;

    const lines: number[][][] =
      geom.type === 'MultiLineString'
        ? (geom as GeoJSON.MultiLineString).coordinates
        : geom.type === 'LineString'
          ? [(geom as GeoJSON.LineString).coordinates]
          : [];

    for (const line of lines) {
      if (line.length < 2) continue;

      // Populate slab depth lookup grid
      for (const [lon, lat] of line) {
        insertSlabDepth(lat, lon, depthKm);
      }

      // §3-3: clampToGround: false — render at actual underground depth
      const positions = Cesium.Cartesian3.fromDegreesArrayHeights(
        line.flatMap(([lon, lat]) => [lon, lat, -(depthKm * 1000)])
      );

      dataSource.entities.add({
        polyline: {
          positions,
          material: color,
          width,
          clampToGround: false,
        },
        properties: {
          slab: config.id,
          depth_km: depthKm,
        } as any,
      });

      // Add depth label at key depths (every 100km)
      if (isKeyDepth && line.length > 2) {
        const midIdx = Math.floor(line.length / 2);
        const [mLon, mLat] = line[midIdx];
        dataSource.entities.add({
          position: Cesium.Cartesian3.fromDegrees(mLon, mLat),
          label: {
            text: `${depthKm}km`,
            font: '9px Inter, sans-serif',
            fillColor: Cesium.Color.fromCssColorString('rgba(255, 255, 255, 0.5)'),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -8),
            scaleByDistance: new Cesium.NearFarScalar(5e5, 1.0, 5e6, 0.3),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
      }
    }
  }
}
