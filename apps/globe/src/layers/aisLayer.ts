/**
 * AIS Layer — Maritime operational intelligence layer.
 *
 * Purpose: During earthquake events, operators need to immediately see:
 * - Which vessels are in the impact zone
 * - High-priority vessels (passenger ferries, tankers with hazmat)
 * - Vessel heading and speed for situational awareness
 * - Port approach traffic that may need diversion
 *
 * Visual:
 * - Top-down ship hull silhouette (NOT circles — those are earthquakes)
 * - Directional: rotated by course-over-ground
 * - Color: type-coded (cargo=slate, tanker=amber, passenger=cyan, fishing=green)
 * - Event mode: impact zone vessels turn red, size increases
 *
 * Layer stack: ais-trails → ais-vessels
 */

import { IconLayer, PathLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { Vessel, VesselType } from '../data/aisManager';
import type { EarthquakeEvent } from '../types';

type RGBA = [number, number, number, number];

// ── Ship Hull Icon ────────────────────────────────────────────
// Top-down vessel silhouette: pointed bow, wide beam, narrower stern.
// Bridge/superstructure shown as darker rectangle.
// mask: true means alpha channel = opacity, getColor provides fill.

const SHIP_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">',
  '<path d="M12 1 L17 8 L17 17 L15 22 L9 22 L7 17 L7 8 Z" fill="white"/>',
  '<rect x="9" y="12" width="6" height="4" rx="0.5" fill="black" opacity="0.15"/>',
  '</svg>',
].join('');

const ICON_URL = `data:image/svg+xml,${encodeURIComponent(SHIP_SVG)}`;
const ICON_MAPPING = {
  vessel: { x: 0, y: 0, width: 24, height: 24, anchorY: 12, mask: true },
};

// ── Type Colors ───────────────────────────────────────────────

const TYPE_COLORS: Record<VesselType, RGBA> = {
  cargo: [148, 163, 184, 170],     // slate — bulk of traffic
  tanker: [251, 191, 36, 200],     // amber — hazardous cargo
  passenger: [125, 211, 252, 220], // ice blue — human life, high priority
  fishing: [110, 231, 183, 140],   // green — coastal, low priority
  other: [120, 130, 150, 140],     // neutral
};

const IMPACT_NORMAL: RGBA = [255, 120, 80, 230];   // in zone, general
const IMPACT_CRITICAL: RGBA = [255, 50, 50, 255];   // in zone, high priority (passenger/tanker)
const TRAIL_COLOR: RGBA = [100, 130, 160, 30];

// ── Impact Zone Computation ───────────────────────────────────

