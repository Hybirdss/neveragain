/**
 * Hospital Layer — Disaster base hospitals (災害拠点病院).
 *
 * Japan designates ~750 disaster base hospitals for earthquake response.
 * This layer shows the top facilities per region with:
 * - Normal: green cross markers
 * - Impact zone: red highlight with capacity info
 * - DMAT bases outside zone: gold (deployable)
 *
 * Intelligence (when event selected):
 * - Intensity at hospital site from GMPE
 * - Operational likelihood (intensity-based)
 * - DMAT deployment readiness
 */

import { IconLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '../types';
import { isInImpactZone } from './impactZone';
import { ICON_ATLAS_URL, ICON_MAPPING } from './iconAtlas';
import { computeGmpe, haversine } from '../engine/gmpe';

type RGBA = [number, number, number, number];

export type HospitalPosture = 'operational' | 'disrupted' | 'assessment-needed' | 'compromised';

export interface Hospital {
  id: string;
  name: string;
  nameEn: string;
  lat: number;
  lng: number;
  beds: number;
  region: string;
  helipad: boolean;
  dmat: boolean;
}

interface HospitalDatum extends Hospital {
  inZone: boolean;
  posture: HospitalPosture;
  intensityAtSite: number;
  dmatDeployable: boolean; // DMAT base outside impact zone = can send teams
}

const NORMAL_COLOR: RGBA = [110, 231, 183, 170];
const ZONE_COLOR: RGBA = [239, 68, 68, 240];
const DMAT_COLOR: RGBA = [251, 191, 36, 200];
const DMAT_DEPLOY_COLOR: RGBA = [34, 211, 238, 220]; // cyan — ready to deploy
const DISRUPTED_COLOR: RGBA = [251, 146, 60, 220];   // orange

// ── Site Assessment ──────────────────────────────────────────

/**
 * Assess hospital operational posture from JMA instrumental intensity at site.
 *
 * Thresholds based on building damage probability functions from Japanese
 * government disaster impact assessments:
 *
 *   JMA 4  (I < 4.5): Operational — light fixtures sway, no structural impact.
 *   JMA 5- (I < 5.5): Disrupted — non-structural damage (fallen ceiling tiles,
 *     broken glass), some equipment displacement. Medical operations may be
 *     temporarily interrupted.
 *   JMA 5+/6- (I < 6.0): Assessment needed — potential structural damage to
 *     non-seismically-reinforced buildings. Evacuation of upper floors may be
 *     required per 災害拠点病院指定要件.
 *   JMA 6+ (I >= 6.0): Compromised — significant structural damage likely.
 *     Hospital function severely degraded or lost.
 *
 * References:
 *   - Cabinet Office (内閣府) "首都直下地震の被害想定と対策について" (2013),
 *     Building damage rates by JMA intensity class, Table 6-1.
 *   - MHLW (厚生労働省) "災害拠点病院指定要件" (Disaster Base Hospital
 *     Designation Requirements), requiring seismic resistance assessment
 *     at JMA 6+ and above.
 *   - Empirical: 2016 Kumamoto earthquake (M7.0) — Kumamoto University Hospital
 *     (JMA 6+) sustained structural damage requiring partial evacuation.
 */
function computeHospitalPosture(intensity: number): HospitalPosture {
  if (intensity < 4.5) return 'operational';
  if (intensity < 5.5) return 'disrupted';
  if (intensity < 6.0) return 'assessment-needed';
  return 'compromised';
}

function assessSite(
  h: Hospital,
  event: EarthquakeEvent | null,
): { intensity: number; posture: HospitalPosture; dmatDeployable: boolean } {
  if (!event) return { intensity: 0, posture: 'operational', dmatDeployable: false };

  const surfaceDist = haversine(event.lat, event.lng, h.lat, h.lng);
  const hypo = Math.sqrt(surfaceDist * surfaceDist + event.depth_km * event.depth_km);
  const result = computeGmpe({
    Mw: event.magnitude,
    depth_km: event.depth_km,
    distance_km: Math.max(hypo, 3),
    faultType: event.faultType,
  });

  const intensity = Math.max(0, result.jmaIntensity);
  const posture = computeHospitalPosture(intensity);
  // DMAT base that is operational can deploy teams to the impact zone
  const dmatDeployable = h.dmat && posture === 'operational' && isInImpactZone(event.lat, event.lng, event);

  return { intensity, posture, dmatDeployable };
}

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

const POSTURE_LABELS: Record<HospitalPosture, { text: string; color: string }> = {
  operational: { text: 'Likely operational', color: '#6ee7b7' },
  disrupted: { text: 'Minor disruption possible', color: '#fbbf24' },
  'assessment-needed': { text: 'Structural assessment needed', color: '#fb923c' },
  compromised: { text: 'CAPACITY COMPROMISED', color: '#ef4444' },
};

export function formatHospitalTooltip(h: Hospital, event: EarthquakeEvent | null): string {
  const { intensity, posture, dmatDeployable } = assessSite(h, event);
  const inZone = isInImpactZone(h.lat, h.lng, event);
  const tags: string[] = [];
  if (h.dmat) tags.push('DMAT Base');
  if (h.helipad) tags.push('Helipad');

  let assessmentHtml = '';
  if (event && intensity > 0.5) {
    const label = POSTURE_LABELS[posture];
    assessmentHtml = `
      <div style="color:${label.color};font-weight:600;margin-top:4px">${label.text}</div>
      <div style="opacity:0.6;font-size:10px">Est. intensity ${intensity.toFixed(1)} at site</div>`;
    if (dmatDeployable) {
      assessmentHtml += '<div style="color:#22d3ee;font-size:10px;margin-top:2px">DMAT deployable to impact zone</div>';
    }
  } else if (inZone) {
    assessmentHtml = '<div style="color:#ef4444;font-weight:600;margin-top:4px">IN IMPACT ZONE</div>';
  }

  return `
    <div style="font-weight:600;font-size:12px;margin-bottom:3px">${h.name}</div>
    <div style="opacity:0.7;font-size:11px">${h.nameEn}</div>
    <div style="margin-top:4px;display:flex;gap:12px">
      <span>${h.beds} beds</span>
      <span style="opacity:0.6">${tags.join(' · ')}</span>
    </div>
    ${assessmentHtml}
  `;
}

// ── Layer Factory ────────────────────────────────────────────

export function createHospitalLayers(
  selectedEvent: EarthquakeEvent | null,
  zoom: number,
  sWaveRadiusKm: number | null = null,
): Layer[] {
  if (zoom < 5) return [];

  const data: HospitalDatum[] = HOSPITALS.map((h) => {
    const assessment = assessSite(h, selectedEvent);
    let inZone = isInImpactZone(h.lat, h.lng, selectedEvent);
    let posture = assessment.posture;
    let dmatDeployable = assessment.dmatDeployable;

    // S-wave cascade: override to pre-impact state if wave hasn't reached this hospital yet
    if (sWaveRadiusKm !== null && selectedEvent) {
      const distKm = haversine(selectedEvent.lat, selectedEvent.lng, h.lat, h.lng);
      if (distKm > sWaveRadiusKm) {
        posture = 'operational';
        inZone = false;
        dmatDeployable = false;
      }
    }

    return {
      ...h,
      inZone,
      posture,
      intensityAtSite: assessment.intensity,
      dmatDeployable,
    };
  });

  const layers: Layer[] = [];

  layers.push(new IconLayer<HospitalDatum>({
    id: 'hospitals',
    data,
    pickable: true,
    autoHighlight: true,
    highlightColor: [125, 211, 252, 200],
    iconAtlas: ICON_ATLAS_URL,
    iconMapping: ICON_MAPPING,
    getIcon: () => 'hospital',
    getPosition: (d) => [d.lng, d.lat],
    getSize: (d) => {
      if (d.posture === 'compromised') return 24;
      if (d.posture === 'assessment-needed') return 22;
      if (d.dmatDeployable) return 22;
      if (d.inZone) return 22;
      if (d.dmat) return 18;
      return 16;
    },
    sizeUnits: 'pixels',
    sizeMinPixels: 10,
    getColor: (d): RGBA => {
      if (d.posture === 'compromised') return ZONE_COLOR;
      if (d.posture === 'assessment-needed') return DISRUPTED_COLOR;
      if (d.posture === 'disrupted') return [251, 191, 36, 200];
      if (d.dmatDeployable) return DMAT_DEPLOY_COLOR;
      if (d.inZone) return ZONE_COLOR;
      if (d.dmat) return DMAT_COLOR;
      return NORMAL_COLOR;
    },
    updateTriggers: {
      getColor: [selectedEvent?.id, sWaveRadiusKm],
      getSize: [selectedEvent?.id, sWaveRadiusKm],
    },
  }));

  // Labels at city zoom (z8+)
  if (zoom >= 8) {
    layers.push(new TextLayer<HospitalDatum>({
      id: 'hospital-labels',
      data,
      pickable: false,
      getPosition: (d) => [d.lng, d.lat],
      getText: (d) => {
        if (d.posture === 'compromised') return `${d.nameEn} ⚠`;
        if (d.dmatDeployable) return `${d.nameEn} → DEPLOY`;
        if (d.inZone) return `${d.nameEn} ⚠`;
        return d.nameEn;
      },
      getSize: 10,
      getColor: (d) => {
        if (d.posture === 'compromised') return [239, 68, 68, 255];
        if (d.posture === 'assessment-needed') return [251, 146, 60, 240];
        if (d.dmatDeployable) return [34, 211, 238, 220];
        if (d.inZone) return [239, 68, 68, 220];
        return [226, 232, 240, 160];
      },
      getTextAnchor: 'start' as const,
      getAlignmentBaseline: 'center' as const,
      getPixelOffset: [10, 0],
      fontFamily: 'Noto Sans JP, system-ui, sans-serif',
      fontWeight: 500,
      outlineWidth: 2,
      outlineColor: [10, 14, 20, 200],
      updateTriggers: {
        getText: [selectedEvent?.id, sWaveRadiusKm],
        getColor: [selectedEvent?.id, sWaveRadiusKm],
      },
    }));
  }

  return layers;
}
