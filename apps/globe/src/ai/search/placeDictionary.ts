/**
 * Place Dictionary — Maps place names (ko/ja/en) to coordinates
 *
 * ~100 entries covering major Japanese cities, prefectures, and regions.
 * Used by the search combiner to resolve place tokens to lat/lng for spatial queries.
 */

export interface PlaceEntry {
  lat: number;
  lng: number;
  radius_km: number;
  region: string;
  names: string[];    // All aliases: kanji, hiragana, romaji, Korean
}

export const PLACE_DICTIONARY: PlaceEntry[] = [
  // ── Regions (large radius) ──
  { lat: 38.0, lng: 140.0, radius_km: 400, region: 'tohoku', names: ['東北', 'とうほく', 'tohoku', '도호쿠'] },
  { lat: 35.5, lng: 139.5, radius_km: 200, region: 'kanto', names: ['関東', 'かんとう', 'kanto', '간토'] },
  { lat: 36.5, lng: 138.0, radius_km: 200, region: 'chubu', names: ['中部', 'ちゅうぶ', 'chubu', '주부'] },
  { lat: 35.0, lng: 136.0, radius_km: 200, region: 'kinki', names: ['近畿', 'きんき', 'kinki', 'kansai', '간사이', '긴키', '関西'] },
  { lat: 34.5, lng: 133.0, radius_km: 200, region: 'chugoku', names: ['中国', 'ちゅうごく', 'chugoku', '주고쿠'] },
  { lat: 33.8, lng: 133.5, radius_km: 150, region: 'shikoku', names: ['四国', 'しこく', 'shikoku', '시코쿠'] },
  { lat: 33.0, lng: 131.0, radius_km: 300, region: 'kyushu', names: ['九州', 'きゅうしゅう', 'kyushu', '규슈'] },
  { lat: 43.0, lng: 143.0, radius_km: 350, region: 'hokkaido', names: ['北海道', 'ほっかいどう', 'hokkaido', '홋카이도'] },
  { lat: 26.3, lng: 127.8, radius_km: 200, region: 'okinawa', names: ['沖縄', 'おきなわ', 'okinawa', '오키나와'] },

  // ── Prefectures + Major Cities ──
  { lat: 35.69, lng: 139.69, radius_km: 50, region: 'kanto', names: ['東京', 'とうきょう', 'tokyo', '도쿄'] },
  { lat: 34.69, lng: 135.50, radius_km: 50, region: 'kinki', names: ['大阪', 'おおさか', 'osaka', '오사카'] },
  { lat: 35.18, lng: 136.91, radius_km: 50, region: 'chubu', names: ['名古屋', 'なごや', 'nagoya', '나고야', '愛知', 'あいち', 'aichi', '아이치'] },
  { lat: 35.01, lng: 135.77, radius_km: 40, region: 'kinki', names: ['京都', 'きょうと', 'kyoto', '교토'] },
  { lat: 34.69, lng: 135.18, radius_km: 40, region: 'kinki', names: ['神戸', 'こうべ', 'kobe', '고베', '兵庫', 'ひょうご', 'hyogo', '효고'] },
  { lat: 33.59, lng: 130.40, radius_km: 50, region: 'kyushu', names: ['福岡', 'ふくおか', 'fukuoka', '후쿠오카'] },
  { lat: 43.06, lng: 141.35, radius_km: 60, region: 'hokkaido', names: ['札幌', 'さっぽろ', 'sapporo', '삿포로'] },
  { lat: 38.27, lng: 140.87, radius_km: 50, region: 'tohoku', names: ['仙台', 'せんだい', 'sendai', '센다이', '宮城', 'みやぎ', 'miyagi', '미야기'] },
  { lat: 34.40, lng: 132.46, radius_km: 50, region: 'chugoku', names: ['広島', 'ひろしま', 'hiroshima', '히로시마'] },
  { lat: 35.45, lng: 139.64, radius_km: 40, region: 'kanto', names: ['横浜', 'よこはま', 'yokohama', '요코하마', '神奈川', 'かながわ', 'kanagawa', '가나가와'] },
  { lat: 34.97, lng: 138.38, radius_km: 50, region: 'chubu', names: ['静岡', 'しずおか', 'shizuoka', '시즈오카'] },
  { lat: 37.90, lng: 139.02, radius_km: 50, region: 'chubu', names: ['新潟', 'にいがた', 'niigata', '니가타'] },
  { lat: 32.79, lng: 130.74, radius_km: 50, region: 'kyushu', names: ['熊本', 'くまもと', 'kumamoto', '구마모토'] },
  { lat: 35.86, lng: 139.65, radius_km: 40, region: 'kanto', names: ['さいたま', 'saitama', '사이타마', '埼玉'] },
  { lat: 35.61, lng: 140.12, radius_km: 40, region: 'kanto', names: ['千葉', 'ちば', 'chiba', '치바'] },
  { lat: 37.75, lng: 140.47, radius_km: 50, region: 'tohoku', names: ['福島', 'ふくしま', 'fukushima', '후쿠시마'] },
  { lat: 36.57, lng: 139.88, radius_km: 40, region: 'kanto', names: ['栃木', 'とちぎ', 'tochigi', '도치기', '宇都宮', 'うつのみや', 'utsunomiya', '우쓰노미야'] },
  { lat: 39.72, lng: 140.10, radius_km: 50, region: 'tohoku', names: ['秋田', 'あきた', 'akita', '아키타'] },
  { lat: 39.70, lng: 141.15, radius_km: 50, region: 'tohoku', names: ['岩手', 'いわて', 'iwate', '이와테', '盛岡', 'もりおか', 'morioka', '모리오카'] },
  { lat: 40.82, lng: 140.74, radius_km: 50, region: 'tohoku', names: ['青森', 'あおもり', 'aomori', '아오모리'] },
  { lat: 38.24, lng: 140.36, radius_km: 50, region: 'tohoku', names: ['山形', 'やまがた', 'yamagata', '야마가타'] },
  { lat: 36.39, lng: 139.06, radius_km: 40, region: 'kanto', names: ['群馬', 'ぐんま', 'gunma', '군마', '前橋', 'まえばし', 'maebashi', '마에바시'] },
  { lat: 36.07, lng: 136.22, radius_km: 40, region: 'chubu', names: ['石川', 'いしかわ', 'ishikawa', '이시카와', '金沢', 'かなざわ', 'kanazawa', '가나자와'] },
  { lat: 36.77, lng: 137.21, radius_km: 40, region: 'chubu', names: ['富山', 'とやま', 'toyama', '도야마'] },
  { lat: 36.06, lng: 136.78, radius_km: 40, region: 'chubu', names: ['福井', 'ふくい', 'fukui', '후쿠이'] },
  { lat: 35.39, lng: 136.72, radius_km: 40, region: 'chubu', names: ['岐阜', 'ぎふ', 'gifu', '기후'] },
  { lat: 36.23, lng: 139.88, radius_km: 30, region: 'kanto', names: ['茨城', 'いばらき', 'ibaraki', '이바라키'] },
  { lat: 35.66, lng: 138.57, radius_km: 40, region: 'chubu', names: ['山梨', 'やまなし', 'yamanashi', '야마나시', '甲府', 'こうふ', 'kofu', '고후'] },
  { lat: 36.23, lng: 138.18, radius_km: 40, region: 'chubu', names: ['長野', 'ながの', 'nagano', '나가노'] },
  { lat: 34.23, lng: 135.17, radius_km: 40, region: 'kinki', names: ['和歌山', 'わかやま', 'wakayama', '와카야마'] },
  { lat: 34.69, lng: 135.83, radius_km: 30, region: 'kinki', names: ['奈良', 'なら', 'nara', '나라'] },
  { lat: 34.97, lng: 135.85, radius_km: 30, region: 'kinki', names: ['滋賀', 'しが', 'shiga', '시가'] },
  { lat: 35.00, lng: 135.11, radius_km: 30, region: 'kinki', names: ['三重', 'みえ', 'mie', '미에'] },
  { lat: 34.66, lng: 133.92, radius_km: 40, region: 'chugoku', names: ['岡山', 'おかやま', 'okayama', '오카야마'] },
  { lat: 35.47, lng: 133.05, radius_km: 40, region: 'chugoku', names: ['島根', 'しまね', 'shimane', '시마네'] },
  { lat: 35.50, lng: 134.23, radius_km: 40, region: 'chugoku', names: ['鳥取', 'とっとり', 'tottori', '돗토리'] },
  { lat: 34.19, lng: 131.47, radius_km: 40, region: 'chugoku', names: ['山口', 'やまぐち', 'yamaguchi', '야마구치'] },
  { lat: 34.07, lng: 134.56, radius_km: 40, region: 'shikoku', names: ['徳島', 'とくしま', 'tokushima', '도쿠시마'] },
  { lat: 34.34, lng: 134.04, radius_km: 40, region: 'shikoku', names: ['香川', 'かがわ', 'kagawa', '가가와', '高松', 'たかまつ', 'takamatsu', '다카마쓰'] },
  { lat: 33.84, lng: 132.77, radius_km: 40, region: 'shikoku', names: ['愛媛', 'えひめ', 'ehime', '에히메', '松山', 'まつやま', 'matsuyama', '마쓰야마'] },
  { lat: 33.56, lng: 133.53, radius_km: 40, region: 'shikoku', names: ['高知', 'こうち', 'kochi', '고치'] },
  { lat: 33.25, lng: 131.61, radius_km: 40, region: 'kyushu', names: ['大分', 'おおいた', 'oita', '오이타'] },
  { lat: 32.11, lng: 131.42, radius_km: 50, region: 'kyushu', names: ['宮崎', 'みやざき', 'miyazaki', '미야자키'] },
  { lat: 31.56, lng: 130.56, radius_km: 50, region: 'kyushu', names: ['鹿児島', 'かごしま', 'kagoshima', '가고시마'] },
  { lat: 33.25, lng: 130.30, radius_km: 40, region: 'kyushu', names: ['佐賀', 'さが', 'saga', '사가'] },
  { lat: 32.74, lng: 129.87, radius_km: 40, region: 'kyushu', names: ['長崎', 'ながさき', 'nagasaki', '나가사키'] },

  // ── Notable seismic zones / offshore ──
  { lat: 33.0, lng: 135.0, radius_km: 300, region: 'nankai', names: ['南海', 'なんかい', 'nankai', '난카이', '南海トラフ', 'nankai trough', '난카이 트로프'] },
  { lat: 38.5, lng: 143.5, radius_km: 200, region: 'sanriku', names: ['三陸', 'さんりく', 'sanriku', '산리쿠', '三陸沖', '산리쿠 앞바다'] },
  { lat: 34.0, lng: 139.0, radius_km: 150, region: 'sagami', names: ['相模', 'さがみ', 'sagami', '사가미', '相模トラフ', 'sagami trough'] },
  { lat: 42.5, lng: 145.0, radius_km: 200, region: 'tokachi', names: ['十勝', 'とかち', 'tokachi', '도카치', '十勝沖', '도카치 앞바다'] },
  { lat: 37.5, lng: 141.0, radius_km: 100, region: 'fukushima_offshore', names: ['福島県沖', '후쿠시마 앞바다', 'fukushima offshore'] },
  { lat: 38.5, lng: 141.5, radius_km: 100, region: 'miyagi_offshore', names: ['宮城県沖', '미야기 앞바다', 'miyagi offshore'] },
  { lat: 33.8, lng: 132.0, radius_km: 100, region: 'bungo', names: ['豊後水道', 'ぶんごすいどう', 'bungo channel', '분고 수도'] },
  { lat: 37.3, lng: 136.8, radius_km: 100, region: 'noto', names: ['能登', 'のと', 'noto', '노토'] },
  { lat: 35.3, lng: 140.5, radius_km: 80, region: 'boso', names: ['房総', 'ぼうそう', 'boso', '보소', '千葉沖'] },
];

/**
 * Look up a place token against the dictionary.
 * Returns the best match or null.
 */
export function lookupPlace(token: string): PlaceEntry | null {
  const lower = token.toLowerCase();
  for (const entry of PLACE_DICTIONARY) {
    for (const name of entry.names) {
      if (name.toLowerCase() === lower || name === token) return entry;
    }
  }
  // Partial match (token is substring of a name, or vice versa)
  for (const entry of PLACE_DICTIONARY) {
    for (const name of entry.names) {
      if (name.toLowerCase().includes(lower) || lower.includes(name.toLowerCase())) {
        return entry;
      }
    }
  }
  return null;
}
