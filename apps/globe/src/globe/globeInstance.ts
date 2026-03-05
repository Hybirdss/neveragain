/**
 * globeInstance.ts — CesiumJS Viewer initialization
 *
 * Satellite imagery architecture:
 *   - Single URL: tiles.seismicjapan.com/satellite/{z}/{x}/{y}.jpg
 *   - CF Workers routes internally:
 *       z0-z3 anywhere      → MapTiler satellite-v2 (85 tiles, pre-cached)
 *       z4-z18 Japan only   → GSI seamlessphoto (free unlimited)
 *       z4+ outside Japan   → 204 (CesiumJS shows z3 upscaled)
 *   - Dev mode: Vite proxy for CORS-free MapTiler access
 *   - Fallback: GSI pale + seamlessphoto when proxy unavailable
 *   - Labels: custom LabelCollection (no CARTO overlay)
 *
 * Terrain: MapTiler Quantized Mesh via proxy or direct.
 * No Cesium Ion dependency.
 */

import * as Cesium from 'cesium';

export type GlobeInstance = Cesium.Viewer;

/** Japan bounding box: Kyushu south to Hokkaido north, with margin. */
const JAPAN_RECT = Cesium.Rectangle.fromDegrees(122, 24, 154, 46);

/**
 * Get current camera point-of-view (altitude in meters).
 */
export function getPointOfView(viewer: GlobeInstance): { lat: number; lng: number; altitude: number } {
  const carto = viewer.camera.positionCartographic;
  return {
    lat: Cesium.Math.toDegrees(carto.latitude),
    lng: Cesium.Math.toDegrees(carto.longitude),
    altitude: carto.height,
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
      minimumLevel: 3,
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
      minimumLevel: 3,
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

  // ── Parallel probes: terrain + tile ──────────────────────────
  // Run both network probes in parallel to shave ~100-200ms off init.
  const probeTerrainUrl = terrainUrl
    ? (terrainUrl.endsWith('/') ? `${terrainUrl}layer.json` : `${terrainUrl}/layer.json`)
    : '';

  const tileProbeUrl = useProxy
    ? (() => {
        const url = satelliteUrl.replace('{z}', '0').replace('{x}', '0').replace('{y}', '0');
        return url.startsWith('http') ? url : `${window.location.origin}${url}`;
      })()
    : '';

  const [terrainProbeOk, tileProbeOk] = await Promise.all([
    probeTerrainUrl
      ? fetch(probeTerrainUrl, { method: 'GET' }).then(r => r.ok).catch(() => false)
      : Promise.resolve(false),
    tileProbeUrl
      ? fetch(tileProbeUrl, { method: 'HEAD' }).then(r => r.ok).catch(() => false)
      : Promise.resolve(false),
  ]);

  if (!terrainProbeOk && probeTerrainUrl) {
    console.warn('[globe] Terrain probe failed — using ellipsoid');
  }
  if (!tileProbeOk && tileProbeUrl) {
    console.warn('[globe] Tile probe failed — using free tiles');
  }

  // ── Terrain provider ────────────────────────────────────────
  let terrainProvider: Cesium.TerrainProvider | undefined;
  if (terrainProbeOk) {
    try {
      terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(terrainUrl);
      console.log('[globe] Terrain loaded');
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
  viewer.scene.globe.tileCacheSize = 500;
  viewer.scene.globe.maximumScreenSpaceError = 1.5;
  viewer.scene.globe.preloadSiblings = true;
  viewer.scene.globe.loadingDescendantLimit = 8;

  Cesium.RequestScheduler.maximumRequests = 24;
  Cesium.RequestScheduler.maximumRequestsPerServer = 12;

  // ── Imagery layer ───────────────────────────────────────────
  const proxyOk = tileProbeOk;

  // Base layer: dark map that covers z0+ so globe is never black when zoomed out
  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
      minimumLevel: 0,
      maximumLevel: 6,  // only used for low zoom (satellite takes over at z1+)
      credit: new Cesium.Credit('© OpenStreetMap © CARTO', false),
    }),
  );

  if (proxyOk) {
    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: satelliteUrl,
        minimumLevel: 1,
        maximumLevel: 18,
        credit: new Cesium.Credit('© MapTiler © OpenStreetMap contributors | 航空写真: 国土地理院', true),
      }),
    );
    console.log('[globe] Imagery: satellite (proxy/MapTiler) + dark base');
  } else {
    // GSI fallback: pale basemap + seamlessphoto (Japan satellite, free)
    addGsiFallbackImagery(viewer);
    console.log('[globe] Imagery: GSI fallback (pale + seamlessphoto, free)');
  }

  // Labels: handled by custom LabelCollection in labels.ts (no tile overlay)

  // ── Atmosphere & sky ────────────────────────────────────────
  if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
  viewer.scene.fog.enabled = false; // fog adds GPU cost with little visual benefit
  if (viewer.scene.skyBox) viewer.scene.skyBox.show = true;

  // ── Globe settings ──────────────────────────────────────────
  viewer.scene.globe.depthTestAgainstTerrain = false;
  viewer.scene.backgroundColor = new Cesium.Color(0.02, 0.02, 0.06, 1.0); // dark navy, not pure black
  viewer.scene.globe.baseColor = new Cesium.Color(0.04, 0.04, 0.08, 1.0); // globe surface before tiles load

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

  // ── Zoom limit: restrict zoom outside Japan ────────────────
  // Outside Japan bounding box, enforce minimum altitude (~200km = z7-ish)
  // to avoid loading blurry/empty tiles at high zoom.
  const MIN_ALT_OUTSIDE_JAPAN = 200_000; // meters
  viewer.camera.changed.addEventListener(() => {
    const carto = viewer.camera.positionCartographic;
    if (carto.height < MIN_ALT_OUTSIDE_JAPAN) {
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const lng = Cesium.Math.toDegrees(carto.longitude);
      if (!isInsideJapan(lat, lng)) {
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromRadians(
            carto.longitude,
            carto.latitude,
            MIN_ALT_OUTSIDE_JAPAN,
          ),
        });
      }
    }
  });
  viewer.camera.percentageChanged = 0.1;

  // ── Globe inertia — natural feel like Google Earth ─────────
  viewer.scene.screenSpaceCameraController.inertiaSpin = 0.9;
  viewer.scene.screenSpaceCameraController.inertiaTranslate = 0.9;
  viewer.scene.screenSpaceCameraController.inertiaZoom = 0.8;

  // ── Initial camera: Japan view directly ──────────────────────
  // Start at final Japan view immediately so CesiumJS requests the right zoom
  // level tiles from the start — no wasted low-zoom tile fetches.
  viewer.camera.setView({
    destination: Cesium.Rectangle.fromDegrees(129, 30, 146, 45),
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
