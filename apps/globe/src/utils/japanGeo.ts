/**
 * japanGeo.ts — Static Japan reverse geocoder
 *
 * Converts lat/lng to a natural place name in ja/en/ko.
 * Uses a table of prefecture centers + offshore seismic regions.
 * Handles disputed territory naming per locale.
 * No external API calls — fully client-side.
 */

interface GeoEntry {
  lat: number;
  lng: number;
  ja: string;        // Japanese name
  en: string;        // English name
  ko: string;        // Korean name
  offshore?: boolean; // true = sea region
}

// Prefecture centers + major offshore seismic zones
const GEO_TABLE: GeoEntry[] = [
  // ── Prefectures (north to south) ──
  { lat: 43.06, lng: 141.35, ja: '北海道', en: 'Hokkaido', ko: '홋카이도' },
  { lat: 40.82, lng: 140.74, ja: '青森県', en: 'Aomori', ko: '아오모리' },
  { lat: 39.70, lng: 141.15, ja: '岩手県', en: 'Iwate', ko: '이와테' },
  { lat: 38.27, lng: 140.87, ja: '宮城県', en: 'Miyagi', ko: '미야기' },
  { lat: 39.72, lng: 140.10, ja: '秋田県', en: 'Akita', ko: '아키타' },
  { lat: 38.24, lng: 140.34, ja: '山形県', en: 'Yamagata', ko: '야마가타' },
  { lat: 37.75, lng: 140.47, ja: '福島県', en: 'Fukushima', ko: '후쿠시마' },
  { lat: 36.34, lng: 140.45, ja: '茨城県', en: 'Ibaraki', ko: '이바라키' },
  { lat: 36.57, lng: 139.88, ja: '栃木県', en: 'Tochigi', ko: '도치기' },
  { lat: 36.39, lng: 139.06, ja: '群馬県', en: 'Gunma', ko: '군마' },
  { lat: 35.86, lng: 139.65, ja: '埼玉県', en: 'Saitama', ko: '사이타마' },
  { lat: 35.61, lng: 140.12, ja: '千葉県', en: 'Chiba', ko: '치바' },
  { lat: 35.69, lng: 139.69, ja: '東京都', en: 'Tokyo', ko: '도쿄' },
  { lat: 35.45, lng: 139.64, ja: '神奈川県', en: 'Kanagawa', ko: '가나가와' },
  { lat: 37.90, lng: 139.02, ja: '新潟県', en: 'Niigata', ko: '니가타' },
  { lat: 36.70, lng: 137.21, ja: '富山県', en: 'Toyama', ko: '도야마' },
  { lat: 36.59, lng: 136.63, ja: '石川県', en: 'Ishikawa', ko: '이시카와' },
  { lat: 36.07, lng: 136.22, ja: '福井県', en: 'Fukui', ko: '후쿠이' },
  { lat: 35.66, lng: 138.57, ja: '山梨県', en: 'Yamanashi', ko: '야마나시' },
  { lat: 36.65, lng: 138.18, ja: '長野県', en: 'Nagano', ko: '나가노' },
  { lat: 35.39, lng: 136.72, ja: '岐阜県', en: 'Gifu', ko: '기후' },
  { lat: 34.98, lng: 138.38, ja: '静岡県', en: 'Shizuoka', ko: '시즈오카' },
  { lat: 35.18, lng: 136.91, ja: '愛知県', en: 'Aichi', ko: '아이치' },
  { lat: 34.73, lng: 136.51, ja: '三重県', en: 'Mie', ko: '미에' },
  { lat: 35.00, lng: 135.87, ja: '滋賀県', en: 'Shiga', ko: '시가' },
  { lat: 35.02, lng: 135.77, ja: '京都府', en: 'Kyoto', ko: '교토' },
  { lat: 34.69, lng: 135.50, ja: '大阪府', en: 'Osaka', ko: '오사카' },
  { lat: 34.69, lng: 135.18, ja: '兵庫県', en: 'Hyogo', ko: '효고' },
  { lat: 34.69, lng: 135.83, ja: '奈良県', en: 'Nara', ko: '나라' },
  { lat: 34.23, lng: 135.17, ja: '和歌山県', en: 'Wakayama', ko: '와카야마' },
  { lat: 35.50, lng: 134.24, ja: '鳥取県', en: 'Tottori', ko: '돗토리' },
  { lat: 35.47, lng: 133.05, ja: '島根県', en: 'Shimane', ko: '시마네' },
  { lat: 34.66, lng: 133.93, ja: '岡山県', en: 'Okayama', ko: '오카야마' },
  { lat: 34.40, lng: 132.46, ja: '広島県', en: 'Hiroshima', ko: '히로시마' },
  { lat: 34.19, lng: 131.47, ja: '山口県', en: 'Yamaguchi', ko: '야마구치' },
  { lat: 34.07, lng: 134.56, ja: '徳島県', en: 'Tokushima', ko: '도쿠시마' },
  { lat: 34.34, lng: 134.04, ja: '香川県', en: 'Kagawa', ko: '가가와' },
  { lat: 33.84, lng: 132.77, ja: '愛媛県', en: 'Ehime', ko: '에히메' },
  { lat: 33.56, lng: 133.53, ja: '高知県', en: 'Kochi', ko: '고치' },
  { lat: 33.59, lng: 130.42, ja: '福岡県', en: 'Fukuoka', ko: '후쿠오카' },
  { lat: 33.25, lng: 130.30, ja: '佐賀県', en: 'Saga', ko: '사가' },
  { lat: 32.75, lng: 129.87, ja: '長崎県', en: 'Nagasaki', ko: '나가사키' },
  { lat: 32.79, lng: 130.74, ja: '熊本県', en: 'Kumamoto', ko: '구마모토' },
  { lat: 33.24, lng: 131.61, ja: '大分県', en: 'Oita', ko: '오이타' },
  { lat: 31.91, lng: 131.42, ja: '宮崎県', en: 'Miyazaki', ko: '미야자키' },
  { lat: 31.56, lng: 130.56, ja: '鹿児島県', en: 'Kagoshima', ko: '가고시마' },
  { lat: 26.34, lng: 127.80, ja: '沖縄県', en: 'Okinawa', ko: '오키나와' },

  // ── Offshore seismic regions ──
  { lat: 40.0, lng: 143.5, ja: '三陸沖', en: 'Off Sanriku', ko: '산리쿠 앞바다', offshore: true },
  { lat: 37.5, lng: 143.0, ja: '福島県沖', en: 'Off Fukushima', ko: '후쿠시마 앞바다', offshore: true },
  { lat: 36.0, lng: 142.0, ja: '茨城県沖', en: 'Off Ibaraki', ko: '이바라키 앞바다', offshore: true },
  { lat: 34.5, lng: 142.0, ja: '千葉県東方沖', en: 'Off east Chiba', ko: '치바 동쪽 앞바다', offshore: true },
  { lat: 33.0, lng: 137.0, ja: '南海トラフ', en: 'Nankai Trough', ko: '난카이 해구', offshore: true },
  { lat: 34.0, lng: 139.0, ja: '伊豆諸島', en: 'Izu Islands', ko: '이즈 제도', offshore: true },
  { lat: 30.0, lng: 140.0, ja: '小笠原諸島', en: 'Ogasawara', ko: '오가사와라 제도', offshore: true },
  { lat: 29.5, lng: 129.5, ja: '奄美大島近海', en: 'Near Amami', ko: '아마미오시마 근해', offshore: true },
  { lat: 27.0, lng: 128.5, ja: '沖縄本島近海', en: 'Near Okinawa', ko: '오키나와 본섬 근해', offshore: true },
  { lat: 24.5, lng: 124.0, ja: '宮古島近海', en: 'Near Miyako', ko: '미야코지마 근해', offshore: true },
  { lat: 24.0, lng: 123.0, ja: '石垣島近海', en: 'Near Ishigaki', ko: '이시가키지마 근해', offshore: true },
  { lat: 42.5, lng: 145.0, ja: '根室半島南東沖', en: 'Off SE Nemuro', ko: '네무로 반도 남동쪽 앞바다', offshore: true },
  { lat: 43.5, lng: 146.5, ja: '択捉島南東沖', en: 'Off Etorofu', ko: '에토로후섬 남동쪽 앞바다', offshore: true },
  { lat: 35.0, lng: 136.0, ja: '紀伊水道', en: 'Kii Channel', ko: '기이 수도', offshore: true },
  { lat: 33.5, lng: 132.0, ja: '豊後水道', en: 'Bungo Channel', ko: '분고 수도', offshore: true },

  // ── Disputed / sensitive naming regions ──
  { lat: 38.5, lng: 134.0, ja: '日本海中部', en: 'Central Sea of Japan', ko: '동해 중부', offshore: true },
  { lat: 37.24, lng: 131.87, ja: '竹島近海', en: 'Near Liancourt Rocks', ko: '독도 근해', offshore: true },
  { lat: 25.8, lng: 123.5, ja: '尖閣諸島近海', en: 'Near Senkaku Islands', ko: '센카쿠 제도 근해', offshore: true },
];

