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
import type { EarthquakeEvent, FaultType } from '../types';
import { computeGmpe } from '../engine/gmpe';
import { isHighPriorityVessel } from '../ops/maritimeTelemetry';
import type { ViewportState } from '../core/viewportManager';

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

/**
 * Compute the impact zone radius using binary search over the
 * Si & Midorikawa (1999) GMPE equation.
 *
 * Impact zone defined as the area where Si & Midorikawa (1999) predicts
 * JMA instrumental intensity >= 3.5 (JMA seismic intensity scale 4),
 * the threshold at which structural damage to buildings begins.
 * Reference: JMA seismic intensity scale classification,
 * Cabinet Office 被害想定.
 */
function impactRadiusKm(
  mag: number,
  depth_km: number = 20,
  faultType: FaultType = 'crustal',
): number {
  const JMA_THRESHOLD = 3.5;
  let lo = 1;
  let hi = 800;

  for (let i = 0; i < 25; i++) {
    const mid = (lo + hi) / 2;
    const hypoDist = Math.sqrt(mid * mid + depth_km * depth_km);
    const result = computeGmpe({
      Mw: mag,
      depth_km,
      distance_km: hypoDist,
      faultType,
    });
    if (result.jmaIntensity >= JMA_THRESHOLD) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return (lo + hi) / 2;
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

  const radius = impactRadiusKm(selectedEvent.magnitude, selectedEvent.depth_km, selectedEvent.faultType);
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
  const priority = isHighPriorityVessel(v.type) ? ' — HIGH PRIORITY' : '';

  let zoneInfo = '';
  if (selectedEvent) {
    const radius = impactRadiusKm(selectedEvent.magnitude, selectedEvent.depth_km, selectedEvent.faultType);
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

function expandBounds(
  bounds: ViewportState['bounds'],
  paddingDeg: number,
): ViewportState['bounds'] {
  return [
    bounds[0] - paddingDeg,
    bounds[1] - paddingDeg,
    bounds[2] + paddingDeg,
    bounds[3] + paddingDeg,
  ];
}

function boundsPaddingForTier(viewport: ViewportState): number {
  switch (viewport.tier) {
    case 'national': return 2.5;
    case 'regional': return 1.2;
    case 'city': return 0.5;
    case 'district': return 0.2;
  }
}

export function filterVisibleVessels(
  vessels: Vessel[],
  viewport: ViewportState,
): Vessel[] {
  const [west, south, east, north] = expandBounds(viewport.bounds, boundsPaddingForTier(viewport));
  return vessels.filter((vessel) =>
    vessel.lng >= west &&
    vessel.lng <= east &&
    vessel.lat >= south &&
    vessel.lat <= north,
  );
}

export function createAisLayers(
  vessels: Vessel[],
  selectedEvent: EarthquakeEvent | null,
  viewport?: ViewportState,
): Layer[] {
  const renderVessels = viewport ? filterVisibleVessels(vessels, viewport) : vessels;
  if (renderVessels.length === 0) return [];

  const radius = selectedEvent ? impactRadiusKm(selectedEvent.magnitude, selectedEvent.depth_km, selectedEvent.faultType) : 0;

  // Precompute impact zone membership for performance
  const inZone = new Set<string>();
  if (selectedEvent && radius > 0) {
    for (const v of renderVessels) {
      const dist = haversineKm(v.lat, v.lng, selectedEvent.lat, selectedEvent.lng);
      if (dist <= radius) inZone.add(v.mmsi);
    }
  }

  // Trails for moving vessels only
  const trailData: TrailDatum[] = renderVessels
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
    data: renderVessels,
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
        return isHighPriorityVessel(d.type) ? IMPACT_CRITICAL : IMPACT_NORMAL;
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
