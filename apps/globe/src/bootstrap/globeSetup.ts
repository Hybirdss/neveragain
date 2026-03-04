/**
 * Globe Setup — Initializes CesiumJS viewer and all globe layers/features.
 */

import { createGlobe, disposeGlobe } from '../globe/globeInstance';
import type { GlobeInstance } from '../globe/globeInstance';
import { initCamera, disposeCamera } from '../globe/camera';
import { initSeismicPoints, initDrillLine, disposeSeismicPoints, setHistoricalCatalog } from '../globe/layers/seismicPoints';
import { initWaveRings } from '../globe/layers/waveRings';
import { initIsoseismal } from '../globe/layers/isoseismal';
import { initTectonicPlates } from '../globe/layers/tectonicPlates';
import { initLabels, disposeLabels } from '../globe/layers/labels';
import { initLayerToggle, disposeLayerToggle } from '../globe/layers/layerToggle';
import { initShakeMapOverlay } from '../globe/features/shakeMapOverlay';
import { initSlab2Contours } from '../globe/features/slab2Contours';
import { initDepthRings, disposeDepthRings } from '../globe/features/depthRings';
import { initPlateauBuildings, disposePlateau } from '../globe/features/plateauBuildings';
import { initGsiLayers } from '../globe/layers/gsiLayers';
import { loadHistoricalCatalog } from '../data/historicalCatalog';

export interface GlobeSetupResult {
  globe: GlobeInstance;
  disposeGlobeSetup: () => void;
}

export async function setupGlobe(globeContainer: HTMLElement): Promise<GlobeSetupResult> {
  const globe = await createGlobe(globeContainer);

  // Tectonic plates (async, non-blocking)
  initTectonicPlates(globe).catch((err) =>
    console.error('[globeSetup] Failed to load tectonic plates:', err),
  );

  initSeismicPoints(globe);
  initDrillLine(globe);
  initWaveRings(globe);
  initIsoseismal(globe);
  initShakeMapOverlay(globe);
  initCamera(globe);
  initLabels(globe);
  initLayerToggle(globe);

  // Slab2 contours (async, non-blocking)
  initSlab2Contours(globe).catch((err) =>
    console.error('[globeSetup] Failed to load Slab2 contours:', err),
  );

  initDepthRings(globe);
  initPlateauBuildings(globe);
  initGsiLayers(globe);

  // Historical catalog for underground view (async, non-blocking)
  loadHistoricalCatalog().then((events) => {
    if (events.length > 0) setHistoricalCatalog(events);
  });

  return {
    globe,
    disposeGlobeSetup: () => {
      disposeSeismicPoints();
      disposeLabels();
      disposeLayerToggle();
      disposePlateau();
      disposeDepthRings();
      disposeCamera();
      disposeGlobe(globe);
    },
  };
}
