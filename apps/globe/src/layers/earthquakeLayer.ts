/**
 * Earthquake Layer — ScatterplotLayer for seismic events.
 *
 * Visual rules:
 * - Size scales with magnitude (exponential)
 * - Color encodes depth: shallow=warm, deep=cool
 * - Recent events pulse (radiusScale animation, virtually free at 60fps)
 * - Selected event gets bright highlight ring
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import type { EarthquakeEvent } from '../types';

// ── Color by depth ─────────────────────────────────────────────

type RGBA = [number, number, number, number];

function depthColor(depth_km: number): RGBA {
  if (depth_km < 30)  return [239, 68, 68, 220];   // shallow: red
  if (depth_km < 70)  return [251, 191, 36, 200];   // mid: amber
  if (depth_km < 150) return [96, 165, 250, 180];   // mid-deep: blue
  if (depth_km < 300) return [125, 211, 252, 160];   // deep: ice blue
  return [148, 163, 184, 140];                       // very deep: slate
}

// ── Magnitude to pixel radius ──────────────────────────────────

function magToRadius(mag: number): number {
  // Exponential scaling: M3=3px, M5=12px, M7=48px, M9=192px
  return Math.max(2, 3 * Math.pow(2, mag - 3));
}

// ── Layer Factory ──────────────────────────────────────────────

export interface EarthquakeLayerOptions {
  events: EarthquakeEvent[];
  selectedId: string | null;
  pulsePhase: number; // 0..1 oscillation for recent events
}

export function createEarthquakeLayer(opts: EarthquakeLayerOptions): ScatterplotLayer<EarthquakeEvent> {
  const { events, selectedId, pulsePhase } = opts;
  const now = Date.now();
  const recentCutoff = now - 6 * 3600_000; // 6 hours

  return new ScatterplotLayer<EarthquakeEvent>({
    id: 'earthquakes',
    data: events,
    pickable: true,
    stroked: true,
    filled: true,
    radiusUnits: 'pixels',
    lineWidthUnits: 'pixels',

    getPosition: (d) => [d.lng, d.lat],

    getRadius: (d) => {
      const base = magToRadius(d.magnitude);
      // Recent events pulse
      if (d.time > recentCutoff) {
        return base * (1 + 0.3 * pulsePhase);
      }
      return base;
    },

    getFillColor: (d) => {
      if (d.id === selectedId) return [125, 211, 252, 255]; // ice blue highlight
      return depthColor(d.depth_km);
    },

    getLineColor: (d) => {
      if (d.id === selectedId) return [125, 211, 252, 255];
      if (d.time > recentCutoff) return [255, 255, 255, 100];
      return [255, 255, 255, 40];
    },

    getLineWidth: (d) => (d.id === selectedId ? 2 : 1),

    updateTriggers: {
      getRadius: [pulsePhase, recentCutoff],
      getFillColor: [selectedId],
      getLineColor: [selectedId, recentCutoff],
      getLineWidth: [selectedId],
    },

    transitions: {
      getRadius: { duration: 150, easing: (t: number) => t },
    },

  });
}
