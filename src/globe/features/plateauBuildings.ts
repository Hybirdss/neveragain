/**
 * plateauBuildings.ts — PLATEAU 3D Buildings tileset loader
 *
 * Loads and manages PLATEAU (Project PLATEAU by MLIT Japan) 3D Tiles
 * city building models on the CesiumJS globe. Supports five major cities
 * with LOD-optimised streaming and automatic camera-distance culling.
 *
 * Data source: https://www.geospatial.jp/ckan/dataset/plateau
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globeInstance';
import type { PlateauCityId, PlateauCityConfig } from '../../types';
import { store } from '../../store/appState';

// ── City Catalog ─────────────────────────────────────────────

export const PLATEAU_CITIES: readonly PlateauCityConfig[] = [
  // ── Tokyo Wards ────────────────────────────────────────────
  { id: 'chiyoda',    nameKey: 'plateau.chiyoda',    tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/a5/ab1daf-7e4a-45a3-8d20-8ee6632c99e6/13101_chiyoda-ku_pref_2023_citygml_2_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json', center: { lat: 35.694, lng: 139.753 } },
  { id: 'chuo',       nameKey: 'plateau.chuo',       tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/ad/b437bf-62d8-41b2-9c49-032c5a0a83cc/13102_chuo-ku_pref_2023_citygml_2_op_bldg_3dtiles_13102_chuo-ku_lod2_no_texture/tileset.json', center: { lat: 35.671, lng: 139.774 } },
  { id: 'minato',     nameKey: 'plateau.minato',     tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/ee/252e4a-c745-45fd-95f0-f0a396d4e395/13103_minato-ku_pref_2023_citygml_2_op_bldg_3dtiles_13103_minato-ku_lod2_no_texture/tileset.json', center: { lat: 35.658, lng: 139.751 } },
  { id: 'shinjuku',   nameKey: 'plateau.shinjuku',   tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/f0/840fc4-114c-41e4-9a65-67768efd3629/13104_shinjuku-ku_pref_2023_citygml_2_op_bldg_3dtiles_13104_shinjuku-ku_lod2_no_texture/tileset.json', center: { lat: 35.694, lng: 139.703 } },
  { id: 'shibuya',    nameKey: 'plateau.shibuya',    tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/9e/9f8e93-4ef1-4157-a388-39919251d41e/13113_shibuya-ku_pref_2023_citygml_2_op_bldg_3dtiles_13113_shibuya-ku_lod2_no_texture/tileset.json', center: { lat: 35.664, lng: 139.698 } },
  // ── Kanto ──────────────────────────────────────────────────
  { id: 'yokohama',   nameKey: 'plateau.yokohama',   tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/2a/a3910b-b760-4798-808d-ad1859354965/14100_yokohama-shi_city_2023_citygml_1_op_bldg_3dtiles_14101_tsurumi-ku_lod2_no_texture/tileset.json', center: { lat: 35.444, lng: 139.638 } },
  { id: 'kawasaki',   nameKey: 'plateau.kawasaki',   tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/6e/2f92f1-9cb4-4759-857c-378864981e89/14130_kawasaki-shi_city_2022_citygml_4_op_bldg_3dtiles_14131_kawasaki-ku_lod2_no_texture/tileset.json', center: { lat: 35.531, lng: 139.703 } },
  { id: 'saitama',    nameKey: 'plateau.saitama',    tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/14/896375-2974-4623-b02a-fa7a71a78a70/11100_saitama-shi_city_2024_citygml_1_op_bldg_3dtiles_11101_nishi-ku_lod1/tileset.json', center: { lat: 35.861, lng: 139.646 } },
  { id: 'chiba',      nameKey: 'plateau.chiba',      tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/17/c731d0-1bd6-4aec-8885-4d06930de96a/12100_chiba-shi_city_2024_citygml_1_op_bldg_3dtiles_12101_chuo-ku_lod2_no_texture/tileset.json', center: { lat: 35.608, lng: 140.106 } },
  { id: 'utsunomiya', nameKey: 'plateau.utsunomiya', tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/37/26f560-ce23-4faf-9ce9-4d185946bc98/09201_utsunomiya-shi_city_2023_citygml_2_op_bldg_3dtiles_lod2_no_texture/tileset.json', center: { lat: 36.566, lng: 139.884 } },
  { id: 'maebashi',   nameKey: 'plateau.maebashi',   tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/54/feae93-0494-463a-8c08-facac83b117d/10201_maebashi-shi_city_2023_citygml_2_op_bldg_3dtiles_lod2_no_texture/tileset.json', center: { lat: 36.391, lng: 139.061 } },
  { id: 'kofu',       nameKey: 'plateau.kofu',       tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/f2/032d31-0149-4642-9f0f-a851c0a2ad82/19201_kofu-shi_city_2023_citygml_2_op_bldg_3dtiles_lod2_no_texture/tileset.json', center: { lat: 35.664, lng: 138.568 } },
  // ── Kansai ─────────────────────────────────────────────────
  { id: 'osaka',      nameKey: 'plateau.osaka',      tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/32/668454-62fc-46b6-a735-56e1b7b5ca38/27100_osaka-shi_city_2024_citygml_1_op_bldg_3dtiles_27102_miyakojima-ku_lod2_no_texture/tileset.json', center: { lat: 34.694, lng: 135.502 } },
  { id: 'kyoto',      nameKey: 'plateau.kyoto',      tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/a9/9187f6-9769-45e5-b1be-7e75d24e17cc/26100_kyoto-shi_city_2024_citygml_1_op_bldg_3dtiles_26101_kita-ku_lod2_no_texture/tileset.json', center: { lat: 35.012, lng: 135.768 } },
  { id: 'wakayama',   nameKey: 'plateau.wakayama',   tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/1f/07f986-904d-42b3-8f67-2a0c70214a56/30201_wakayama-shi_city_2023_citygml_2_op_bldg_3dtiles_lod1/tileset.json', center: { lat: 34.226, lng: 135.168 } },
  // ── Chubu ──────────────────────────────────────────────────
  { id: 'nagoya',     nameKey: 'plateau.nagoya',     tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/e3/c5a409-dfb4-415c-a0a1-3c2c565fb3b8/23100_nagoya-shi_city_2022_citygml_4_op_bldg_3dtiles_23101_chikusa-ku_lod1/tileset.json', center: { lat: 35.181, lng: 136.906 } },
  { id: 'shizuoka',   nameKey: 'plateau.shizuoka',   tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/5a/6e1803-7552-4240-b382-7141299884a2/22100_shizuoka-shi_city_2023_citygml_2_op_bldg_3dtiles_22101_aoi-ku_lod2_no_texture/tileset.json', center: { lat: 34.976, lng: 138.383 } },
  { id: 'hamamatsu',  nameKey: 'plateau.hamamatsu',  tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/8d/01deb7-3c29-4faf-9d15-818d79158d52/22130_hamamatsu-shi_city_2023_citygml_2_op_bldg_3dtiles_22131_naka-ku_lod1/tileset.json', center: { lat: 34.711, lng: 137.726 } },
  { id: 'niigata',    nameKey: 'plateau.niigata',    tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/a9/773598-8295-4d57-bb22-e61fcd730955/15100_niigata-shi_city_2023_citygml_2_op_bldg_3dtiles_15101_kita-ku_lod1/tileset.json', center: { lat: 37.916, lng: 139.036 } },
  { id: 'kanazawa',   nameKey: 'plateau.kanazawa',   tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/1c/d88dd6-7aaf-41d3-9dd7-fda7b7f34d2b/17201_kanazawa-shi_city_2024_citygml_1_op_bldg_3dtiles_lod1/tileset.json', center: { lat: 36.561, lng: 136.656 } },
  { id: 'gifu',       nameKey: 'plateau.gifu',       tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/03/7ffccd-04cb-44ef-a47d-bfb9a95d8ee5/21201_gifu-shi_city_2024_citygml_1_op_bldg_3dtiles_lod2_no_texture/tileset.json', center: { lat: 35.423, lng: 136.763 } },
  // ── Hokkaido / Tohoku ──────────────────────────────────────
  { id: 'sapporo',    nameKey: 'plateau.sapporo',    tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/bc/2e9ddc-cfe2-42fc-a91f-3bb95f97ddad/01100_sapporo-shi_city_2020_citygml_7_op_bldg_3dtiles_01101_chuo-ku_lod2_no_texture/tileset.json', center: { lat: 43.062, lng: 141.354 } },
  { id: 'sendai',     nameKey: 'plateau.sendai',     tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/bd/e78220-9044-4dcd-9519-5ff5730e25f2/04100_sendai-shi_city_2024_citygml_1_op_bldg_3dtiles_04101_aoba-ku_lod2_no_texture/tileset.json', center: { lat: 38.268, lng: 140.872 } },
  { id: 'fukushima',  nameKey: 'plateau.fukushima',  tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/6c/c66e68-49b1-4ed4-81d4-11e8c327ed6b/07201_fukushima-shi_city_2024_citygml_1_op_bldg_3dtiles_lod2_no_texture/tileset.json', center: { lat: 37.750, lng: 140.468 } },
  // ── Chugoku / Shikoku ─────────────────────────────────────
  { id: 'hiroshima',  nameKey: 'plateau.hiroshima',  tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/96/b46095-22bc-4190-b658-3ef163e36c9f/34100_hiroshima-shi_city_2024_citygml_1_op_bldg_3dtiles_34101_naka-ku_lod2_no_texture/tileset.json', center: { lat: 34.396, lng: 132.460 } },
  { id: 'okayama',    nameKey: 'plateau.okayama',    tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/26/d4852d-22f7-4d44-8eb8-6897c82bd4f8/33100_okayama-shi_city_2024_citygml_1_op_bldg_3dtiles_33101_kita-ku_lod2_no_texture/tileset.json', center: { lat: 34.662, lng: 133.935 } },
  { id: 'takamatsu',  nameKey: 'plateau.takamatsu',  tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/c5/1682ca-c3b2-42de-9827-c1fc3f75d983/37201_takamatsu-shi_city_2022_citygml_4_op_bldg_3dtiles_lod2_no_texture/tileset.json', center: { lat: 34.340, lng: 134.043 } },
  { id: 'tottori',    nameKey: 'plateau.tottori',    tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/b7/cc2f44-4ff1-457c-84d6-d27bd0239013/31201_tottori-shi_city_2020_citygml_7_op_bldg_3dtiles_lod2_no_texture/tileset.json', center: { lat: 35.501, lng: 134.235 } },
  { id: 'tokushima',  nameKey: 'plateau.tokushima',  tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/b2/8844ca-69b2-43d6-9098-9aeb561adbde/36201_tokushima-shi_city_2023_citygml_2_op_bldg_3dtiles_lod2_no_texture/tileset.json', center: { lat: 34.066, lng: 134.559 } },
  { id: 'matsuyama',  nameKey: 'plateau.matsuyama',  tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/4c/21d834-aaaa-44d3-999b-0f11ec13063d/38201_matsuyama-shi_city_2020_citygml_7_op_bldg_3dtiles_lod2_no_texture/tileset.json', center: { lat: 33.839, lng: 132.766 } },
  { id: 'kochi',      nameKey: 'plateau.kochi',      tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/e3/cfc53c-b62b-4a80-a8ae-c616b2a4f354/39201_kouchi-shi_pref_2023_citygml_2_op_bldg_3dtiles_lod2_no_texture/tileset.json', center: { lat: 33.559, lng: 133.531 } },
  // ── Kyushu / Okinawa ──────────────────────────────────────
  { id: 'fukuoka',    nameKey: 'plateau.fukuoka',    tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/f6/b88d43-1c97-4523-9181-67d1d39e93b7/40130_fukuoka-shi_city_2024_citygml_1_op_bldg_3dtiles_40131_higashi-ku_lod1/tileset.json', center: { lat: 33.590, lng: 130.402 } },
  { id: 'kitakyushu', nameKey: 'plateau.kitakyushu', tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/51/b0eef2-b883-42b7-a140-82e6a6b16a30/40100_kitakyushu-shi_city_2020_citygml_7_op_bldg_3dtiles_40101_moji-ku_lod1/tileset.json', center: { lat: 33.883, lng: 130.875 } },
  { id: 'kumamoto',   nameKey: 'plateau.kumamoto',   tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/fb/81ab56-3852-4ebc-bdf7-d11582980d5f/43100_kumamoto-shi_city_2022_citygml_4_op_bldg_3dtiles_43101_chuo-ku_lod2_no_texture/tileset.json', center: { lat: 32.803, lng: 130.708 } },
  { id: 'naha',       nameKey: 'plateau.naha',       tilesetUrl: 'https://assets.cms.plateau.reearth.io/assets/c7/efa2db-6f03-4eea-bb3c-d42b3a2c7af3/47201_naha-shi_city_2020_citygml_7_op_bldg_3dtiles_lod2_no_texture/tileset.json', center: { lat: 26.335, lng: 127.681 } },
];

// ── Constants ────────────────────────────────────────────────

/** Hide buildings when camera is above this altitude (meters). */
const MAX_CAMERA_HEIGHT = 200_000;

