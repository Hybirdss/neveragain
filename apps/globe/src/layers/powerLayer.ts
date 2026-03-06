/**
 * Power Layer — Nuclear and major thermal power plants.
 *
 * Critical for earthquake operations: Fukushima proved that nuclear plant
 * status is one of the first things operators need to assess.
 *
 * Visual:
 *   Nuclear: large amber markers (⚛), red when in impact zone
 *   Thermal: smaller gray markers, red when in impact zone
 *   Decommissioning: dim, still shown (radiation risk persists)
 */

import { IconLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '../types';
import { isInImpactZone } from './impactZone';
import { ICON_ATLAS_URL, ICON_MAPPING } from './iconAtlas';

type RGBA = [number, number, number, number];

export type PlantType = 'nuclear' | 'thermal';
export type PlantStatus = 'operating' | 'shutdown' | 'decommissioning';

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
}

const NUCLEAR_COLOR: RGBA = [251, 191, 36, 220];    // amber
const NUCLEAR_OFF: RGBA = [251, 191, 36, 100];      // dim amber
const THERMAL_COLOR: RGBA = [148, 163, 184, 150];   // slate
const ZONE_COLOR: RGBA = [239, 68, 68, 240];        // red
const DECOM_COLOR: RGBA = [148, 100, 60, 100];      // brown-dim

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

  // Major Thermal Plants (top capacity)
  { id: 'tpp-kashima', name: '鹿島火力発電所', nameEn: 'Kashima Thermal', lat: 35.9617, lng: 140.7003, type: 'thermal', status: 'operating', capacityMw: 4400, units: 6, region: 'kanto' },
  { id: 'tpp-hekinan', name: '碧南火力発電所', nameEn: 'Hekinan Thermal', lat: 34.8333, lng: 136.9833, type: 'thermal', status: 'operating', capacityMw: 4100, units: 5, region: 'chubu' },
  { id: 'tpp-chita', name: '知多火力発電所', nameEn: 'Chita Thermal', lat: 34.9750, lng: 136.8500, type: 'thermal', status: 'operating', capacityMw: 3966, units: 6, region: 'chubu' },
  { id: 'tpp-maizuru', name: '舞鶴発電所', nameEn: 'Maizuru Thermal', lat: 35.4833, lng: 135.3833, type: 'thermal', status: 'operating', capacityMw: 1800, units: 2, region: 'kansai' },
  { id: 'tpp-matsuura', name: '松浦火力発電所', nameEn: 'Matsuura Thermal', lat: 33.3500, lng: 129.6667, type: 'thermal', status: 'operating', capacityMw: 2000, units: 2, region: 'kyushu' },
];

// ── Tooltip ──────────────────────────────────────────────────

export function formatPowerTooltip(p: PowerPlant, event: EarthquakeEvent | null): string {
  const inZone = isInImpactZone(p.lat, p.lng, event);
  const typeLabel = p.type === 'nuclear' ? 'Nuclear' : 'Thermal';
  const statusLabel = p.status === 'operating' ? '● Operating'
    : p.status === 'decommissioning' ? '◌ Decommissioning'
    : '○ Shutdown';
  const statusColor = p.status === 'operating' ? '#6ee7b7'
    : p.status === 'decommissioning' ? '#c8504660'
    : '#94a3b8';

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
    ${inZone ? '<div style="color:#ef4444;font-weight:600;margin-top:4px">IN IMPACT ZONE — Verify plant status</div>' : ''}
  `;
}

// ── Layer Factory ────────────────────────────────────────────

export function createPowerLayers(
  selectedEvent: EarthquakeEvent | null,
  zoom: number,
): Layer[] {
  // Nuclear always visible; thermal at z6+
  const minZoom = 4;
  if (zoom < minZoom) return [];

  const showThermal = zoom >= 6;
  const filtered = showThermal
    ? POWER_PLANTS
    : POWER_PLANTS.filter((p) => p.type === 'nuclear');

  const data: PowerDatum[] = filtered.map((p) => ({
    ...p,
    inZone: isInImpactZone(p.lat, p.lng, selectedEvent),
  }));

  const layers: Layer[] = [];

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
      if (d.type === 'nuclear') return d.inZone ? 24 : 20;
      return d.inZone ? 18 : 14;
    },
    sizeUnits: 'pixels',
    sizeMinPixels: 10,
    getColor: (d): RGBA => {
      if (d.inZone) return ZONE_COLOR;
      if (d.status === 'decommissioning') return DECOM_COLOR;
      if (d.type === 'nuclear') {
        return d.status === 'operating' ? NUCLEAR_COLOR : NUCLEAR_OFF;
      }
      return THERMAL_COLOR;
    },
    updateTriggers: {
      getColor: [selectedEvent?.id],
      getSize: [selectedEvent?.id],
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
        const prefix = d.status === 'decommissioning' ? '⊘ '
          : d.status === 'operating' ? '⚛ '
          : '';
        return `${prefix}${d.nameEn}`;
      },
      getSize: 10,
      getColor: (d) => d.inZone ? [239, 68, 68, 220] : [251, 191, 36, 180],
      getTextAnchor: 'start' as const,
      getAlignmentBaseline: 'center' as const,
      getPixelOffset: [12, 0],
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