function impactRadiusKm(mag: number): number {
  return 30 * Math.pow(2, mag - 4);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isHighPriority(type: VesselType): boolean {
  return type === 'passenger' || type === 'tanker';
}

// ── Vessel Size ───────────────────────────────────────────────

function vesselSize(type: VesselType, inImpactZone: boolean): number {
  const base = type === 'passenger' ? 16
    : type === 'tanker' ? 14
    : type === 'cargo' ? 12
    : type === 'fishing' ? 8
    : 10;
  return inImpactZone ? base * 1.4 : base;
}

// ── Maritime Exposure Summary ─────────────────────────────────

export interface MaritimeExposure {
  totalInZone: number;
  passengerCount: number;
  tankerCount: number;
  cargoCount: number;
  fishingCount: number;
  summary: string;
}

export function computeMaritimeExposure(
  vessels: Vessel[],
  selectedEvent: EarthquakeEvent | null,
): MaritimeExposure {
  if (!selectedEvent || vessels.length === 0) {
    return { totalInZone: 0, passengerCount: 0, tankerCount: 0, cargoCount: 0, fishingCount: 0, summary: '' };
  }

  const radius = impactRadiusKm(selectedEvent.magnitude);
  let passenger = 0;
  let tanker = 0;
  let cargo = 0;
  let fishing = 0;

  for (const v of vessels) {
    const dist = haversineKm(v.lat, v.lng, selectedEvent.lat, selectedEvent.lng);
    if (dist <= radius) {
      if (v.type === 'passenger') passenger++;
      else if (v.type === 'tanker') tanker++;
      else if (v.type === 'cargo') cargo++;
      else if (v.type === 'fishing') fishing++;
    }
  }

  const total = passenger + tanker + cargo + fishing;
  if (total === 0) return { totalInZone: 0, passengerCount: 0, tankerCount: 0, cargoCount: 0, fishingCount: 0, summary: '' };

  const parts: string[] = [`${total} vessels in impact zone`];
  if (passenger > 0) parts.push(`${passenger} passenger`);
  if (tanker > 0) parts.push(`${tanker} tanker`);

  return {
    totalInZone: total,
    passengerCount: passenger,
    tankerCount: tanker,
    cargoCount: cargo,
    fishingCount: fishing,
    summary: parts.join(' · '),
  };
}

// ── Tooltip Formatter ─────────────────────────────────────────

export function formatVesselTooltip(v: Vessel, selectedEvent: EarthquakeEvent | null): string {
  const typeLabel = v.type.toUpperCase();
  const speed = v.sog > 0.5 ? `${v.sog.toFixed(1)} kn` : 'Anchored';
  const heading = v.sog > 0.5 ? `HDG ${Math.round(v.cog)}°` : '';
  const priority = isHighPriority(v.type) ? ' — HIGH PRIORITY' : '';

  let zoneInfo = '';
  if (selectedEvent) {
    const radius = impactRadiusKm(selectedEvent.magnitude);
    const dist = haversineKm(v.lat, v.lng, selectedEvent.lat, selectedEvent.lng);
    if (dist <= radius) {
      zoneInfo = `<div style="color:#ef4444;font-weight:600;margin-top:4px">IN IMPACT ZONE — ${Math.round(dist)}km from epicenter</div>`;
    }
  }

  return `
    <div style="font-weight:600;font-size:12px;margin-bottom:3px">${v.name}${priority}</div>
    <div style="opacity:0.7">${typeLabel} · ${speed}${heading ? ' · ' + heading : ''}</div>
    <div style="opacity:0.5;font-size:10px">MMSI ${v.mmsi} · ${v.lat.toFixed(3)}°N ${v.lng.toFixed(3)}°E</div>
    ${zoneInfo}
  `;
}

// ── Layer Factory ─────────────────────────────────────────────

interface TrailDatum {
  path: [number, number][];
}

export function createAisLayers(
  vessels: Vessel[],
  selectedEvent: EarthquakeEvent | null,
): Layer[] {
  if (vessels.length === 0) return [];

  const radius = selectedEvent ? impactRadiusKm(selectedEvent.magnitude) : 0;

  // Precompute impact zone membership for performance
  const inZone = new Set<string>();
  if (selectedEvent && radius > 0) {
    for (const v of vessels) {
      const dist = haversineKm(v.lat, v.lng, selectedEvent.lat, selectedEvent.lng);
      if (dist <= radius) inZone.add(v.mmsi);
    }
  }

  // Trails for moving vessels only
  const trailData: TrailDatum[] = vessels
    .filter((v) => v.trail.length >= 3 && v.sog > 0.5)
    .map((v) => ({ path: v.trail }));

  const trailLayer = new PathLayer<TrailDatum>({
    id: 'ais-trails',
    data: trailData,
    pickable: false,
    widthUnits: 'pixels',
    widthMinPixels: 1,
    getPath: (d) => d.path,
    getColor: TRAIL_COLOR,
    getWidth: 1,
  });

  const vesselLayer = new IconLayer<Vessel>({
    id: 'ais-vessels',
    data: vessels,
    pickable: true,
    autoHighlight: true,
    highlightColor: [125, 211, 252, 200],
    iconAtlas: ICON_URL,
    iconMapping: ICON_MAPPING,
    getIcon: () => 'vessel',
    getPosition: (d) => [d.lng, d.lat],
    getSize: (d) => vesselSize(d.type, inZone.has(d.mmsi)),
    sizeUnits: 'pixels',
    sizeMinPixels: 5,
    getAngle: (d) => 360 - d.cog,
    getColor: (d) => {
      if (inZone.has(d.mmsi)) {
        return isHighPriority(d.type) ? IMPACT_CRITICAL : IMPACT_NORMAL;
      }
      return TYPE_COLORS[d.type] ?? TYPE_COLORS.other;
    },
    updateTriggers: {
      getColor: [selectedEvent?.id],
      getSize: [selectedEvent?.id],
    },
  });

  return [trailLayer, vesselLayer];
}