// ── Compass directions per locale ──

const DIRS_JA = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
const DIRS_EN = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const DIRS_KO = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];

/**
 * Haversine distance in km between two lat/lng points.
 */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Compute compass direction index (0-7) from reference point to target.
 */
function compassIdx(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const dLat = toLat - fromLat;
  const dLng = toLng - fromLng;
  const angle = Math.atan2(dLng, dLat) * 180 / Math.PI;
  const a = ((angle % 360) + 360) % 360;
  return Math.round(a / 45) % 8;
}

export interface JapanPlaceName {
  ja: string;   // Japanese display name
  en: string;   // English name
  ko: string;   // Korean name
}

/**
 * Get a locale-aware place name for the given coordinates.
 *
 * Returns null if coordinates are >500km from any Japan reference point.
 */
export function getJapanPlaceName(lat: number, lng: number): JapanPlaceName | null {
  let nearest: GeoEntry | null = null;
  let nearestDist = Infinity;

  for (const entry of GEO_TABLE) {
    const d = distanceKm(lat, lng, entry.lat, entry.lng);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = entry;
    }
  }

  if (!nearest) return null;
  if (nearestDist > 500) return null;

  // Offshore region match — use directly if within reasonable range
  if (nearest.offshore && nearestDist < 200) {
    return { ja: nearest.ja, en: nearest.en, ko: nearest.ko };
  }

  // Very close to a land prefecture — "XX付近"
  if (!nearest.offshore && nearestDist < 30) {
    return {
      ja: `${nearest.ja}付近`,
      en: `Near ${nearest.en}`,
      ko: `${nearest.ko} 부근`,
    };
  }

  // Find nearest land prefecture for direction-based name
  let nearestLand: GeoEntry | null = null;
  let nearestLandDist = Infinity;
  for (const entry of GEO_TABLE) {
    if (entry.offshore) continue;
    const d = distanceKm(lat, lng, entry.lat, entry.lng);
    if (d < nearestLandDist) {
      nearestLandDist = d;
      nearestLand = entry;
    }
  }

  if (!nearestLand) {
    return { ja: nearest.ja, en: nearest.en, ko: nearest.ko };
  }

  // Offshore from land prefecture — "XX県沖"
  if (nearestLandDist > 80) {
    return {
      ja: `${nearestLand.ja}沖`,
      en: `Off ${nearestLand.en}`,
      ko: `${nearestLand.ko} 앞바다`,
    };
  }

  // Moderate distance — "XX県 南東35km"
  const idx = compassIdx(nearestLand.lat, nearestLand.lng, lat, lng);
  const km = Math.round(nearestLandDist);
  return {
    ja: `${nearestLand.ja} ${DIRS_JA[idx]}${km}km`,
    en: `${km}km ${DIRS_EN[idx]} of ${nearestLand.en}`,
    ko: `${nearestLand.ko} ${DIRS_KO[idx]} ${km}km`,
  };
}
