/**
 * labels.ts — Custom label layer (CesiumJS LabelCollection)
 *
 * Comprehensive label system replacing CARTO tile overlay.
 * Fully customizable, free, no external API dependency.
 *
 * Tiers:
 *   1. Mega cities (Tokyo, Osaka) — visible from 8,000km
 *   2. Major cities (prefectural capitals 1M+) — visible from 5,000km
 *   3. All 47 prefectural capitals — visible from 3,000km
 *   4. Geographic features (trenches, mountains, straits) — visible from 2,000km
 *   5. Medium cities & islands — visible from 800km
 *   6. Global context cities — visible from 10,000km (globe view only)
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globeInstance';

// ── Data Types ──────────────────────────────────────────────────

interface CityLabel {
  name: string;
  nameEn: string;
  lat: number;
  lng: number;
  /** Display tier: lower = visible from further away */
  tier: 1 | 2 | 3 | 4 | 5 | 6;
}

interface GeoLabel {
  name: string;
  nameEn: string;
  lat: number;
  lng: number;
  tier: 4 | 5;
  /** Italic style for geographic features */
  italic?: boolean;
}

// ── Tier → Distance Display Condition ───────────────────────────

function getTierDisplayCondition(tier: number): Cesium.DistanceDisplayCondition {
  switch (tier) {
    case 1: return new Cesium.DistanceDisplayCondition(0, 8_000_000);
    case 2: return new Cesium.DistanceDisplayCondition(0, 5_000_000);
    case 3: return new Cesium.DistanceDisplayCondition(0, 3_000_000);
    case 4: return new Cesium.DistanceDisplayCondition(0, 2_000_000);
    case 5: return new Cesium.DistanceDisplayCondition(0, 800_000);
    case 6: return new Cesium.DistanceDisplayCondition(0, 10_000_000);
    default: return new Cesium.DistanceDisplayCondition(0, 1_000_000);
  }
}

function getTierFont(tier: number, italic = false): string {
  const style = italic ? 'italic ' : '';
  switch (tier) {
    case 1: return `${style}bold 14px Inter, sans-serif`;
    case 2: return `${style}bold 12px Inter, sans-serif`;
    case 6: return `${style}11px Inter, sans-serif`;
    default: return `${style}11px Inter, sans-serif`;
  }
}

function getTierColor(tier: number, isGeo = false): Cesium.Color {
  if (isGeo) return new Cesium.Color(0.6, 0.75, 0.9, 0.7); // blue-ish for geo
  if (tier === 6) return new Cesium.Color(0.7, 0.7, 0.7, 0.6); // dim for global
  return Cesium.Color.WHITE;
}

// ── Japan: 47 Prefectural Capitals ──────────────────────────────
// Deduplicated: mega/major cities get higher tier

