/**
 * HERP Official Fault Probability Data
 *
 * Source: 地震調査研究推進本部 (Headquarters for Earthquake Research Promotion)
 * https://www.jishin.go.jp/evaluation/long_term_evaluation/
 *
 * Last updated: 2025-01-01 (based on HERP 2024 annual report)
 * Reference: "主要活断層帯の長期評価" + "海溝型地震の長期評価"
 *
 * All probability values are 30-year exceedance probabilities as published by HERP.
 * Mw values are HERP's assessed maximum magnitude, NOT Wells & Coppersmith estimates.
 * Recurrence intervals are from HERP paleoseismic/historical assessments.
 *
 * DO NOT modify these values without citing the specific HERP evaluation document.
 */

export interface HerpFaultData {
  /** Fault ID (must match active-faults.json) */
  id: string;
  /** Japanese name */
  name: string;
  /** English name */
  nameEn: string;
  /** HERP assessed maximum magnitude */
  mw: number;
  /** 30-year probability as published (string, preserves HERP format) */
  probability30yr: string;
  /** Recurrence interval as published (string) */
  interval: string;
  /** Fault type */
  faultType: 'crustal' | 'interface' | 'intraslab';
  /** Typical depth (km) */
  depthKm: number;
  /** HERP evaluation document date (YYYY-MM or YYYY) */
  evaluationDate: string;
  /** Specific HERP document reference */
  reference: string;
}

// ── Subduction Zone Earthquakes (海溝型地震) ──────────────────

export const HERP_SUBDUCTION: HerpFaultData[] = [
  {
    id: 'nankai-trough',
    name: '南海トラフ',
    nameEn: 'Nankai Trough',
    mw: 9.1,
    probability30yr: '70〜80%',
    interval: '88.2年',
    faultType: 'interface',
    depthKm: 20,
    evaluationDate: '2024-01',
    reference: '南海トラフの地震活動の長期評価（第二版）2013, 確率更新2024',
  },
  {
    id: 'sagami-trough',
    name: '相模トラフ',
    nameEn: 'Sagami Trough',
    mw: 8.0,
    probability30yr: 'ほぼ0〜6%',
    interval: '200〜400年',
    faultType: 'interface',
    depthKm: 25,
    evaluationDate: '2014-04',
    reference: '相模トラフ沿いの地震活動の長期評価（第二版）2014',
  },
  {
    id: 'sagami-trough-m7',
    name: '相模トラフ（M7程度）',
    nameEn: 'Sagami Trough (M7 class)',
    mw: 7.3,
    probability30yr: '70%程度',
    interval: '27.5年',
    faultType: 'interface',
    depthKm: 30,
    evaluationDate: '2014-04',
    reference: '相模トラフ沿いの地震活動の長期評価（第二版）2014',
  },
  {
    id: 'japan-trench-tohoku',
    name: '日本海溝（東北沖）',
    nameEn: 'Japan Trench (Tohoku)',
    mw: 9.0,
    probability30yr: 'ほぼ0%',
    interval: '600年程度',
    faultType: 'interface',
    depthKm: 24,
    evaluationDate: '2019-02',
    reference: '日本海溝沿いの地震活動の長期評価（第二版）2019',
  },
  {
    id: 'japan-trench-miyagi',
    name: '日本海溝（宮城県沖）',
    nameEn: 'Japan Trench (Off Miyagi)',
    mw: 7.4,
    probability30yr: '90%程度',
    interval: '38.0年',
    faultType: 'interface',
    depthKm: 40,
    evaluationDate: '2019-02',
    reference: '日本海溝沿いの地震活動の長期評価（第二版）2019',
  },
  {
    id: 'kuril-trench',
    name: '千島海溝',
    nameEn: 'Kuril Trench',
    mw: 8.8,
    probability30yr: '7〜40%',
    interval: '340〜380年',
    faultType: 'interface',
    depthKm: 30,
    evaluationDate: '2017-12',
    reference: '千島海溝沿いの地震活動の長期評価（第三版）2017',
  },
];

// ── Major Crustal Fault Zones (主要活断層帯) ─────────────────
// Source: HERP 主要活断層帯の長期評価 (115 fault zones evaluated)

