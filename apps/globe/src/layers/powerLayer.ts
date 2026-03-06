/**
 * Power Layer — Nuclear and major thermal power plants.
 *
 * Nuclear SCRAM inference: When an earthquake is selected, computes
 * GMPE intensity at each nuclear plant site. PGA > 120 gal triggers
 * visual SCRAM indicator.
 *
 * Visual:
 *   Nuclear operating: amber icon
 *   Nuclear shutdown: dim amber
 *   Nuclear SCRAM likely: pulsing red
 *   Thermal: smaller gray icons
 *   In impact zone: red highlight
 */

import { IconLayer, TextLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '../types';
import { isInImpactZone } from './impactZone';
import { ICON_ATLAS_URL, ICON_MAPPING } from './iconAtlas';
import { computeGmpe, haversine } from '../engine/gmpe';

type RGBA = [number, number, number, number];

export type PlantType = 'nuclear' | 'thermal';
export type PlantStatus = 'operating' | 'shutdown' | 'decommissioning';
export type ScramLikelihood = 'none' | 'unlikely' | 'possible' | 'likely' | 'certain';

export interface PowerPlant {
  id: string;
  name: string;
  nameEn: string;
  lat: number;
  lng: number;
  type: PlantType;
  status: PlantStatus;
  capacityMw: number;
  units: number;
  region: string;
}

interface PowerDatum extends PowerPlant {
  inZone: boolean;
  scramLikelihood: ScramLikelihood;
  estimatedIntensity: number;
  estimatedPgaGal: number;
}

const NUCLEAR_COLOR: RGBA = [251, 191, 36, 220];    // amber
const NUCLEAR_OFF: RGBA = [251, 191, 36, 100];      // dim amber
const THERMAL_COLOR: RGBA = [148, 163, 184, 150];   // slate
const ZONE_COLOR: RGBA = [239, 68, 68, 240];        // red
const DECOM_COLOR: RGBA = [148, 100, 60, 100];      // brown-dim
const SCRAM_LIKELY: RGBA = [239, 68, 68, 255];      // bright red
const SCRAM_POSSIBLE: RGBA = [251, 146, 60, 240];   // orange

// ── SCRAM Inference ─────────────────────────────────────────

/**
 * Approximate PGA (gal) from JMA instrumental intensity.
 *
 * Uses the empirical relationship between JMA intensity and peak ground
 * acceleration. The JMA intensity scale is defined as:
 *   I_JMA = 2 * log10(a_filtered) + 0.94
 * where a_filtered is the vector sum of filtered accelerations (not raw PGA).
 *
 * For approximate PGA estimation, we use the inverse:
 *   PGA_approx ≈ 10^((I - 0.94) / 2)
 *
 * This gives values consistent with Midorikawa et al. (1999) empirical
 * PGA-intensity relationship and JMA published intensity-acceleration tables:
 *   JMA 5- (I=4.5): ~105 gal   (JMA range: 80-110)
 *   JMA 6- (I=5.5): ~190 gal   (JMA range: 180-250)
 *   JMA 6+ (I=6.0): ~338 gal   (JMA range: 250-400)
 *
 * Reference: JMA "計測震度の算出方法" (Method of computing instrumental intensity)
 * https://www.data.jma.go.jp/eqev/data/kyoshin/kaisetsu/calc_sindo.html
 */
function intensityToPgaGal(intensity: number): number {
  if (intensity <= 0) return 0;
  return Math.pow(10, (intensity - 0.94) / 2);
}

/**
 * Estimate SCRAM (automatic reactor shutdown) likelihood from PGA.
 *
 * Japanese nuclear plants have seismic automatic shutdown systems (地震感知器)
 * that trigger reactor trip when observed ground acceleration exceeds a
 * design-specific setpoint.
 *
 * Historical SCRAM trigger levels (NRA 原子力規制委員会):
 *   - Pre-2006 (S1 design basis): ~120 gal horizontal at reactor building base
 *   - Post-2006 (Ss design basis): 450-993 gal depending on plant
 *     (e.g., Sendai: 620 gal, Ohi: 856 gal, Mihama: 993 gal)
 *   - Actual seismic SCRAM setpoints are typically lower than Ss, around
 *     120-200 gal for most plants.
 *
 * Historical events:
 *   - 2007 NCO earthquake: Kashiwazaki-Kariwa, 680 gal observed, all 7 units tripped
 *   - 2011 Tohoku: Onagawa, ~540 gal observed, safe automatic shutdown
 *   - 2016 Kumamoto: Sendai, ~8 gal observed (distant), no SCRAM
 *
 * Reference: NRA "新規制基準の概要" (Overview of New Regulatory Requirements);
 * each plant's "設置変更許可申請書" (Installation Change Permit Application)
 * documents the specific Ss and SCRAM setpoint values.
 *
 * The thresholds below are conservative approximations for the visualization.
 * Actual SCRAM decisions depend on plant-specific setpoints and observed
 * acceleration at the reactor building, not at the free-field surface.
 */
function computeScramLikelihood(pgaGal: number, status: PlantStatus): ScramLikelihood {
  if (status !== 'operating') return 'none';
  if (pgaGal >= 200) return 'certain';
  if (pgaGal >= 120) return 'likely';
  if (pgaGal >= 80) return 'possible';
  if (pgaGal >= 40) return 'unlikely';
  return 'none';
}

function computeSiteAssessment(
  plant: PowerPlant,
  event: EarthquakeEvent | null,
): { intensity: number; pgaGal: number; scram: ScramLikelihood } {
  if (!event || plant.type !== 'nuclear') {
    return { intensity: 0, pgaGal: 0, scram: 'none' };
  }

  const surfaceDist = haversine(event.lat, event.lng, plant.lat, plant.lng);
  const hypo = Math.sqrt(surfaceDist * surfaceDist + event.depth_km * event.depth_km);
  const result = computeGmpe({
    Mw: event.magnitude,
    depth_km: event.depth_km,
    distance_km: Math.max(hypo, 3),
    faultType: event.faultType,
  });

  const pgaGal = intensityToPgaGal(result.jmaIntensity);
  return {
    intensity: result.jmaIntensity,
    pgaGal,
    scram: computeScramLikelihood(pgaGal, plant.status),
  };
}

// ── Power Plant Catalog ──────────────────────────────────────

export const POWER_PLANTS: PowerPlant[] = [
  // Nuclear Plants
  { id: 'npp-tomari', name: '泊発電所', nameEn: 'Tomari', lat: 43.0367, lng: 140.5122, type: 'nuclear', status: 'shutdown', capacityMw: 2070, units: 3, region: 'hokkaido' },
  { id: 'npp-higashidori', name: '東通原子力発電所', nameEn: 'Higashidori', lat: 41.1847, lng: 141.3858, type: 'nuclear', status: 'shutdown', capacityMw: 1100, units: 1, region: 'tohoku' },
  { id: 'npp-onagawa', name: '女川原子力発電所', nameEn: 'Onagawa', lat: 38.4028, lng: 141.5019, type: 'nuclear', status: 'operating', capacityMw: 2174, units: 3, region: 'tohoku' },
  { id: 'npp-fukushima1', name: '福島第一原子力発電所', nameEn: 'Fukushima Daiichi', lat: 37.4211, lng: 141.0328, type: 'nuclear', status: 'decommissioning', capacityMw: 0, units: 6, region: 'tohoku' },
  { id: 'npp-fukushima2', name: '福島第二原子力発電所', nameEn: 'Fukushima Daini', lat: 37.3169, lng: 141.0250, type: 'nuclear', status: 'decommissioning', capacityMw: 0, units: 4, region: 'tohoku' },
  { id: 'npp-tokai2', name: '東海第二発電所', nameEn: 'Tokai Daini', lat: 36.4667, lng: 140.6056, type: 'nuclear', status: 'shutdown', capacityMw: 1100, units: 1, region: 'kanto' },
  { id: 'npp-kashiwazaki', name: '柏崎刈羽原子力発電所', nameEn: 'Kashiwazaki-Kariwa', lat: 37.4264, lng: 138.5958, type: 'nuclear', status: 'shutdown', capacityMw: 8212, units: 7, region: 'chubu' },
  { id: 'npp-shika', name: '志賀原子力発電所', nameEn: 'Shika', lat: 37.0606, lng: 136.7269, type: 'nuclear', status: 'shutdown', capacityMw: 1898, units: 2, region: 'chubu' },
  { id: 'npp-hamaoka', name: '浜岡原子力発電所', nameEn: 'Hamaoka', lat: 34.6236, lng: 138.1433, type: 'nuclear', status: 'shutdown', capacityMw: 3617, units: 3, region: 'chubu' },
  { id: 'npp-tsuruga', name: '敦賀発電所', nameEn: 'Tsuruga', lat: 35.7547, lng: 136.0222, type: 'nuclear', status: 'shutdown', capacityMw: 1517, units: 2, region: 'kansai' },
  { id: 'npp-mihama', name: '美浜発電所', nameEn: 'Mihama', lat: 35.7014, lng: 135.9631, type: 'nuclear', status: 'operating', capacityMw: 826, units: 1, region: 'kansai' },
  { id: 'npp-ohi', name: '大飯発電所', nameEn: 'Ohi', lat: 35.5414, lng: 135.6553, type: 'nuclear', status: 'operating', capacityMw: 2360, units: 2, region: 'kansai' },
  { id: 'npp-takahama', name: '高浜発電所', nameEn: 'Takahama', lat: 35.5222, lng: 135.5019, type: 'nuclear', status: 'operating', capacityMw: 3392, units: 4, region: 'kansai' },
  { id: 'npp-shimane', name: '島根原子力発電所', nameEn: 'Shimane', lat: 35.5389, lng: 132.9994, type: 'nuclear', status: 'operating', capacityMw: 1373, units: 2, region: 'chugoku' },
  { id: 'npp-ikata', name: '伊方発電所', nameEn: 'Ikata', lat: 33.4908, lng: 132.3128, type: 'nuclear', status: 'operating', capacityMw: 890, units: 1, region: 'shikoku' },
  { id: 'npp-genkai', name: '玄海原子力発電所', nameEn: 'Genkai', lat: 33.5153, lng: 129.8364, type: 'nuclear', status: 'operating', capacityMw: 2319, units: 2, region: 'kyushu' },
  { id: 'npp-sendai', name: '川内原子力発電所', nameEn: 'Sendai', lat: 31.8333, lng: 130.1903, type: 'nuclear', status: 'operating', capacityMw: 1780, units: 2, region: 'kyushu' },
  { id: 'npp-ohma', name: '大間原子力発電所', nameEn: 'Ohma', lat: 41.5089, lng: 140.9092, type: 'nuclear', status: 'shutdown', capacityMw: 1383, units: 1, region: 'tohoku' },

  // Major Thermal Plants (>1GW capacity)
  { id: 'tpp-kashima', name: '鹿島火力発電所', nameEn: 'Kashima Thermal', lat: 35.9617, lng: 140.7003, type: 'thermal', status: 'operating', capacityMw: 4400, units: 6, region: 'kanto' },
  { id: 'tpp-hekinan', name: '碧南火力発電所', nameEn: 'Hekinan Thermal', lat: 34.8333, lng: 136.9833, type: 'thermal', status: 'operating', capacityMw: 4100, units: 5, region: 'chubu' },
  { id: 'tpp-chita', name: '知多火力発電所', nameEn: 'Chita Thermal', lat: 34.9750, lng: 136.8500, type: 'thermal', status: 'operating', capacityMw: 3966, units: 6, region: 'chubu' },
  { id: 'tpp-maizuru', name: '舞鶴発電所', nameEn: 'Maizuru Thermal', lat: 35.4833, lng: 135.3833, type: 'thermal', status: 'operating', capacityMw: 1800, units: 2, region: 'kansai' },
  { id: 'tpp-matsuura', name: '松浦火力発電所', nameEn: 'Matsuura Thermal', lat: 33.3500, lng: 129.6667, type: 'thermal', status: 'operating', capacityMw: 2000, units: 2, region: 'kyushu' },
];

// ── Tooltip ──────────────────────────────────────────────────

const SCRAM_LABELS: Record<ScramLikelihood, { text: string; color: string }> = {
  none: { text: '', color: '' },
  unlikely: { text: 'SCRAM unlikely', color: '#94a3b8' },
  possible: { text: 'SCRAM possible', color: '#fb923c' },
  likely: { text: 'SCRAM LIKELY', color: '#ef4444' },
  certain: { text: 'SCRAM CERTAIN', color: '#ef4444' },
};

export function formatPowerTooltip(p: PowerPlant, event: EarthquakeEvent | null): string {
  const inZone = isInImpactZone(p.lat, p.lng, event);
  const { intensity, pgaGal, scram } = computeSiteAssessment(p, event);
  const typeLabel = p.type === 'nuclear' ? 'Nuclear' : 'Thermal';
  const statusLabel = p.status === 'operating' ? '● Operating'
    : p.status === 'decommissioning' ? '◌ Decommissioning'
    : '○ Shutdown';
  const statusColor = p.status === 'operating' ? '#6ee7b7'
    : p.status === 'decommissioning' ? '#c8504660'
    : '#94a3b8';

  let scramHtml = '';
  if (scram !== 'none' && p.type === 'nuclear') {
    const label = SCRAM_LABELS[scram];
    scramHtml = `
      <div style="color:${label.color};font-weight:600;margin-top:4px">${label.text}</div>
      <div style="opacity:0.6;font-size:10px">
        Est. intensity ${intensity.toFixed(1)} · PGA ~${Math.round(pgaGal)} gal
      </div>`;
  }

  let zoneHtml = '';
  if (inZone && !scramHtml) {
    zoneHtml = '<div style="color:#ef4444;font-weight:600;margin-top:4px">IN IMPACT ZONE — Verify plant status</div>';
  }

  return `
    <div style="font-weight:600;font-size:12px;margin-bottom:3px">${p.name}</div>
    <div style="opacity:0.7;font-size:11px">${p.nameEn}</div>
    <div style="margin-top:4px;display:flex;gap:12px">
      <span>${typeLabel}</span>
      <span style="color:${statusColor}">${statusLabel}</span>
    </div>
    <div style="opacity:0.6;font-size:10px;margin-top:2px">
      ${p.capacityMw > 0 ? `${p.capacityMw} MW · ` : ''}${p.units} unit${p.units > 1 ? 's' : ''}
    </div>
    ${scramHtml}
    ${zoneHtml}
  `;
}

// ── Layer Factory ────────────────────────────────────────────

export function createPowerLayers(
  selectedEvent: EarthquakeEvent | null,
  zoom: number,
  sWaveRadiusKm: number | null = null,
): Layer[] {
  const minZoom = 4;
  if (zoom < minZoom) return [];

  const showThermal = zoom >= 5;
  const filtered = showThermal
    ? POWER_PLANTS
    : POWER_PLANTS.filter((p) => p.type === 'nuclear');

  const data: PowerDatum[] = filtered.map((p) => {
    const assessment = computeSiteAssessment(p, selectedEvent);
    let inZone = isInImpactZone(p.lat, p.lng, selectedEvent);
    let scramLikelihood = assessment.scram;

    // S-wave cascade: override to pre-impact state if wave hasn't reached this plant yet
    if (sWaveRadiusKm !== null && selectedEvent) {
      const distKm = haversine(selectedEvent.lat, selectedEvent.lng, p.lat, p.lng);
      if (distKm > sWaveRadiusKm) {
        scramLikelihood = 'none';
        inZone = false;
      }
    }

    return {
      ...p,
      inZone,
      scramLikelihood,
      estimatedIntensity: assessment.intensity,
      estimatedPgaGal: assessment.pgaGal,
    };
  });

  const layers: Layer[] = [];

  // SCRAM glow rings — pulsing red circles behind SCRAM-likely nuclear plants
  const scramPlants = data.filter((d) =>
    d.type === 'nuclear' && (d.scramLikelihood === 'likely' || d.scramLikelihood === 'certain'),
  );
  if (scramPlants.length > 0) {
    layers.push(new ScatterplotLayer<PowerDatum>({
      id: 'power-scram-glow',
      data: scramPlants,
      pickable: false,
      stroked: true,
      filled: true,
      radiusUnits: 'pixels',
      lineWidthUnits: 'pixels',
      // Pulse is driven by compositor's rAF via updateTriggers change
      getPosition: (d) => [d.lng, d.lat],
      getRadius: 24,
      getFillColor: [239, 68, 68, 25],
      getLineColor: [239, 68, 68, 80],
      getLineWidth: 1.5,
      updateTriggers: { getRadius: [selectedEvent?.id, sWaveRadiusKm] },
    }));
  }

  layers.push(new IconLayer<PowerDatum>({
    id: 'power',
    data,
    pickable: true,
    autoHighlight: true,
    highlightColor: [251, 191, 36, 200],
    iconAtlas: ICON_ATLAS_URL,
    iconMapping: ICON_MAPPING,
    getIcon: (d) => d.type === 'nuclear' ? 'nuclear' : 'thermal',
    getPosition: (d) => [d.lng, d.lat],
    getSize: (d) => {
      // SCRAM plants get largest size for immediate visibility
      if (d.scramLikelihood === 'certain' || d.scramLikelihood === 'likely') return 28;
      if (d.scramLikelihood === 'possible') return 24;
      if (d.type === 'nuclear') return d.inZone ? 24 : 20;
      return d.inZone ? 18 : 14;
    },
    sizeUnits: 'pixels',
    sizeMinPixels: 10,
    getColor: (d): RGBA => {
      // SCRAM inference overrides everything for nuclear
      if (d.scramLikelihood === 'certain' || d.scramLikelihood === 'likely') return SCRAM_LIKELY;
      if (d.scramLikelihood === 'possible') return SCRAM_POSSIBLE;
      if (d.inZone) return ZONE_COLOR;
      if (d.status === 'decommissioning') return DECOM_COLOR;
      if (d.type === 'nuclear') {
        return d.status === 'operating' ? NUCLEAR_COLOR : NUCLEAR_OFF;
      }
      return THERMAL_COLOR;
    },
    updateTriggers: {
      getColor: [selectedEvent?.id, sWaveRadiusKm],
      getSize: [selectedEvent?.id, sWaveRadiusKm],
    },
  }));

  // Labels for nuclear plants at z6+
  if (zoom >= 6) {
    const nuclear = data.filter((d) => d.type === 'nuclear');
    layers.push(new TextLayer<PowerDatum>({
      id: 'power-labels',
      data: nuclear,
      pickable: false,
      getPosition: (d) => [d.lng, d.lat],
      getText: (d) => {
        if (d.scramLikelihood === 'certain' || d.scramLikelihood === 'likely') {
          return `⚠ ${d.nameEn} — SCRAM`;
        }
        if (d.scramLikelihood === 'possible') {
          return `⚡ ${d.nameEn}`;
        }
        const prefix = d.status === 'decommissioning' ? '⊘ '
          : d.status === 'operating' ? '⚛ '
          : '';
        return `${prefix}${d.nameEn}`;
      },
      getSize: (d) => {
        if (d.scramLikelihood === 'likely' || d.scramLikelihood === 'certain') return 12;
        return 10;
      },
      getColor: (d) => {
        if (d.scramLikelihood === 'certain' || d.scramLikelihood === 'likely') return [239, 68, 68, 255];
        if (d.scramLikelihood === 'possible') return [251, 146, 60, 240];
        if (d.inZone) return [239, 68, 68, 220];
        return [251, 191, 36, 180];
      },
      getTextAnchor: 'start' as const,
      getAlignmentBaseline: 'center' as const,
      getPixelOffset: [12, 0],
      fontFamily: 'Noto Sans JP, system-ui, sans-serif',
      fontWeight: 500,
      outlineWidth: 2,
      outlineColor: [10, 14, 20, 200],
      updateTriggers: {
        getText: [selectedEvent?.id, sWaveRadiusKm],
        getColor: [selectedEvent?.id, sWaveRadiusKm],
        getSize: [selectedEvent?.id, sWaveRadiusKm],
      },
    }));
  }

  return layers;
}
