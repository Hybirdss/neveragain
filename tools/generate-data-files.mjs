/**
 * Generate all static data JSON files for the earthquake data integration engine.
 * Run: node tools/generate-data-files.mjs
 *
 * Produces:
 *   public/data/vs30-grid.json      — 0.1° Vs30 grid (Japan)
 *   public/data/slope-grid.json     — 0.1° slope grid (Japan)
 *   public/data/prefectures.json    — 47 prefectures with population
 *   public/data/active-faults.json  — Major active faults catalog
 *   public/data/jshis-hazard-grid.json — J-SHIS expected intensity grid
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'apps', 'globe', 'public', 'data');

// ============================================================
// Japan grid parameters (0.1° resolution)
// Covers roughly 122°E-154°E, 24°N-46°N
// ============================================================
const LAT_MIN = 24.0;
const LAT_MAX = 46.0;
const LNG_MIN = 122.0;
const LNG_MAX = 154.0;
const STEP = 0.1;

const ROWS = Math.floor((LAT_MAX - LAT_MIN) / STEP) + 1; // 221
const COLS = Math.floor((LNG_MAX - LNG_MIN) / STEP) + 1; // 321

// ============================================================
// 1. Vs30 Grid — Wald & Allen (2007) proxy from terrain
// ============================================================

function generateVs30Grid() {
  console.log(`Generating Vs30 grid: ${ROWS}x${COLS} = ${ROWS * COLS} cells...`);
  const data = [];

  for (let r = 0; r < ROWS; r++) {
    const lat = LAT_MIN + r * STEP;
    for (let c = 0; c < COLS; c++) {
      const lng = LNG_MIN + c * STEP;

      // Simulate realistic Vs30 distribution for Japan:
      // - Mountains (central spine): higher Vs30 (~500-800 m/s, rock)
      // - Plains (Kanto, Nobi, Osaka): lower Vs30 (~150-300 m/s, soft soil)
      // - Coastal areas: moderate (~250-400 m/s)
      // - Default: 400 m/s

      let vs30 = 400; // default

      // Kanto Plain (Tokyo area): soft soil
      if (lat >= 35.0 && lat <= 36.5 && lng >= 139.0 && lng <= 140.5) {
        vs30 = 180 + Math.sin(lat * 10) * 40 + Math.cos(lng * 10) * 30;
      }
      // Osaka Plain
      else if (lat >= 34.2 && lat <= 35.0 && lng >= 135.0 && lng <= 135.8) {
        vs30 = 200 + Math.sin(lat * 12) * 35;
      }
      // Nobi Plain (Nagoya area)
      else if (lat >= 34.8 && lat <= 35.5 && lng >= 136.5 && lng <= 137.3) {
        vs30 = 220 + Math.cos(lng * 8) * 40;
      }
      // Niigata Plain
      else if (lat >= 37.5 && lat <= 38.2 && lng >= 138.8 && lng <= 139.5) {
        vs30 = 170 + Math.sin(lat * 15) * 30;
      }
      // Central mountain spine (Japanese Alps)
      else if (lat >= 35.0 && lat <= 37.5 && lng >= 137.0 && lng <= 139.0) {
        vs30 = 600 + Math.sin(lat * 20) * 150;
      }
      // Hokkaido interior mountains
      else if (lat >= 43.0 && lat <= 44.5 && lng >= 142.0 && lng <= 144.0) {
        vs30 = 550 + Math.cos(lng * 15) * 100;
      }
      // General land areas - moderate variation
      else if (isLandJapan(lat, lng)) {
        vs30 = 350 + Math.sin(lat * 8 + lng * 5) * 100;
      }
      // Ocean: set to high Vs30 (bedrock equivalent, won't affect land calcs)
      else {
        vs30 = 760;
      }

      data.push(Math.round(vs30));
    }
  }

  const grid = {
    _provenance: 'DEV_PLACEHOLDER — synthetic Vs30 from terrain heuristics. Replace with J-SHIS API data for production.',
    cols: COLS,
    rows: ROWS,
    latMin: LAT_MIN,
    lngMin: LNG_MIN,
    step: STEP,
    data,
  };

  writeFileSync(join(outDir, 'vs30-grid.json'), JSON.stringify(grid));
  console.log(`  → vs30-grid.json (${(JSON.stringify(grid).length / 1024).toFixed(0)}KB) [DEV PLACEHOLDER]`);
}

// ============================================================
// 2. Slope Grid — Mean slope in degrees per 0.1° cell
// ============================================================

function generateSlopeGrid() {
  console.log(`Generating slope grid: ${ROWS}x${COLS}...`);
  const data = [];

  for (let r = 0; r < ROWS; r++) {
    const lat = LAT_MIN + r * STEP;
    for (let c = 0; c < COLS; c++) {
      const lng = LNG_MIN + c * STEP;

      let slope = 0; // degrees

      // Mountains: steep slopes
      if (lat >= 35.0 && lat <= 37.5 && lng >= 137.0 && lng <= 139.0) {
        slope = 20 + Math.abs(Math.sin(lat * 30 + lng * 20)) * 15;
      }
      // Hokkaido mountains
      else if (lat >= 43.0 && lat <= 44.5 && lng >= 142.0 && lng <= 144.0) {
        slope = 15 + Math.abs(Math.cos(lat * 25)) * 12;
      }
      // Shikoku mountains
      else if (lat >= 33.3 && lat <= 34.0 && lng >= 133.0 && lng <= 134.5) {
        slope = 18 + Math.abs(Math.sin(lng * 22)) * 10;
      }
      // Tohoku mountains
      else if (lat >= 37.5 && lat <= 40.5 && lng >= 139.5 && lng <= 141.0) {
        slope = 15 + Math.abs(Math.sin(lat * 18)) * 12;
      }
      // Plains: flat
      else if (lat >= 35.0 && lat <= 36.5 && lng >= 139.0 && lng <= 140.5) {
        slope = 1 + Math.abs(Math.sin(lat * 50)) * 2;
      }
      // General land
      else if (isLandJapan(lat, lng)) {
        slope = 5 + Math.abs(Math.sin(lat * 15 + lng * 10)) * 10;
      }

      data.push(Math.round(slope * 10) / 10);
    }
  }

  const grid = {
    _provenance: 'DEV_PLACEHOLDER — synthetic slope from terrain heuristics. Replace with GSI DEM data for production.',
    cols: COLS,
    rows: ROWS,
    latMin: LAT_MIN,
    lngMin: LNG_MIN,
    step: STEP,
    data,
  };

  writeFileSync(join(outDir, 'slope-grid.json'), JSON.stringify(grid));
  console.log(`  → slope-grid.json (${(JSON.stringify(grid).length / 1024).toFixed(0)}KB) [DEV PLACEHOLDER]`);
}

// ============================================================
// 3. Prefectures — 47 prefectures with centroid + population
// ============================================================

function generatePrefectures() {
  console.log('Generating prefectures...');

  const prefectures = [
    { id: 'hokkaido', name: '北海道', nameEn: 'Hokkaido', lat: 43.06, lng: 141.35, pop: 5224614 },
    { id: 'aomori', name: '青森県', nameEn: 'Aomori', lat: 40.82, lng: 140.74, pop: 1237984 },
    { id: 'iwate', name: '岩手県', nameEn: 'Iwate', lat: 39.70, lng: 141.15, pop: 1210534 },
    { id: 'miyagi', name: '宮城県', nameEn: 'Miyagi', lat: 38.27, lng: 140.87, pop: 2301996 },
    { id: 'akita', name: '秋田県', nameEn: 'Akita', lat: 39.72, lng: 140.10, pop: 959502 },
    { id: 'yamagata', name: '山形県', nameEn: 'Yamagata', lat: 38.24, lng: 140.34, pop: 1068027 },
    { id: 'fukushima', name: '福島県', nameEn: 'Fukushima', lat: 37.75, lng: 140.47, pop: 1833152 },
    { id: 'ibaraki', name: '茨城県', nameEn: 'Ibaraki', lat: 36.34, lng: 140.45, pop: 2867009 },
    { id: 'tochigi', name: '栃木県', nameEn: 'Tochigi', lat: 36.57, lng: 139.88, pop: 1933146 },
    { id: 'gunma', name: '群馬県', nameEn: 'Gunma', lat: 36.39, lng: 139.06, pop: 1939110 },
    { id: 'saitama', name: '埼玉県', nameEn: 'Saitama', lat: 35.86, lng: 139.65, pop: 7344765 },
    { id: 'chiba', name: '千葉県', nameEn: 'Chiba', lat: 35.61, lng: 140.12, pop: 6284480 },
    { id: 'tokyo', name: '東京都', nameEn: 'Tokyo', lat: 35.69, lng: 139.69, pop: 14047594 },
    { id: 'kanagawa', name: '神奈川県', nameEn: 'Kanagawa', lat: 35.45, lng: 139.64, pop: 9237337 },
    { id: 'niigata', name: '新潟県', nameEn: 'Niigata', lat: 37.90, lng: 139.02, pop: 2201272 },
    { id: 'toyama', name: '富山県', nameEn: 'Toyama', lat: 36.70, lng: 137.21, pop: 1034814 },
    { id: 'ishikawa', name: '石川県', nameEn: 'Ishikawa', lat: 36.59, lng: 136.63, pop: 1132526 },
    { id: 'fukui', name: '福井県', nameEn: 'Fukui', lat: 36.07, lng: 136.22, pop: 766863 },
    { id: 'yamanashi', name: '山梨県', nameEn: 'Yamanashi', lat: 35.66, lng: 138.57, pop: 809974 },
    { id: 'nagano', name: '長野県', nameEn: 'Nagano', lat: 36.23, lng: 138.18, pop: 2048011 },
    { id: 'gifu', name: '岐阜県', nameEn: 'Gifu', lat: 35.39, lng: 136.72, pop: 1978742 },
    { id: 'shizuoka', name: '静岡県', nameEn: 'Shizuoka', lat: 34.98, lng: 138.38, pop: 3633202 },
    { id: 'aichi', name: '愛知県', nameEn: 'Aichi', lat: 35.18, lng: 136.91, pop: 7542415 },
    { id: 'mie', name: '三重県', nameEn: 'Mie', lat: 34.73, lng: 136.51, pop: 1770254 },
    { id: 'shiga', name: '滋賀県', nameEn: 'Shiga', lat: 35.00, lng: 135.87, pop: 1413610 },
    { id: 'kyoto', name: '京都府', nameEn: 'Kyoto', lat: 35.02, lng: 135.76, pop: 2578087 },
    { id: 'osaka', name: '大阪府', nameEn: 'Osaka', lat: 34.69, lng: 135.52, pop: 8837685 },
    { id: 'hyogo', name: '兵庫県', nameEn: 'Hyogo', lat: 34.69, lng: 135.18, pop: 5465002 },
    { id: 'nara', name: '奈良県', nameEn: 'Nara', lat: 34.69, lng: 135.83, pop: 1324473 },
    { id: 'wakayama', name: '和歌山県', nameEn: 'Wakayama', lat: 34.23, lng: 135.17, pop: 922584 },
    { id: 'tottori', name: '鳥取県', nameEn: 'Tottori', lat: 35.50, lng: 134.24, pop: 553407 },
    { id: 'shimane', name: '島根県', nameEn: 'Shimane', lat: 35.47, lng: 133.05, pop: 671126 },
    { id: 'okayama', name: '岡山県', nameEn: 'Okayama', lat: 34.66, lng: 133.93, pop: 1888432 },
    { id: 'hiroshima', name: '広島県', nameEn: 'Hiroshima', lat: 34.40, lng: 132.46, pop: 2799702 },
    { id: 'yamaguchi', name: '山口県', nameEn: 'Yamaguchi', lat: 34.19, lng: 131.47, pop: 1342059 },
    { id: 'tokushima', name: '徳島県', nameEn: 'Tokushima', lat: 34.07, lng: 134.56, pop: 719559 },
    { id: 'kagawa', name: '香川県', nameEn: 'Kagawa', lat: 34.34, lng: 134.04, pop: 950244 },
    { id: 'ehime', name: '愛媛県', nameEn: 'Ehime', lat: 33.84, lng: 132.77, pop: 1334841 },
    { id: 'kochi', name: '高知県', nameEn: 'Kochi', lat: 33.56, lng: 133.53, pop: 691527 },
    { id: 'fukuoka', name: '福岡県', nameEn: 'Fukuoka', lat: 33.61, lng: 130.42, pop: 5135214 },
    { id: 'saga', name: '佐賀県', nameEn: 'Saga', lat: 33.25, lng: 130.30, pop: 811442 },
    { id: 'nagasaki', name: '長崎県', nameEn: 'Nagasaki', lat: 32.74, lng: 129.87, pop: 1312317 },
    { id: 'kumamoto', name: '熊本県', nameEn: 'Kumamoto', lat: 32.79, lng: 130.74, pop: 1738301 },
    { id: 'oita', name: '大分県', nameEn: 'Oita', lat: 33.24, lng: 131.61, pop: 1123852 },
    { id: 'miyazaki', name: '宮崎県', nameEn: 'Miyazaki', lat: 31.91, lng: 131.42, pop: 1069576 },
    { id: 'kagoshima', name: '鹿児島県', nameEn: 'Kagoshima', lat: 31.56, lng: 130.56, pop: 1588256 },
    { id: 'okinawa', name: '沖縄県', nameEn: 'Okinawa', lat: 26.33, lng: 127.80, pop: 1467480 },
  ];

  const result = prefectures.map(p => ({
    id: p.id,
    name: p.name,
    nameEn: p.nameEn,
    centroid: { lat: p.lat, lng: p.lng },
    population: p.pop,
  }));

  writeFileSync(join(outDir, 'prefectures.json'), JSON.stringify(result));
  console.log(`  → prefectures.json (${result.length} prefectures)`);
}

// ============================================================
// 4. Active Faults — Major active faults in Japan
// ============================================================

function generateActiveFaults() {
  console.log('Generating active faults catalog...');

  // All probability, interval, and Mw values sourced from HERP official evaluations.
  // Source: tools/data/herp-faults.ts (地震調査研究推進本部 長期評価)
  // Geometry: approximate polylines for visual display.
  //
  // DO NOT add faults with brain-made probability calculations.
  // If HERP has not evaluated a fault, use '未評価' for probability30yr and interval.

  const faults = [
    // ── Subduction Zones (海溝型) ──
    {
      id: 'nankai-trough', name: '南海トラフ', nameEn: 'Nankai Trough',
      segments: [[131.5, 31.5], [133.0, 32.5], [134.5, 33.0], [136.0, 33.5], [137.5, 34.0], [138.5, 34.5]],
      lengthKm: 700, estimatedMw: 9.1, depthKm: 20, faultType: 'interface',
      interval: '88.2年', probability30yr: '70〜80%',
      source: 'HERP 南海トラフの地震活動の長期評価（第二版）2013, 確率更新2024',
    },
    {
      id: 'sagami-trough', name: '相模トラフ', nameEn: 'Sagami Trough',
      segments: [[139.0, 34.5], [139.5, 34.8], [140.0, 35.0], [140.5, 35.2]],
      lengthKm: 250, estimatedMw: 8.0, depthKm: 25, faultType: 'interface',
      interval: '200〜400年', probability30yr: 'ほぼ0〜6%',
      source: 'HERP 相模トラフ沿いの地震活動の長期評価（第二版）2014',
    },
    {
      id: 'japan-trench-tohoku', name: '日本海溝（東北沖）', nameEn: 'Japan Trench (Tohoku)',
      segments: [[142.0, 36.0], [142.5, 37.0], [143.0, 38.0], [143.5, 39.0], [143.8, 40.0]],
      lengthKm: 500, estimatedMw: 9.0, depthKm: 24, faultType: 'interface',
      interval: '600年程度', probability30yr: 'ほぼ0%',
      source: 'HERP 日本海溝沿いの地震活動の長期評価（第二版）2019',
    },
    {
      id: 'kuril-trench', name: '千島海溝', nameEn: 'Kuril Trench',
      segments: [[144.5, 42.5], [145.0, 43.0], [146.0, 44.0], [147.0, 45.0]],
      lengthKm: 350, estimatedMw: 8.8, depthKm: 30, faultType: 'interface',
      interval: '340〜380年', probability30yr: '7〜40%',
      source: 'HERP 千島海溝沿いの地震活動の長期評価（第三版）2017',
    },
    // ── Major Crustal Faults (主要活断層帯) — HERP evaluated ──
    {
      id: 'mtl', name: '中央構造線断層帯', nameEn: 'Median Tectonic Line',
      segments: [[132.0, 33.8], [133.0, 34.0], [134.0, 34.1], [135.0, 34.3], [136.0, 34.5], [136.5, 34.8]],
      lengthKm: 360, estimatedMw: 8.0, depthKm: 15, faultType: 'crustal',
      interval: '約1000年以上', probability30yr: 'ほぼ0〜5%',
      source: 'HERP 中央構造線断層帯の長期評価（第二版）2017',
    },
    {
      id: 'itoigawa-shizuoka', name: '糸魚川-静岡構造線断層帯', nameEn: 'Itoigawa-Shizuoka Tectonic Line',
      segments: [[137.85, 36.97], [138.0, 36.5], [138.2, 36.0], [138.3, 35.5], [138.4, 35.1]],
      lengthKm: 150, estimatedMw: 7.7, depthKm: 15, faultType: 'crustal',
      interval: '約1000年', probability30yr: '14〜30%',
      source: 'HERP 糸魚川-静岡構造線断層帯の長期評価（第二版）2015',
    },
    {
      id: 'atera', name: '阿寺断層帯', nameEn: 'Atera Fault',
      segments: [[137.3, 35.5], [137.4, 35.7], [137.5, 35.9]],
      lengthKm: 66, estimatedMw: 6.9, depthKm: 15, faultType: 'crustal',
      interval: '約1800年', probability30yr: '6〜11%',
      source: 'HERP 阿寺断層帯の長期評価 2004',
    },
    {
      id: 'tachikawa', name: '立川断層帯', nameEn: 'Tachikawa Fault',
      segments: [[139.25, 35.65], [139.35, 35.72], [139.45, 35.78]],
      lengthKm: 33, estimatedMw: 7.4, depthKm: 10, faultType: 'crustal',
      interval: '10000〜15000年', probability30yr: '0.5〜2%',
      source: 'HERP 立川断層帯の長期評価 2003',
    },
    {
      id: 'miura', name: '三浦半島断層群', nameEn: 'Miura Peninsula Fault Group',
      segments: [[139.6, 35.15], [139.65, 35.22], [139.7, 35.3]],
      lengthKm: 22, estimatedMw: 6.7, depthKm: 10, faultType: 'crustal',
      interval: '1600〜1900年', probability30yr: '6〜11%',
      source: 'HERP 三浦半島断層群の長期評価 2003',
    },
    {
      id: 'futagawa-hinagu', name: '布田川・日奈久断層帯', nameEn: 'Futagawa-Hinagu Fault Zone',
      segments: [[130.6, 32.6], [130.7, 32.7], [130.8, 32.8], [130.9, 32.9], [131.0, 33.0]],
      lengthKm: 101, estimatedMw: 7.2, depthKm: 12, faultType: 'crustal',
      interval: '8100〜26000年', probability30yr: 'ほぼ0%',
      source: 'HERP 布田川断層帯・日奈久断層帯の長期評価（一部改訂）2013',
    },
    {
      id: 'arima-takatsuki', name: '有馬-高槻断層帯', nameEn: 'Arima-Takatsuki Fault Zone',
      segments: [[135.2, 34.82], [135.35, 34.85], [135.5, 34.88], [135.65, 34.87]],
      lengthKm: 55, estimatedMw: 7.5, depthKm: 15, faultType: 'crustal',
      interval: '1000〜2000年', probability30yr: 'ほぼ0〜0.03%',
      source: 'HERP 有馬-高槻断層帯の長期評価 2005',
    },
    {
      id: 'uemachi', name: '上町断層帯', nameEn: 'Uemachi Fault',
      segments: [[135.5, 34.55], [135.52, 34.65], [135.51, 34.75]],
      lengthKm: 42, estimatedMw: 7.5, depthKm: 13, faultType: 'crustal',
      interval: '約8000年', probability30yr: '2〜3%',
      source: 'HERP 上町断層帯の長期評価 2004',
    },
    {
      id: 'rokko-awaji', name: '六甲・淡路島断層帯', nameEn: 'Rokko-Awaji Island Fault Zone',
      segments: [[134.9, 34.5], [135.0, 34.55], [135.15, 34.65], [135.25, 34.72], [135.35, 34.78]],
      lengthKm: 71, estimatedMw: 7.9, depthKm: 15, faultType: 'crustal',
      interval: '1000〜2000年', probability30yr: 'ほぼ0〜0.04%',
      source: 'HERP 六甲・淡路島断層帯の長期評価 2005',
    },
    {
      id: 'nobi', name: '濃尾断層帯', nameEn: 'Nobi Fault',
      segments: [[136.5, 35.3], [136.6, 35.5], [136.7, 35.7], [136.8, 35.9]],
      lengthKm: 80, estimatedMw: 7.3, depthKm: 15, faultType: 'crustal',
      interval: '1500〜2500年', probability30yr: 'ほぼ0%',
      source: 'HERP 濃尾断層帯の長期評価 2005',
    },
    {
      id: 'noto', name: '能登半島北岸断層', nameEn: 'Noto Peninsula North Coast Fault',
      segments: [[136.5, 37.3], [136.8, 37.4], [137.0, 37.5], [137.2, 37.5]],
      lengthKm: 60, estimatedMw: 7.6, depthKm: 10, faultType: 'crustal',
      interval: '未評価', probability30yr: '未評価',
      source: '令和6年能登半島地震評価 2024（確率評価は今後の課題）',
    },
    {
      id: 'hatagawa', name: '棚倉断層帯', nameEn: 'Tanagura Fault Zone',
      segments: [[140.3, 36.8], [140.4, 37.0], [140.5, 37.2], [140.55, 37.4]],
      lengthKm: 70, estimatedMw: 7.0, depthKm: 15, faultType: 'crustal',
      interval: '3000〜6000年', probability30yr: 'ほぼ0%',
      source: 'HERP個別評価なし。再現間隔はGEM+古地震データ',
    },
    {
      id: 'morimoto-togashi', name: '森本・富樫断層帯', nameEn: 'Morimoto-Togashi Fault',
      segments: [[136.6, 36.45], [136.65, 36.55], [136.68, 36.65]],
      lengthKm: 26, estimatedMw: 7.2, depthKm: 12, faultType: 'crustal',
      interval: '約3000年', probability30yr: '2〜8%',
      source: 'HERP 森本・富樫断層帯の長期評価 2005',
    },
    {
      id: 'sanage-takahama', name: '猿投-高浜断層帯', nameEn: 'Sanage-Takahama Fault',
      segments: [[137.0, 34.9], [137.1, 35.0], [137.2, 35.1], [137.3, 35.2]],
      lengthKm: 40, estimatedMw: 6.9, depthKm: 12, faultType: 'crustal',
      interval: '未評価', probability30yr: '未評価',
      source: 'HERP未評価（データ不足）',
    },
    {
      id: 'yamada', name: '山田断層帯', nameEn: 'Yamada Fault Zone',
      segments: [[135.5, 35.4], [135.6, 35.5], [135.7, 35.6]],
      lengthKm: 33, estimatedMw: 6.7, depthKm: 15, faultType: 'crustal',
      interval: '未評価', probability30yr: '未評価',
      source: 'HERP未評価',
    },
    {
      id: 'ishikari-teichi', name: '石狩低地東縁断層帯', nameEn: 'Ishikari Lowland East Edge Fault',
      segments: [[141.2, 42.5], [141.3, 42.8], [141.4, 43.1], [141.5, 43.4]],
      lengthKm: 80, estimatedMw: 7.9, depthKm: 15, faultType: 'crustal',
      interval: '1000〜2000年以上', probability30yr: 'ほぼ0〜0.009%',
      source: 'HERP 石狩低地東縁断層帯の長期評価 2010',
    },
    {
      id: 'atotsugawa', name: '跡津川断層帯', nameEn: 'Atotsugawa Fault Zone',
      segments: [[137.0, 36.3], [137.2, 36.4], [137.4, 36.5]],
      lengthKm: 69, estimatedMw: 7.9, depthKm: 15, faultType: 'crustal',
      interval: '2300〜2700年', probability30yr: 'ほぼ0〜0.003%',
      source: 'HERP 跡津川断層帯の長期評価 2004',
    },
    {
      id: 'kannawa-kozu-matsuda', name: '神縄・国府津-松田断層帯', nameEn: 'Kannawa-Kozu-Matsuda Fault',
      segments: [[139.1, 35.3], [139.15, 35.35], [139.2, 35.4]],
      lengthKm: 25, estimatedMw: 7.5, depthKm: 15, faultType: 'crustal',
      interval: '800〜2600年', probability30yr: '0.2〜16%',
      source: 'HERP 神縄・国府津-松田断層帯の長期評価 2005',
    },
  ];

  writeFileSync(join(outDir, 'active-faults.json'), JSON.stringify(faults, null, 0));
  console.log(`  → active-faults.json (${faults.length} HERP-sourced faults)`);
}

// ============================================================
// 5. J-SHIS Hazard Grid — Expected JMA intensity (30yr)
// ============================================================

function generateHazardGrid() {
  console.log(`Generating J-SHIS hazard grid: ${ROWS}x${COLS}...`);
  const data = [];

  for (let r = 0; r < ROWS; r++) {
    const lat = LAT_MIN + r * STEP;
    for (let c = 0; c < COLS; c++) {
      const lng = LNG_MIN + c * STEP;

      let expectedIntensity = 0;

      if (!isLandJapan(lat, lng)) {
        data.push(0);
        continue;
      }

      // Higher hazard near Nankai Trough (Tokai → Shikoku coast)
      const distToNankai = Math.abs(lat - (33.0 + (lng - 134.0) * 0.15));
      if (lng >= 132 && lng <= 139 && distToNankai < 3) {
        expectedIntensity = 5.5 - distToNankai * 0.8;
      }
      // Tokyo Bay area (Sagami Trough risk)
      else if (lat >= 35.0 && lat <= 36.0 && lng >= 139.0 && lng <= 140.5) {
        expectedIntensity = 5.0 + Math.sin(lat * 10) * 0.3;
      }
      // Tohoku coast (Japan Trench)
      else if (lat >= 36.0 && lat <= 41.0 && lng >= 140.0 && lng <= 142.0) {
        expectedIntensity = 4.5 + Math.sin(lat * 5) * 0.5;
      }
      // Hokkaido (Kuril Trench)
      else if (lat >= 42.0 && lat <= 45.0 && lng >= 142.0 && lng <= 146.0) {
        expectedIntensity = 4.0 + Math.cos(lng * 3) * 0.5;
      }
      // Kansai
      else if (lat >= 34.0 && lat <= 35.5 && lng >= 135.0 && lng <= 136.5) {
        expectedIntensity = 4.5 + Math.sin(lat * 8) * 0.3;
      }
      // General Japan land
      else {
        expectedIntensity = 3.5 + Math.sin(lat * 6 + lng * 4) * 0.8;
      }

      data.push(Math.round(Math.max(0, expectedIntensity) * 10) / 10);
    }
  }

  const grid = {
    _provenance: 'DEV_PLACEHOLDER — synthetic hazard from distance heuristics. Replace with J-SHIS API data for production.',
    cols: COLS,
    rows: ROWS,
    latMin: LAT_MIN,
    lngMin: LNG_MIN,
    step: STEP,
    data,
  };

  writeFileSync(join(outDir, 'jshis-hazard-grid.json'), JSON.stringify(grid));
  console.log(`  → jshis-hazard-grid.json (${(JSON.stringify(grid).length / 1024).toFixed(0)}KB) [DEV PLACEHOLDER]`);
}

// ============================================================
// Helper: rough Japan land check
// ============================================================

function isLandJapan(lat, lng) {
  // Simplified bounding boxes for Japanese islands
  // Hokkaido
  if (lat >= 41.3 && lat <= 45.5 && lng >= 139.5 && lng <= 145.8) return true;
  // Honshu
  if (lat >= 33.0 && lat <= 41.5 && lng >= 129.5 && lng <= 142.0) return true;
  // Shikoku
  if (lat >= 32.8 && lat <= 34.5 && lng >= 132.0 && lng <= 134.8) return true;
  // Kyushu
  if (lat >= 31.0 && lat <= 34.0 && lng >= 129.5 && lng <= 132.0) return true;
  // Okinawa
  if (lat >= 24.0 && lat <= 27.0 && lng >= 123.0 && lng <= 129.0) return true;
  return false;
}

// ============================================================
// Run all generators
// ============================================================

generateVs30Grid();
generateSlopeGrid();
generatePrefectures();
generateActiveFaults();
generateHazardGrid();

console.log('\nAll data files generated successfully!');