/** Default translucent white style for buildings. */
const DEFAULT_STYLE = new Cesium.Cesium3DTileStyle({
  color: "color('white', 0.85)",
});

/** Tileset loading options — aggressive LOD skipping for performance. */
const TILESET_OPTIONS = {
  maximumScreenSpaceError: 24,
  maximumMemoryUsage: 256,
  skipLevelOfDetail: true,
  baseScreenSpaceError: 1024,
  skipScreenSpaceErrorFactor: 16,
  skipLevels: 1,
  immediatelyLoadDesiredLevelOfDetail: false,
  loadSiblings: false,
};

// ── State ────────────────────────────────────────────────────

let viewer: GlobeInstance | null = null;
let activeTileset: Cesium.Cesium3DTileset | null = null;
let cameraListener: Cesium.Event.RemoveCallback | null = null;
let unsubCity: (() => void) | null = null;

/** Tracks whether the layer is hidden due to camera altitude. */
let hiddenByCamera = false;

// ── URL Builder ──────────────────────────────────────────────

/**
 * Return the tileset URL for a city.
 * Uses the direct PLATEAU CDN URL (assets.cms.plateau.reearth.io).
 * CORS is already allowed on the CDN, so no proxy is needed.
 */
function getTilesetUrl(city: PlateauCityConfig): string {
  return city.tilesetUrl;
}

