/**
 * Japan Municipality Population Catalog — 2025 Estimates
 *
 * Base data: 総務省統計局「令和2年国勢調査 人口等基本集計」(2020 Census)
 * Adjustment: 総務省統計局「人口推計」(Monthly Population Estimates, 2025-01)
 *
 * Methodology:
 *   2025 estimate = 2020 census × prefecture-level change rate
 *   Prefecture change rates from 総務省「人口推計 令和7年1月報」
 *   National total: 123,400,000 (2025-01 estimate, -2.2% from 2020)
 *
 * The 2025 national census (令和7年国勢調査) is scheduled for October 2025.
 * These figures will be updated when results are published (~2026-11).
 *
 * Coordinates: city hall / ward office locations.
 */

export interface Municipality {
  name: string;
  nameEn: string;
  lat: number;
  lng: number;
  /** Estimated 2025 population */
  population: number;
  prefectureId: string;
}

/**
 * Prefecture-level population change rates 2020→2025.
 * Source: 総務省統計局「人口推計」令和7年(2025年)1月報
 * https://www.stat.go.jp/data/jinsui/new.html
 *
 * Positive = growth, negative = decline.
 */
const PREF_CHANGE_RATE: Record<string, number> = {
  hokkaido: -0.040,
  aomori: -0.058,
  iwate: -0.054,
  miyagi: -0.020,
  akita: -0.068,
  yamagata: -0.050,
  fukushima: -0.046,
  ibaraki: -0.024,
  tochigi: -0.026,
  gunma: -0.026,
  saitama: +0.003,
  chiba: +0.002,
  tokyo: +0.006,
  kanagawa: +0.002,
  niigata: -0.042,
  toyama: -0.038,
  ishikawa: -0.030,
  fukui: -0.040,
  yamanashi: -0.038,
  nagano: -0.036,
  gifu: -0.032,
  shizuoka: -0.030,
  aichi: +0.002,
  mie: -0.032,
  shiga: -0.006,
  kyoto: -0.018,
  osaka: -0.008,
  hyogo: -0.016,
  nara: -0.032,
  wakayama: -0.048,
  tottori: -0.044,
  shimane: -0.048,
  okayama: -0.020,
  hiroshima: -0.020,
  yamaguchi: -0.042,
  tokushima: -0.048,
  kagawa: -0.030,
  ehime: -0.040,
  kochi: -0.050,
  fukuoka: -0.002,
  saga: -0.032,
  nagasaki: -0.046,
  kumamoto: -0.024,
  oita: -0.030,
  miyazaki: -0.038,
  kagoshima: -0.034,
  okinawa: +0.004,
};

/** Apply prefecture-level adjustment to 2020 census figure */
function est2025(census2020: number, prefId: string): number {
  const rate = PREF_CHANGE_RATE[prefId] ?? -0.022;
  return Math.round(census2020 * (1 + rate));
}

// ── Tokyo 23 Special Wards (東京都特別区) ─────────────────────