const JAPAN_CITIES: CityLabel[] = [
  // Tier 1: Mega
  { name: '東京', nameEn: 'Tokyo', lat: 35.6762, lng: 139.6503, tier: 1 },
  { name: '大阪', nameEn: 'Osaka', lat: 34.6937, lng: 135.5023, tier: 1 },

  // Tier 2: Major (1M+ population, also prefectural capitals)
  { name: '横浜', nameEn: 'Yokohama', lat: 35.4437, lng: 139.6380, tier: 2 },
  { name: '名古屋', nameEn: 'Nagoya', lat: 35.1815, lng: 136.9066, tier: 2 },
  { name: '札幌', nameEn: 'Sapporo', lat: 43.0618, lng: 141.3545, tier: 2 },
  { name: '福岡', nameEn: 'Fukuoka', lat: 33.5904, lng: 130.4017, tier: 2 },
  { name: '神戸', nameEn: 'Kobe', lat: 34.6901, lng: 135.1956, tier: 2 },
  { name: '京都', nameEn: 'Kyoto', lat: 35.0116, lng: 135.7681, tier: 2 },
  { name: '仙台', nameEn: 'Sendai', lat: 38.2682, lng: 140.8694, tier: 2 },
  { name: '広島', nameEn: 'Hiroshima', lat: 34.3853, lng: 132.4553, tier: 2 },

  // Tier 3: Remaining prefectural capitals
  { name: '青森', nameEn: 'Aomori', lat: 40.8244, lng: 140.7400, tier: 3 },
  { name: '盛岡', nameEn: 'Morioka', lat: 39.7036, lng: 141.1527, tier: 3 },
  { name: '秋田', nameEn: 'Akita', lat: 39.7186, lng: 140.1024, tier: 3 },
  { name: '山形', nameEn: 'Yamagata', lat: 38.2404, lng: 140.3634, tier: 3 },
  { name: '福島', nameEn: 'Fukushima', lat: 37.7503, lng: 140.4676, tier: 3 },
  { name: '水戸', nameEn: 'Mito', lat: 36.3415, lng: 140.4468, tier: 3 },
  { name: '宇都宮', nameEn: 'Utsunomiya', lat: 36.5658, lng: 139.8836, tier: 3 },
  { name: '前橋', nameEn: 'Maebashi', lat: 36.3911, lng: 139.0608, tier: 3 },
  { name: 'さいたま', nameEn: 'Saitama', lat: 35.8617, lng: 139.6455, tier: 3 },
  { name: '千葉', nameEn: 'Chiba', lat: 35.6074, lng: 140.1065, tier: 3 },
  { name: '新潟', nameEn: 'Niigata', lat: 37.9026, lng: 139.0236, tier: 3 },
  { name: '富山', nameEn: 'Toyama', lat: 36.6953, lng: 137.2114, tier: 3 },
  { name: '金沢', nameEn: 'Kanazawa', lat: 36.5613, lng: 136.6562, tier: 3 },
  { name: '福井', nameEn: 'Fukui', lat: 36.0652, lng: 136.2219, tier: 3 },
  { name: '甲府', nameEn: 'Kofu', lat: 35.6636, lng: 138.5684, tier: 3 },
  { name: '長野', nameEn: 'Nagano', lat: 36.6513, lng: 138.1810, tier: 3 },
  { name: '岐阜', nameEn: 'Gifu', lat: 35.3912, lng: 136.7223, tier: 3 },
  { name: '静岡', nameEn: 'Shizuoka', lat: 34.9756, lng: 138.3827, tier: 3 },
  { name: '津', nameEn: 'Tsu', lat: 34.7303, lng: 136.5086, tier: 3 },
  { name: '大津', nameEn: 'Otsu', lat: 35.0045, lng: 135.8686, tier: 3 },
  { name: '奈良', nameEn: 'Nara', lat: 34.6851, lng: 135.8048, tier: 3 },
  { name: '和歌山', nameEn: 'Wakayama', lat: 34.2260, lng: 135.1675, tier: 3 },
  { name: '鳥取', nameEn: 'Tottori', lat: 35.5039, lng: 134.2377, tier: 3 },
  { name: '松江', nameEn: 'Matsue', lat: 35.4723, lng: 133.0505, tier: 3 },
  { name: '岡山', nameEn: 'Okayama', lat: 34.6617, lng: 133.9350, tier: 3 },
  { name: '山口', nameEn: 'Yamaguchi', lat: 34.1859, lng: 131.4714, tier: 3 },
  { name: '徳島', nameEn: 'Tokushima', lat: 34.0657, lng: 134.5593, tier: 3 },
  { name: '高松', nameEn: 'Takamatsu', lat: 34.3401, lng: 134.0434, tier: 3 },
  { name: '松山', nameEn: 'Matsuyama', lat: 33.8416, lng: 132.7656, tier: 3 },
  { name: '高知', nameEn: 'Kochi', lat: 33.5597, lng: 133.5311, tier: 3 },
  { name: '佐賀', nameEn: 'Saga', lat: 33.2494, lng: 130.2988, tier: 3 },
  { name: '長崎', nameEn: 'Nagasaki', lat: 32.7503, lng: 129.8779, tier: 3 },
  { name: '熊本', nameEn: 'Kumamoto', lat: 32.8032, lng: 130.7079, tier: 3 },
  { name: '大分', nameEn: 'Oita', lat: 33.2382, lng: 131.6126, tier: 3 },
  { name: '宮崎', nameEn: 'Miyazaki', lat: 31.9111, lng: 131.4239, tier: 3 },
  { name: '鹿児島', nameEn: 'Kagoshima', lat: 31.5602, lng: 130.5581, tier: 3 },
  { name: '那覇', nameEn: 'Naha', lat: 26.2124, lng: 127.6809, tier: 3 },

  // Tier 5: Notable non-capital cities & islands
  { name: '函館', nameEn: 'Hakodate', lat: 41.7687, lng: 140.7290, tier: 5 },
  { name: '旭川', nameEn: 'Asahikawa', lat: 43.7707, lng: 142.3650, tier: 5 },
  { name: '釧路', nameEn: 'Kushiro', lat: 42.9849, lng: 144.3820, tier: 5 },
  { name: '北九州', nameEn: 'Kitakyushu', lat: 33.8835, lng: 130.8752, tier: 5 },
  { name: '堺', nameEn: 'Sakai', lat: 34.5733, lng: 135.4830, tier: 5 },
  { name: '浜松', nameEn: 'Hamamatsu', lat: 34.7108, lng: 137.7261, tier: 5 },
  { name: '川崎', nameEn: 'Kawasaki', lat: 35.5309, lng: 139.7030, tier: 5 },
  { name: '石垣', nameEn: 'Ishigaki', lat: 24.3448, lng: 124.1553, tier: 5 },
  { name: '小笠原', nameEn: 'Ogasawara', lat: 27.0945, lng: 142.1914, tier: 5 },
  { name: '稚内', nameEn: 'Wakkanai', lat: 45.4155, lng: 141.6729, tier: 5 },
  { name: '根室', nameEn: 'Nemuro', lat: 43.3301, lng: 145.5833, tier: 5 },
];