// ── Internal Helpers ─────────────────────────────────────────

/** Find a city config by its ID. */
function findCity(id: PlateauCityId): PlateauCityConfig | undefined {
  return PLATEAU_CITIES.find((c) => c.id === id);
}

/** Remove the current tileset from the scene and release references. */
function destroyActiveTileset(): void {
  if (activeTileset && viewer) {
    viewer.scene.primitives.remove(activeTileset);
    activeTileset = null;
  }
}

/**
 * Load a PLATEAU 3D Tiles tileset for the given city and add it to the scene.
 * Auto-enables the `layers.plateauBuildings` flag on successful load.
 */
async function loadCity(cityId: PlateauCityId): Promise<void> {
  if (!viewer) return;

  const city = findCity(cityId);
  if (!city) {
    console.warn(`[plateau] Unknown city: ${cityId}`);
    return;
  }

  const url = getTilesetUrl(city);
  console.log(`[plateau] Loading ${city.id}...`);

  try {
    const tileset = await Cesium.Cesium3DTileset.fromUrl(url, TILESET_OPTIONS);
    tileset.style = DEFAULT_STYLE;

    // Respect current layer visibility and camera state
    const layerOn = store.get('layers').plateauBuildings;
    tileset.show = layerOn && !hiddenByCamera;

    activeTileset = tileset;
    viewer.scene.primitives.add(tileset);

    // Auto-enable the layer if it was off
    const layers = store.get('layers');
    if (!layers.plateauBuildings) {
      store.set('layers', { ...layers, plateauBuildings: true });
    }
  } catch (err) {
    console.error(`[plateau] Failed to load tileset for ${city.id}:`, err);
  }
}