const TOKYO_WARDS: Municipality[] = [
  { name: '世田谷区', nameEn: 'Setagaya', lat: 35.646, lng: 139.653, population: est2025(943664, 'tokyo'), prefectureId: 'tokyo' },
  { name: '練馬区', nameEn: 'Nerima', lat: 35.735, lng: 139.652, population: est2025(752608, 'tokyo'), prefectureId: 'tokyo' },
  { name: '大田区', nameEn: 'Ota', lat: 35.561, lng: 139.716, population: est2025(748081, 'tokyo'), prefectureId: 'tokyo' },
  { name: '江戸川区', nameEn: 'Edogawa', lat: 35.707, lng: 139.868, population: est2025(697932, 'tokyo'), prefectureId: 'tokyo' },
  { name: '足立区', nameEn: 'Adachi', lat: 35.775, lng: 139.804, population: est2025(695043, 'tokyo'), prefectureId: 'tokyo' },
  { name: '杉並区', nameEn: 'Suginami', lat: 35.699, lng: 139.637, population: est2025(591108, 'tokyo'), prefectureId: 'tokyo' },
  { name: '板橋区', nameEn: 'Itabashi', lat: 35.751, lng: 139.709, population: est2025(584483, 'tokyo'), prefectureId: 'tokyo' },
  { name: '江東区', nameEn: 'Koto', lat: 35.673, lng: 139.817, population: est2025(524310, 'tokyo'), prefectureId: 'tokyo' },
  { name: '葛飾区', nameEn: 'Katsushika', lat: 35.743, lng: 139.847, population: est2025(453093, 'tokyo'), prefectureId: 'tokyo' },
  { name: '品川区', nameEn: 'Shinagawa', lat: 35.609, lng: 139.730, population: est2025(422488, 'tokyo'), prefectureId: 'tokyo' },
  { name: '北区', nameEn: 'Kita', lat: 35.753, lng: 139.737, population: est2025(355213, 'tokyo'), prefectureId: 'tokyo' },
  { name: '新宿区', nameEn: 'Shinjuku', lat: 35.694, lng: 139.703, population: est2025(349385, 'tokyo'), prefectureId: 'tokyo' },
  { name: '中野区', nameEn: 'Nakano', lat: 35.707, lng: 139.664, population: est2025(344880, 'tokyo'), prefectureId: 'tokyo' },
  { name: '豊島区', nameEn: 'Toshima', lat: 35.726, lng: 139.715, population: est2025(301599, 'tokyo'), prefectureId: 'tokyo' },
  { name: '目黒区', nameEn: 'Meguro', lat: 35.634, lng: 139.698, population: est2025(288088, 'tokyo'), prefectureId: 'tokyo' },
  { name: '墨田区', nameEn: 'Sumida', lat: 35.710, lng: 139.801, population: est2025(272085, 'tokyo'), prefectureId: 'tokyo' },
  { name: '港区', nameEn: 'Minato', lat: 35.658, lng: 139.751, population: est2025(260486, 'tokyo'), prefectureId: 'tokyo' },
  { name: '渋谷区', nameEn: 'Shibuya', lat: 35.662, lng: 139.704, population: est2025(243883, 'tokyo'), prefectureId: 'tokyo' },
  { name: '文京区', nameEn: 'Bunkyo', lat: 35.708, lng: 139.752, population: est2025(240069, 'tokyo'), prefectureId: 'tokyo' },
  { name: '荒川区', nameEn: 'Arakawa', lat: 35.736, lng: 139.783, population: est2025(217475, 'tokyo'), prefectureId: 'tokyo' },
  { name: '台東区', nameEn: 'Taito', lat: 35.712, lng: 139.780, population: est2025(211444, 'tokyo'), prefectureId: 'tokyo' },
  { name: '中央区', nameEn: 'Chuo', lat: 35.670, lng: 139.772, population: est2025(169179, 'tokyo'), prefectureId: 'tokyo' },
  { name: '千代田区', nameEn: 'Chiyoda', lat: 35.694, lng: 139.754, population: est2025(67049, 'tokyo'), prefectureId: 'tokyo' },
];

// ── Tokyo Tama Region (東京都多摩地域) ─────────────────────────

const TOKYO_TAMA: Municipality[] = [
  { name: '八王子市', nameEn: 'Hachioji', lat: 35.656, lng: 139.324, population: est2025(579330, 'tokyo'), prefectureId: 'tokyo' },
  { name: '町田市', nameEn: 'Machida', lat: 35.549, lng: 139.447, population: est2025(432348, 'tokyo'), prefectureId: 'tokyo' },
  { name: '府中市', nameEn: 'Fuchu', lat: 35.669, lng: 139.478, population: est2025(262790, 'tokyo'), prefectureId: 'tokyo' },
  { name: '調布市', nameEn: 'Chofu', lat: 35.652, lng: 139.541, population: est2025(243072, 'tokyo'), prefectureId: 'tokyo' },
  { name: '西東京市', nameEn: 'Nishi-Tokyo', lat: 35.726, lng: 139.539, population: est2025(207388, 'tokyo'), prefectureId: 'tokyo' },
];

// ── Designated Cities (政令指定都市) ──────────────────────────

