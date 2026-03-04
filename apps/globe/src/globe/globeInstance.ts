/**
 * globeInstance.ts — CesiumJS Viewer initialization
 *
 * Satellite imagery architecture:
 *   - Single URL: tiles.seismicjapan.com/satellite/{z}/{x}/{y}.jpg
 *   - CF Workers routes internally:
 *       z0-z13 anywhere     → MapTiler satellite-v2 (cached 30d)
 *       z14-z18 Japan only  → GSI seamlessphoto (cached 30d, free)
 *       z14+ outside Japan  → 204 (blocked, CesiumJS shows z13 upscaled)
 *   - Dev mode: Vite proxy for CORS-free MapTiler access
 *   - Fallback: Esri World Imagery when proxy unavailable
 *
 * Terrain: MapTiler Quantized Mesh via proxy or direct.
 * No Cesium Ion dependency.
 */

import * as Cesium from 'cesium';

export type GlobeInstance = Cesium.Viewer;

/** Japan bounding box: Kyushu south to Hokkaido north, with margin. */
const JAPAN_RECT = Cesium.Rectangle.fromDegrees(122, 24, 154, 46);

/**
 * Convert globe.gl-style altitude (fraction of Earth radius) to Cesium meters.
 */
export function altitudeToMeters(alt: number): number {
  return alt * 6_371_000;
}

/**
 * Convert Cesium meters altitude to globe.gl-style fraction.
 */
export function metersToAltitude(meters: number): number {
  return meters / 6_371_000;
}

/**
 * Get current camera point-of-view in a format compatible with the rest of the app.
 */
export function getPointOfView(viewer: GlobeInstance): { lat: number; lng: number; altitude: number } {
  const carto = viewer.camera.positionCartographic;
  return {
    lat: Cesium.Math.toDegrees(carto.latitude),
    lng: Cesium.Math.toDegrees(carto.longitude),
    altitude: carto.height / 6_371_000,
  };
}

/**
 * Check if a cartographic position is within the Japan bounding box.
 */
export function isInsideJapan(lat: number, lng: number): boolean {
  const carto = Cesium.Cartographic.fromDegrees(lng, lat);
  return Cesium.Rectangle.contains(JAPAN_RECT, carto);
}

/** Default CF Workers tile proxy — always available, no API key needed client-side. */
const DEFAULT_TILE_PROXY = 'https://seismic-tile-proxy.narukys.workers.dev';

/**
 * Add GSI-only fallback imagery (used when tile proxy is completely unreachable):
 *   - GSI seamlessphoto (Japan, z2-z18) — free satellite, no API key
 *   - GSI pale map (global-ish, z2-z18) — light basemap for context outside Japan
 */
function addGsiFallbackImagery(viewer: GlobeInstance): void {
  // GSI pale map as global base (light basemap, covers Japan well)
  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',
      minimumLevel: 2,
      maximumLevel: 18,
      credit: new Cesium.Credit('地理院タイル: 国土地理院', true),
    }),
  );

  // GSI seamlessphoto for Japan (high-res satellite overlay)
  const japanRect = Cesium.Rectangle.fromDegrees(122, 20, 154, 46);
  const gsiSatellite = viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
      rectangle: japanRect,
      minimumLevel: 2,
      maximumLevel: 18,
      credit: new Cesium.Credit('航空写真: 国土地理院', true),
    }),
  );
  gsiSatellite.alpha = 1.0;
}


/**
 * Create and mount a CesiumJS Viewer into the given container element.
 */
