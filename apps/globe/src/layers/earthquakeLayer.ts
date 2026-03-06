/**
 * Earthquake Layer — ScatterplotLayer for seismic events.
 *
 * Performance rules (deck.gl official guidance):
 * - data ref must be STABLE — same array object when data hasn't changed
 * - accessors (getRadius, getColor) must NOT depend on animation state
 * - animation uses radiusScale (uniform prop, ~0 cost at 60fps)
 * - updateTriggers only fire on real data changes (selectedId, data swap)
 *
 * Visual rules:
 * - Size scales with magnitude — AREA proportional to seismic energy
 *   Energy: E ∝ 10^(1.5M)  →  radius ∝ 10^(0.75M)
 *   Reference: Kanamori (1977), USGS map conventions
 * - Color encodes depth: shallow=warm, deep=cool (USGS/IRIS convention)
 * - Selected event: bright ice blue highlight ring
 *
 * See docs/current/VISUALIZATION-STANDARDS.md §1 for full rationale.
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '../types';

type RGBA = [number, number, number, number];

function depthColor(depth_km: number): RGBA {
  if (depth_km < 30)  return [239, 68, 68, 220];   // shallow: red
  if (depth_km < 70)  return [251, 191, 36, 200];   // mid: amber
  if (depth_km < 150) return [96, 165, 250, 180];   // mid-deep: blue
  if (depth_km < 300) return [125, 211, 252, 160];   // deep: ice blue
  return [148, 163, 184, 140];                       // very deep: slate
}

// ── Magnitude → radius (cube-root-of-energy scaling) ────────
//
// Seismic energy: E ∝ 10^(1.5M)  (Kanamori 1977)
// Full energy-proportional (radius ∝ 10^0.75M) is too extreme for
// visualization — M5 would be 32× larger than M3, filling the screen.
//
// Standard cartographic compression (Bertin 1967): apply cube root
// to the energy ratio, giving area ∝ E^(1/3) = 10^(0.5M).
// This means: radius ∝ 10^(0.25M).
//
// Result: each magnitude step ≈ 1.78× radius increase (vs 5.6× raw).
// Consistent with USGS/EMSC/JMA map circle conventions.
//
// See docs/current/VISUALIZATION-STANDARDS.md §1.
const MAG_REF = 3;
const MAG_BASE_PX = 3;
const MAG_RADIUS_MIN = 3;
const MAG_RADIUS_MAX = 55;

function magToRadius(mag: number): number {
  const r = MAG_BASE_PX * Math.pow(10, 0.25 * (mag - MAG_REF));
  return Math.max(MAG_RADIUS_MIN, Math.min(MAG_RADIUS_MAX, r));
}

/**
 * Ambient glow radius — 1.6× the dot radius, same scaling curve.
 */
const GLOW_SCALE = 1.6;
const GLOW_RADIUS_MIN = 6;

function ambientGlowRadius(mag: number): number {
  const r = MAG_BASE_PX * GLOW_SCALE * Math.pow(10, 0.25 * (mag - MAG_REF));
  return Math.max(GLOW_RADIUS_MIN, Math.min(MAG_RADIUS_MAX * GLOW_SCALE, r));
}

function ambientGlowAlpha(event: EarthquakeEvent): number {
  const ageMs = Date.now() - event.time;
  const ageHours = ageMs / 3600_000;
  if (ageHours > 24) return 0;
  // Fade from 40 to 0 over 24 hours
  return Math.round(40 * Math.max(0, 1 - ageHours / 24));
}