const DESIGNATED_CITIES: Municipality[] = [
  { name: '横浜市', nameEn: 'Yokohama', lat: 35.444, lng: 139.638, population: est2025(3777491, 'kanagawa'), prefectureId: 'kanagawa' },
  { name: '大阪市', nameEn: 'Osaka', lat: 34.694, lng: 135.502, population: est2025(2752412, 'osaka'), prefectureId: 'osaka' },
  { name: '名古屋市', nameEn: 'Nagoya', lat: 35.181, lng: 136.906, population: est2025(2320361, 'aichi'), prefectureId: 'aichi' },
  { name: '札幌市', nameEn: 'Sapporo', lat: 43.062, lng: 141.354, population: est2025(1975066, 'hokkaido'), prefectureId: 'hokkaido' },
  { name: '福岡市', nameEn: 'Fukuoka', lat: 33.590, lng: 130.402, population: est2025(1612392, 'fukuoka'), prefectureId: 'fukuoka' },
  { name: '川崎市', nameEn: 'Kawasaki', lat: 35.531, lng: 139.703, population: est2025(1538262, 'kanagawa'), prefectureId: 'kanagawa' },
  { name: '神戸市', nameEn: 'Kobe', lat: 34.690, lng: 135.196, population: est2025(1525152, 'hyogo'), prefectureId: 'hyogo' },
  { name: '京都市', nameEn: 'Kyoto', lat: 35.012, lng: 135.768, population: est2025(1463723, 'kyoto'), prefectureId: 'kyoto' },
  { name: 'さいたま市', nameEn: 'Saitama', lat: 35.861, lng: 139.646, population: est2025(1324025, 'saitama'), prefectureId: 'saitama' },
  { name: '広島市', nameEn: 'Hiroshima', lat: 34.386, lng: 132.455, population: est2025(1200754, 'hiroshima'), prefectureId: 'hiroshima' },
  { name: '仙台市', nameEn: 'Sendai', lat: 38.268, lng: 140.872, population: est2025(1096704, 'miyagi'), prefectureId: 'miyagi' },
  { name: '千葉市', nameEn: 'Chiba', lat: 35.607, lng: 140.106, population: est2025(974951, 'chiba'), prefectureId: 'chiba' },
  { name: '北九州市', nameEn: 'Kitakyushu', lat: 33.883, lng: 130.883, population: est2025(939029, 'fukuoka'), prefectureId: 'fukuoka' },
  { name: '堺市', nameEn: 'Sakai', lat: 34.573, lng: 135.483, population: est2025(826161, 'osaka'), prefectureId: 'osaka' },
  { name: '新潟市', nameEn: 'Niigata', lat: 37.902, lng: 139.023, population: est2025(789275, 'niigata'), prefectureId: 'niigata' },
  { name: '浜松市', nameEn: 'Hamamatsu', lat: 34.711, lng: 137.726, population: est2025(790718, 'shizuoka'), prefectureId: 'shizuoka' },
  { name: '熊本市', nameEn: 'Kumamoto', lat: 32.803, lng: 130.708, population: est2025(738865, 'kumamoto'), prefectureId: 'kumamoto' },
  { name: '相模原市', nameEn: 'Sagamihara', lat: 35.571, lng: 139.373, population: est2025(725493, 'kanagawa'), prefectureId: 'kanagawa' },
  { name: '岡山市', nameEn: 'Okayama', lat: 34.662, lng: 133.935, population: est2025(724691, 'okayama'), prefectureId: 'okayama' },
  { name: '静岡市', nameEn: 'Shizuoka', lat: 34.976, lng: 138.383, population: est2025(693389, 'shizuoka'), prefectureId: 'shizuoka' },
];

// ── Core Cities (中核市) and Other Major Cities ──────────────

