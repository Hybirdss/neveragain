/**
 * Hospital Layer — Disaster base hospitals (災害拠点病院).
 *
 * Japan designates ~750 disaster base hospitals for earthquake response.
 * This layer shows the top facilities per region with:
 * - Normal: white cross markers
 * - Impact zone: red highlight with capacity info
 */

import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '@namazue/ops/types';
import { isInImpactZone } from './impactZone';

type RGBA = [number, number, number, number];

export interface Hospital {
  id: string;
  name: string;
  nameEn: string;
  lat: number;
  lng: number;
  beds: number;
  region: string;
  helipad: boolean;
  dmat: boolean; // Disaster Medical Assistance Team base
}

interface HospitalDatum extends Hospital {
  inZone: boolean;
}

const NORMAL_COLOR: RGBA = [110, 231, 183, 170];
const ZONE_COLOR: RGBA = [239, 68, 68, 240];
const DMAT_COLOR: RGBA = [251, 191, 36, 200];

// ── Hospital Catalog ─────────────────────────────────────────

export const HOSPITALS: Hospital[] = [
  // Hokkaido
  { id: 'h-sapporo-med', name: '札幌医科大学附属病院', nameEn: 'Sapporo Medical University', lat: 43.0474, lng: 141.3409, beds: 938, region: 'hokkaido', helipad: true, dmat: true },
  { id: 'h-hokudai', name: '北海道大学病院', nameEn: 'Hokkaido University Hospital', lat: 43.0746, lng: 141.3416, beds: 944, region: 'hokkaido', helipad: false, dmat: true },
  { id: 'h-asahikawa', name: '旭川医科大学病院', nameEn: 'Asahikawa Medical University', lat: 43.7305, lng: 142.3839, beds: 602, region: 'hokkaido', helipad: true, dmat: false },

  // Tohoku
  { id: 'h-tohoku-univ', name: '東北大学病院', nameEn: 'Tohoku University Hospital', lat: 38.2601, lng: 140.8575, beds: 1225, region: 'tohoku', helipad: true, dmat: true },
  { id: 'h-iwate-med', name: '岩手医科大学附属病院', nameEn: 'Iwate Medical University', lat: 39.4486, lng: 141.1269, beds: 1000, region: 'tohoku', helipad: true, dmat: true },
  { id: 'h-yamagata', name: '山形大学医学部附属病院', nameEn: 'Yamagata University Hospital', lat: 38.2370, lng: 140.3258, beds: 637, region: 'tohoku', helipad: false, dmat: true },
  { id: 'h-fukushima', name: '福島県立医科大学附属病院', nameEn: 'Fukushima Medical University', lat: 37.7512, lng: 140.4678, beds: 778, region: 'tohoku', helipad: true, dmat: true },

  // Kanto
  { id: 'h-todai', name: '東京大学医学部附属病院', nameEn: 'University of Tokyo Hospital', lat: 35.7134, lng: 139.7610, beds: 1217, region: 'kanto', helipad: true, dmat: true },
  { id: 'h-st-lukes', name: '聖路加国際病院', nameEn: "St. Luke's International Hospital", lat: 35.6677, lng: 139.7772, beds: 520, region: 'kanto', helipad: false, dmat: true },
  { id: 'h-ndmc', name: '国立病院機構災害医療センター', nameEn: 'National Disaster Medical Center', lat: 35.7134, lng: 139.4891, beds: 455, region: 'kanto', helipad: true, dmat: true },
  { id: 'h-yokohama-city', name: '横浜市立大学附属病院', nameEn: 'Yokohama City University Hospital', lat: 35.3772, lng: 139.6189, beds: 674, region: 'kanto', helipad: true, dmat: true },
  { id: 'h-saitama-med', name: 'さいたま赤十字病院', nameEn: 'Saitama Red Cross Hospital', lat: 35.8871, lng: 139.6353, beds: 637, region: 'kanto', helipad: true, dmat: true },
  { id: 'h-chiba-univ', name: '千葉大学医学部附属病院', nameEn: 'Chiba University Hospital', lat: 35.6225, lng: 140.1069, beds: 850, region: 'kanto', helipad: true, dmat: true },

  // Chubu
  { id: 'h-nagoya-univ', name: '名古屋大学医学部附属病院', nameEn: 'Nagoya University Hospital', lat: 35.1549, lng: 136.9645, beds: 1080, region: 'chubu', helipad: true, dmat: true },
  { id: 'h-shizuoka-gen', name: '静岡県立総合病院', nameEn: 'Shizuoka General Hospital', lat: 34.9795, lng: 138.3870, beds: 712, region: 'chubu', helipad: true, dmat: true },
  { id: 'h-niigata-univ', name: '新潟大学医歯学総合病院', nameEn: 'Niigata University Hospital', lat: 37.9137, lng: 139.0388, beds: 825, region: 'chubu', helipad: true, dmat: true },
  { id: 'h-kanazawa', name: '金沢大学附属病院', nameEn: 'Kanazawa University Hospital', lat: 36.5453, lng: 136.6637, beds: 838, region: 'chubu', helipad: true, dmat: true },

  // Kansai
  { id: 'h-osaka-univ', name: '大阪大学医学部附属病院', nameEn: 'Osaka University Hospital', lat: 34.8215, lng: 135.5268, beds: 1086, region: 'kansai', helipad: true, dmat: true },
  { id: 'h-kyoto-univ', name: '京都大学医学部附属病院', nameEn: 'Kyoto University Hospital', lat: 35.0163, lng: 135.7720, beds: 1141, region: 'kansai', helipad: true, dmat: true },
  { id: 'h-kobe-city', name: '神戸市立医療センター中央市民病院', nameEn: 'Kobe City Medical Center', lat: 34.6915, lng: 135.1807, beds: 768, region: 'kansai', helipad: true, dmat: true },
  { id: 'h-nara-med', name: '奈良県立医科大学附属病院', nameEn: 'Nara Medical University Hospital', lat: 34.4718, lng: 135.7914, beds: 992, region: 'kansai', helipad: true, dmat: true },

  // Chugoku
  { id: 'h-hiroshima-univ', name: '広島大学病院', nameEn: 'Hiroshima University Hospital', lat: 34.3853, lng: 132.4688, beds: 740, region: 'chugoku', helipad: true, dmat: true },
  { id: 'h-okayama-univ', name: '岡山大学病院', nameEn: 'Okayama University Hospital', lat: 34.6529, lng: 133.9221, beds: 865, region: 'chugoku', helipad: true, dmat: true },

  // Shikoku
  { id: 'h-ehime-univ', name: '愛媛大学医学部附属病院', nameEn: 'Ehime University Hospital', lat: 33.8416, lng: 132.7875, beds: 635, region: 'shikoku', helipad: true, dmat: true },
  { id: 'h-tokushima', name: '徳島大学病院', nameEn: 'Tokushima University Hospital', lat: 34.0696, lng: 134.5594, beds: 697, region: 'shikoku', helipad: true, dmat: true },
  { id: 'h-kochi-med', name: '高知医療センター', nameEn: 'Kochi Medical Center', lat: 33.5474, lng: 133.5349, beds: 672, region: 'shikoku', helipad: true, dmat: true },

  // Kyushu
  { id: 'h-kyushu-univ', name: '九州大学病院', nameEn: 'Kyushu University Hospital', lat: 33.6116, lng: 130.4288, beds: 1275, region: 'kyushu', helipad: true, dmat: true },
  { id: 'h-kumamoto-univ', name: '熊本大学病院', nameEn: 'Kumamoto University Hospital', lat: 32.7904, lng: 130.7283, beds: 845, region: 'kyushu', helipad: true, dmat: true },
  { id: 'h-nagasaki', name: '長崎大学病院', nameEn: 'Nagasaki University Hospital', lat: 32.7718, lng: 129.8735, beds: 862, region: 'kyushu', helipad: true, dmat: true },
  { id: 'h-kagoshima', name: '鹿児島大学病院', nameEn: 'Kagoshima University Hospital', lat: 31.5695, lng: 130.5440, beds: 756, region: 'kyushu', helipad: true, dmat: true },
];

