/**
 * Impact Zone Visual Heuristics — Shared geographic calculations for layer modules.
 *
 * These helpers are visual-only heuristics.
 * They are useful for map emphasis, but they are not the final source of
 * operator queue text or backend-owned consequence truth.
 */

import type { EarthquakeEvent } from '../types';

export interface VisualImpactHeuristic {
  source: 'visual-heuristic';
  algorithm: 'magnitude-radius';
  radiusKm: number;
  reason: string;
}

export function impactRadiusKm(magnitude: number): number {
  return 30 * Math.pow(2, magnitude - 4);
}

export function buildVisualImpactHeuristic(
  event: EarthquakeEvent | null,
): VisualImpactHeuristic | null {
  if (!event) {
    return null;
  }

  const radiusKm = impactRadiusKm(event.magnitude);
  return {
    source: 'visual-heuristic',
    algorithm: 'magnitude-radius',
    radiusKm,
    reason: `Magnitude-radius heuristic for ${event.place.text}`,
  };
}

export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
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

export function isInImpactZone(
  lat: number,
  lng: number,
  event: EarthquakeEvent | null,
): boolean {
  if (!event) return false;
  const radius = impactRadiusKm(event.magnitude);
  return haversineKm(lat, lng, event.lat, event.lng) <= radius;
}

export function distanceToEpicenterKm(
  lat: number,
  lng: number,
  event: EarthquakeEvent,
): number {
  return haversineKm(lat, lng, event.lat, event.lng);
}