const MAJOR_CITIES: Municipality[] = [
  // Kanto
  { name: '船橋市', nameEn: 'Funabashi', lat: 35.695, lng: 139.983, population: est2025(642907, 'chiba'), prefectureId: 'chiba' },
  { name: '川口市', nameEn: 'Kawaguchi', lat: 35.808, lng: 139.724, population: est2025(594274, 'saitama'), prefectureId: 'saitama' },
  { name: '松戸市', nameEn: 'Matsudo', lat: 35.787, lng: 139.903, population: est2025(498232, 'chiba'), prefectureId: 'chiba' },
  { name: '市川市', nameEn: 'Ichikawa', lat: 35.732, lng: 139.931, population: est2025(496676, 'chiba'), prefectureId: 'chiba' },
  { name: '柏市', nameEn: 'Kashiwa', lat: 35.868, lng: 139.972, population: est2025(426468, 'chiba'), prefectureId: 'chiba' },
  { name: '川越市', nameEn: 'Kawagoe', lat: 35.925, lng: 139.486, population: est2025(354571, 'saitama'), prefectureId: 'saitama' },
  { name: '所沢市', nameEn: 'Tokorozawa', lat: 35.799, lng: 139.469, population: est2025(341924, 'saitama'), prefectureId: 'saitama' },
  { name: '越谷市', nameEn: 'Koshigaya', lat: 35.891, lng: 139.790, population: est2025(341621, 'saitama'), prefectureId: 'saitama' },
  { name: '横須賀市', nameEn: 'Yokosuka', lat: 35.281, lng: 139.672, population: est2025(388078, 'kanagawa'), prefectureId: 'kanagawa' },
  { name: '藤沢市', nameEn: 'Fujisawa', lat: 35.339, lng: 139.490, population: est2025(436905, 'kanagawa'), prefectureId: 'kanagawa' },
  { name: '宇都宮市', nameEn: 'Utsunomiya', lat: 36.566, lng: 139.884, population: est2025(518594, 'tochigi'), prefectureId: 'tochigi' },
  { name: '前橋市', nameEn: 'Maebashi', lat: 36.389, lng: 139.061, population: est2025(336154, 'gunma'), prefectureId: 'gunma' },
  { name: '高崎市', nameEn: 'Takasaki', lat: 36.322, lng: 139.000, population: est2025(370884, 'gunma'), prefectureId: 'gunma' },
  { name: '水戸市', nameEn: 'Mito', lat: 36.342, lng: 140.447, population: est2025(270685, 'ibaraki'), prefectureId: 'ibaraki' },
  { name: 'つくば市', nameEn: 'Tsukuba', lat: 36.083, lng: 140.077, population: est2025(252854, 'ibaraki'), prefectureId: 'ibaraki' },
  // Chubu
  { name: '金沢市', nameEn: 'Kanazawa', lat: 36.561, lng: 136.656, population: est2025(463254, 'ishikawa'), prefectureId: 'ishikawa' },
  { name: '長野市', nameEn: 'Nagano', lat: 36.651, lng: 138.181, population: est2025(372760, 'nagano'), prefectureId: 'nagano' },
  { name: '松本市', nameEn: 'Matsumoto', lat: 36.238, lng: 137.972, population: est2025(243293, 'nagano'), prefectureId: 'nagano' },
  { name: '岐阜市', nameEn: 'Gifu', lat: 35.391, lng: 136.722, population: est2025(402557, 'gifu'), prefectureId: 'gifu' },
  { name: '富山市', nameEn: 'Toyama', lat: 36.695, lng: 137.211, population: est2025(413938, 'toyama'), prefectureId: 'toyama' },
  { name: '福井市', nameEn: 'Fukui', lat: 36.065, lng: 136.222, population: est2025(262327, 'fukui'), prefectureId: 'fukui' },
  { name: '甲府市', nameEn: 'Kofu', lat: 35.664, lng: 138.568, population: est2025(188405, 'yamanashi'), prefectureId: 'yamanashi' },
  { name: '豊橋市', nameEn: 'Toyohashi', lat: 34.769, lng: 137.392, population: est2025(371920, 'aichi'), prefectureId: 'aichi' },
  { name: '豊田市', nameEn: 'Toyota', lat: 35.083, lng: 137.156, population: est2025(422542, 'aichi'), prefectureId: 'aichi' },
  // Kansai
  { name: '東大阪市', nameEn: 'Higashi-Osaka', lat: 34.680, lng: 135.601, population: est2025(496681, 'osaka'), prefectureId: 'osaka' },
  { name: '豊中市', nameEn: 'Toyonaka', lat: 34.781, lng: 135.470, population: est2025(401558, 'osaka'), prefectureId: 'osaka' },
  { name: '吹田市', nameEn: 'Suita', lat: 34.766, lng: 135.517, population: est2025(385827, 'osaka'), prefectureId: 'osaka' },
  { name: '高槻市', nameEn: 'Takatsuki', lat: 34.846, lng: 135.617, population: est2025(351829, 'osaka'), prefectureId: 'osaka' },
  { name: '枚方市', nameEn: 'Hirakata', lat: 34.816, lng: 135.651, population: est2025(396193, 'osaka'), prefectureId: 'osaka' },
  { name: '姫路市', nameEn: 'Himeji', lat: 34.815, lng: 134.685, population: est2025(530495, 'hyogo'), prefectureId: 'hyogo' },
  { name: '西宮市', nameEn: 'Nishinomiya', lat: 34.738, lng: 135.342, population: est2025(487850, 'hyogo'), prefectureId: 'hyogo' },
  { name: '尼崎市', nameEn: 'Amagasaki', lat: 34.733, lng: 135.407, population: est2025(452563, 'hyogo'), prefectureId: 'hyogo' },
  { name: '奈良市', nameEn: 'Nara', lat: 34.685, lng: 135.805, population: est2025(354630, 'nara'), prefectureId: 'nara' },
  { name: '和歌山市', nameEn: 'Wakayama', lat: 34.226, lng: 135.168, population: est2025(356729, 'wakayama'), prefectureId: 'wakayama' },
  { name: '大津市', nameEn: 'Otsu', lat: 35.005, lng: 135.869, population: est2025(344547, 'shiga'), prefectureId: 'shiga' },
  { name: '津市', nameEn: 'Tsu', lat: 34.730, lng: 136.509, population: est2025(274943, 'mie'), prefectureId: 'mie' },
  { name: '四日市市', nameEn: 'Yokkaichi', lat: 34.965, lng: 136.624, population: est2025(311031, 'mie'), prefectureId: 'mie' },
  // Tohoku
  { name: '秋田市', nameEn: 'Akita', lat: 39.720, lng: 140.103, population: est2025(307672, 'akita'), prefectureId: 'akita' },
  { name: '郡山市', nameEn: 'Koriyama', lat: 37.400, lng: 140.360, population: est2025(324272, 'fukushima'), prefectureId: 'fukushima' },
  { name: 'いわき市', nameEn: 'Iwaki', lat: 37.051, lng: 140.888, population: est2025(332931, 'fukushima'), prefectureId: 'fukushima' },
  { name: '福島市', nameEn: 'Fukushima', lat: 37.750, lng: 140.468, population: est2025(283348, 'fukushima'), prefectureId: 'fukushima' },
  { name: '盛岡市', nameEn: 'Morioka', lat: 39.704, lng: 141.153, population: est2025(290700, 'iwate'), prefectureId: 'iwate' },
  { name: '青森市', nameEn: 'Aomori', lat: 40.824, lng: 140.740, population: est2025(275193, 'aomori'), prefectureId: 'aomori' },
  { name: '山形市', nameEn: 'Yamagata', lat: 38.241, lng: 140.334, population: est2025(248890, 'yamagata'), prefectureId: 'yamagata' },
  // Chugoku / Shikoku
  { name: '倉敷市', nameEn: 'Kurashiki', lat: 34.585, lng: 133.772, population: est2025(474592, 'okayama'), prefectureId: 'okayama' },
  { name: '福山市', nameEn: 'Fukuyama', lat: 34.486, lng: 133.363, population: est2025(460780, 'hiroshima'), prefectureId: 'hiroshima' },
  { name: '下関市', nameEn: 'Shimonoseki', lat: 33.958, lng: 130.942, population: est2025(255051, 'yamaguchi'), prefectureId: 'yamaguchi' },
  { name: '松山市', nameEn: 'Matsuyama', lat: 33.839, lng: 132.766, population: est2025(509312, 'ehime'), prefectureId: 'ehime' },
  { name: '高松市', nameEn: 'Takamatsu', lat: 34.340, lng: 134.043, population: est2025(420748, 'kagawa'), prefectureId: 'kagawa' },
  { name: '高知市', nameEn: 'Kochi', lat: 33.559, lng: 133.531, population: est2025(326545, 'kochi'), prefectureId: 'kochi' },
  { name: '徳島市', nameEn: 'Tokushima', lat: 34.066, lng: 134.559, population: est2025(252391, 'tokushima'), prefectureId: 'tokushima' },
  { name: '鳥取市', nameEn: 'Tottori', lat: 35.501, lng: 134.235, population: est2025(188465, 'tottori'), prefectureId: 'tottori' },
  { name: '松江市', nameEn: 'Matsue', lat: 35.472, lng: 133.051, population: est2025(203616, 'shimane'), prefectureId: 'shimane' },
  // Kyushu / Okinawa
  { name: '鹿児島市', nameEn: 'Kagoshima', lat: 31.596, lng: 130.557, population: est2025(593128, 'kagoshima'), prefectureId: 'kagoshima' },
  { name: '大分市', nameEn: 'Oita', lat: 33.238, lng: 131.613, population: est2025(478146, 'oita'), prefectureId: 'oita' },
  { name: '長崎市', nameEn: 'Nagasaki', lat: 32.750, lng: 129.878, population: est2025(411421, 'nagasaki'), prefectureId: 'nagasaki' },
  { name: '宮崎市', nameEn: 'Miyazaki', lat: 31.911, lng: 131.424, population: est2025(401138, 'miyazaki'), prefectureId: 'miyazaki' },
  { name: '佐賀市', nameEn: 'Saga', lat: 33.249, lng: 130.300, population: est2025(233301, 'saga'), prefectureId: 'saga' },
  { name: '那覇市', nameEn: 'Naha', lat: 26.212, lng: 127.681, population: est2025(317405, 'okinawa'), prefectureId: 'okinawa' },
  // Hokkaido (besides Sapporo)
  { name: '旭川市', nameEn: 'Asahikawa', lat: 43.771, lng: 142.365, population: est2025(329306, 'hokkaido'), prefectureId: 'hokkaido' },
  { name: '函館市', nameEn: 'Hakodate', lat: 41.769, lng: 140.729, population: est2025(251084, 'hokkaido'), prefectureId: 'hokkaido' },
  // Critical infrastructure cities (near nuclear plants, major faults)
  { name: '輪島市', nameEn: 'Wajima', lat: 37.391, lng: 136.899, population: est2025(23556, 'ishikawa'), prefectureId: 'ishikawa' },
  { name: '珠洲市', nameEn: 'Suzu', lat: 37.436, lng: 137.262, population: est2025(13025, 'ishikawa'), prefectureId: 'ishikawa' },
  { name: '柏崎市', nameEn: 'Kashiwazaki', lat: 37.372, lng: 138.560, population: est2025(80447, 'niigata'), prefectureId: 'niigata' },
  { name: '敦賀市', nameEn: 'Tsuruga', lat: 35.645, lng: 136.055, population: est2025(64850, 'fukui'), prefectureId: 'fukui' },
  { name: '薩摩川内市', nameEn: 'Satsumasendai', lat: 31.814, lng: 130.304, population: est2025(92806, 'kagoshima'), prefectureId: 'kagoshima' },
];

/** All municipalities in the catalog */
export const MUNICIPALITIES: Municipality[] = [
  ...TOKYO_WARDS,
  ...TOKYO_TAMA,
  ...DESIGNATED_CITIES,
  ...MAJOR_CITIES,
];

/** Total cataloged population (2025 estimate) */
export const CATALOGED_POPULATION = MUNICIPALITIES.reduce((sum, m) => sum + m.population, 0);

/** Japan total population (2025-01 estimate, 総務省人口推計) */
export const JAPAN_TOTAL_POPULATION = 123_400_000;

/** Coverage ratio of cataloged vs total */
export const COVERAGE_RATIO = CATALOGED_POPULATION / JAPAN_TOTAL_POPULATION;
