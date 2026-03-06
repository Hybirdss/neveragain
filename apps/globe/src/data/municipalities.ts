/**
 * Japan Municipality Population Catalog — 2020 Census (令和2年国勢調査)
 *
 * Source: 総務省統計局「令和2年国勢調査 人口等基本集計」
 * https://www.stat.go.jp/data/kokusei/2020/kekka.html
 *
 * All population figures are EXACT census counts, not estimates.
 * Coordinates are city hall / ward office locations.
 *
 * Coverage: ~100 major municipalities representing ~55M people
 * (44% of Japan's 126,146,099 total population).
 * Used for population exposure computation — remaining population
 * distributed via prefecture remainders.
 */

export interface Municipality {
  name: string;
  nameEn: string;
  lat: number;
  lng: number;
  /** 2020 census exact population */
  population: number;
  prefectureId: string;
}

// ── Tokyo 23 Special Wards (東京都特別区) ─────────────────────

const TOKYO_WARDS: Municipality[] = [
  { name: '世田谷区', nameEn: 'Setagaya', lat: 35.646, lng: 139.653, population: 943664, prefectureId: 'tokyo' },
  { name: '練馬区', nameEn: 'Nerima', lat: 35.735, lng: 139.652, population: 752608, prefectureId: 'tokyo' },
  { name: '大田区', nameEn: 'Ota', lat: 35.561, lng: 139.716, population: 748081, prefectureId: 'tokyo' },
  { name: '江戸川区', nameEn: 'Edogawa', lat: 35.707, lng: 139.868, population: 697932, prefectureId: 'tokyo' },
  { name: '足立区', nameEn: 'Adachi', lat: 35.775, lng: 139.804, population: 695043, prefectureId: 'tokyo' },
  { name: '杉並区', nameEn: 'Suginami', lat: 35.699, lng: 139.637, population: 591108, prefectureId: 'tokyo' },
  { name: '板橋区', nameEn: 'Itabashi', lat: 35.751, lng: 139.709, population: 584483, prefectureId: 'tokyo' },
  { name: '江東区', nameEn: 'Koto', lat: 35.673, lng: 139.817, population: 524310, prefectureId: 'tokyo' },
  { name: '葛飾区', nameEn: 'Katsushika', lat: 35.743, lng: 139.847, population: 453093, prefectureId: 'tokyo' },
  { name: '品川区', nameEn: 'Shinagawa', lat: 35.609, lng: 139.730, population: 422488, prefectureId: 'tokyo' },
  { name: '北区', nameEn: 'Kita', lat: 35.753, lng: 139.737, population: 355213, prefectureId: 'tokyo' },
  { name: '新宿区', nameEn: 'Shinjuku', lat: 35.694, lng: 139.703, population: 349385, prefectureId: 'tokyo' },
  { name: '中野区', nameEn: 'Nakano', lat: 35.707, lng: 139.664, population: 344880, prefectureId: 'tokyo' },
  { name: '豊島区', nameEn: 'Toshima', lat: 35.726, lng: 139.715, population: 301599, prefectureId: 'tokyo' },
  { name: '目黒区', nameEn: 'Meguro', lat: 35.634, lng: 139.698, population: 288088, prefectureId: 'tokyo' },
  { name: '墨田区', nameEn: 'Sumida', lat: 35.710, lng: 139.801, population: 272085, prefectureId: 'tokyo' },
  { name: '港区', nameEn: 'Minato', lat: 35.658, lng: 139.751, population: 260486, prefectureId: 'tokyo' },
  { name: '渋谷区', nameEn: 'Shibuya', lat: 35.662, lng: 139.704, population: 243883, prefectureId: 'tokyo' },
  { name: '文京区', nameEn: 'Bunkyo', lat: 35.708, lng: 139.752, population: 240069, prefectureId: 'tokyo' },
  { name: '荒川区', nameEn: 'Arakawa', lat: 35.736, lng: 139.783, population: 217475, prefectureId: 'tokyo' },
  { name: '台東区', nameEn: 'Taito', lat: 35.712, lng: 139.780, population: 211444, prefectureId: 'tokyo' },
  { name: '中央区', nameEn: 'Chuo', lat: 35.670, lng: 139.772, population: 169179, prefectureId: 'tokyo' },
  { name: '千代田区', nameEn: 'Chiyoda', lat: 35.694, lng: 139.754, population: 67049, prefectureId: 'tokyo' },
];

