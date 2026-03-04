/**
 * tectonicPlates.ts — Layer 2: Tectonic plate boundary lines (CesiumJS)
 *
 * Fetches GeoJSON plate-boundary data and renders as dashed orange
 * polylines on the globe using Cesium GeoJsonDataSource.
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globeInstance';

const PLATES_URL =
  'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json';

let dataSource: Cesium.GeoJsonDataSource | null = null;

/**
 * Fetch tectonic plate boundary GeoJSON and render as orange dashed lines.
 */
export async function initTectonicPlates(viewer: GlobeInstance): Promise<void> {
  try {
    console.log('[tectonicPlates] Fetching plate boundaries...');
    const response = await fetch(PLATES_URL);
    if (!response.ok) {
      console.error(`[tectonicPlates] Failed to fetch plate data: ${response.status}`);
      return;
    }

    const data = await response.json();
    console.log(`[tectonicPlates] GeoJSON loaded: ${data.features?.length ?? 0} features`);

    dataSource = await Cesium.GeoJsonDataSource.load(data, {
      stroke: Cesium.Color.fromCssColorString('#ff7800'),
      strokeWidth: 1.5,
      fill: Cesium.Color.TRANSPARENT,
      clampToGround: true,
    });

    // Override material to dashed lines
    const entities = dataSource.entities.values;
    for (const entity of entities) {
      if (entity.polyline) {
        entity.polyline.material = new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#ff7800'),
          dashLength: 16,
        }) as unknown as Cesium.MaterialProperty;
        entity.polyline.width = new Cesium.ConstantProperty(1.5);
      }
    }

    viewer.dataSources.add(dataSource);
    console.log(`[tectonicPlates] Rendered ${entities.length} plate boundaries`);
  } catch (err) {
    console.error('[tectonicPlates] Init failed:', err);
  }
}

/** Set visibility of tectonic plates layer. */
export function setPlatesVisible(visible: boolean): void {
  if (dataSource) dataSource.show = visible;
}