// ── Geographic Features ─────────────────────────────────────────

const GEO_FEATURES: GeoLabel[] = [
  // Tectonic trenches & troughs (tier 4 — seismically critical)
  { name: '日本海溝', nameEn: 'Japan Trench', lat: 38.5, lng: 144.5, tier: 4, italic: true },
  { name: '南海トラフ', nameEn: 'Nankai Trough', lat: 32.5, lng: 135.0, tier: 4, italic: true },
  { name: '相模トラフ', nameEn: 'Sagami Trough', lat: 34.5, lng: 140.5, tier: 4, italic: true },
  { name: '千島海溝', nameEn: 'Kuril Trench', lat: 44.0, lng: 150.0, tier: 4, italic: true },
  { name: '琉球海溝', nameEn: 'Ryukyu Trench', lat: 26.0, lng: 129.0, tier: 4, italic: true },
  { name: '伊豆・小笠原海溝', nameEn: 'Izu-Bonin Trench', lat: 30.0, lng: 143.0, tier: 4, italic: true },

  // Major mountains & volcanoes
  { name: '富士山', nameEn: 'Mt. Fuji', lat: 35.3606, lng: 138.7274, tier: 4 },
  { name: '阿蘇山', nameEn: 'Mt. Aso', lat: 32.8842, lng: 131.1040, tier: 5 },
  { name: '桜島', nameEn: 'Sakurajima', lat: 31.5853, lng: 130.6570, tier: 5 },
  { name: '御嶽山', nameEn: 'Mt. Ontake', lat: 35.8934, lng: 137.4808, tier: 5 },
  { name: '雲仙岳', nameEn: 'Mt. Unzen', lat: 32.7570, lng: 130.2939, tier: 5 },
  { name: '大雪山', nameEn: 'Mt. Daisetsu', lat: 43.6630, lng: 142.8570, tier: 5 },
  { name: '浅間山', nameEn: 'Mt. Asama', lat: 36.4060, lng: 138.5233, tier: 5 },

  // Seas & ocean areas
  { name: '太平洋', nameEn: 'Pacific Ocean', lat: 30.0, lng: 155.0, tier: 4, italic: true },
  { name: '日本海', nameEn: 'Sea of Japan', lat: 40.0, lng: 134.0, tier: 4, italic: true },
  { name: '東シナ海', nameEn: 'East China Sea', lat: 28.0, lng: 125.0, tier: 4, italic: true },
  { name: 'オホーツク海', nameEn: 'Sea of Okhotsk', lat: 52.0, lng: 148.0, tier: 4, italic: true },
  { name: 'フィリピン海', nameEn: 'Philippine Sea', lat: 22.0, lng: 135.0, tier: 4, italic: true },

  // Straits
  { name: '津軽海峡', nameEn: 'Tsugaru Strait', lat: 41.5, lng: 140.5, tier: 5, italic: true },
  { name: '関門海峡', nameEn: 'Kanmon Strait', lat: 33.95, lng: 130.95, tier: 5, italic: true },
  { name: '紀伊水道', nameEn: 'Kii Channel', lat: 33.95, lng: 134.80, tier: 5, italic: true },

  // Tectonic plates (far offshore, large text)
  { name: '太平洋プレート', nameEn: 'Pacific Plate', lat: 35.0, lng: 152.0, tier: 4, italic: true },
  { name: 'フィリピン海プレート', nameEn: 'Philippine Sea Plate', lat: 25.0, lng: 140.0, tier: 4, italic: true },

  // Regions / islands
  { name: '北海道', nameEn: 'Hokkaido', lat: 43.5, lng: 143.5, tier: 4 },
  { name: '本州', nameEn: 'Honshu', lat: 36.5, lng: 138.0, tier: 4 },
  { name: '四国', nameEn: 'Shikoku', lat: 33.7, lng: 133.5, tier: 4 },
  { name: '九州', nameEn: 'Kyushu', lat: 33.0, lng: 131.0, tier: 4 },
  { name: '沖縄', nameEn: 'Okinawa', lat: 26.5, lng: 128.0, tier: 4 },
];

