/**
 * Rail Layer — Japan's Shinkansen and major rail corridors.
 *
 * During earthquake events, rail operations halt automatically (UrEDAS).
 * This layer shows which corridors are in the impact zone and likely
 * suspended, helping operators assess transportation disruption.
 *
 * Visual:
 *   Normal: line-specific colors (Tokaido=blue, Tohoku=green, etc.)
 *   Impact zone: red highlight for affected segments
 */

import { PathLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '../types';
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
}

const AFFECTED_COLOR: RGBA = [239, 68, 68, 220];

// ── Shinkansen Routes ────────────────────────────────────────
// Simplified waypoints (major stations). Sufficient for national overview.

export const RAIL_ROUTES: RailRoute[] = [
  {
    id: 'tokaido',
    name: '東海道新幹線',
    nameEn: 'Tokaido Shinkansen',
    type: 'shinkansen',
    color: [96, 165, 250, 200], // blue
    path: [
      [139.7671, 35.6812], // Tokyo
      [139.6178, 35.5075], // Shin-Yokohama
      [139.1553, 35.2564], // Odawara
      [139.0769, 35.1039], // Atami
      [138.9110, 35.1265], // Mishima
      [138.3891, 34.9719], // Shizuoka
      [137.7344, 34.7038], // Hamamatsu
      [136.8815, 35.1709], // Nagoya
      [135.7586, 34.9855], // Kyoto
      [135.5001, 34.7335], // Shin-Osaka
    ],
  },
  {
    id: 'sanyo',
    name: '山陽新幹線',
    nameEn: 'Sanyo Shinkansen',
    type: 'shinkansen',
    color: [96, 165, 250, 200], // blue (continuation)
    path: [
      [135.5001, 34.7335], // Shin-Osaka
      [135.1955, 34.6915], // Shin-Kobe
      [134.6914, 34.8267], // Himeji
      [133.9184, 34.6653], // Okayama
      [133.3625, 34.4867], // Fukuyama
      [132.4757, 34.3977], // Hiroshima
      [131.4636, 34.0887], // Shin-Yamaguchi
      [130.8820, 33.8856], // Kokura
      [130.4206, 33.5898], // Hakata
    ],
  },
  {
    id: 'tohoku',
    name: '東北新幹線',
    nameEn: 'Tohoku Shinkansen',
    type: 'shinkansen',
    color: [110, 231, 183, 200], // green
    path: [
      [139.7671, 35.6812], // Tokyo
      [139.6501, 35.8616], // Omiya
      [140.1069, 36.3911], // Utsunomiya
      [140.3616, 37.7544], // Koriyama
      [140.4553, 37.8987], // Fukushima
      [140.8824, 38.2606], // Sendai
      [141.1072, 39.0139], // Ichinoseki
      [141.1376, 39.7015], // Morioka
      [140.7247, 40.8240], // Shin-Aomori
    ],
  },
  {
    id: 'hokkaido',
    name: '北海道新幹線',
    nameEn: 'Hokkaido Shinkansen',
    type: 'shinkansen',
    color: [148, 163, 184, 180], // slate
    path: [
      [140.7247, 40.8240], // Shin-Aomori
      [140.3247, 41.2140], // Okutsugaru-Imabetsu
      [140.6531, 41.7762], // Kikonai
      [140.7267, 41.9046], // Shin-Hakodate-Hokuto
    ],
  },
  {
    id: 'joetsu',
    name: '上越新幹線',
    nameEn: 'Joetsu Shinkansen',
    type: 'shinkansen',
    color: [251, 191, 36, 180], // amber
    path: [
      [139.6501, 35.8616], // Omiya
      [139.0235, 36.3914], // Takasaki
      [138.9285, 36.9326], // Echigo-Yuzawa
      [139.0582, 37.6471], // Nagaoka
      [139.0388, 37.9137], // Niigata
    ],
  },
  {
    id: 'hokuriku',
    name: '北陸新幹線',
    nameEn: 'Hokuriku Shinkansen',
    type: 'shinkansen',
    color: [167, 139, 250, 180], // purple
    path: [
      [139.6501, 35.8616], // Omiya
      [139.0235, 36.3914], // Takasaki
      [138.2529, 36.2310], // Karuizawa
      [138.1811, 36.5943], // Nagano
      [137.2115, 36.6953], // Toyama
      [136.6637, 36.5782], // Kanazawa
      [136.1865, 35.9452], // Fukui
      [136.0222, 35.6484], // Tsuruga
    ],
  },
  {
    id: 'kyushu',
    name: '九州新幹線',
    nameEn: 'Kyushu Shinkansen',
    type: 'shinkansen',
    color: [239, 68, 68, 180], // red
    path: [
      [130.4206, 33.5898], // Hakata
      [130.5479, 33.3593], // Shin-Tosu
      [130.7183, 32.8063], // Kumamoto
      [130.6880, 32.1031], // Shin-Yatsushiro
      [130.5475, 31.7266], // Sendai (Kagoshima)
      [130.5410, 31.5840], // Kagoshima-Chuo
    ],
  },
  {
    id: 'nishi-kyushu',
    name: '西九州新幹線',
    nameEn: 'Nishi-Kyushu Shinkansen',
    type: 'shinkansen',
    color: [239, 68, 68, 140], // red (dim)
    path: [
      [130.1082, 33.1594], // Takeo-Onsen
      [129.9440, 32.9496], // Ureshino-Onsen
      [129.8640, 32.7924], // Shin-Omura
      [129.8735, 32.7718], // Nagasaki
    ],
  },
];

// ── Impact Check ─────────────────────────────────────────────

function isRouteAffected(route: RailRoute, event: EarthquakeEvent | null): boolean {
  if (!event) return false;
  const radius = impactRadiusKm(event.magnitude);
  return route.path.some(([lng, lat]) =>
    haversineKm(lat, lng, event.lat, event.lng) <= radius,
  );
}

// ── Tooltip ──────────────────────────────────────────────────

export function formatRailTooltip(route: RailRoute, event: EarthquakeEvent | null): string {
  const affected = isRouteAffected(route, event);
  const typeLabel = route.type === 'shinkansen' ? 'Shinkansen' : 'Conventional';
  const stations = route.path.length;

  return `
    <div style="font-weight:600;font-size:12px;margin-bottom:3px">${route.name}</div>
    <div style="opacity:0.7;font-size:11px">${route.nameEn}</div>
    <div style="margin-top:4px;opacity:0.6">${typeLabel} · ${stations} stations</div>
    ${affected ? '<div style="color:#ef4444;font-weight:600;margin-top:4px">LIKELY SUSPENDED — UrEDAS triggered</div>' : ''}
  `;
}

// ── Layer Factory ────────────────────────────────────────────

export function createRailLayers(
  selectedEvent: EarthquakeEvent | null,
  zoom: number,
): Layer[] {
  // Shinkansen visible at national zoom (z4+)
  if (zoom < 4) return [];

  const data: RailDatum[] = RAIL_ROUTES.map((r) => ({
    ...r,
    affected: isRouteAffected(r, selectedEvent),
  }));

  return [
    new PathLayer<RailDatum>({
      id: 'rail',
      data,
      pickable: true,
      autoHighlight: true,
      highlightColor: [125, 211, 252, 160],
      widthUnits: 'pixels',
      widthMinPixels: 1,
      getPath: (d) => d.path,
      getWidth: (d) => d.type === 'shinkansen' ? 3 : 1.5,
      getColor: (d) => d.affected ? AFFECTED_COLOR : d.color,
      updateTriggers: {
        getColor: [selectedEvent?.id],
      },
    }),
  ];
}