// ── Tokyo Tama Region (東京都多摩地域) ─────────────────────────

const TOKYO_TAMA: Municipality[] = [
  { name: '八王子市', nameEn: 'Hachioji', lat: 35.656, lng: 139.324, population: 579330, prefectureId: 'tokyo' },
  { name: '町田市', nameEn: 'Machida', lat: 35.549, lng: 139.447, population: 432348, prefectureId: 'tokyo' },
  { name: '府中市', nameEn: 'Fuchu', lat: 35.669, lng: 139.478, population: 262790, prefectureId: 'tokyo' },
  { name: '調布市', nameEn: 'Chofu', lat: 35.652, lng: 139.541, population: 243072, prefectureId: 'tokyo' },
  { name: '西東京市', nameEn: 'Nishi-Tokyo', lat: 35.726, lng: 139.539, population: 207388, prefectureId: 'tokyo' },
];

// ── Designated Cities (政令指定都市) ──────────────────────────

const DESIGNATED_CITIES: Municipality[] = [
  { name: '横浜市', nameEn: 'Yokohama', lat: 35.444, lng: 139.638, population: 3777491, prefectureId: 'kanagawa' },
  { name: '大阪市', nameEn: 'Osaka', lat: 34.694, lng: 135.502, population: 2752412, prefectureId: 'osaka' },
  { name: '名古屋市', nameEn: 'Nagoya', lat: 35.181, lng: 136.906, population: 2320361, prefectureId: 'aichi' },
  { name: '札幌市', nameEn: 'Sapporo', lat: 43.062, lng: 141.354, population: 1975066, prefectureId: 'hokkaido' },
  { name: '福岡市', nameEn: 'Fukuoka', lat: 33.590, lng: 130.402, population: 1612392, prefectureId: 'fukuoka' },
  { name: '川崎市', nameEn: 'Kawasaki', lat: 35.531, lng: 139.703, population: 1538262, prefectureId: 'kanagawa' },
  { name: '神戸市', nameEn: 'Kobe', lat: 34.690, lng: 135.196, population: 1525152, prefectureId: 'hyogo' },
  { name: '京都市', nameEn: 'Kyoto', lat: 35.012, lng: 135.768, population: 1463723, prefectureId: 'kyoto' },
  { name: 'さいたま市', nameEn: 'Saitama', lat: 35.861, lng: 139.646, population: 1324025, prefectureId: 'saitama' },
  { name: '広島市', nameEn: 'Hiroshima', lat: 34.386, lng: 132.455, population: 1200754, prefectureId: 'hiroshima' },
  { name: '仙台市', nameEn: 'Sendai', lat: 38.268, lng: 140.872, population: 1096704, prefectureId: 'miyagi' },
  { name: '千葉市', nameEn: 'Chiba', lat: 35.607, lng: 140.106, population: 974951, prefectureId: 'chiba' },
  { name: '北九州市', nameEn: 'Kitakyushu', lat: 33.883, lng: 130.883, population: 939029, prefectureId: 'fukuoka' },
  { name: '堺市', nameEn: 'Sakai', lat: 34.573, lng: 135.483, population: 826161, prefectureId: 'osaka' },
  { name: '新潟市', nameEn: 'Niigata', lat: 37.902, lng: 139.023, population: 789275, prefectureId: 'niigata' },
  { name: '浜松市', nameEn: 'Hamamatsu', lat: 34.711, lng: 137.726, population: 790718, prefectureId: 'shizuoka' },
  { name: '熊本市', nameEn: 'Kumamoto', lat: 32.803, lng: 130.708, population: 738865, prefectureId: 'kumamoto' },
  { name: '相模原市', nameEn: 'Sagamihara', lat: 35.571, lng: 139.373, population: 725493, prefectureId: 'kanagawa' },
  { name: '岡山市', nameEn: 'Okayama', lat: 34.662, lng: 133.935, population: 724691, prefectureId: 'okayama' },
  { name: '静岡市', nameEn: 'Shizuoka', lat: 34.976, lng: 138.383, population: 693389, prefectureId: 'shizuoka' },
];