export const HERP_CRUSTAL: HerpFaultData[] = [
  // ── Hokkaido ──
  {
    id: 'ishikari-teichi',
    name: '石狩低地東縁断層帯',
    nameEn: 'Ishikari Lowland East Edge Fault',
    mw: 7.9,
    probability30yr: 'ほぼ0〜0.009%',
    interval: '1000〜2000年以上',
    faultType: 'crustal',
    depthKm: 15,
    evaluationDate: '2010-11',
    reference: '石狩低地東縁断層帯の長期評価 2010',
  },
  {
    id: 'sarobetsu',
    name: 'サロベツ断層帯',
    nameEn: 'Sarobetsu Fault Zone',
    mw: 7.6,
    probability30yr: '3%以上',
    interval: '1900〜2600年',
    faultType: 'crustal',
    depthKm: 15,
    evaluationDate: '2008-03',
    reference: 'サロベツ断層帯の長期評価 2008',
  },
  // ── Tohoku ──
  {
    id: 'shonai-heiya',
    name: '庄内平野東縁断層帯',
    nameEn: 'Shonai Plain East Edge Fault',
    mw: 7.5,
    probability30yr: 'ほぼ0〜6%',
    interval: '3000〜5900年',
    faultType: 'crustal',
    depthKm: 15,
    evaluationDate: '2008-11',
    reference: '庄内平野東縁断層帯の長期評価 2008',
  },
  {
    id: 'nagamachi-rifu',
    name: '長町-利府線断層帯',
    nameEn: 'Nagamachi-Rifu Fault',
    mw: 7.0,
    probability30yr: '1%以下',
    interval: '3000年程度',
    faultType: 'crustal',
    depthKm: 15,
    evaluationDate: '2005-08',
    reference: '長町-利府線断層帯の長期評価 2005',
  },
  // ── Kanto ──
  {
    id: 'tachikawa',
    name: '立川断層帯',
    nameEn: 'Tachikawa Fault',
    mw: 7.4,
    probability30yr: '0.5〜2%',
    interval: '10000〜15000年',
    faultType: 'crustal',
    depthKm: 10,
    evaluationDate: '2003-07',
    reference: '立川断層帯の長期評価 2003',
  },
  {
    id: 'miura',
    name: '三浦半島断層群',
    nameEn: 'Miura Peninsula Fault Group',
    mw: 6.7,
    probability30yr: '6〜11%',
    interval: '1600〜1900年',
    faultType: 'crustal',
    depthKm: 10,
    evaluationDate: '2003-03',
    reference: '三浦半島断層群の長期評価 2003',
  },
  {
    id: 'kannawa-kozu-matsuda',
    name: '神縄・国府津-松田断層帯',
    nameEn: 'Kannawa-Kozu-Matsuda Fault',
    mw: 7.5,
    probability30yr: '0.2〜16%',
    interval: '800〜2600年',
    faultType: 'crustal',
    depthKm: 15,
    evaluationDate: '2005-04',
    reference: '神縄・国府津-松田断層帯の長期評価 2005',
  },
  // ── Chubu ──
  {
    id: 'itoigawa-shizuoka',
    name: '糸魚川-静岡構造線断層帯',
    nameEn: 'Itoigawa-Shizuoka Tectonic Line',
    mw: 7.7,
    probability30yr: '14〜30%',
    interval: '約1000年',
    faultType: 'crustal',
    depthKm: 15,
    evaluationDate: '2015-06',
    reference: '糸魚川-静岡構造線断層帯の長期評価（第二版）2015',
  },
  {
    id: 'atera',
    name: '阿寺断層帯',
    nameEn: 'Atera Fault',
    mw: 6.9,
    probability30yr: '6〜11%',
    interval: '約1800年',
    faultType: 'crustal',
    depthKm: 15,
    evaluationDate: '2004-04',
    reference: '阿寺断層帯の長期評価 2004',
  },
  {
    id: 'atotsugawa',
    name: '跡津川断層帯',
    nameEn: 'Atotsugawa Fault Zone',
    mw: 7.9,
    probability30yr: 'ほぼ0〜0.003%',
    interval: '2300〜2700年',
    faultType: 'crustal',
    depthKm: 15,
    evaluationDate: '2004-01',
    reference: '跡津川断層帯の長期評価 2004',
  },
  {
    id: 'morimoto-togashi',
    name: '森本・富樫断層帯',
    nameEn: 'Morimoto-Togashi Fault',
    mw: 7.2,
    probability30yr: '2〜8%',
    interval: '約3000年',
    faultType: 'crustal',
    depthKm: 12,
    evaluationDate: '2005-01',
    reference: '森本・富樫断層帯の長期評価 2005',
  },
  {
    id: 'nobi',
    name: '濃尾断層帯',
    nameEn: 'Nobi Fault',
    mw: 7.3,
    probability30yr: 'ほぼ0%',
    interval: '1500〜2500年',
    faultType: 'crustal',
    depthKm: 15,
    evaluationDate: '2005-01',
    reference: '濃尾断層帯の長期評価 2005',
  },
  {
    id: 'sanage-takahama',
    name: '猿投-高浜断層帯',
    nameEn: 'Sanage-Takahama Fault',
    mw: 6.9,
    probability30yr: '不明',
    interval: '不明',
    faultType: 'crustal',
    depthKm: 12,
    evaluationDate: 'N/A',
    reference: 'HERP未評価（データ不足）',
  },
  {
    id: 'noto',
    name: '能登半島北岸断層',
    nameEn: 'Noto Peninsula North Coast Fault',
    mw: 7.6,
    probability30yr: '不明',
    interval: '不明',
    faultType: 'crustal',
    depthKm: 10,
    evaluationDate: '2024-03',
    reference: '令和6年能登半島地震評価 2024（確率評価は今後の課題）',
  },
  // ── Kansai ──
  {
    id: 'arima-takatsuki',
    name: '有馬-高槻断層帯',
    nameEn: 'Arima-Takatsuki Fault Zone',
    mw: 7.5,
    probability30yr: 'ほぼ0〜0.03%',
    interval: '1000〜2000年',
    faultType: 'crustal',
    depthKm: 15,
    evaluationDate: '2005-01',
    reference: '有馬-高槻断層帯の長期評価 2005',
  },
  {
    id: 'uemachi',
    name: '上町断層帯',
    nameEn: 'Uemachi Fault',
    mw: 7.5,
    probability30yr: '2〜3%',
    interval: '約8000年',
    faultType: 'crustal',
    depthKm: 13,
    evaluationDate: '2004-02',
    reference: '上町断層帯の長期評価 2004',
  },
  {
    id: 'rokko-awaji',
    name: '六甲・淡路島断層帯',
    nameEn: 'Rokko-Awaji Island Fault Zone',
    mw: 7.9,
    probability30yr: 'ほぼ0〜0.04%',
    interval: '1000〜2000年',
    faultType: 'crustal',
    depthKm: 15,
    evaluationDate: '2005-01',
    reference: '六甲・淡路島断層帯の長期評価 2005',
  },
  {
    id: 'yamada',
    name: '山田断層帯',
    nameEn: 'Yamada Fault Zone',
    mw: 6.7,
    probability30yr: '不明',
    interval: '不明',
    faultType: 'crustal',
    depthKm: 15,
    evaluationDate: 'N/A',
    reference: 'HERP未評価',
  },
  {
    id: 'mtl',
    name: '中央構造線断層帯',
    nameEn: 'Median Tectonic Line',
    mw: 8.0,
    probability30yr: 'ほぼ0〜5%',
    interval: '約1000年以上',
    faultType: 'crustal',
    depthKm: 15,
    evaluationDate: '2017-12',
    reference: '中央構造線断層帯の長期評価（第二版）2017',
  },
  // ── Kyushu ──
  {
    id: 'futagawa-hinagu',
    name: '布田川・日奈久断層帯',
    nameEn: 'Futagawa-Hinagu Fault Zone',
    mw: 7.2,
    probability30yr: 'ほぼ0%',
    interval: '8100〜26000年',
    faultType: 'crustal',
    depthKm: 12,
    evaluationDate: '2013-02',
    reference: '布田川断層帯・日奈久断層帯の長期評価（一部改訂）2013',
  },
  {
    id: 'beppu-haneyama',
    name: '別府-万年山断層帯',
    nameEn: 'Beppu-Haneyama Fault Zone',
    mw: 7.3,
    probability30yr: 'ほぼ0〜2%',
    interval: '2100〜3300年',
    faultType: 'crustal',
    depthKm: 15,
    evaluationDate: '2005-03',
    reference: '別府-万年山断層帯の長期評価 2005',
  },
  // ── Tohoku (Tanagura) ──
  {
    id: 'hatagawa',
    name: '棚倉断層帯',
    nameEn: 'Tanagura Fault Zone',
    mw: 7.0,
    probability30yr: 'ほぼ0%',
    interval: '3000〜6000年',
    faultType: 'crustal',
    depthKm: 15,
    evaluationDate: 'N/A',
    reference: '断層帯としてのHERP個別評価なし。再現間隔はGEM+古地震データ',
  },
];

/** All HERP-evaluated faults combined */
export const HERP_ALL = [...HERP_SUBDUCTION, ...HERP_CRUSTAL];

/** Lookup map by fault ID */
export const HERP_BY_ID = new Map(HERP_ALL.map((f) => [f.id, f]));