export function createEarthquakeLayer(
  events: EarthquakeEvent[],
  selectedId: string | null,
  radiusScale: number = 1,
): ScatterplotLayer<EarthquakeEvent> {
  return new ScatterplotLayer<EarthquakeEvent>({
    id: 'earthquakes',
    data: events,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 100],
    stroked: true,
    filled: true,
    radiusUnits: 'pixels',
    lineWidthUnits: 'pixels',
    radiusMinPixels: MAG_RADIUS_MIN,
    radiusMaxPixels: MAG_RADIUS_MAX,
    // radiusScale animated by compositor for calm pulse — uniform prop, ~0 GPU cost
    radiusScale,

    getPosition: (d) => [d.lng, d.lat],
    getRadius: (d) => magToRadius(d.magnitude),

    getFillColor: (d) => {
      if (d.id === selectedId) return [125, 211, 252, 255];
      return depthColor(d.depth_km);
    },

    getLineColor: (d) => {
      if (d.id === selectedId) return [125, 211, 252, 255];
      return [255, 255, 255, 50];
    },

    getLineWidth: (d) => (d.id === selectedId ? 2.5 : 0.5),

    // CRITICAL: only trigger GPU buffer rebuild on actual data changes
    updateTriggers: {
      getFillColor: [selectedId],
      getLineColor: [selectedId],
      getLineWidth: [selectedId],
    },
  });
}

/**
 * Age decay ring layer — subtle outer rings encoding event age.
 * Recent events get tight bright rings; older events get wider, dimmer rings.
 * Makes the temporal dimension visible on the map.
 * Only shows events within the last 72 hours.
 */
export function createEarthquakeAgeRingLayer(
  events: EarthquakeEvent[],
): Layer | null {
  const now = Date.now();
  const cutoff72h = now - 72 * 3600_000;
  const recent = events.filter((e) => e.time > cutoff72h);
  if (recent.length === 0) return null;

  function ageRingRadius(ageHours: number): number {
    if (ageHours < 1) return 8;
    if (ageHours < 6) return 12;
    if (ageHours < 24) return 18;
    return 24;
  }

  function ageRingAlpha(ageHours: number): number {
    if (ageHours < 1) return 60;
    if (ageHours < 6) return 40;
    if (ageHours < 24) return 25;
    return 12;
  }

  return new ScatterplotLayer<EarthquakeEvent>({
    id: 'earthquake-age-rings',
    data: recent,
    pickable: false,
    stroked: true,
    filled: false,
    radiusUnits: 'pixels',
    lineWidthUnits: 'pixels',
    lineWidthMinPixels: 1,
    getPosition: (d) => [d.lng, d.lat],
    getRadius: (d) => {
      const ageHours = (now - d.time) / 3600_000;
      return ageRingRadius(ageHours);
    },
    getLineColor: (d) => {
      const ageHours = (now - d.time) / 3600_000;
      return [255, 255, 255, ageRingAlpha(ageHours)];
    },
    getLineWidth: 1,
    updateTriggers: {
      getRadius: [events.length],
      getLineColor: [events.length],
    },
  });
}

/**
 * Ambient glow layer — faint halos around recent events.
 * Makes the map feel alive even in calm mode.
 * Only shows events < 24h old with M >= 3.5.
 */
export function createEarthquakeGlowLayer(
  events: EarthquakeEvent[],
): Layer | null {
  const recent = events.filter((e) => {
    const age = Date.now() - e.time;
    return age < 86400_000 && e.magnitude >= 3.5;
  });
  if (recent.length === 0) return null;

  return new ScatterplotLayer<EarthquakeEvent>({
    id: 'earthquake-glow',
    data: recent,
    pickable: false,
    stroked: false,
    filled: true,
    radiusUnits: 'pixels',
    radiusMinPixels: GLOW_RADIUS_MIN,
    radiusMaxPixels: Math.round(MAG_RADIUS_MAX * GLOW_SCALE),
    getPosition: (d) => [d.lng, d.lat],
    getRadius: (d) => ambientGlowRadius(d.magnitude),
    getFillColor: (d) => {
      const color = depthColor(d.depth_km);
      const alpha = ambientGlowAlpha(d);
      return [color[0], color[1], color[2], alpha];
    },
    updateTriggers: {
      getFillColor: [events.length],
    },
  });
}
