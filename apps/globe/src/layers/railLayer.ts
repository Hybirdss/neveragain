/**
 * Rail Layer — Japan's Shinkansen and major rail corridors.
 *
 * Color priority:
 *   1. Live ODPT status (suspended=red, delayed=amber, partial=amber dim)
 *   2. Earthquake impact zone inference (if no live status)
 *   3. Default line color
 *
 * Suspended lines use dashed paths for instant visual recognition.
 */

import { PathLayer, TextLayer } from '@deck.gl/layers';
import { PathStyleExtension } from '@deck.gl/extensions';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent, RailLineStatus, RailOperationStatus } from '../types';
import { haversineKm, impactRadiusKm } from './impactZone';

type RGBA = [number, number, number, number];
type Coord = [number, number]; // [lng, lat]

export interface RailRoute {
  id: string;
  name: string;
  nameEn: string;
  type: 'shinkansen' | 'conventional';
  path: Coord[];
  color: RGBA;
}

interface RailDatum extends RailRoute {
  affected: boolean;
  liveStatus: RailOperationStatus | null;
  liveCause?: string;
}

const AFFECTED_COLOR: RGBA = [239, 68, 68, 220];
const SUSPENDED_COLOR: RGBA = [239, 68, 68, 240];
const DELAYED_COLOR: RGBA = [251, 191, 36, 220];
const PARTIAL_COLOR: RGBA = [251, 191, 36, 160];

// ── Shinkansen Routes ────────────────────────────────────────

export const RAIL_ROUTES: RailRoute[] = [
  {
    id: 'tokaido',
    name: '東海道新幹線',
    nameEn: 'Tokaido Shinkansen',
    type: 'shinkansen',
    color: [96, 165, 250, 200],
    path: [
      [139.7671, 35.6812], [139.6178, 35.5075], [139.1553, 35.2564],
      [139.0769, 35.1039], [138.9110, 35.1265], [138.3891, 34.9719],
      [137.7344, 34.7038], [136.8815, 35.1709], [135.7586, 34.9855],
      [135.5001, 34.7335],
    ],
  },
  {
    id: 'sanyo',
    name: '山陽新幹線',
    nameEn: 'Sanyo Shinkansen',
    type: 'shinkansen',
    color: [96, 165, 250, 200],
    path: [
      [135.5001, 34.7335], [135.1955, 34.6915], [134.6914, 34.8267],
      [133.9184, 34.6653], [133.3625, 34.4867], [132.4757, 34.3977],
      [131.4636, 34.0887], [130.8820, 33.8856], [130.4206, 33.5898],
    ],
  },
  {
    id: 'tohoku',
    name: '東北新幹線',
    nameEn: 'Tohoku Shinkansen',
    type: 'shinkansen',
    color: [110, 231, 183, 200],
    path: [
      [139.7671, 35.6812], [139.6501, 35.8616], [140.1069, 36.3911],
      [140.3616, 37.7544], [140.4553, 37.8987], [140.8824, 38.2606],
      [141.1072, 39.0139], [141.1376, 39.7015], [140.7247, 40.8240],
    ],
  },
  {
    id: 'hokkaido',
    name: '北海道新幹線',
    nameEn: 'Hokkaido Shinkansen',
    type: 'shinkansen',
    color: [148, 163, 184, 180],
    path: [
      [140.7247, 40.8240], [140.3247, 41.2140],
      [140.6531, 41.7762], [140.7267, 41.9046],
    ],
  },
  {
    id: 'joetsu',
    name: '上越新幹線',
    nameEn: 'Joetsu Shinkansen',
    type: 'shinkansen',
    color: [251, 191, 36, 180],
    path: [
      [139.6501, 35.8616], [139.0235, 36.3914], [138.9285, 36.9326],
      [139.0582, 37.6471], [139.0388, 37.9137],
    ],
  },
  {
    id: 'hokuriku',
    name: '北陸新幹線',
    nameEn: 'Hokuriku Shinkansen',
    type: 'shinkansen',
    color: [167, 139, 250, 180],
    path: [
      [139.6501, 35.8616], [139.0235, 36.3914], [138.2529, 36.2310],
      [138.1811, 36.5943], [137.2115, 36.6953], [136.6637, 36.5782],
      [136.1865, 35.9452], [136.0222, 35.6484],
    ],
  },
  {
    id: 'kyushu',
    name: '九州新幹線',
    nameEn: 'Kyushu Shinkansen',
    type: 'shinkansen',
    color: [239, 68, 68, 180],
    path: [
      [130.4206, 33.5898], [130.5479, 33.3593], [130.7183, 32.8063],
      [130.6880, 32.1031], [130.5475, 31.7266], [130.5410, 31.5840],
    ],
  },
  {
    id: 'nishi-kyushu',
    name: '西九州新幹線',
    nameEn: 'Nishi-Kyushu Shinkansen',
    type: 'shinkansen',
    color: [239, 68, 68, 140],
    path: [
      [130.1082, 33.1594], [129.9440, 32.9496],
      [129.8640, 32.7924], [129.8735, 32.7718],
    ],
  },
];

// ── Impact Check ─────────────────────────────────────────────

function isRouteAffected(route: RailRoute, event: EarthquakeEvent | null): boolean {
  if (!event) return false;
  const radius = impactRadiusKm(event.magnitude, event.depth_km, event.faultType);
  return route.path.some(([lng, lat]) =>
    haversineKm(lat, lng, event.lat, event.lng) <= radius,
  );
}

// ── Tooltip ──────────────────────────────────────────────────