export async function createGlobe(container: HTMLElement): Promise<GlobeInstance> {
  console.log('[globe] Starting CesiumJS initialization...');

  const tileProxyUrl = import.meta.env.VITE_TILE_PROXY_URL || DEFAULT_TILE_PROXY;
  const mapTilerKey = import.meta.env.VITE_MAPTILER_KEY ?? '';
  const isDev = import.meta.env.DEV;

  // ── Satellite imagery URL ───────────────────────────────────
  // Priority: CF Workers proxy (default) > Vite dev proxy > MapTiler direct
  let satelliteUrl = '';
  let useProxy = false;

  if (isDev && mapTilerKey && mapTilerKey !== 'your_key_here') {
    // Dev: Vite proxy for CORS-free MapTiler access (override tile proxy)
    satelliteUrl = `/maptiler-proxy/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${mapTilerKey}`;
    useProxy = true;
    console.log('[globe] Satellite: Vite dev proxy → MapTiler');
  } else {
    // Production + default: CF Workers proxy (MapTiler z0-13, GSI z14-18 Japan)
    satelliteUrl = `${tileProxyUrl}/satellite/{z}/{x}/{y}.jpg`;
    useProxy = true;
    console.log(`[globe] Satellite: CF Workers proxy (${tileProxyUrl})`);
  }

  // ── Terrain URL ─────────────────────────────────────────────
  const terrainUrl = (isDev && mapTilerKey && mapTilerKey !== 'your_key_here')
    ? `/maptiler-proxy/tiles/terrain-quantized-mesh-v2/?key=${mapTilerKey}`
    : `${tileProxyUrl}/terrain/`;

  // ── Terrain provider ────────────────────────────────────────
  // Probe terrain availability before committing — avoids persistent 503 errors
  // that prevent the globe from rendering properly.
  let terrainProvider: Cesium.TerrainProvider | undefined;
  if (terrainUrl) {
    try {
      // Quick probe: fetch layer.json to verify the server is actually up
      const probeTerrainUrl = terrainUrl.endsWith('/')
        ? `${terrainUrl}layer.json`
        : `${terrainUrl}/layer.json`;
      const terrainProbe = await fetch(probeTerrainUrl, { method: 'GET' });
      if (!terrainProbe.ok) {
        console.warn(`[globe] Terrain probe returned ${terrainProbe.status} — using ellipsoid`);
      } else {
        terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(terrainUrl);
        console.log('[globe] Terrain loaded');
      }
    } catch (err) {
      console.warn('[globe] Failed to load terrain, using ellipsoid:', err);
    }
  }

  // ── Viewer ──────────────────────────────────────────────────
  const viewer = new Cesium.Viewer(container, {
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    vrButton: false,
    selectionIndicator: false,
    infoBox: false,
    sceneModePicker: false,
    projectionPicker: false,
    baseLayer: false,
    terrainProvider,
    requestRenderMode: false,
    maximumRenderTimeChange: Infinity,
  });
  console.log('[globe] Viewer created');

  // ── Tile loading tuning ─────────────────────────────────────
  // Balance between visual quality and performance.
  viewer.scene.globe.tileCacheSize = 200;
  viewer.scene.globe.maximumScreenSpaceError = 4;
  viewer.scene.globe.preloadSiblings = false;
  viewer.scene.globe.loadingDescendantLimit = 4;

  Cesium.RequestScheduler.maximumRequests = 12;
  Cesium.RequestScheduler.maximumRequestsPerServer = 6;

  // ── Imagery layer ───────────────────────────────────────────
  // Priority: CF Workers proxy (default) > MapTiler direct > GSI fallback
  let proxyOk = false;
  if (useProxy) {
    try {
      const probeUrl = satelliteUrl
        .replace('{z}', '0').replace('{x}', '0').replace('{y}', '0');
      const probeTarget = probeUrl.startsWith('http') ? probeUrl : `${window.location.origin}${probeUrl}`;
      const resp = await fetch(probeTarget, { method: 'HEAD' });
      proxyOk = resp.ok;
      if (!resp.ok) {
        console.warn(`[globe] Tile probe returned ${resp.status} — using free tiles`);
      }
    } catch {
      console.warn('[globe] Tile source unreachable — using free tiles');
    }
  }

  if (proxyOk) {
    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: satelliteUrl,
        maximumLevel: 18,
        credit: new Cesium.Credit('© MapTiler © OpenStreetMap contributors | 航空写真: 国土地理院', true),
      }),
    );
    console.log('[globe] Imagery: satellite (proxy/MapTiler)');
  } else {
    // GSI fallback: pale basemap + seamlessphoto (Japan satellite, free)
    addGsiFallbackImagery(viewer);
    console.log('[globe] Imagery: GSI fallback (pale + seamlessphoto, free)');
  }

  // ── Atmosphere & sky ────────────────────────────────────────
  if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
  viewer.scene.fog.enabled = false; // fog adds GPU cost with little visual benefit
  if (viewer.scene.skyBox) viewer.scene.skyBox.show = true;

  // ── Globe settings ──────────────────────────────────────────
  viewer.scene.globe.depthTestAgainstTerrain = false;
  viewer.scene.backgroundColor = Cesium.Color.BLACK;

  // ── Performance: reduce shadow / lighting overhead ──────────
  viewer.scene.globe.enableLighting = false;
  viewer.shadows = false;
  viewer.scene.msaaSamples = 1; // disable MSAA for perf

  // Globe translucency — enable via ?translucency=1 in URL
  if (new URLSearchParams(window.location.search).has('translucency')) {
    try {
      viewer.scene.globe.translucency.enabled = true;
      viewer.scene.globe.translucency.frontFaceAlpha = 0.55;
      viewer.scene.globe.translucency.backFaceAlpha = 0.0;
      console.log('[globe] Translucency enabled via URL param');
    } catch (err) {
      console.warn('[globe] Translucency not supported:', err);
    }
  }

  // ── Hide credits container (attribution in our own UI) ──────
  try {
    const creditContainer = viewer.cesiumWidget.creditContainer as HTMLElement;
    if (creditContainer) creditContainer.style.display = 'none';
  } catch { /* ignore */ }

  // ── Globe inertia — natural feel like Google Earth ─────────
  viewer.scene.screenSpaceCameraController.inertiaSpin = 0.9;
  viewer.scene.screenSpaceCameraController.inertiaTranslate = 0.9;
  viewer.scene.screenSpaceCameraController.inertiaZoom = 0.8;

  // ── Initial camera: Japan overview → cinematic zoom-in ──────
  // Start at Japan overview altitude (~2,500km) so Japan tiles load immediately.
  // Then smooth zoom-in to detail level once tiles are ready.
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(137, 36, 2_500_000),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-90),
      roll: 0,
    },
  });

  // Wait for Japan tiles to load, then zoom in
  let tileCheckCount = 0;
  viewer.scene.postRender.addEventListener(function waitForTiles() {
    tileCheckCount++;
    const tilesLoading = viewer.scene.globe.tilesLoaded === false;

    // Wait until tiles are loaded OR max 60 frames (~1s), then fly in
    if (tilesLoading && tileCheckCount < 60) return;

    viewer.scene.postRender.removeEventListener(waitForTiles);
    viewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(129, 30, 146, 45),
      duration: 2.0,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  });

  // ── Error listeners ─────────────────────────────────────────
  viewer.scene.renderError.addEventListener((_scene: Cesium.Scene, error: unknown) => {
    console.error('[globe] Render error:', error);
  });

  console.log('[globe] Initialization complete');
  return viewer;
}

/**
 * Toggle globe translucency at runtime.
 */
export function setGlobeTranslucency(
  viewer: GlobeInstance,
  enabled: boolean,
  frontAlpha = 0.6,
): boolean {
  try {
    viewer.scene.globe.translucency.enabled = enabled;
    if (enabled) {
      viewer.scene.globe.translucency.frontFaceAlpha = frontAlpha;
      viewer.scene.globe.translucency.backFaceAlpha = 0.0;
    }
    return true;
  } catch (err) {
    console.warn('[globe] Translucency toggle failed:', err);
    return false;
  }
}

/** Japan bounding rectangle for flyTo. */
const JAPAN_FLY_RECT = Cesium.Rectangle.fromDegrees(128, 30, 146, 46);

/**
 * Fly the camera to center on Japan.
 */
export function flyToJapan(viewer: GlobeInstance): void {
  viewer.camera.flyTo({
    destination: JAPAN_FLY_RECT,
    duration: 1.5,
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
  });
}

/**
 * Destroy the CesiumJS Viewer and free all resources.
 */
export function disposeGlobe(viewer: GlobeInstance): void {
  if (!viewer.isDestroyed()) {
    viewer.destroy();
  }
}