// ── Core Cities (中核市) and Other Major Cities ──────────────

const MAJOR_CITIES: Municipality[] = [
  // Kanto
  { name: '船橋市', nameEn: 'Funabashi', lat: 35.695, lng: 139.983, population: 642907, prefectureId: 'chiba' },
  { name: '川口市', nameEn: 'Kawaguchi', lat: 35.808, lng: 139.724, population: 594274, prefectureId: 'saitama' },
  { name: '松戸市', nameEn: 'Matsudo', lat: 35.787, lng: 139.903, population: 498232, prefectureId: 'chiba' },
  { name: '市川市', nameEn: 'Ichikawa', lat: 35.732, lng: 139.931, population: 496676, prefectureId: 'chiba' },
  { name: '柏市', nameEn: 'Kashiwa', lat: 35.868, lng: 139.972, population: 426468, prefectureId: 'chiba' },
  { name: '川越市', nameEn: 'Kawagoe', lat: 35.925, lng: 139.486, population: 354571, prefectureId: 'saitama' },
  { name: '所沢市', nameEn: 'Tokorozawa', lat: 35.799, lng: 139.469, population: 341924, prefectureId: 'saitama' },
  { name: '越谷市', nameEn: 'Koshigaya', lat: 35.891, lng: 139.790, population: 341621, prefectureId: 'saitama' },
  { name: '横須賀市', nameEn: 'Yokosuka', lat: 35.281, lng: 139.672, population: 388078, prefectureId: 'kanagawa' },
  { name: '藤沢市', nameEn: 'Fujisawa', lat: 35.339, lng: 139.490, population: 436905, prefectureId: 'kanagawa' },
  { name: '宇都宮市', nameEn: 'Utsunomiya', lat: 36.566, lng: 139.884, population: 518594, prefectureId: 'tochigi' },
  { name: '前橋市', nameEn: 'Maebashi', lat: 36.389, lng: 139.061, population: 336154, prefectureId: 'gunma' },
  { name: '高崎市', nameEn: 'Takasaki', lat: 36.322, lng: 139.000, population: 370884, prefectureId: 'gunma' },
  { name: '水戸市', nameEn: 'Mito', lat: 36.342, lng: 140.447, population: 270685, prefectureId: 'ibaraki' },
  { name: 'つくば市', nameEn: 'Tsukuba', lat: 36.083, lng: 140.077, population: 252854, prefectureId: 'ibaraki' },
  // Chubu
  { name: '金沢市', nameEn: 'Kanazawa', lat: 36.561, lng: 136.656, population: 463254, prefectureId: 'ishikawa' },
  { name: '長野市', nameEn: 'Nagano', lat: 36.651, lng: 138.181, population: 372760, prefectureId: 'nagano' },
  { name: '松本市', nameEn: 'Matsumoto', lat: 36.238, lng: 137.972, population: 243293, prefectureId: 'nagano' },
  { name: '岐阜市', nameEn: 'Gifu', lat: 35.391, lng: 136.722, population: 402557, prefectureId: 'gifu' },
  { name: '富山市', nameEn: 'Toyama', lat: 36.695, lng: 137.211, population: 413938, prefectureId: 'toyama' },
  { name: '福井市', nameEn: 'Fukui', lat: 36.065, lng: 136.222, population: 262327, prefectureId: 'fukui' },
  { name: '甲府市', nameEn: 'Kofu', lat: 35.664, lng: 138.568, population: 188405, prefectureId: 'yamanashi' },
  { name: '豊橋市', nameEn: 'Toyohashi', lat: 34.769, lng: 137.392, population: 371920, prefectureId: 'aichi' },
  { name: '豊田市', nameEn: 'Toyota', lat: 35.083, lng: 137.156, population: 422542, prefectureId: 'aichi' },
  // Kansai
  { name: '東大阪市', nameEn: 'Higashi-Osaka', lat: 34.680, lng: 135.601, population: 496681, prefectureId: 'osaka' },
  { name: '豊中市', nameEn: 'Toyonaka', lat: 34.781, lng: 135.470, population: 401558, prefectureId: 'osaka' },
  { name: '吹田市', nameEn: 'Suita', lat: 34.766, lng: 135.517, population: 385827, prefectureId: 'osaka' },
  { name: '高槻市', nameEn: 'Takatsuki', lat: 34.846, lng: 135.617, population: 351829, prefectureId: 'osaka' },
  { name: '枚方市', nameEn: 'Hirakata', lat: 34.816, lng: 135.651, population: 396193, prefectureId: 'osaka' },
  { name: '姫路市', nameEn: 'Himeji', lat: 34.815, lng: 134.685, population: 530495, prefectureId: 'hyogo' },
  { name: '西宮市', nameEn: 'Nishinomiya', lat: 34.738, lng: 135.342, population: 487850, prefectureId: 'hyogo' },
  { name: '尼崎市', nameEn: 'Amagasaki', lat: 34.733, lng: 135.407, population: 452563, prefectureId: 'hyogo' },
  { name: '奈良市', nameEn: 'Nara', lat: 34.685, lng: 135.805, population: 354630, prefectureId: 'nara' },
  { name: '和歌山市', nameEn: 'Wakayama', lat: 34.226, lng: 135.168, population: 356729, prefectureId: 'wakayama' },
  { name: '大津市', nameEn: 'Otsu', lat: 35.005, lng: 135.869, population: 344547, prefectureId: 'shiga' },
  { name: '津市', nameEn: 'Tsu', lat: 34.730, lng: 136.509, population: 274943, prefectureId: 'mie' },
  { name: '四日市市', nameEn: 'Yokkaichi', lat: 34.965, lng: 136.624, population: 311031, prefectureId: 'mie' },
  // Tohoku
  { name: '秋田市', nameEn: 'Akita', lat: 39.720, lng: 140.103, population: 307672, prefectureId: 'akita' },
  { name: '郡山市', nameEn: 'Koriyama', lat: 37.400, lng: 140.360, population: 324272, prefectureId: 'fukushima' },
  { name: 'いわき市', nameEn: 'Iwaki', lat: 37.051, lng: 140.888, population: 332931, prefectureId: 'fukushima' },
  { name: '福島市', nameEn: 'Fukushima', lat: 37.750, lng: 140.468, population: 283348, prefectureId: 'fukushima' },
  { name: '盛岡市', nameEn: 'Morioka', lat: 39.704, lng: 141.153, population: 290700, prefectureId: 'iwate' },
  { name: '青森市', nameEn: 'Aomori', lat: 40.824, lng: 140.740, population: 275193, prefectureId: 'aomori' },
  { name: '山形市', nameEn: 'Yamagata', lat: 38.241, lng: 140.334, population: 248890, prefectureId: 'yamagata' },
  // Chugoku / Shikoku
  { name: '倉敷市', nameEn: 'Kurashiki', lat: 34.585, lng: 133.772, population: 474592, prefectureId: 'okayama' },
  { name: '福山市', nameEn: 'Fukuyama', lat: 34.486, lng: 133.363, population: 460780, prefectureId: 'hiroshima' },
  { name: '下関市', nameEn: 'Shimonoseki', lat: 33.958, lng: 130.942, population: 255051, prefectureId: 'yamaguchi' },
  { name: '松山市', nameEn: 'Matsuyama', lat: 33.839, lng: 132.766, population: 509312, prefectureId: 'ehime' },
  { name: '高松市', nameEn: 'Takamatsu', lat: 34.340, lng: 134.043, population: 420748, prefectureId: 'kagawa' },
  { name: '高知市', nameEn: 'Kochi', lat: 33.559, lng: 133.531, population: 326545, prefectureId: 'kochi' },
  { name: '徳島市', nameEn: 'Tokushima', lat: 34.066, lng: 134.559, population: 252391, prefectureId: 'tokushima' },
  { name: '鳥取市', nameEn: 'Tottori', lat: 35.501, lng: 134.235, population: 188465, prefectureId: 'tottori' },
  { name: '松江市', nameEn: 'Matsue', lat: 35.472, lng: 133.051, population: 203616, prefectureId: 'shimane' },
  // Kyushu / Okinawa
  { name: '鹿児島市', nameEn: 'Kagoshima', lat: 31.596, lng: 130.557, population: 593128, prefectureId: 'kagoshima' },
  { name: '大分市', nameEn: 'Oita', lat: 33.238, lng: 131.613, population: 478146, prefectureId: 'oita' },
  { name: '長崎市', nameEn: 'Nagasaki', lat: 32.750, lng: 129.878, population: 411421, prefectureId: 'nagasaki' },
  { name: '宮崎市', nameEn: 'Miyazaki', lat: 31.911, lng: 131.424, population: 401138, prefectureId: 'miyazaki' },
  { name: '佐賀市', nameEn: 'Saga', lat: 33.249, lng: 130.300, population: 233301, prefectureId: 'saga' },
  { name: '那覇市', nameEn: 'Naha', lat: 26.212, lng: 127.681, population: 317405, prefectureId: 'okinawa' },
  // Hokkaido (besides Sapporo)
  { name: '旭川市', nameEn: 'Asahikawa', lat: 43.771, lng: 142.365, population: 329306, prefectureId: 'hokkaido' },
  { name: '函館市', nameEn: 'Hakodate', lat: 41.769, lng: 140.729, population: 251084, prefectureId: 'hokkaido' },
  // Critical infrastructure cities (near nuclear plants, major faults)
  { name: '輪島市', nameEn: 'Wajima', lat: 37.391, lng: 136.899, population: 23556, prefectureId: 'ishikawa' },
  { name: '珠洲市', nameEn: 'Suzu', lat: 37.436, lng: 137.262, population: 13025, prefectureId: 'ishikawa' },
  { name: '柏崎市', nameEn: 'Kashiwazaki', lat: 37.372, lng: 138.560, population: 80447, prefectureId: 'niigata' },
  { name: '敦賀市', nameEn: 'Tsuruga', lat: 35.645, lng: 136.055, population: 64850, prefectureId: 'fukui' },
  { name: '薩摩川内市', nameEn: 'Satsumasendai', lat: 31.814, lng: 130.304, population: 92806, prefectureId: 'kagoshima' },
];

/** All municipalities in the catalog */
export const MUNICIPALITIES: Municipality[] = [
  ...TOKYO_WARDS,
  ...TOKYO_TAMA,
  ...DESIGNATED_CITIES,
  ...MAJOR_CITIES,
];

/** Total cataloged population */
export const CATALOGED_POPULATION = MUNICIPALITIES.reduce((sum, m) => sum + m.population, 0);

/** Japan total population (2020 census) */
export const JAPAN_TOTAL_POPULATION = 126_146_099;

/** Coverage ratio of cataloged vs total */
export const COVERAGE_RATIO = CATALOGED_POPULATION / JAPAN_TOTAL_POPULATION;