// ── Tooltip ──────────────────────────────────────────────────

export function formatHospitalTooltip(h: Hospital, event: EarthquakeEvent | null): string {
  const inZone = isInImpactZone(h.lat, h.lng, event);
  const tags: string[] = [];
  if (h.dmat) tags.push('DMAT Base');
  if (h.helipad) tags.push('Helipad');

  let zoneInfo = '';
  if (inZone) {
    zoneInfo = '<div style="color:#ef4444;font-weight:600;margin-top:4px">IN IMPACT ZONE</div>';
  }

  return `
    <div style="font-weight:600;font-size:12px;margin-bottom:3px">${h.name}</div>
    <div style="opacity:0.7;font-size:11px">${h.nameEn}</div>
    <div style="margin-top:4px;display:flex;gap:12px">
      <span>${h.beds} beds</span>
      <span style="opacity:0.6">${tags.join(' · ')}</span>
    </div>
    ${zoneInfo}
  `;
}

// ── Layer Factory ────────────────────────────────────────────

export function createHospitalLayers(
  selectedEvent: EarthquakeEvent | null,
  zoom: number,
): Layer[] {
  // Only show at regional zoom (z7+)
  if (zoom < 5) return [];

  const data: HospitalDatum[] = HOSPITALS.map((h) => ({
    ...h,
    inZone: isInImpactZone(h.lat, h.lng, selectedEvent),
  }));

  const layers: Layer[] = [];

  layers.push(new ScatterplotLayer<HospitalDatum>({
    id: 'hospitals',
    data,
    pickable: true,
    autoHighlight: true,
    highlightColor: [125, 211, 252, 200],
    stroked: true,
    filled: true,
    radiusUnits: 'pixels',
    lineWidthUnits: 'pixels',
    getPosition: (d) => [d.lng, d.lat],
    getRadius: (d) => {
      if (d.inZone) return 8;
      if (d.dmat) return 6;
      return 5;
    },
    getFillColor: (d) => {
      if (d.inZone) return ZONE_COLOR;
      if (d.dmat) return DMAT_COLOR;
      return NORMAL_COLOR;
    },
    getLineColor: [255, 255, 255, 120],
    getLineWidth: 1,
    updateTriggers: {
      getFillColor: [selectedEvent?.id],
      getRadius: [selectedEvent?.id],
    },
  }));

  // Labels at city zoom (z8+)
  if (zoom >= 8) {
    layers.push(new TextLayer<HospitalDatum>({
      id: 'hospital-labels',
      data,
      pickable: false,
      getPosition: (d) => [d.lng, d.lat],
      getText: (d) => `${d.nameEn}${d.inZone ? ' ⚠' : ''}`,
      getSize: 10,
      getColor: (d) => d.inZone ? [239, 68, 68, 220] : [226, 232, 240, 160],
      getTextAnchor: 'start' as const,
      getAlignmentBaseline: 'center' as const,
      getPixelOffset: [10, 0],
      fontFamily: 'Noto Sans JP, system-ui, sans-serif',
      fontWeight: 500,
      outlineWidth: 2,
      outlineColor: [10, 14, 20, 200],
      updateTriggers: {
        getText: [selectedEvent?.id],
        getColor: [selectedEvent?.id],
      },
    }));
  }

  return layers;
}
