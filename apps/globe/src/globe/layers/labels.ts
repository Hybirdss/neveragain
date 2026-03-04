/**
 * labels.ts — City name labels layer (CesiumJS)
 *
 * Renders major Japanese city names on the globe using Cesium LabelCollection.
 * Labels show Japanese name + English name (e.g., "東京\nTokyo").
 * Camera-altitude-aware: larger cities visible from higher altitude,
 * smaller cities appear only when zoomed in.
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globeInstance';

interface CityDef {
  name: string;
  nameEn: string;
  lat: number;
  lng: number;
  pop: number;
}

const JAPAN_CITIES: CityDef[] = [
  { name: '東京', nameEn: 'Tokyo', lat: 35.6762, lng: 139.6503, pop: 14000000 },
  { name: '大阪', nameEn: 'Osaka', lat: 34.6937, lng: 135.5023, pop: 2750000 },
  { name: '名古屋', nameEn: 'Nagoya', lat: 35.1815, lng: 136.9066, pop: 2320000 },
  { name: '札幌', nameEn: 'Sapporo', lat: 43.0618, lng: 141.3545, pop: 1970000 },
  { name: '福岡', nameEn: 'Fukuoka', lat: 33.5904, lng: 130.4017, pop: 1610000 },
  { name: '仙台', nameEn: 'Sendai', lat: 38.2682, lng: 140.8694, pop: 1090000 },
  { name: '広島', nameEn: 'Hiroshima', lat: 34.3853, lng: 132.4553, pop: 1200000 },
  { name: '那覇', nameEn: 'Naha', lat: 26.2124, lng: 127.6809, pop: 320000 },
  { name: '神戸', nameEn: 'Kobe', lat: 34.6901, lng: 135.1956, pop: 1530000 },
  { name: '京都', nameEn: 'Kyoto', lat: 35.0116, lng: 135.7681, pop: 1460000 },
  { name: '静岡', nameEn: 'Shizuoka', lat: 34.9756, lng: 138.3827, pop: 690000 },
  { name: '金沢', nameEn: 'Kanazawa', lat: 36.5613, lng: 136.6562, pop: 460000 },
  { name: '高知', nameEn: 'Kochi', lat: 33.5597, lng: 133.5311, pop: 330000 },
  { name: '新潟', nameEn: 'Niigata', lat: 37.9026, lng: 139.0236, pop: 790000 },
  { name: '熊本', nameEn: 'Kumamoto', lat: 32.8032, lng: 130.7079, pop: 740000 },
];

/**
 * Population-based distance display condition.
 * Large cities (pop > 2M) visible from far away; small cities only when zoomed in.
 */
function getDisplayCondition(pop: number): Cesium.DistanceDisplayCondition {
  // Near distance is always 0 (visible up close)
  // Far distance scales with population — bigger city = visible from further away
  if (pop >= 10_000_000) return new Cesium.DistanceDisplayCondition(0, 8_000_000);
  if (pop >= 2_000_000)  return new Cesium.DistanceDisplayCondition(0, 5_000_000);
  if (pop >= 1_000_000)  return new Cesium.DistanceDisplayCondition(0, 3_000_000);
  if (pop >= 500_000)    return new Cesium.DistanceDisplayCondition(0, 1_500_000);
  return new Cesium.DistanceDisplayCondition(0, 800_000);
}

let labelCollection: Cesium.LabelCollection | null = null;
let viewerRef: GlobeInstance | null = null;

/**
 * Initialise the labels layer. Adds a LabelCollection to the scene.
 */
export function initLabels(viewer: GlobeInstance): void {
  viewerRef = viewer;

  labelCollection = new Cesium.LabelCollection({
    scene: viewer.scene,
  });

  for (const city of JAPAN_CITIES) {
    labelCollection.add({
      text: `${city.name}\n${city.nameEn}`,
      position: Cesium.Cartesian3.fromDegrees(city.lng, city.lat, 0),
      font: '12px Inter, sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      pixelOffset: new Cesium.Cartesian2(0, -4),
      distanceDisplayCondition: getDisplayCondition(city.pop),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      showBackground: false,
    });
  }

  viewer.scene.primitives.add(labelCollection);
  console.log(`[labels] Initialised ${JAPAN_CITIES.length} city labels`);
}

/**
 * Toggle label visibility.
 */
export function setLabelsVisible(visible: boolean): void {
  if (labelCollection) {
    labelCollection.show = visible;
  }
}

/**
 * Destroy the label collection and release resources.
 */
export function disposeLabels(): void {
  if (labelCollection && viewerRef && !viewerRef.isDestroyed()) {
    viewerRef.scene.primitives.remove(labelCollection);
  }
  labelCollection = null;
  viewerRef = null;
}