/**
 * Camera altitude guard — hide buildings when zoomed out beyond threshold.
 */
function onCameraChanged(): void {
  if (!viewer || !activeTileset) return;

  const height = viewer.camera.positionCartographic.height;
  const shouldHide = height > MAX_CAMERA_HEIGHT;

  if (shouldHide !== hiddenByCamera) {
    hiddenByCamera = shouldHide;
    const layerOn = store.get('layers').plateauBuildings;
    activeTileset.show = layerOn && !hiddenByCamera;
  }
}

/**
 * Handle store `plateauCity` changes — swap the active tileset.
 */
function onCityChanged(cityId: PlateauCityId | null): void {
  destroyActiveTileset();

  if (cityId) {
    loadCity(cityId);
  }
}

// ── Public API ───────────────────────────────────────────────

/**
 * Initialise the PLATEAU buildings feature.
 * Subscribes to store changes and camera events.
 */
export function initPlateauBuildings(v: GlobeInstance): void {
  viewer = v;
  hiddenByCamera = false;

  // Subscribe to city selection changes
  unsubCity = store.subscribe('plateauCity', onCityChanged);

  // Camera altitude guard
  cameraListener = viewer.camera.changed.addEventListener(onCameraChanged);

  // Load initial city if already set
  const initial = store.get('plateauCity');
  if (initial) {
    loadCity(initial);
  }
}

/**
 * Show or hide the active PLATEAU tileset.
 * Respects the camera altitude guard — won't force-show if camera is too high.
 */
export function setPlateauVisible(visible: boolean): void {
  if (activeTileset) {
    activeTileset.show = visible && !hiddenByCamera;
  }
}

/**
 * Tear down the PLATEAU buildings feature.
 * Removes tileset, unsubscribes from store and camera events.
 */
export function disposePlateau(): void {
  destroyActiveTileset();

  if (unsubCity) {
    unsubCity();
    unsubCity = null;
  }
  if (cameraListener) {
    cameraListener();
    cameraListener = null;
  }

  viewer = null;
  hiddenByCamera = false;
}