const STATUS_LABELS: Record<RailOperationStatus, { text: string; color: string }> = {
  normal: { text: 'Normal Operations', color: '#6ee7b7' },
  delayed: { text: 'Delayed', color: '#fbbf24' },
  suspended: { text: 'SUSPENDED', color: '#ef4444' },
  partial: { text: 'Partial Service', color: '#fbbf24' },
  unknown: { text: 'Status Unknown', color: '#94a3b8' },
};

export function formatRailTooltip(
  route: RailRoute,
  event: EarthquakeEvent | null,
  statuses?: RailLineStatus[],
): string {
  const affected = isRouteAffected(route, event);
  const live = statuses?.find((s) => s.lineId === route.id);
  const typeLabel = route.type === 'shinkansen' ? 'Shinkansen' : 'Conventional';
  const stations = route.path.length;

  let statusHtml = '';
  if (live && live.status !== 'normal') {
    const label = STATUS_LABELS[live.status];
    statusHtml = `
      <div style="color:${label.color};font-weight:600;margin-top:4px">
        ${label.text}${live.cause ? ` — ${live.cause}` : ''}
      </div>`;
  } else if (affected) {
    statusHtml = '<div style="color:#ef4444;font-weight:600;margin-top:4px">LIKELY SUSPENDED — UrEDAS triggered</div>';
  } else if (live) {
    statusHtml = `<div style="color:#6ee7b7;font-size:10px;margin-top:4px">Normal operations</div>`;
  }

  return `
    <div style="font-weight:600;font-size:12px;margin-bottom:3px">${route.name}</div>
    <div style="opacity:0.7;font-size:11px">${route.nameEn}</div>
    <div style="margin-top:4px;opacity:0.6">${typeLabel} · ${stations} stations</div>
    ${statusHtml}
  `;
}

// ── Layer Factory ────────────────────────────────────────────

export function createRailLayers(
  selectedEvent: EarthquakeEvent | null,
  zoom: number,
  railStatuses: RailLineStatus[] = [],
  sWaveRadiusKm: number | null = null,
): Layer[] {
  if (zoom < 4) return [];

  const statusMap = new Map(railStatuses.map((s) => [s.lineId, s]));

  const data: RailDatum[] = RAIL_ROUTES.map((r) => {
    let affected = isRouteAffected(r, selectedEvent);

    // S-wave cascade: override to unaffected if wave hasn't reached any segment point
    if (affected && sWaveRadiusKm !== null && selectedEvent) {
      const anyReached = r.path.some(([lng, lat]) =>
        haversineKm(lat, lng, selectedEvent.lat, selectedEvent.lng) <= sWaveRadiusKm,
      );
      if (!anyReached) {
        affected = false;
      }
    }

    return {
      ...r,
      affected,
      liveStatus: statusMap.get(r.id)?.status ?? null,
      liveCause: statusMap.get(r.id)?.cause,
    };
  });

  const layers: Layer[] = [];

  // Main path layer — dash props come from PathStyleExtension
  layers.push(new PathLayer<RailDatum>({
    id: 'rail',
    data,
    pickable: true,
    autoHighlight: true,
    highlightColor: [125, 211, 252, 160],
    widthUnits: 'pixels',
    widthMinPixels: 1,
    getPath: (d) => d.path,
    getWidth: (d) => {
      if (d.liveStatus === 'suspended') return 4;
      if (d.liveStatus === 'delayed' || d.liveStatus === 'partial') return 3.5;
      return d.type === 'shinkansen' ? 3 : 1.5;
    },
    getColor: (d): RGBA => {
      if (d.liveStatus === 'suspended') return SUSPENDED_COLOR;
      if (d.liveStatus === 'delayed') return DELAYED_COLOR;
      if (d.liveStatus === 'partial') return PARTIAL_COLOR;
      if (d.affected) return AFFECTED_COLOR;
      return d.color;
    },
    // PathStyleExtension adds getDashArray/dashJustified
    ...({
      getDashArray: (d: RailDatum): [number, number] => {
        if (d.liveStatus === 'suspended') return [8, 4];
        if (d.liveStatus === 'partial') return [12, 4];
        return [0, 0];
      },
      dashJustified: true,
    } as Record<string, unknown>),
    extensions: [new PathStyleExtension({ dash: true })],
    updateTriggers: {
      getColor: [selectedEvent?.id, railStatuses, sWaveRadiusKm],
      getWidth: [railStatuses, sWaveRadiusKm],
      getDashArray: [railStatuses],
    },
  }));

  // Status badges at midpoint of each line (z6+)
  if (zoom >= 6) {
    const badgeData = data.filter((d) =>
      d.liveStatus === 'suspended' || d.liveStatus === 'delayed' || d.liveStatus === 'partial',
    );

    if (badgeData.length > 0) {
      layers.push(new TextLayer<RailDatum>({
        id: 'rail-status-badges',
        data: badgeData,
        pickable: false,
        getPosition: (d) => {
          const mid = Math.floor(d.path.length / 2);
          return d.path[mid];
        },
        getText: (d) => {
          if (d.liveStatus === 'suspended') return '運休';
          if (d.liveStatus === 'delayed') return '遅延';
          if (d.liveStatus === 'partial') return '一部運休';
          return '';
        },
        getSize: 11,
        getColor: (d) => {
          if (d.liveStatus === 'suspended') return [239, 68, 68, 255];
          return [251, 191, 36, 255];
        },
        fontFamily: 'Noto Sans JP, system-ui, sans-serif',
        fontWeight: 700,
        outlineWidth: 3,
        outlineColor: [10, 14, 20, 220],
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        getPixelOffset: [0, -14],
      }));
    }
  }

  return layers;
}