// ── Global Context Cities (globe view) ──────────────────────────

const GLOBAL_CITIES: CityLabel[] = [
  { name: 'ソウル', nameEn: 'Seoul', lat: 37.5665, lng: 126.9780, tier: 6 },
  { name: '北京', nameEn: 'Beijing', lat: 39.9042, lng: 116.4074, tier: 6 },
  { name: '上海', nameEn: 'Shanghai', lat: 31.2304, lng: 121.4737, tier: 6 },
  { name: '台北', nameEn: 'Taipei', lat: 25.0330, lng: 121.5654, tier: 6 },
  { name: 'マニラ', nameEn: 'Manila', lat: 14.5995, lng: 120.9842, tier: 6 },
  { name: 'ウラジオストク', nameEn: 'Vladivostok', lat: 43.1155, lng: 131.8855, tier: 6 },
  { name: 'ハノイ', nameEn: 'Hanoi', lat: 21.0278, lng: 105.8342, tier: 6 },
  { name: '香港', nameEn: 'Hong Kong', lat: 22.3193, lng: 114.1694, tier: 6 },
  { name: 'シンガポール', nameEn: 'Singapore', lat: 1.3521, lng: 103.8198, tier: 6 },
  { name: 'シドニー', nameEn: 'Sydney', lat: -33.8688, lng: 151.2093, tier: 6 },
  { name: 'アンカレッジ', nameEn: 'Anchorage', lat: 61.2181, lng: -149.9003, tier: 6 },
  { name: 'ホノルル', nameEn: 'Honolulu', lat: 21.3069, lng: -157.8583, tier: 6 },
];

// ── Label Collection Management ─────────────────────────────────

let labelCollection: Cesium.LabelCollection | null = null;
let viewerRef: GlobeInstance | null = null;

export function initLabels(viewer: GlobeInstance): void {
  viewerRef = viewer;

  labelCollection = new Cesium.LabelCollection({
    scene: viewer.scene,
  });

  // Add Japan cities
  for (const city of JAPAN_CITIES) {
    labelCollection.add({
      text: `${city.name}\n${city.nameEn}`,
      position: Cesium.Cartesian3.fromDegrees(city.lng, city.lat, 0),
      font: getTierFont(city.tier),
      fillColor: getTierColor(city.tier),
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      pixelOffset: new Cesium.Cartesian2(0, -4),
      distanceDisplayCondition: getTierDisplayCondition(city.tier),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      showBackground: false,
    });
  }

  // Add geographic features
  for (const geo of GEO_FEATURES) {
    labelCollection.add({
      text: `${geo.name}\n${geo.nameEn}`,
      position: Cesium.Cartesian3.fromDegrees(geo.lng, geo.lat, 0),
      font: getTierFont(geo.tier, geo.italic),
      fillColor: getTierColor(geo.tier, true),
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      distanceDisplayCondition: getTierDisplayCondition(geo.tier),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      showBackground: false,
    });
  }

  // Add global context cities
  for (const city of GLOBAL_CITIES) {
    labelCollection.add({
      text: `${city.name}\n${city.nameEn}`,
      position: Cesium.Cartesian3.fromDegrees(city.lng, city.lat, 0),
      font: getTierFont(city.tier),
      fillColor: getTierColor(city.tier),
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      pixelOffset: new Cesium.Cartesian2(0, -4),
      distanceDisplayCondition: getTierDisplayCondition(city.tier),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      showBackground: false,
    });
  }

  viewer.scene.primitives.add(labelCollection);
  const total = JAPAN_CITIES.length + GEO_FEATURES.length + GLOBAL_CITIES.length;
  console.log(`[labels] Initialised ${total} labels (${JAPAN_CITIES.length} cities + ${GEO_FEATURES.length} geo + ${GLOBAL_CITIES.length} global)`);
}

export function setLabelsVisible(visible: boolean): void {
  if (labelCollection) {
    labelCollection.show = visible;
  }
}

export function disposeLabels(): void {
  if (labelCollection && viewerRef && !viewerRef.isDestroyed()) {
    viewerRef.scene.primitives.remove(labelCollection);
  }
  labelCollection = null;
  viewerRef = null;
}
